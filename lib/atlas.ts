import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';

import type { AtlasEntry } from './taste';

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
