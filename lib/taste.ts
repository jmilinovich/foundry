/**
 * Taste elicitation.
 *
 * Nobody can write the prompt for the font they want, and — it turns out — most
 * people can't answer "what category, what contrast, what weight" either. But
 * everyone can look at two specimens and point at the one they like more.
 *
 * So the front door is a this-or-that duel over the frozen atlas. Each atlas
 * specimen has a known genome, so a pick is a vote on the genes behind it. After
 * ~12 rounds the votes become a *taste profile*: a soft per-axis distribution
 * plus a few hard pins where you were consistent. That seeds generation 0.
 */

import {
  CATEGORY,
  CONTRAST,
  MOOD,
  TERMINALS,
  WEIGHT,
  WIDTH,
  type Genome,
  type Rng,
} from './genome';

export type AtlasEntry = { slug: string; genome: Genome; name: string };

/**
 * The axes the quiz actually probes. Deliberately not all ten — the duel has a
 * budget of rounds, and these are the axes a person can *see* the difference on
 * in a single word. Corner, x-height, era and use-case ride along in the seed
 * from whichever atlas fonts you favored, but we don't spend rounds isolating
 * them.
 */
export const QUIZ_AXES = ['category', 'weight', 'width', 'contrast', 'terminals'] as const;
export type QuizAxis = (typeof QUIZ_AXES)[number];

const VALUES: Record<QuizAxis, readonly string[]> = {
  category: CATEGORY,
  weight: WEIGHT,
  width: WIDTH,
  contrast: CONTRAST,
  terminals: TERMINALS,
};

/**
 * A running tally of your votes.
 *
 * `axis[k][value]` accumulates weight for each value you picked; `moods` does
 * the same for the two mood tags. `seen` counts how often each axis has been
 * the *deciding* difference in a duel, so the selector can chase coverage.
 */
export type TasteProfile = {
  round: number;
  axis: Record<QuizAxis, Record<string, number>>;
  moods: Record<string, number>;
  seen: Record<QuizAxis, number>;
  /** slugs shown, so we don't repeat a specimen. */
  shown: string[];
};

export function emptyProfile(): TasteProfile {
  const axis = {} as TasteProfile['axis'];
  const seen = {} as TasteProfile['seen'];
  for (const a of QUIZ_AXES) {
    axis[a] = {};
    seen[a] = 0;
  }
  return { round: 0, axis, moods: {}, seen, shown: [] };
}

const ordinalDistance = (values: readonly string[], a: string, b: string) =>
  Math.abs(values.indexOf(a) - values.indexOf(b));

/** How different two genomes are on the quiz axes — for choosing contrasty pairs. */
function axisSpread(a: Genome, b: Genome): { total: number; per: Record<QuizAxis, number> } {
  const per = {} as Record<QuizAxis, number>;
  let total = 0;
  for (const ax of QUIZ_AXES) {
    const d = ordinalDistance(VALUES[ax], a[ax] as string, b[ax] as string) / VALUES[ax].length;
    per[ax] = d;
    total += d;
  }
  return { total, per };
}

export type Duel = { a: AtlasEntry; b: AtlasEntry; targets: QuizAxis[] };

/**
 * Choose the next pair.
 *
 * Adaptive on two fronts: it targets the axis you've *seen* least (coverage),
 * and among candidate pairs it prefers ones that are far apart on that axis but
 * otherwise similar, so your pick is attributable rather than muddy. Seeded RNG
 * keeps a session reproducible.
 */
export function nextDuel(profile: TasteProfile, atlas: AtlasEntry[], rng: Rng): Duel | null {
  const pool = atlas.filter((e) => !profile.shown.includes(e.slug));
  if (pool.length < 2) return null;

  // The axis we know least about.
  const target = [...QUIZ_AXES].sort((x, y) => profile.seen[x] - profile.seen[y])[0];

  let best: { a: AtlasEntry; b: AtlasEntry; score: number } | null = null;
  // Sample a bounded number of pairs rather than all O(n^2) — cheap and plenty.
  for (let i = 0; i < 90; i++) {
    const a = pool[Math.floor(rng() * pool.length)];
    let b = pool[Math.floor(rng() * pool.length)];
    if (a.slug === b.slug) {
      b = pool[(pool.indexOf(a) + 1 + Math.floor(rng() * (pool.length - 1))) % pool.length];
    }
    if (a.slug === b.slug) continue;

    const spread = axisSpread(a.genome, b.genome);
    // Far apart on the target axis, not maximally noisy elsewhere.
    const score = spread.per[target] * 2.2 - (spread.total - spread.per[target]) * 0.25 + rng() * 0.15;
    if (!best || score > best.score) best = { a, b, score };
  }
  if (!best) return null;

  const spread = axisSpread(best.a.genome, best.b.genome);
  const targets = QUIZ_AXES.filter((ax) => spread.per[ax] > 0.18);
  return { a: best.a, b: best.b, targets };
}

/**
 * Record a pick.
 *
 * The winner's genes get the vote, weighted up on the axes that actually
 * differed in this duel (those carry real signal) and lightly elsewhere. Mood
 * always counts — it's the through-line of a person's taste.
 */
export function recordPick(
  profile: TasteProfile,
  duel: Duel,
  winner: 'a' | 'b',
): TasteProfile {
  const won = winner === 'a' ? duel.a : duel.b;
  const next: TasteProfile = {
    ...profile,
    round: profile.round + 1,
    axis: structuredClone(profile.axis),
    moods: { ...profile.moods },
    seen: { ...profile.seen },
    shown: [...profile.shown, duel.a.slug, duel.b.slug],
  };

  for (const ax of QUIZ_AXES) {
    const differed = duel.targets.includes(ax);
    const v = won.genome[ax] as string;
    next.axis[ax][v] = (next.axis[ax][v] ?? 0) + (differed ? 1 : 0.25);
    if (differed) next.seen[ax] += 1;
  }
  for (const m of won.genome.mood) next.moods[m] = (next.moods[m] ?? 0) + 1;

  return next;
}

// ---------------------------------------------------------------------------
// Profile → seed
// ---------------------------------------------------------------------------

/**
 * A biased sampling seed for generation 0.
 *
 * `weights` are soft per-axis distributions (value → probability mass); the
 * biased sampler draws from them so the population is unmistakably yours but
 * still spreads. `pinned` holds only the axes where one value ran away with the
 * vote — those get fixed, giving the generation a spine.
 */
export type TasteSeed = {
  weights: Partial<Record<QuizAxis, Record<string, number>>>;
  pinned: Partial<Genome>;
  moods: [string, string];
};

/** Pin an axis only when its top value is both dominant and clearly ahead. */
const PIN_SHARE = 0.55;
const PIN_MARGIN = 1.6;

export function profileToSeed(profile: TasteProfile): TasteSeed {
  const weights: TasteSeed['weights'] = {};
  const pinned: Partial<Genome> = {};

  for (const ax of QUIZ_AXES) {
    const tally = profile.axis[ax];
    const entries = Object.entries(tally);
    if (!entries.length) continue;

    const total = entries.reduce((s, [, w]) => s + w, 0);
    // Smooth toward neighbours on ordinal axes so the seed explores around a
    // liked value rather than only reproducing exact atlas points.
    const smoothed: Record<string, number> = {};
    const values = VALUES[ax];
    for (const [v, w] of entries) {
      const i = values.indexOf(v);
      smoothed[v] = (smoothed[v] ?? 0) + w;
      if (i > 0) smoothed[values[i - 1]] = (smoothed[values[i - 1]] ?? 0) + w * 0.35;
      if (i < values.length - 1) smoothed[values[i + 1]] = (smoothed[values[i + 1]] ?? 0) + w * 0.35;
    }
    weights[ax] = smoothed;

    const sorted = entries.sort((x, y) => y[1] - x[1]);
    const [topV, topW] = sorted[0];
    const runnerUp = sorted[1]?.[1] ?? 0;
    if (topW / total >= PIN_SHARE && topW >= (runnerUp || 0.01) * PIN_MARGIN) {
      (pinned as Record<string, unknown>)[ax] = topV;
    }
  }

  const moodSorted = Object.entries(profile.moods).sort((a, b) => b[1] - a[1]);
  const moods: [string, string] = [
    moodSorted[0]?.[0] ?? 'editorial',
    moodSorted[1]?.[0] ?? moodSorted[0]?.[0] ?? 'warm',
  ];
  if (moods[1] === moods[0]) moods[1] = moods[0] === 'warm' ? 'editorial' : 'warm';

  return { weights, pinned, moods };
}

/**
 * A plain-language read of a profile, derived deterministically. No model in
 * the loop — the same picks always yield the same sentence.
 */
export function summarize(profile: TasteProfile): string {
  const top = (ax: QuizAxis): string | null => {
    const e = Object.entries(profile.axis[ax]).sort((a, b) => b[1] - a[1])[0];
    return e ? e[0] : null;
  };
  const moods = Object.entries(profile.moods)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([m]) => m);

  const bits: string[] = [];
  if (moods.length) bits.push(moods.join(' and '));
  const cat = top('category');
  if (cat) bits.push(cat);
  const contrast = top('contrast');
  if (contrast && contrast !== 'moderate contrast') bits.push(contrast);
  const weight = top('weight');
  if (weight && weight !== 'regular') bits.push(weight);
  const width = top('width');
  if (width && width !== 'normal-width') bits.push(width);

  return bits.join(' · ');
}

export const QUIZ_LENGTH = 12;
