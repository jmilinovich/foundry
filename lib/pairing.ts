/**
 * Finding a partner for a face among type that already exists.
 *
 * Pairing used to have exactly one implementation: mint six new faces and judge
 * them, $1.20 and half a minute. That made the catalog browsable but not
 * usable — a visitor could look at 201 typefaces and never get an answer to the
 * only question they actually have, which is what to set the body copy in.
 *
 * Everything needed to answer it for free was already here. `STANCE_RULES` in
 * genome.ts states, per axis, whether a good partner should harmonize with the
 * locked face, contrast against it, or ignore it. Generation samples those
 * rules through an rng. Matching reads them directly: score every known face on
 * how well it satisfies the same relations, and rank. 350 candidates, no model,
 * no network, no spend, and the same locked face always returns the same list.
 *
 * Breeding is still there for when nothing in 350 fits, which is a much better
 * thing to sell than the only way to see a pair at all.
 */

import {
  CATEGORY,
  CONTRAST,
  CORNER,
  ERA,
  TERMINALS,
  TEXTURE,
  WEIGHT,
  WIDTH,
  XHEIGHT,
  type Genome,
  type Slot,
  type Stance,
} from './genome';
import type { GoogleFont } from './recommend';
import type { AtlasEntry } from './taste';

/**
 * The axes a partner is judged on, and what each is worth.
 *
 * Mirrors recommend.ts: category dominates because it is what anyone would name
 * first, and terminals sits last because at reading size it works on you
 * without being noticed. The three axes generation treats as texture rather
 * than structure — corner, texture, era — carry little, but they are what
 * separates two otherwise identical grotesques.
 */
const AXES = {
  category: CATEGORY,
  weight: WEIGHT,
  width: WIDTH,
  contrast: CONTRAST,
  terminals: TERMINALS,
  xheight: XHEIGHT,
  corner: CORNER,
  texture: TEXTURE,
  era: ERA,
} as const;

type PairAxis = keyof typeof AXES;

const WEIGHTS: Record<PairAxis, number> = {
  category: 3.0,
  contrast: 1.6,
  weight: 1.3,
  width: 1.2,
  terminals: 0.9,
  xheight: 1.1,
  corner: 0.5,
  texture: 0.5,
  era: 0.7,
};

const MOOD_WEIGHT = 1.4;

/**
 * Per-axis intent, restated from genome.ts STANCE_RULES.
 *
 * Deliberately a copy rather than an import: those rules describe how to *draw*
 * a partner and are consumed by an rng, while these describe how to *recognise*
 * one. They agree today, and pairing.test.ts asserts they keep agreeing, but
 * they are answering different questions and should be free to diverge.
 */
type Relation = 'harmonize' | 'contrast' | 'free';

const INTENT: Record<Stance, Record<PairAxis | 'mood', Relation>> = {
  classic: {
    category: 'contrast',
    weight: 'contrast',
    contrast: 'contrast',
    terminals: 'free',
    width: 'harmonize',
    xheight: 'harmonize',
    corner: 'harmonize',
    texture: 'harmonize',
    era: 'harmonize',
    mood: 'harmonize',
  },
  superfamily: {
    category: 'harmonize',
    weight: 'harmonize',
    contrast: 'harmonize',
    terminals: 'harmonize',
    width: 'harmonize',
    xheight: 'harmonize',
    corner: 'harmonize',
    texture: 'harmonize',
    era: 'harmonize',
    mood: 'harmonize',
  },
  tension: {
    category: 'contrast',
    weight: 'contrast',
    contrast: 'contrast',
    terminals: 'contrast',
    width: 'contrast',
    xheight: 'harmonize',
    corner: 'contrast',
    texture: 'contrast',
    era: 'free',
    mood: 'free',
  },
};

/**
 * What a text face may not be, restated from constrainForText.
 *
 * These are the genes that are gorgeous at 96px and unreadable at 16px. In
 * generation they are clamped; a candidate that already exists cannot be
 * clamped, so it is simply not a body face and does not belong in the list.
 */
const TEXT_LIMITS: Partial<Record<PairAxis, [number, number]>> = {
  weight: [2, 5], // light … semibold
  width: [2, 4], // narrow … wide
  contrast: [0, 3], // monoline … moderate
  xheight: [2, 4], // normal … very large
  texture: [0, 1], // clean … lightly inked
};

export function readableAsText(g: Genome): boolean {
  for (const [ax, [lo, hi]] of Object.entries(TEXT_LIMITS) as [PairAxis, [number, number]][]) {
    const i = (AXES[ax] as readonly string[]).indexOf(g[ax] as string);
    if (i < 0 || i < lo || i > hi) return false;
  }
  return true;
}

/** 0 = same value, 1 = opposite ends of the axis. */
function axisDistance(ax: PairAxis, a: Genome, b: Genome): number | null {
  const values = AXES[ax] as readonly string[];
  const ia = values.indexOf(a[ax] as string);
  const ib = values.indexOf(b[ax] as string);
  if (ia < 0 || ib < 0) return null;
  return Math.abs(ia - ib) / (values.length - 1 || 1);
}

export type AxisVerdict = { axis: PairAxis | 'mood'; relation: Relation; satisfaction: number };

/**
 * How well `candidate` answers `locked` under a stance, from 0 to 1.
 *
 * A harmonized axis scores for being near, a contrasted axis for being far, and
 * a free axis is not scored at all rather than being scored as neutral — a
 * stance that does not care about terminals should not dilute the result with
 * an axis worth half a point either way.
 */
export function scorePartner(
  locked: Genome,
  candidate: Genome,
  stance: Stance,
): { score: number; axes: AxisVerdict[] } {
  const intent = INTENT[stance];
  let sum = 0;
  let total = 0;
  const axes: AxisVerdict[] = [];

  for (const ax of Object.keys(AXES) as PairAxis[]) {
    const relation = intent[ax];
    if (relation === 'free') continue;
    const d = axisDistance(ax, locked, candidate);
    if (d === null) continue;
    const satisfaction = relation === 'contrast' ? d : 1 - d;
    const w = WEIGHTS[ax];
    sum += satisfaction * w;
    total += w;
    axes.push({ axis: ax, relation, satisfaction });
  }

  if (intent.mood !== 'free') {
    const shared = candidate.mood.filter((m) => locked.mood.includes(m)).length;
    const satisfaction =
      intent.mood === 'harmonize' ? Math.min(1, shared / 1) : 1 - Math.min(1, shared / 1);
    sum += satisfaction * MOOD_WEIGHT;
    total += MOOD_WEIGHT;
    axes.push({ axis: 'mood', relation: intent.mood, satisfaction });
  }

  return { score: total ? sum / total : 0, axes };
}

const LABEL: Record<PairAxis | 'mood', { harmonize: string; contrast: string }> = {
  category: { harmonize: 'the same family of shapes', contrast: 'a different skeleton' },
  weight: { harmonize: 'the same colour on the page', contrast: 'a clear step in weight' },
  width: { harmonize: 'the same proportions', contrast: 'a different set width' },
  contrast: { harmonize: 'the same stroke modulation', contrast: 'opposite stroke modulation' },
  terminals: { harmonize: 'matching terminals', contrast: 'terminals cut the other way' },
  xheight: { harmonize: 'a matching x-height', contrast: 'a different x-height' },
  corner: { harmonize: 'the same corner treatment', contrast: 'corners handled differently' },
  texture: { harmonize: 'the same surface', contrast: 'a different surface' },
  era: { harmonize: 'the same period', contrast: 'a different period' },
  mood: { harmonize: 'a shared voice', contrast: 'a deliberately different voice' },
};

/**
 * The two axes this match actually wins on, said plainly. No model.
 *
 * Ranked by CONTRIBUTION, not by satisfaction. Sorting on satisfaction alone
 * read well and said nothing: nearly every face is crisp-cornered and
 * clean-surfaced, so those two axes scored a perfect 1.0 on almost every pair
 * and "the same corner treatment, the same surface" became the explanation for
 * the entire list. Multiplying by the axis weight surfaces the reasons a person
 * would actually give — the skeleton, the colour, the modulation.
 */
export function explainMatch(axes: AxisVerdict[]): string {
  const weightOf = (a: AxisVerdict) => (a.axis === 'mood' ? MOOD_WEIGHT : WEIGHTS[a.axis]);
  const best = [...axes]
    .filter((a) => a.satisfaction >= 0.6)
    .sort((a, b) => b.satisfaction * weightOf(b) - a.satisfaction * weightOf(a))
    .slice(0, 2);
  if (best.length === 0) return 'a loose fit on every axis';
  return best.map((a) => LABEL[a.axis][a.relation === 'contrast' ? 'contrast' : 'harmonize']).join(', ');
}

export type Partner = {
  source: 'house' | 'google';
  /** Atlas slug, or Google family name. */
  id: string;
  name: string;
  genome: Genome;
  score: number;
  why: string;
  /** Google only: the weights actually available to render with. */
  staticWeights?: number[];
};

/**
 * The ranked partners for a face, across both libraries.
 *
 * Google families and house faces compete on one list rather than in separate
 * sections. They are genuinely different offers — one is installable this
 * afternoon, the other exists nowhere else — but which is the better *pairing*
 * is a question about the type, and splitting them would answer a question
 * nobody asked at the cost of hiding the best match below a fold.
 */
export function findPartners(
  locked: Genome,
  opts: {
    slot: Slot;
    stance: Stance;
    house: AtlasEntry[];
    google: GoogleFont[];
    limit?: number;
    /** The atlas slug being paired, so a face is never offered against itself. */
    excludeSlug?: string;
  },
): Partner[] {
  const { slot, stance, house, google, limit = 6, excludeSlug } = opts;
  const out: Partner[] = [];

  for (const e of house) {
    if (e.slug === excludeSlug) continue;
    if (slot === 'text' && !readableAsText(e.genome)) continue;
    const { score, axes } = scorePartner(locked, e.genome, stance);
    out.push({
      source: 'house',
      id: e.slug,
      name: e.name,
      genome: e.genome,
      score,
      why: explainMatch(axes),
    });
  }

  for (const f of google) {
    // A display, script or mono face is not body copy, whatever its genome
    // says. Mono in particular scored well and read terribly: Courier Prime
    // came back as the best partner for a didone, because on the axes it is
    // measured on it genuinely is close. Nobody sets a paragraph in it to sit
    // under a display serif.
    if (slot === 'text' && f.kind !== 'text') continue;
    if (slot === 'text' && !readableAsText(f.genome)) continue;
    const { score, axes } = scorePartner(locked, f.genome, stance);
    out.push({
      source: 'google',
      id: f.family,
      name: f.family,
      genome: f.genome,
      score,
      why: explainMatch(axes),
      staticWeights: f.staticWeights,
    });
  }

  return out
    // Ties broken by name so the same input always yields the same order —
    // the list is linkable and must not reshuffle between two loads.
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}
