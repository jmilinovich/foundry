/**
 * The read.
 *
 * A verdict on your taste, in the register of someone who looks at type for a
 * living. Four moves: name what you are, name the contradiction in it, cite the
 * evidence, land it.
 *
 * Nothing here calls a model. The sentences were authored once and ship as
 * static JSON; this module only *chooses* among them, and every choice is a
 * pure function of the votes. That is a hard product requirement, not an
 * optimisation — a shared link has to render the same verdict for the person
 * who sent it and the person who opens it, forever, and it has to render in
 * milliseconds without a key or a network call.
 *
 * The evidence sentence is the one part that is computed rather than chosen,
 * from `profile.decisive` — so "seven times out of nine" is arithmetic, never a
 * flourish.
 */

import { CATEGORY, CONTRAST, TERMINALS, WEIGHT, WIDTH } from './genome';
import bank from './data/read-bank.json';
import { profileSeed } from './profileCode';
import { QUIZ_AXES, type QuizAxis, type TasteProfile } from './taste';

// ---------------------------------------------------------------------------
// The authored bank
// ---------------------------------------------------------------------------

export type Clause = { label: string; clause: string; reads: string };
export type ReadBank = {
  /**
   * The verdict: four to nine words, keyed the same way as the opener.
   *
   * Every opener is one ~28-word sentence, which set as the page H1 came to
   * eight lines of display type on a phone before the reader got anything, and
   * was what the share card truncated. The verdict carries the headline and the
   * OG card; the sentence it belongs to becomes the first line of the read.
   * Both are constrained the same way — they may lean on the category family
   * and the mood, and on nothing else.
   */
  verdicts: Record<string, string>;
  openers: Record<string, string[]>;
  tensions: Record<string, string[]>;
  closers: Record<string, string[]>;
  clauses: Record<string, Record<string, Clause>>;
};

const BANK = bank as unknown as ReadBank;

const AXIS_VALUES: Record<QuizAxis, readonly string[]> = {
  category: CATEGORY,
  weight: WEIGHT,
  width: WIDTH,
  contrast: CONTRAST,
  terminals: TERMINALS,
};

/**
 * Category families. The 11 categories are a fine-grained scale for matching but
 * too fine to write 11 distinct characters for, so the read groups them.
 */
const FAMILY_OF = [
  'geometric', 'neogrotesque', 'grotesque', 'humanist-sans', 'flared',
  'wedge', 'humanist-serif', 'transitional', 'oldstyle', 'didone', 'slab',
] as const;
export type CategoryFamily = (typeof FAMILY_OF)[number];

const MOOD_CLUSTER: Record<string, string> = {
  clinical: 'cool', severe: 'cool', utilitarian: 'cool', mechanical: 'cool',
  warm: 'warm', literary: 'warm', botanical: 'warm', nostalgic: 'warm',
  brutalist: 'loud', industrial: 'loud', psychedelic: 'loud', playful: 'loud',
  elegant: 'refined', editorial: 'refined', ecclesiastical: 'refined',
  futuristic: 'forward',
};

// ---------------------------------------------------------------------------
// Reading the profile
// ---------------------------------------------------------------------------

const topOf = (tally: Record<string, number>): [string, number] | null => {
  const e = Object.entries(tally ?? {}).sort((a, b) => b[1] - a[1])[0];
  return e ?? null;
};

/** Weighted mean position on an axis, 0..len-1, or null if never voted on. */
export function meanIndex(profile: TasteProfile, ax: QuizAxis): number | null {
  const values = AXIS_VALUES[ax];
  let num = 0;
  let den = 0;
  for (const [v, w] of Object.entries(profile.axis[ax] ?? {})) {
    const i = values.indexOf(v);
    if (i < 0) continue;
    num += i * w;
    den += w;
  }
  return den > 0 ? num / den : null;
}

export function dominantCategory(profile: TasteProfile): string | null {
  return topOf(profile.axis.category)?.[0] ?? null;
}

export function categoryFamily(profile: TasteProfile): CategoryFamily {
  const dom = dominantCategory(profile);
  const i = dom ? CATEGORY.indexOf(dom as (typeof CATEGORY)[number]) : -1;
  if (i >= 0) return FAMILY_OF[i];
  const mean = meanIndex(profile, 'category');
  return FAMILY_OF[mean === null ? 3 : Math.round(mean)] ?? 'humanist-sans';
}

export function moodCluster(profile: TasteProfile): string {
  const totals: Record<string, number> = {};
  for (const [m, w] of Object.entries(profile.moods ?? {})) {
    const c = MOOD_CLUSTER[m];
    if (c) totals[c] = (totals[c] ?? 0) + w;
  }
  return topOf(totals)?.[0] ?? 'cool';
}

/** Share of category votes that went to sans (index ≤ 4) vs serif. */
function serifSplit(profile: TasteProfile): { sans: number; serif: number } {
  let sans = 0;
  let serif = 0;
  for (const [v, w] of Object.entries(profile.axis.category ?? {})) {
    const i = CATEGORY.indexOf(v as (typeof CATEGORY)[number]);
    if (i < 0) continue;
    if (i <= 4) sans += w;
    else serif += w;
  }
  const total = sans + serif || 1;
  return { sans: sans / total, serif: serif / total };
}

const moodShare = (profile: TasteProfile, moods: string[]) => {
  const total = Object.values(profile.moods ?? {}).reduce((s, n) => s + n, 0) || 1;
  return moods.reduce((s, m) => s + (profile.moods?.[m] ?? 0), 0) / total;
};

/**
 * Find the contradiction.
 *
 * This is the move that makes the read feel observed rather than generated, so
 * the specific patterns are checked before the structural ones, and the honest
 * "no contradiction" answer is a real outcome rather than a failure.
 */
export function detectTension(profile: TasteProfile): string {
  const { sans, serif } = serifSplit(profile);
  const w = meanIndex(profile, 'weight');
  const wd = meanIndex(profile, 'width');
  const c = meanIndex(profile, 'contrast');
  const t = meanIndex(profile, 'terminals');

  const loud = moodShare(profile, ['brutalist', 'industrial', 'psychedelic', 'playful']);
  const warm = moodShare(profile, ['warm', 'literary', 'botanical', 'nostalgic']);
  const cool = moodShare(profile, ['clinical', 'severe', 'utilitarian', 'mechanical']);
  const forward = moodShare(profile, ['futuristic']);

  const historical = ['15th-century humanist', '18th-century enlightenment', '19th-century industrial'];
  const oldEra = historical.reduce((s, e) => s + (profile.eras?.[e] ?? 0), 0);
  const eraTotal = Object.values(profile.eras ?? {}).reduce((s, n) => s + n, 0) || 1;

  if (serif >= 0.55 && loud >= 0.34) return 'serif-brutal';
  if (sans >= 0.55 && warm >= 0.34) return 'sans-literary';
  if (w !== null && c !== null && w >= 6 && c >= 4) return 'heavy-fine';
  if (w !== null && w <= 2.2 && loud >= 0.34) return 'light-loud';
  if (wd !== null && wd >= 4.4 && cool >= 0.34) return 'wide-severe';
  if (wd !== null && wd <= 2 && warm >= 0.34) return 'narrow-warm';
  if (t !== null && t >= 6 && cool >= 0.34) return 'soft-cold';
  if (t !== null && t <= 1.2 && warm >= 0.34) return 'hard-warm';
  if (oldEra / eraTotal >= 0.5 && forward >= 0.2) return 'old-future';
  if (sans >= 0.4 && serif >= 0.4) return 'split-category';

  // Structural fallbacks: how you sit on the axes generally.
  const positions = QUIZ_AXES.map((ax) => {
    const m = meanIndex(profile, ax);
    if (m === null) return null;
    const span = AXIS_VALUES[ax].length - 1 || 1;
    return Math.abs(m / span - 0.5) * 2; // 0 = dead centre, 1 = at an end
  }).filter((x): x is number => x !== null);

  if (positions.length) {
    const avg = positions.reduce((s, n) => s + n, 0) / positions.length;
    if (avg >= 0.62) return 'extreme-taste';
    if (avg <= 0.24) return 'middle-taste';
  }
  return 'no-tension';
}

/** How committed the picks were — drives the closer. */
export function decisiveness(profile: TasteProfile, pinnedCount: number): 'decisive' | 'leaning' | 'open' {
  if (pinnedCount >= 3) return 'decisive';
  if (pinnedCount >= 1) return 'leaning';
  return 'open';
}

// ---------------------------------------------------------------------------
// Evidence — computed, never authored
// ---------------------------------------------------------------------------

/**
 * Numerals, not words.
 *
 * "five times out of 6" is the tell of a sentence assembled by a machine. The
 * counts here are small and the point of the line is the ratio, so both halves
 * stay numerals and the sentence reads the way a person would say it aloud.
 */

/**
 * The one sentence that is arithmetic rather than phrasing.
 *
 * Picks the axis where the person was most lopsided *and* had enough decisive
 * rounds to be worth citing, then states the count plainly. Returns null when
 * there isn't enough evidence to say anything true, and the read simply runs
 * without it rather than inventing a number.
 */
export function evidenceSentence(profile: TasteProfile): string | null {
  let best: { ax: QuizAxis; value: string; hits: number; total: number; share: number } | null = null;

  for (const ax of QUIZ_AXES) {
    const total = profile.seen[ax] ?? 0;
    if (total < 3) continue;
    const top = topOf(profile.decisive[ax] ?? {});
    if (!top) continue;
    const [value, hits] = top;
    if (hits < 2) continue;
    const share = hits / total;
    if (!best || share > best.share || (share === best.share && total > best.total)) {
      best = { ax, value, hits, total, share };
    }
  }
  if (!best) return null;

  const label = BANK.clauses?.[best.ax]?.[best.value]?.label ?? best.value;

  if (best.hits === best.total) {
    return `When ${best.ax} decided it, you went ${label} every single time, all ${best.total} of them.`;
  }
  return `When ${best.ax} decided it, you went ${label} ${best.hits} of the ${best.total} times.`;
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/** Deterministic choice from a list, seeded by the profile itself. */
function choose<T>(options: T[] | undefined, seed: number, salt: number): T | null {
  if (!options?.length) return null;
  const h = Math.imul(seed ^ Math.imul(salt, 0x9e3779b1), 0x85ebca6b) >>> 0;
  return options[h % options.length];
}

export type TheRead = {
  /** The headline. Short enough to read at a glance and to survive an OG card. */
  verdict: string;
  opener: string;
  tension: string | null;
  evidence: string | null;
  closer: string | null;
  /** For debugging and for the specimen chips under the read. */
  keys: { family: CategoryFamily; cluster: string; tension: string; decisiveness: string };
};

export function composeRead(profile: TasteProfile, pinnedCount: number): TheRead {
  const seed = profileSeed(profile);
  const family = categoryFamily(profile);
  const cluster = moodCluster(profile);
  const tensionKey = detectTension(profile);
  const dec = decisiveness(profile, pinnedCount);

  const openerKey = `${family}:${cluster}`;
  const opener =
    choose(BANK.openers?.[openerKey], seed, 1) ??
    choose(BANK.openers?.[`${family}:cool`], seed, 2) ??
    'Your picks describe a face that has not been drawn yet.';
  const verdict =
    BANK.verdicts?.[openerKey] ??
    BANK.verdicts?.[`${family}:cool`] ??
    'You know it when you see it.';

  return {
    verdict,
    opener,
    tension: choose(BANK.tensions?.[tensionKey], seed, 3),
    evidence: evidenceSentence(profile),
    closer: choose(BANK.closers?.[dec], seed, 4),
    keys: { family, cluster, tension: tensionKey, decisiveness: dec },
  };
}

/** The read as one paragraph, for share images and meta descriptions. */
export function readToParagraph(read: TheRead): string {
  return [read.verdict, read.opener, read.tension, read.evidence, read.closer]
    .filter(Boolean)
    .join(' ');
}

/**
 * The authored, speakable name for a gene value.
 *
 * Gene values are written for the prompt renderer, not for prose: `normal-width`
 * and `very low contrast` are fine inside a Mixfont prompt and wrong in a
 * sentence. Falls back to the raw value so a missing label degrades to
 * something true rather than to nothing.
 */
export function labelFor(axis: string, value: string): string {
  return BANK.clauses?.[axis]?.[value]?.label ?? value;
}

/** Plain-language chips for the axes the person was most consistent about. */
export function axisChips(profile: TasteProfile): { axis: QuizAxis; label: string; reads: string }[] {
  const out: { axis: QuizAxis; label: string; reads: string }[] = [];
  for (const ax of QUIZ_AXES) {
    const top = topOf(profile.axis[ax] ?? {});
    if (!top) continue;
    const entry = BANK.clauses?.[ax]?.[top[0]];
    out.push({ axis: ax, label: entry?.label ?? top[0], reads: entry?.reads ?? '' });
  }
  return out;
}
