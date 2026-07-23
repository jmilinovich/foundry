/**
 * The typographic genome.
 *
 * A font in Foundry is not a prompt string — it's a set of genes that renders
 * *into* a prompt. That buys three things a freeform prompt can't:
 *   1. real inheritance (uniform crossover, gene by gene),
 *   2. meaningful mutation (ordinal genes step to a *neighbour*, so children
 *      drift rather than teleport),
 *   3. a genome you can read on screen and understand why a font looks like it does.
 *
 * Most axes are ordered: index 0 and index n are the extremes, and adjacent
 * values are typographically adjacent. Mutation walks ±1 along that order.
 */

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32) — same generator used across the sketches, so a run
// is reproducible from its seed.
// ---------------------------------------------------------------------------

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

// ---------------------------------------------------------------------------
// The axes
// ---------------------------------------------------------------------------

/** Ordered by serif prominence: none → flared → wedge → bracketed → slab. */
export const CATEGORY = [
  'geometric sans',
  'neo-grotesque sans',
  'grotesque sans',
  'humanist sans',
  'flared sans',
  'wedge serif',
  'humanist serif',
  'transitional serif',
  'old-style serif',
  'didone serif',
  'slab serif',
] as const;

export const WEIGHT = [
  'hairline',
  'extralight',
  'light',
  'regular',
  'medium',
  'semibold',
  'bold',
  'black',
  'ultra-heavy',
] as const;

export const WIDTH = [
  'ultra-condensed',
  'condensed',
  'narrow',
  'normal-width',
  'wide',
  'extended',
  'ultra-extended',
] as const;

/** Stroke modulation. `reverse` is real (Italian / French Clarendon) and fun. */
export const CONTRAST = [
  'monoline',
  'very low contrast',
  'low contrast',
  'moderate contrast',
  'high contrast',
  'extreme contrast',
  'reverse contrast',
] as const;

/** Ordered hard → soft. */
export const TERMINALS = [
  'blunt cut',
  'angled',
  'sheared',
  'spurred',
  'flared',
  'tapered',
  'rounded',
  'ball',
] as const;

export const XHEIGHT = ['small', 'modest', 'normal', 'large', 'very large'] as const;

/** How the joins and corners are cut. Ordered sharp → soft. */
export const CORNER = ['razor-sharp', 'crisp', 'softened', 'rounded', 'pillowy'] as const;

/** Surface treatment, ordered by how much hand/noise is in the outline. */
export const TEXTURE = [
  'clean',
  'lightly inked',
  'slightly rough',
  'engraved',
  'brush-drawn',
  'eroded',
  'stencil-cut',
  'pixel-stepped',
] as const;

export const ERA = [
  '15th-century humanist',
  '18th-century enlightenment',
  '19th-century industrial',
  '1920s Bauhaus',
  '1950s Swiss',
  '1970s phototypesetting',
  '1990s digital',
  'contemporary',
  'speculative near-future',
] as const;

export const MOOD = [
  'editorial',
  'brutalist',
  'warm',
  'clinical',
  'nostalgic',
  'futuristic',
  'literary',
  'industrial',
  'playful',
  'severe',
  'elegant',
  'utilitarian',
  'psychedelic',
  'ecclesiastical',
  'botanical',
  'mechanical',
] as const;

/** Mixfont's best-practices page asks for a use case. It measurably sharpens output. */
export const USE_CASE = [
  'a wellness app identity',
  'a financial dashboard',
  'an independent record label',
  'a literary journal',
  'a sports broadcast package',
  'a science museum',
  'a coffee packaging line',
  'a film title sequence',
  'a transit wayfinding system',
  'an architecture studio',
  'a fashion house',
  "a children's picture book",
  'a legal document set',
  'a synthesizer front panel',
] as const;

export type Genome = {
  category: (typeof CATEGORY)[number];
  weight: (typeof WEIGHT)[number];
  width: (typeof WIDTH)[number];
  contrast: (typeof CONTRAST)[number];
  terminals: (typeof TERMINALS)[number];
  xheight: (typeof XHEIGHT)[number];
  corner: (typeof CORNER)[number];
  texture: (typeof TEXTURE)[number];
  era: (typeof ERA)[number];
  mood: [(typeof MOOD)[number], (typeof MOOD)[number]];
  useCase: (typeof USE_CASE)[number];
};

/** Every ordinal axis, so crossover/mutation can be written once. */
const ORDINAL = {
  category: CATEGORY,
  weight: WEIGHT,
  width: WIDTH,
  contrast: CONTRAST,
  terminals: TERMINALS,
  xheight: XHEIGHT,
  corner: CORNER,
  texture: TEXTURE,
  era: ERA,
  useCase: USE_CASE,
} as const;

type OrdinalKey = keyof typeof ORDINAL;
const ORDINAL_KEYS = Object.keys(ORDINAL) as OrdinalKey[];

/** Axes that carry the visible look — mutated more eagerly than era/useCase. */
const STRUCTURAL: OrdinalKey[] = [
  'category',
  'weight',
  'width',
  'contrast',
  'terminals',
  'xheight',
  'corner',
  'texture',
];

// ---------------------------------------------------------------------------
// Prompt rendering
// ---------------------------------------------------------------------------

/**
 * Render a genome into a Mixfont prompt.
 *
 * Their best-practices page is explicit: name the type category, the visual
 * style, the use case, and distinctive details. Vague mood words alone score
 * badly. So we always emit all four, and drop the genes whose value is the
 * neutral default rather than saying "normal-width" out loud.
 */
/** "a eroded surface" reads as sloppy in a prompt the model actually consumes. */
const article = (word: string) => ('aeiou'.includes(word[0].toLowerCase()) ? 'an' : 'a');

export function toPrompt(g: Genome): string {
  const shape: string[] = [];
  if (g.width !== 'normal-width') shape.push(g.width);
  shape.push(g.weight, g.category);

  const details: string[] = [];
  details.push(g.contrast === 'monoline' ? 'monoline strokes' : `${g.contrast} strokes`);
  details.push(`${g.terminals} terminals`);
  if (g.corner !== 'crisp') details.push(`${g.corner} corners`);
  if (g.xheight !== 'normal') details.push(`${article(g.xheight)} ${g.xheight} x-height`);
  if (g.texture !== 'clean') details.push(`${article(g.texture)} ${g.texture} surface`);

  const last = details.pop()!;
  const detailText = details.length ? `${details.join(', ')}, and ${last}` : last;

  return (
    `A ${shape.join(' ')} with ${detailText}. ` +
    `${g.era} in spirit, ${g.mood[0]} and ${g.mood[1]}. ` +
    `Drawn for ${g.useCase}.`
  );
}

/** The compact one-line genotype shown under each specimen. */
export function toGenotype(g: Genome): string {
  return [
    g.category,
    g.weight,
    g.width === 'normal-width' ? null : g.width,
    g.contrast,
    `${g.terminals} terms`,
    `${g.xheight} x-ht`,
    `${g.corner} corners`,
    g.texture === 'clean' ? null : g.texture,
    g.mood.join('+'),
  ]
    .filter(Boolean)
    .join(' · ');
}

// ---------------------------------------------------------------------------
// Sampling, crossover, mutation
// ---------------------------------------------------------------------------

export function randomGenome(rng: Rng): Genome {
  let a = pick(rng, MOOD);
  let b = pick(rng, MOOD);
  while (b === a) b = pick(rng, MOOD);
  return {
    category: pick(rng, CATEGORY),
    weight: pick(rng, WEIGHT),
    width: pick(rng, WIDTH),
    contrast: pick(rng, CONTRAST),
    terminals: pick(rng, TERMINALS),
    xheight: pick(rng, XHEIGHT),
    corner: pick(rng, CORNER),
    texture: pick(rng, TEXTURE),
    era: pick(rng, ERA),
    mood: [a, b],
    useCase: pick(rng, USE_CASE),
  };
}

/**
 * Generation 0. Not eight random draws — a *spread*.
 *
 * Each individual is stratified along the two axes that dominate first
 * impressions (category and weight), so the opening screen covers the space
 * instead of accidentally showing you five bold slabs. Any gene the seed text
 * pinned down is held fixed across the whole generation.
 */
export function seedGeneration(seedText: string, size: number, rng: Rng): Genome[] {
  const pinned = parseSeed(seedText);
  return Array.from({ length: size }, (_, i) => {
    const base = randomGenome(rng);
    // Stratify: walk category and weight across their full range.
    const t = (i + rng() * 0.8) / size;
    base.category = CATEGORY[Math.min(CATEGORY.length - 1, Math.floor(t * CATEGORY.length))];
    const w = ((i * 5) % size) / size;
    base.weight = WEIGHT[Math.min(WEIGHT.length - 1, Math.floor(w * WEIGHT.length))];
    return { ...base, ...pinned };
  });
}

/**
 * Read a free-text seed for gene values it names outright.
 *
 * Deliberately literal — no model in the loop. If you type "condensed brutalist
 * slab serif" those three genes are pinned and everything else explores. If you
 * type nothing recognisable, the whole space is open, which is the honest answer.
 */
export function parseSeed(seedText: string): Partial<Genome> {
  const s = seedText.toLowerCase();
  const out: Partial<Genome> = {};
  if (!s.trim()) return out;

  for (const key of ORDINAL_KEYS) {
    const values = ORDINAL[key] as readonly string[];
    // Longest match first, so "extralight" beats "light" and "slab serif" beats "serif".
    const hit = [...values].sort((a, b) => b.length - a.length).find((v) => {
      const needle = v.replace(/-/g, ' ').toLowerCase();
      return s.includes(needle) || s.includes(v.toLowerCase());
    });
    if (hit) (out as Record<string, unknown>)[key] = hit;
  }

  const moods = MOOD.filter((m) => s.includes(m));
  if (moods.length >= 2) out.mood = [moods[0], moods[1]];
  else if (moods.length === 1) out.mood = [moods[0], moods[0] === 'warm' ? 'editorial' : 'warm'];

  return out;
}

const step = <T extends string>(values: readonly T[], current: T, delta: number): T => {
  const i = values.indexOf(current);
  if (i < 0) return current;
  return values[Math.max(0, Math.min(values.length - 1, i + delta))];
};

/** Uniform per-gene crossover from an arbitrary number of parents. */
export function crossover(parents: Genome[], rng: Rng): Genome {
  const gene = <K extends keyof Genome>(k: K): Genome[K] =>
    parents[Math.floor(rng() * parents.length)][k];
  return {
    category: gene('category'),
    weight: gene('weight'),
    width: gene('width'),
    contrast: gene('contrast'),
    terminals: gene('terminals'),
    xheight: gene('xheight'),
    corner: gene('corner'),
    texture: gene('texture'),
    era: gene('era'),
    mood: [...gene('mood')] as Genome['mood'],
    useCase: gene('useCase'),
  };
}

/**
 * Mutation as a *walk*, not a jump: an ordinal gene moves one or two places
 * along its own axis. A geometric sans can become a neo-grotesque; it will not
 * become a didone in one step. That's what makes successive generations feel
 * like refinement rather than a fresh roll of the dice.
 */
export function mutate(g: Genome, rng: Rng, rate = 0.25): Genome {
  const out: Genome = { ...g, mood: [...g.mood] as Genome['mood'] };

  for (const key of STRUCTURAL) {
    if (rng() < rate) {
      const delta = rng() < 0.75 ? (rng() < 0.5 ? -1 : 1) : rng() < 0.5 ? -2 : 2;
      const values = ORDINAL[key] as readonly string[];
      (out as Record<string, unknown>)[key] = step(values, out[key] as string, delta);
    }
  }
  // Era and use case drift more slowly — they're framing, not form.
  for (const key of ['era', 'useCase'] as const) {
    if (rng() < rate * 0.5) {
      const values = ORDINAL[key] as readonly string[];
      (out as Record<string, unknown>)[key] = step(values, out[key], rng() < 0.5 ? -1 : 1);
    }
  }
  if (rng() < rate) {
    const slot = rng() < 0.5 ? 0 : 1;
    let m = pick(rng, MOOD);
    while (m === out.mood[1 - slot]) m = pick(rng, MOOD);
    out.mood[slot] = m;
  }
  return out;
}

/**
 * Build the next generation from the survivors.
 *
 * Composition matters more than it looks. Elites carry the thing you liked
 * forward unchanged so a generation can never go backwards; the wildcard keeps
 * a door open to the rest of the space so the population can't collapse onto
 * one look by generation three.
 */
export function breed(
  survivors: Genome[],
  size: number,
  rng: Rng,
  opts: { mutationRate?: number; elites?: number; wildcards?: number } = {},
): { genome: Genome; kind: 'elite' | 'child' | 'wildcard' }[] {
  const rate = opts.mutationRate ?? 0.25;
  const eliteCount = Math.min(opts.elites ?? 1, survivors.length);
  const wildcards = opts.wildcards ?? 1;

  const out: { genome: Genome; kind: 'elite' | 'child' | 'wildcard' }[] = [];

  for (let i = 0; i < eliteCount; i++) {
    out.push({ genome: { ...survivors[i], mood: [...survivors[i].mood] as Genome['mood'] }, kind: 'elite' });
  }
  while (out.length < size - wildcards) {
    out.push({ genome: mutate(crossover(survivors, rng), rng, rate), kind: 'child' });
  }
  while (out.length < size) {
    out.push({ genome: randomGenome(rng), kind: 'wildcard' });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

const STEMS = [
  'Halden', 'Verrick', 'Osmont', 'Calder', 'Braith', 'Lorn', 'Mercer', 'Vance',
  'Ashgrove', 'Pell', 'Quarry', 'Sable', 'Thicket', 'Understory', 'Wren', 'Yarrow',
  'Corvid', 'Dunlin', 'Ember', 'Fathom', 'Glaive', 'Harrow', 'Ingot', 'Jetty',
  'Kestrel', 'Lantern', 'Marrow', 'Nocturne', 'Obelisk', 'Pallas', 'Quill', 'Ridgeway',
  'Saltmarsh', 'Tarn', 'Ulster', 'Vellum', 'Winnow', 'Axil', 'Bellwether', 'Cinder',
];

const SUFFIX_BY_WIDTH: Record<string, string> = {
  'ultra-condensed': 'Compressed',
  condensed: 'Condensed',
  narrow: 'Narrow',
  wide: 'Wide',
  extended: 'Extended',
  'ultra-extended': 'Expanded',
};

/** Deterministic from the genome, so the same font always carries the same name. */
export function nameFor(g: Genome, salt: string): string {
  const rng = mulberry32(hashSeed(JSON.stringify(g) + salt));
  const stem = pick(rng, STEMS);
  const width = SUFFIX_BY_WIDTH[g.width];
  const weight =
    g.weight === 'regular' ? null : g.weight[0].toUpperCase() + g.weight.slice(1).replace('-', ' ');
  const parts = [stem, width, weight].filter(Boolean);
  return parts.join(' ');
}
