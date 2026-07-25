import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import googleFonts from '@/lib/data/google-fonts.json';
import world from '@/lib/data/world.json';
import { CATEGORY, CONTRAST, ERA, MOOD, TERMINALS, WEIGHT, WIDTH } from '@/lib/genome';
import type { GoogleFont } from '@/lib/recommend';
import type { WorldImage } from '@/lib/world';

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
