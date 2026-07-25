/**
 * The world image bank.
 *
 * Half the quiz shows photographs instead of specimens: a shopfront, a station
 * sign, a letterpress page, a poster. The question is "which world would you
 * live in?", which anybody can answer without knowing what a terminal is.
 *
 * The cost of that accessibility is signal quality. A photograph carries mood
 * and era loudly and letterform detail quietly — you can tell a 1970s record
 * shop from a Swiss timetable at a glance, but you cannot read the x-height off
 * a neon sign. So a world vote counts at full strength on `mood` and `era` and
 * is deliberately discounted on the letterform axes. See WORLD_AXIS_WEIGHT.
 *
 * Every image is licence-cleared at harvest time (scripts/harvest-world.mjs
 * keeps only what Wikimedia Commons itself reports as public domain or CC) and
 * carries its attribution here so the credit can be rendered next to it.
 */

export type WorldCredit = {
  artist: string;
  licence: string;
  licenceUrl: string | null;
  /** Commons file description page — where the licence claim can be checked. */
  source: string;
};

export type WorldImage = {
  id: string;
  /** The licensed master. Variants are derived from it; see scripts/variants-world.mjs. */
  file: string;
  /**
   * Intrinsic pixel size of the master, so a pane reserves its box before the
   * bytes land. Named pxW/pxH because `width` on this type is already the
   * genome axis — the string one, "condensed".
   */
  pxW?: number;
  pxH?: number;
  theme: string;
  /** What a viewer is actually reading off the picture. */
  caption: string;
  /** The loud signal. */
  mood: [string, string];
  era: string;
  /** The quiet signal — present when the lettering is legible enough to judge. */
  category?: string;
  weight?: string;
  width?: string;
  contrast?: string;
  credit: WorldCredit;
};

/**
 * How much a world pick counts, per axis, relative to a specimen pick.
 *
 * Mood and era are what a photograph is actually evidence *of*. The letterform
 * axes ride along at 0.4 so a run of world rounds nudges rather than decides —
 * without this, four pretty pictures would outvote eight direct comparisons of
 * the letterforms themselves.
 */
export const WORLD_AXIS_WEIGHT = 0.4;
export const WORLD_MOOD_WEIGHT = 1;

/** Images shown per 12-round quiz, and where they fall. 1-indexed rounds. */
export const WORLD_ROUNDS = [2, 5, 8, 11] as const;

export function isWorldRound(round0: number): boolean {
  return (WORLD_ROUNDS as readonly number[]).includes(round0 + 1);
}

/**
 * The display cuts of a photograph.
 *
 * The masters are ~1000px JPEGs and a duel pane is about 350 CSS px, so the
 * bank was 85% of everything the quiz downloaded — against 393 KB for all 201
 * typefaces. Two wastes compounding: resolution, and format. Across the images
 * one session preloads, this takes 2888 KB to 1051 KB.
 *
 * 480 covers a 1x phone; 900 covers 2x and desktop. AVIF for the ~95% that
 * support it, JPEG for the rest — `<picture>` picks, and neither the srcset nor
 * the fallback can serve something that does not exist, because the variants
 * are generated for every entry and a test asserts it.
 */
const VARIANT_WIDTHS = [480, 900] as const;

const stem = (file: string) => file.replace(/\.(jpe?g|png)$/i, '');

export function worldSrcSet(image: WorldImage, ext: 'avif' | 'jpg'): string {
  return VARIANT_WIDTHS.map((w) => `/world/${stem(image.file)}-${w}.${ext} ${w}w`).join(', ');
}

/** The `src` a non-srcset browser falls back to. */
export function worldFallback(image: WorldImage): string {
  return `/world/${stem(image.file)}-900.jpg`;
}

/** What the preloader should warm: the cut a phone will actually request. */
export function worldPreloadUrl(image: WorldImage): string {
  return `/world/${stem(image.file)}-900.avif`;
}
