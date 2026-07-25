import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';

import type { AtlasEntry } from './taste';
import type { WorldImage } from './world';

/**
 * Load the frozen taste atlas manifest from the public assets.
 *
 * Read once at request time (cheap — it's a few KB) rather than bundled, so
 * re-minting the atlas doesn't require a rebuild.
 */
export async function loadAtlas(): Promise<AtlasEntry[]> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), 'public', 'atlas', 'manifest.json'),
      'utf8',
    );
    return JSON.parse(raw) as AtlasEntry[];
  } catch {
    return [];
  }
}

/**
 * Load the world image bank.
 *
 * Returns an empty list if the bank hasn't been assembled, which the quiz reads
 * as "run specimen duels for every round" rather than as an error — the taste
 * engine was built to degrade that way so a missing asset can't dead-end a run.
 */
export async function loadWorld(): Promise<WorldImage[]> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), 'lib', 'data', 'world.json'),
      'utf8',
    );
    return JSON.parse(raw) as WorldImage[];
  } catch {
    return [];
  }
}
