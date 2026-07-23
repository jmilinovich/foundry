/** Shared between server and client — no fs, no `server-only`, safe to import anywhere. */

import type { Genome } from './genome';

export type FontStatus = 'queued' | 'generating' | 'ready' | 'failed';

/** How an individual came to exist. Drives the badge on each specimen card. */
export type Lineage = 'seed' | 'elite' | 'child' | 'wildcard';

/**
 * A second, 319-glyph cut of the same font.
 *
 * Everything minted during exploration is the 72-glyph `standard` set — no
 * accents, no curly quotes, no en/em dashes. Nothing shippable comes out of
 * that, so a font you've settled on gets re-minted at `extended` and keeps
 * both files.
 */
export type ExtendedCut = {
  mixfontId: string | null;
  status: FontStatus;
  progress: number;
  error?: string;
};

export type FontRecord = {
  id: string;
  name: string;
  genome: Genome;
  prompt: string;
  generation: number;
  lineage: Lineage;
  /** Font ids of the parents this individual was crossed from. */
  parents: string[];
  mixfontId: string | null;
  status: FontStatus;
  progress: number;
  error?: string;
  /** True once picked as a parent — the record of your own taste. */
  survived: boolean;
  createdAt: string;
  extended?: ExtendedCut;
};

export type GlyphSetName = 'standard' | 'extended';

export type Run = {
  id: string;
  seedText: string;
  seed: number;
  /** The string every specimen is rendered in. Testing on real content beats an alphabet. */
  specimenText: string;
  populationSize: number;
  mutationRate: number;
  generation: number;
  createdAt: string;
  fonts: FontRecord[];
  /** Cumulative spend, in credits. 1 credit = $0.01. */
  creditsSpent: number;
};

export const dollars = (credits: number) => `$${(credits / 100).toFixed(2)}`;
