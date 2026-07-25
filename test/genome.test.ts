import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  CATEGORY,
  CONTRAST,
  WIDTH,
  toPrompt,
  type Genome,
} from '@/lib/genome';

/**
 * The prompt is the product.
 *
 * Every generated typeface — the frozen atlas and every font a person breeds —
 * is whatever this function asks for. A wording change here changes what the
 * foundry makes, so the things that were established by measurement are pinned
 * here rather than left to be re-discovered.
 */

const base: Genome = {
  category: 'grotesque sans',
  weight: 'regular',
  width: 'normal-width',
  contrast: 'low contrast',
  terminals: 'blunt cut',
  xheight: 'normal',
  corner: 'crisp',
  texture: 'clean',
  era: 'contemporary',
  mood: ['utilitarian', 'industrial'],
  useCase: 'a transit wayfinding system',
};

const withWidth = (width: Genome['width']) => toPrompt({ ...base, width });

describe('the width request', () => {
  /**
   * Measured, not stylistic. As a bare adjective the wide half of the axis
   * inverts: "ultra-extended" produced 2.29em of "Handgloves" against 9.20em
   * for the same request phrased as a sentence. If someone reverts these to
   * adjectives because they read more tidily, the library silently goes
   * condensed again.
   */
  it('states the wide half as a sentence, never as an adjective', () => {
    for (const w of ['wide', 'extended', 'ultra-extended'] as const) {
      const p = withWidth(w);
      expect(p, w).toMatch(/The letterforms are drawn (very )?wide|extremely wide/);
      // The adjective must not appear in the opening noun phrase.
      expect(p.split('.')[0], w).not.toContain(w);
    }
  });

  it('says normal-width out loud rather than leaving it unstated', () => {
    // Left silent the model defaults to 3.56em — already condensed — and
    // normal-width is the most common value in any population, so silence there
    // was the single largest contributor to the skew.
    expect(withWidth('normal-width')).toContain('classic proportions');
  });

  it('keeps the narrow half as adjectives, which do work', () => {
    expect(withWidth('ultra-condensed')).toContain('ultra-condensed regular');
    expect(withWidth('condensed')).toContain('condensed regular');
    // "narrow" as a word barely moves the model; this phrasing measured 3.44em,
    // which sits where narrow belongs, between condensed and normal.
    expect(withWidth('narrow')).toContain('slightly condensed regular');
  });

  it('gives every width value exactly one way of being asked for', () => {
    for (const w of WIDTH) {
      const p = withWidth(w);
      const sentence = /The letterforms/.test(p);
      const adjective = /^An? (ultra-condensed|condensed|slightly condensed) /.test(p);
      expect(sentence !== adjective, `${w} must use one mechanism, not both or neither`).toBe(true);
    }
  });

  it('opens with the right article', () => {
    // "A ultra-extended…" shipped for 201 fonts. It was not the cause of the
    // width failure, but it is still wrong.
    expect(withWidth('ultra-condensed').startsWith('An ')).toBe(true);
    expect(withWidth('condensed').startsWith('A ')).toBe(true);
    expect(toPrompt({ ...base, weight: 'extralight' }).startsWith('An ')).toBe(true);
  });
});

describe('the prompt in general', () => {
  it('never renders an empty or malformed clause', () => {
    for (const width of WIDTH) {
      for (const category of CATEGORY) {
        for (const contrast of CONTRAST) {
          const p = toPrompt({ ...base, width, category, contrast });
          expect(p).not.toMatch(/\s{2,}/);
          expect(p).not.toMatch(/,\s*\./);
          expect(p).not.toMatch(/undefined|null|NaN/);
          expect(p.endsWith('.')).toBe(true);
        }
      }
    }
  });

  it('mentions every gene that has a visible consequence', () => {
    const p = toPrompt({
      ...base,
      weight: 'black',
      terminals: 'ball',
      xheight: 'very large',
      texture: 'eroded',
      corner: 'pillowy',
    });
    for (const s of ['black', 'ball terminals', 'very large x-height', 'eroded', 'pillowy']) {
      expect(p, s).toContain(s);
    }
  });
});

describe('the atlas script and the runtime agree', () => {
  /**
   * scripts/build-atlas.mjs deliberately replicates toPrompt rather than
   * importing it, so it can stay a zero-dependency script. Replication is how
   * two things drift, and a drift here means the frozen library and the fonts
   * people breed are asking for different typefaces. Comparing the source text
   * of both renderers catches it without needing to import a .mjs into vitest.
   */
  it('carries the same width vocabulary in both renderers', () => {
    const script = readFileSync('scripts/build-atlas.mjs', 'utf8');
    const lib = readFileSync('lib/genome.ts', 'utf8');

    const grab = (src: string, name: string) =>
      src
        .slice(src.indexOf(`const ${name}`), src.indexOf('};', src.indexOf(`const ${name}`)))
        // the TS version carries a type annotation the .mjs cannot
        .replace(/: Partial<Record<Genome\['width'\], string>>/, '')
        // commentary is allowed to differ; the vocabulary is not
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\s+/g, ' ')
        .trim();

    expect(grab(script, 'WIDTH_ADJECTIVE')).toBe(grab(lib, 'WIDTH_ADJECTIVE'));
    expect(grab(script, 'WIDTH_SENTENCE')).toBe(grab(lib, 'WIDTH_SENTENCE'));
  });
});
