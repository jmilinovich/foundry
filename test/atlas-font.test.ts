import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { CATEGORY, ERA, type Genome } from '@/lib/genome';
import { ATLAS_RUN, findFont, readFontFile } from '@/lib/store';
import { QUIZ_AXES, seedFromGenome } from '@/lib/taste';

const manifest = JSON.parse(readFileSync('public/atlas/manifest.json', 'utf8')) as {
  slug: string;
  name: string;
  genome: Genome;
}[];

const sample = manifest[0];

/**
 * A house font has no run and no font record. Pairing, the kit zip and the
 * locked-slot picker all resolve their locked side through findFont, so the
 * atlas is addressed as a reserved run id rather than threaded through each of
 * them separately. If that resolution breaks, "pair this" on a house font fails
 * at the point where money is already being spent.
 */
describe('a house font resolves as a font record', () => {
  it('returns a ready record with the manifest genome and name', async () => {
    const rec = await findFont(ATLAS_RUN, sample.slug);
    expect(rec).not.toBeNull();
    expect(rec!.id).toBe(sample.slug);
    expect(rec!.name).toBe(sample.name);
    expect(rec!.genome).toEqual(sample.genome);
    // createPairingRun refuses anything not ready, so this is load-bearing.
    expect(rec!.status).toBe('ready');
  });

  it('is stable across calls, so the same page renders the same twice', async () => {
    const [a, b] = await Promise.all([
      findFont(ATLAS_RUN, sample.slug),
      findFont(ATLAS_RUN, sample.slug),
    ]);
    expect(a).toEqual(b);
  });

  it('returns null for a font that is not in the library', async () => {
    expect(await findFont(ATLAS_RUN, 'no-such-font')).toBeNull();
  });

  it('refuses slugs that could escape the atlas directory', async () => {
    for (const bad of ['../../package', '..', 'a/b', 'A-Font', 'foo.ttf', '']) {
      expect(await findFont(ATLAS_RUN, bad), bad).toBeNull();
      expect(await readFontFile(bad), bad).toBeNull();
    }
  });
});

describe('house font bytes are served through the font route', () => {
  it('serves the atlas TTF for a slug with no run behind it', async () => {
    const buf = await readFontFile(sample.slug);
    expect(buf).not.toBeNull();
    // A TrueType file starts with 0x00010000; anything else means we handed
    // back some other file entirely.
    expect(buf!.subarray(0, 4)).toEqual(Buffer.from([0x00, 0x01, 0x00, 0x00]));
    expect(buf!.length).toBe(readFileSync(`public/atlas/${sample.slug}.ttf`).length);
  });

  it('has no extended cut to offer', async () => {
    expect(await readFontFile(sample.slug, 'extended')).toBeNull();
  });
});

describe('breeding from one face', () => {
  const g = sample.genome;

  it('pins only what makes the face recognisable', async () => {
    const seed = seedFromGenome(g);
    expect(seed.pinned).toEqual({ category: g.category, era: g.era });
    expect(CATEGORY).toContain(seed.pinned.category);
    expect(ERA).toContain(seed.pinned.era);
  });

  it('peaks each weighted axis on this font and spills onto its neighbours', () => {
    const seed = seedFromGenome(g);
    for (const ax of QUIZ_AXES) {
      const w = seed.weights[ax];
      expect(w, ax).toBeTruthy();
      const top = Object.entries(w!).sort((a, b) => b[1] - a[1])[0];
      expect(top[0], ax).toBe(g[ax]);
      // Neighbours present means the generation explores rather than copies.
      expect(Object.keys(w!).length, ax).toBeGreaterThan(1);
    }
  });

  it('carries this font’s moods', () => {
    expect(seedFromGenome(g).moods).toEqual([g.mood[0], g.mood[1]]);
  });

  /**
   * Pinning every axis would mint a population of copies of the font you were
   * already looking at, at 20 credits each.
   */
  it('leaves enough free that the population is not one font eight times', () => {
    const seed = seedFromGenome(g);
    expect(Object.keys(seed.pinned).length).toBeLessThan(4);
  });
});
