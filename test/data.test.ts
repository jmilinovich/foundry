import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'opentype.js';
import { describe, expect, it } from 'vitest';

import googleFonts from '@/lib/data/google-fonts.json';
import world from '@/lib/data/world.json';
import { CATEGORY, CONTRAST, ERA, MOOD, TERMINALS, WEIGHT, WIDTH } from '@/lib/genome';
import type { GoogleFont } from '@/lib/recommend';
import type { WorldImage } from '@/lib/world';

/** Must match SPECIMEN in components/quiz/Quiz.tsx. */
const SPECIMEN = 'Handgloves';

const GOOGLE = googleFonts as unknown as GoogleFont[];
const WORLD = world as unknown as WorldImage[];

describe('the world image bank', () => {
  it('has enough images for the world rounds not to repeat', () => {
    // Four world rounds per quiz, two images each.
    expect(WORLD.length).toBeGreaterThanOrEqual(24);
  });

  it('ships every file it references', () => {
    for (const w of WORLD) {
      expect(existsSync(`public/world/${w.file}`), `missing ${w.file}`).toBe(true);
    }
  });

  it('names a file extension that matches how it will be served', () => {
    for (const w of WORLD) expect(w.file).toMatch(/\.(jpg|jpeg|png)$/i);
  });

  /**
   * These are other people's photographs on a public site. The licence, the
   * attribution and a checkable source must survive all the way to the page.
   */
  it('carries an attributable credit for every image', () => {
    for (const w of WORLD) {
      expect(w.credit?.artist, `${w.id} has no artist`).toBeTruthy();
      expect(w.credit?.licence, `${w.id} has no licence`).toBeTruthy();
      expect(w.credit?.source, `${w.id} has no source`).toMatch(/^https?:\/\//);
    }
  });

  it('contains nothing that forbids commercial use or modification', () => {
    for (const w of WORLD) {
      expect(w.credit.licence).not.toMatch(/noncommercial|no derivative|\bND\b|fair use/i);
      expect(w.credit.licence).toMatch(/public domain|pd|cc0|cc by|creative commons/i);
    }
  });

  it('uses only real genome values', () => {
    for (const w of WORLD) {
      expect(w.mood).toHaveLength(2);
      expect(w.mood[0]).not.toBe(w.mood[1]);
      for (const m of w.mood) expect(MOOD).toContain(m);
      expect(ERA).toContain(w.era);
      if (w.category) expect(CATEGORY).toContain(w.category);
      if (w.weight) expect(WEIGHT).toContain(w.weight);
      if (w.width) expect(WIDTH).toContain(w.width);
      if (w.contrast) expect(CONTRAST).toContain(w.contrast);
    }
  });

  it('has captions in the house voice — short, lowercase, concrete', () => {
    for (const w of WORLD) {
      expect(w.caption.length).toBeGreaterThan(4);
      expect(w.caption.length).toBeLessThanOrEqual(60);
      expect(w.caption[0]).toBe(w.caption[0].toLowerCase());
      expect(w.caption).not.toMatch(/\b(beautiful|stunning|gorgeous|timeless|vintage vibes)\b/i);
    }
  });

  it('disagrees with itself enough for a duel to mean something', () => {
    // If every image were the same mood, a world pick would carry no signal.
    const moods = new Set(WORLD.flatMap((w) => w.mood));
    const eras = new Set(WORLD.map((w) => w.era));
    expect(moods.size).toBeGreaterThanOrEqual(6);
    expect(eras.size).toBeGreaterThanOrEqual(4);
  });

  it('has unique ids and files', () => {
    expect(new Set(WORLD.map((w) => w.id)).size).toBe(WORLD.length);
    expect(new Set(WORLD.map((w) => w.file)).size).toBe(WORLD.length);
  });
});

describe('the atlas ships what it advertises', () => {
  const manifest = JSON.parse(readFileSync('public/atlas/manifest.json', 'utf8')) as {
    slug: string;
    name: string;
  }[];

  it('has a quiz subset and a full cut for every entry', () => {
    // build-atlas.mjs admits an entry to the manifest on the strength of its
    // .ttf alone, and subset-atlas.mjs can fail on an individual font. Nothing
    // else connects the two, so a font can be offered to the quiz while its
    // woff2 404s — which renders as a blank pane the person is asked to judge.
    const missing = manifest.filter(
      (e) =>
        !existsSync(`public/atlas/q/${e.slug}.woff2`) ||
        !existsSync(`public/atlas/w/${e.slug}.woff2`),
    );
    expect(missing.map((e) => e.slug)).toEqual([]);
  });

  it('is large enough that a 12-round quiz never runs out of specimens', () => {
    expect(manifest.length).toBeGreaterThanOrEqual(24);
  });

  /**
   * Both panes of a duel share one point size, because width is an axis being
   * judged and scaling each face to its pane would erase the difference. That
   * size is derived in globals.css from the widest face in the atlas — the
   * `6.4` divisor in `.duel-specimen`. If a wider face is ever minted, the
   * divisor is wrong and the specimen clips off the edge of a phone with no
   * error anywhere, so the assumption is pinned here rather than trusted.
   */
  it('contains no face wider than the specimen sizing assumes', () => {
    const WIDEST_EM = 6.4;
    const widest = manifest
      .map((e) => {
        const font = parse(readFileSync(`public/atlas/${e.slug}.ttf`).buffer as ArrayBuffer);
        let w = 0;
        for (const ch of SPECIMEN) w += font.charToGlyph(ch).advanceWidth ?? 0;
        return { slug: e.slug, em: w / font.unitsPerEm };
      })
      .sort((a, b) => b.em - a.em)[0];

    expect(
      widest.em,
      `${widest.slug} needs ${widest.em.toFixed(2)}em; update the divisor in .duel-specimen`,
    ).toBeLessThanOrEqual(WIDEST_EM);
  });

  it('has unique slugs and a name for every font', () => {
    expect(new Set(manifest.map((e) => e.slug)).size).toBe(manifest.length);
    for (const e of manifest) expect(e.name?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('the Google Fonts library', () => {
  it('is big enough and has no duplicates', () => {
    expect(GOOGLE.length).toBeGreaterThanOrEqual(120);
    expect(new Set(GOOGLE.map((f) => f.family)).size).toBe(GOOGLE.length);
  });

  it('spans the category axis rather than defaulting', () => {
    const cats = new Set(GOOGLE.map((f) => f.genome.category));
    expect(cats.size).toBeGreaterThanOrEqual(8);
    // No single category may swallow the library.
    const counts: Record<string, number> = {};
    for (const f of GOOGLE) counts[f.genome.category] = (counts[f.genome.category] ?? 0) + 1;
    expect(Math.max(...Object.values(counts))).toBeLessThan(GOOGLE.length * 0.4);
  });

  it('classifies every family so specialists can be capped', () => {
    for (const f of GOOGLE) {
      expect(['text', 'display', 'script', 'mono'], `${f.family}`).toContain(f.kind);
    }
  });

  it('uses only real genome values', () => {
    for (const f of GOOGLE) {
      expect(CATEGORY).toContain(f.genome.category);
      expect(WEIGHT).toContain(f.genome.weight);
      expect(WIDTH).toContain(f.genome.width);
      expect(CONTRAST).toContain(f.genome.contrast);
      expect(TERMINALS).toContain(f.genome.terminals);
      expect(ERA).toContain(f.genome.era);
      for (const m of f.genome.mood) expect(MOOD).toContain(m);
    }
  });

  it('describes each face without marketing language', () => {
    for (const f of GOOGLE) {
      expect(f.why.length).toBeGreaterThan(12);
      expect(f.why, f.family).not.toMatch(
        /\b(elegant|timeless|versatile|perfect|stunning|beautiful|modern)\b/i,
      );
    }
  });

  it('only suggests pairings that exist in the library', () => {
    const families = new Set(GOOGLE.map((f) => f.family));
    const dangling = GOOGLE.filter((f) => f.pairsWith && !families.has(f.pairsWith));
    // A dangling pairing renders as a name the reader cannot look up.
    expect(dangling.map((f) => `${f.family} → ${f.pairsWith}`)).toEqual([]);
  });
});
