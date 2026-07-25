import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import googleFonts from '@/lib/data/google-fonts.json';
import { PANGRAM, SAMPLE_PARAGRAPH } from '@/lib/glyphs';
import type { GoogleFont } from '@/lib/recommend';

const GOOGLE = googleFonts as unknown as GoogleFont[];

/** The charset scripts/subset-atlas.mjs builds the on-demand w/ cut from. */
function fullTextCharset(): Set<string> {
  const src = readFileSync('scripts/subset-atlas.mjs', 'utf8');
  const start = src.indexOf('const FULL_TEXT');
  const body = src.slice(start, src.indexOf(';\n', start));
  // The literal is assembled from several quoted chunks.
  const chunks = [...body.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map((m) =>
    (m[1] ?? m[2]).replace(/\\(.)/g, '$1'),
  );
  return new Set(chunks.join(''));
}

/** Every string the app sets in a generated face, on any surface. */
function specimenCopy(): { where: string; text: string }[] {
  const pair = readFileSync('components/PairFinder.tsx', 'utf8');
  const grabConst = (name: string) => {
    const i = pair.indexOf(`const ${name}`);
    const seg = pair.slice(i, pair.indexOf(';\n', i));
    return [...seg.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\(.)/g, '$1')).join('');
  };
  return [
    { where: 'lib/glyphs SAMPLE_PARAGRAPH', text: SAMPLE_PARAGRAPH },
    { where: 'lib/glyphs PANGRAM', text: PANGRAM },
    { where: 'PairFinder HEADLINE', text: grabConst('HEADLINE') },
    { where: 'PairFinder BODY', text: grabConst('BODY') },
  ];
}

/**
 * A house face renders from a subset built to a fixed charset. Any character in
 * the specimen copy that the charset omits silently renders in the fallback
 * serif — inside a page whose entire job is to show you the typeface, and with
 * nothing anywhere to catch it.
 *
 * This shipped: the sample paragraph sets "arm’s length" with a U+2019, and the
 * charset carried only the ASCII apostrophe, so one character of every pairing
 * preview was Georgia.
 */
describe('the subset carries every character the app sets in it', () => {
  const charset = fullTextCharset();

  it('parsed a real charset rather than an empty one', () => {
    expect(charset.size).toBeGreaterThan(60);
    expect(charset.has('A')).toBe(true);
    expect(charset.has('’')).toBe(true);
  });

  it('covers every specimen string', () => {
    const missing: string[] = [];
    for (const { where, text } of specimenCopy()) {
      expect(text.length, `${where} did not parse`).toBeGreaterThan(4);
      for (const ch of new Set(text)) {
        if (!charset.has(ch)) {
          missing.push(`${where}: ${JSON.stringify(ch)} (U+${ch.codePointAt(0)!.toString(16).toUpperCase()})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

/**
 * The pair page prints how many faces were in the running. It said "350" —
 * both libraries added together — which is only true of the display slot; the
 * body-copy slot throws out every display, script and mono family and every
 * house face too extreme to read at 16px, leaving about a hundred.
 */
describe('the pairing page counts rather than claims', () => {
  const src = readFileSync('components/PairFinder.tsx', 'utf8');

  it('hardcodes no library or pool size', () => {
    // A three-digit literal sitting next to "of", "Google", "families" or
    // "faces" is a count someone typed and will forget to update. `* 100` is
    // the percentage the score is rendered as and is not a count.
    const counts = [
      ...src.matchAll(/\bof\s+(\d{2,4})\b/g),
      ...src.matchAll(/(\d{2,4})\s*(?:Google|families|faces)/g),
    ].map((m) => m[1]);
    expect(counts).toEqual([]);
  });

  it('takes both numbers from props', () => {
    expect(src).toMatch(/\{googleCount\}/);
    expect(src).toMatch(/pools\[slot\]/);
  });
});

/**
 * A font recommender must not recommend something that is not a typeface.
 * "Libre Barcode 39" sat in the library with a `why` reading "not letterforms
 * at all — every character sets as scannable Code 39 bars", and the display
 * slot has no kind filter, so it was offered as a pairing partner.
 */
describe('the Google library contains only typefaces', () => {
  it('has nothing that is not letterforms', () => {
    for (const f of GOOGLE) {
      expect(f.family, f.family).not.toMatch(/barcode/i);
      expect(f.why, f.family).not.toMatch(/not letterforms/i);
    }
  });

  it('still has enough families to recommend from', () => {
    expect(GOOGLE.length).toBeGreaterThanOrEqual(120);
  });
});
