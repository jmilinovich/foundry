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
import {
  isWorldRound,
  WORLD_AXIS_WEIGHT,
  WORLD_MOOD_WEIGHT,
  type WorldImage,
} from './world';

export type AtlasEntry = {
  slug: string;
  genome: Genome;
  name: string;
  /**
   * Width of the specimen word in ems, measured off the real outlines by
   * scripts/measure-atlas.mjs. The duel sizes itself from the wider of its two
   * faces so a pair of condensed cuts fills the bench instead of being sized
   * for the widest slab in the library. Optional: a manifest without it falls
   * back to the global worst case, which is safe, just small.
   */
  w?: number;
};

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
  /**
   * Votes cast when this axis was the *deciding* difference in the duel, as a
   * plain count. `axis` blends decisive picks (1.0), ride-alongs (0.25) and
   * world picks (0.4) into one number, which is the right thing to sample a
   * seed from but useless as evidence: you cannot say "7 times out of 9" from a
   * weighted sum. The read cites this instead, so its claims are literally true.
   */
  decisive: Record<QuizAxis, Record<string, number>>;
  moods: Record<string, number>;
  /**
   * Era votes. Not a quiz axis — no duel is ever chosen to isolate it — but
   * both specimen and world picks carry an era, and it's the single most
   * legible thing about a photograph, so it's worth tallying for the read.
   */
  eras: Record<string, number>;
  seen: Record<QuizAxis, number>;
  /** slugs shown, so we don't repeat a specimen. */
  shown: string[];
  /** world image ids shown, same reason. */
  worldShown: string[];
};

export function emptyProfile(): TasteProfile {
  const axis = {} as TasteProfile['axis'];
  const decisive = {} as TasteProfile['decisive'];
  const seen = {} as TasteProfile['seen'];
  for (const a of QUIZ_AXES) {
    axis[a] = {};
    decisive[a] = {};
    seen[a] = 0;
  }
  return { round: 0, axis, decisive, moods: {}, eras: {}, seen, shown: [], worldShown: [] };
}

/**
 * Snap a tally to the 1/20 grid.
 *
 * Votes arrive in units of 0.25, 0.4 and 1.0, none of which are exact in binary
 * floating point, so a dozen `+=`s drift a tally to 2.4499999999999997. That is
 * invisible in a recommendation but it breaks a property we actually depend on:
 * a profile must survive the round trip through a shared URL *identically*, and
 * the URL stores twentieths. Snapping on accumulation keeps the in-memory value
 * and the encoded value the same number rather than merely equal to 15 places.
 */
const q20 = (n: number) => Math.round(n * 20) / 20;

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

export type TypeDuel = { kind: 'type'; a: AtlasEntry; b: AtlasEntry; targets: QuizAxis[] };
export type WorldDuel = { kind: 'world'; a: WorldImage; b: WorldImage };
export type Duel = TypeDuel | WorldDuel;

/**
 * Choose the next pair — a specimen duel or a world duel, per the schedule.
 *
 * The schedule is fixed rather than random so the quiz has a rhythm: you get a
 * photograph every third round, which resets attention and stops twelve rounds
 * of Handgloves from going numb. If the image bank is missing or exhausted the
 * round silently falls back to a specimen duel, so the quiz never dead-ends.
 */
export function nextDuel(
  profile: TasteProfile,
  atlas: AtlasEntry[],
  rng: Rng,
  world: WorldImage[] = [],
): Duel | null {
  if (isWorldRound(profile.round)) {
    const w = nextWorldDuel(profile, world, rng);
    if (w) return w;
  }
  return nextTypeDuel(profile, atlas, rng);
}

/**
 * Two photographs that disagree.
 *
 * Same principle as the specimen duel: a pick is only informative if the two
 * options differ. We pair across mood and era and avoid showing two images of
 * the same theme, since "two neon signs" tests nothing but colour preference.
 */
export function nextWorldDuel(
  profile: TasteProfile,
  world: WorldImage[],
  rng: Rng,
): WorldDuel | null {
  const pool = world.filter((w) => !profile.worldShown.includes(w.id));
  if (pool.length < 2) return null;

  let best: { a: WorldImage; b: WorldImage; score: number } | null = null;
  for (let i = 0; i < 80; i++) {
    const a = pool[Math.floor(rng() * pool.length)];
    const b = pool[Math.floor(rng() * pool.length)];
    if (a.id === b.id) continue;
    const moodOverlap = a.mood.filter((m) => b.mood.includes(m)).length;
    const eraApart = a.era === b.era ? 0 : 1;
    const themeApart = a.theme === b.theme ? 0 : 1;
    const score = (2 - moodOverlap) * 1.4 + eraApart * 1.1 + themeApart * 0.8 + rng() * 0.2;
    if (!best || score > best.score) best = { a, b, score };
  }
  return best ? { kind: 'world', a: best.a, b: best.b } : null;
}

/**
 * Choose the next specimen pair.
 *
 * Adaptive on two fronts: it targets the axis you've *seen* least (coverage),
 * and among candidate pairs it prefers ones that are far apart on that axis but
 * otherwise similar, so your pick is attributable rather than muddy. Seeded RNG
 * keeps a session reproducible.
 */
export function nextTypeDuel(profile: TasteProfile, atlas: AtlasEntry[], rng: Rng): TypeDuel | null {
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
  return { kind: 'type', a: best.a, b: best.b, targets };
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
  const next: TasteProfile = {
    ...profile,
    round: profile.round + 1,
    axis: structuredClone(profile.axis),
    decisive: structuredClone(profile.decisive),
    moods: { ...profile.moods },
    eras: { ...profile.eras },
    seen: { ...profile.seen },
    shown: [...profile.shown],
    worldShown: [...profile.worldShown],
  };

  if (duel.kind === 'world') {
    const won = winner === 'a' ? duel.a : duel.b;
    next.worldShown.push(duel.a.id, duel.b.id);

    // The loud signal, at full strength.
    for (const m of won.mood) next.moods[m] = q20((next.moods[m] ?? 0) + WORLD_MOOD_WEIGHT);
    next.eras[won.era] = q20((next.eras[won.era] ?? 0) + 1);

    // The quiet signal, discounted — a photograph is weak evidence about
    // letterforms, and only counted where the lettering was legible enough for
    // the tagging pass to commit to a value at all.
    for (const ax of QUIZ_AXES) {
      const v = won[ax as keyof WorldImage] as string | undefined;
      if (!v) continue;
      next.axis[ax][v] = q20((next.axis[ax][v] ?? 0) + WORLD_AXIS_WEIGHT);
    }
    return next;
  }

  const won = winner === 'a' ? duel.a : duel.b;
  next.shown.push(duel.a.slug, duel.b.slug);

  for (const ax of QUIZ_AXES) {
    const differed = duel.targets.includes(ax);
    const v = won.genome[ax] as string;
    next.axis[ax][v] = q20((next.axis[ax][v] ?? 0) + (differed ? 1 : 0.25));
    if (differed) {
      next.seen[ax] += 1;
      next.decisive[ax][v] = (next.decisive[ax][v] ?? 0) + 1;
    }
  }
  for (const m of won.genome.mood) next.moods[m] = q20((next.moods[m] ?? 0) + 1);
  next.eras[won.genome.era] = q20((next.eras[won.genome.era] ?? 0) + 1);

  return next;
}

/** Advance a round without recording a vote, for "no preference". */
export function recordSkip(profile: TasteProfile, duel: Duel | null): TasteProfile {
  const next: TasteProfile = { ...profile, round: profile.round + 1 };
  if (!duel) return next;
  if (duel.kind === 'world') next.worldShown = [...profile.worldShown, duel.a.id, duel.b.id];
  else next.shown = [...profile.shown, duel.a.slug, duel.b.slug];
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
 * Start a run from one existing face.
 *
 * Pinning all eleven axes would mint eight copies of the font you were already
 * looking at, which is $1.60 for nothing. So only the two axes that carry a
 * face's identity are pinned, and the rest are weighted to peak on this font's
 * values with some spill onto their neighbours. What comes back reads as a
 * family around the face rather than a reproduction of it.
 */
const NEIGHBOUR_SPILL = 0.4;

export function seedFromGenome(g: Genome): TasteSeed {
  const weights: TasteSeed['weights'] = {};

  for (const ax of QUIZ_AXES) {
    const values = VALUES[ax];
    const i = values.indexOf(g[ax] as string);
    if (i < 0) continue;
    const w: Record<string, number> = { [values[i]]: 1 };
    if (i > 0) w[values[i - 1]] = NEIGHBOUR_SPILL;
    if (i < values.length - 1) w[values[i + 1]] = NEIGHBOUR_SPILL;
    weights[ax] = w;
  }

  return {
    weights,
    // Category and era are what make a face recognisably itself; let everything
    // else move.
    pinned: { category: g.category, era: g.era },
    moods: [g.mood[0], g.mood[1]],
  };
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
