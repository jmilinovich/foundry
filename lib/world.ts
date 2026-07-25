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
  file: string;
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
