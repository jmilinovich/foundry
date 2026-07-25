/**
 * Matching a taste profile to fonts that already exist.
 *
 * The quiz used to end at a CTA: here's your profile, now spend $1.60. That
 * made the profile a receipt rather than a result. This module is the other
 * half — given the same votes, name real typefaces the person would like, from
 * two libraries with opposite virtues:
 *
 *   Google Fonts    real, free, installable this afternoon. Hand-tagged into
 *                   this genome by the authoring pass, so a match is a claim
 *                   somebody stands behind rather than a string similarity.
 *   the Foundry atlas  the frozen pregenerated library. Nothing like it exists
 *                   anywhere else, and each one can be bred further.
 *
 * The whole thing is arithmetic over ordinal axes. No model runs here, in
 * development or in production: the same votes always produce the same six
 * fonts in the same order, which is what makes the result shareable.
 */

import {
  CATEGORY,
  CONTRAST,
  TERMINALS,
  WEIGHT,
  WIDTH,
  type Genome,
} from './genome';
import type { AtlasEntry, TasteProfile } from './taste';

/** Ordinal axes worth matching on, with the ordering used to measure distance. */
const AXIS_VALUES = {
  category: CATEGORY,
  weight: WEIGHT,
  width: WIDTH,
  contrast: CONTRAST,
  terminals: TERMINALS,
} as const;

export type MatchAxis = keyof typeof AXIS_VALUES;

/**
 * What each axis is worth.
 *
 * `category` dominates because it is what a person sees first and what they
 * would name if asked; getting it wrong makes every other axis irrelevant.
 * `terminals` is last because at recommendation sizes almost nobody perceives
 * it directly — it works on you without being noticed.
 */
const AXIS_WEIGHT: Record<MatchAxis, number> = {
  category: 3.0,
  contrast: 1.6,
  weight: 1.3,
  width: 1.2,
  terminals: 0.9,
};
const MOOD_WEIGHT = 1.5;
const ERA_WEIGHT = 0.7;

/**
 * The profile as a point in genome space.
 *
 * Each axis collapses to a *fractional* index — the weighted mean of the values
 * voted for. Fractional matters: someone who split evenly between grotesque
 * (index 2) and humanist sans (index 3) lands at 2.5, and the nearest real font
 * to 2.5 is a better answer than either mode alone.
 */
export type TasteVector = {
  axis: Partial<Record<MatchAxis, number>>;
  moods: Record<string, number>;
  eras: Record<string, number>;
};

export function profileToVector(profile: TasteProfile): TasteVector {
  const axis: TasteVector['axis'] = {};

  for (const ax of Object.keys(AXIS_VALUES) as MatchAxis[]) {
    const tally = profile.axis[ax];
    const values = AXIS_VALUES[ax] as readonly string[];
    let num = 0;
    let den = 0;
    for (const [v, w] of Object.entries(tally ?? {})) {
      const i = values.indexOf(v);
      if (i < 0) continue; // unknown value: no signal rather than a wrong one
      num += i * w;
      den += w;
    }
    if (den > 0) axis[ax] = num / den;
  }

  return { axis, moods: normalise(profile.moods), eras: normalise(profile.eras) };
}

function normalise(tally: Record<string, number>): Record<string, number> {
  const total = Object.values(tally).reduce((s, n) => s + n, 0);
  if (!total) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(tally)) out[k] = v / total;
  return out;
}

/** Per-axis closeness, 0..1, for explaining a match as well as scoring it. */
export type MatchDetail = { axis: MatchAxis; closeness: number; value: string };

export type Match<T> = {
  item: T;
  /** 0..1, higher is better. */
  score: number;
  /** The axes this font gets *right*, best first — the reason to show it. */
  strengths: MatchDetail[];
};

/**
 * Distance from the profile to one genome.
 *
 * Axes the quiz never gathered evidence on are skipped rather than treated as
 * zero — an unprobed axis should not push a font away.
 */
export function scoreGenome(vec: TasteVector, g: Genome): { score: number; strengths: MatchDetail[] } {
  let weighted = 0;
  let total = 0;
  const details: MatchDetail[] = [];

  for (const ax of Object.keys(AXIS_VALUES) as MatchAxis[]) {
    const target = vec.axis[ax];
    if (target === undefined) continue;
    const values = AXIS_VALUES[ax] as readonly string[];
    const idx = values.indexOf(g[ax] as string);
    if (idx < 0) continue;
    const span = values.length - 1 || 1;
    const closeness = 1 - Math.abs(target - idx) / span;
    const w = AXIS_WEIGHT[ax];
    weighted += closeness * w;
    total += w;
    details.push({ axis: ax, closeness, value: g[ax] as string });
  }

  // Mood is a set, not a scale: credit the share of the profile's mood mass
  // that this font's two moods actually cover.
  if (Object.keys(vec.moods).length) {
    const cover = g.mood.reduce((s, m) => s + (vec.moods[m] ?? 0), 0);
    // Two moods can cover at most the top two shares; scale so a perfect hit ~1.
    const best = Object.values(vec.moods).sort((a, b) => b - a).slice(0, 2).reduce((s, n) => s + n, 0);
    weighted += (best > 0 ? Math.min(cover / best, 1) : 0) * MOOD_WEIGHT;
    total += MOOD_WEIGHT;
  }

  if (Object.keys(vec.eras).length) {
    const top = Math.max(...Object.values(vec.eras));
    const cover = vec.eras[g.era] ?? 0;
    weighted += (top > 0 ? cover / top : 0) * ERA_WEIGHT;
    total += ERA_WEIGHT;
  }

  return { score: total > 0 ? weighted / total : 0, strengths: details.sort((a, b) => b.closeness - a.closeness) };
}

/**
 * Rank a library, then thin it out.
 *
 * Straight top-N is a bad recommendation set: the six nearest fonts to a point
 * are usually six versions of the same idea, and the person learns nothing. So
 * after ranking we take greedily, skipping anything too close to something
 * already taken. `spread` is the minimum genome distance between picks.
 */
/**
 * How many specialist faces may appear in one set of recommendations.
 *
 * A script and a geometric sans can occupy nearly the same point in genome
 * space — both monoline, light, round — so pure nearest-neighbour puts a
 * ballpoint handwriting face in a list for somebody who spent twelve rounds
 * picking Swiss grotesques. These caps encode what the genome can't: a
 * recommendation is for *use*, and most people need something they can set a
 * paragraph in. Specialists still surface, but they have to earn the slot.
 */
const KIND_CAP: Record<string, number> = { script: 1, display: 2, mono: 1 };

export function recommend<T extends { genome: Genome; kind?: string }>(
  vec: TasteVector,
  library: T[],
  count: number,
  spread = 0.13,
): Match<T>[] {
  const ranked = library
    .map((item) => {
      const { score, strengths } = scoreGenome(vec, item.genome);
      return { item, score, strengths };
    })
    .sort((a, b) => b.score - a.score);

  const used: Record<string, number> = {};
  const taken: Match<T>[] = [];

  const admissible = (cand: Match<T>) => {
    const kind = cand.item.kind;
    if (!kind || kind === 'text') return true;
    const cap = KIND_CAP[kind];
    if (cap === undefined) return true;
    return (used[kind] ?? 0) < cap;
  };

  const take = (cand: Match<T>) => {
    const kind = cand.item.kind;
    if (kind && kind !== 'text') used[kind] = (used[kind] ?? 0) + 1;
    taken.push(cand);
  };

  for (const cand of ranked) {
    if (taken.length >= count) break;
    if (!admissible(cand)) continue;
    if (taken.some((t) => genomeDistance(t.item.genome, cand.item.genome) < spread)) continue;
    take(cand);
  }
  // Relax diversity before relaxing the caps: two similar text faces are a
  // better answer than a script nobody asked for.
  for (const cand of ranked) {
    if (taken.length >= count) break;
    if (taken.includes(cand) || !admissible(cand)) continue;
    take(cand);
  }
  // Last resort, so the list is never short.
  for (const cand of ranked) {
    if (taken.length >= count) break;
    if (!taken.includes(cand)) take(cand);
  }
  return taken;
}

/** Normalised ordinal distance between two genomes over the match axes. */
export function genomeDistance(a: Genome, b: Genome): number {
  let sum = 0;
  let total = 0;
  for (const ax of Object.keys(AXIS_VALUES) as MatchAxis[]) {
    const values = AXIS_VALUES[ax] as readonly string[];
    const ia = values.indexOf(a[ax] as string);
    const ib = values.indexOf(b[ax] as string);
    if (ia < 0 || ib < 0) continue;
    const span = values.length - 1 || 1;
    sum += (Math.abs(ia - ib) / span) * AXIS_WEIGHT[ax];
    total += AXIS_WEIGHT[ax];
  }
  return total ? sum / total : 0;
}

// ---------------------------------------------------------------------------
// Libraries
// ---------------------------------------------------------------------------

export type GoogleFont = {
  family: string;
  genome: Genome;
  mono: boolean;
  /** Google's own classification, mapped: text | display | script | mono. */
  kind?: 'text' | 'display' | 'script' | 'mono';
  popularity?: number;
  staticWeights: number[];
  /** One lowercase clause naming what a person would actually notice. */
  why: string;
  pairsWith: string;
};

/** The Google Fonts CSS2 URL for a family at the weights we intend to show. */
export function googleCssUrl(font: GoogleFont, weights: number[] = [400, 700]): string {
  const wanted = weights.filter((w) => font.staticWeights.includes(w));
  const list = (wanted.length ? wanted : [font.staticWeights[0] ?? 400]).join(';');
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family).replace(
    /%20/g,
    '+',
  )}:wght@${list}&display=swap`;
}

export function googleSpecimenUrl(font: GoogleFont): string {
  return `https://fonts.google.com/specimen/${font.family.replace(/\s+/g, '+')}`;
}

/** Atlas entries carry a genome already, so they drop straight into recommend(). */
export type AtlasMatch = Match<AtlasEntry>;
export type GoogleMatch = Match<GoogleFont>;
