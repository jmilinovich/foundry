import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import bank from '@/lib/data/read-bank.json';
import { mulberry32, type Genome } from '@/lib/genome';
import {
  axisChips,
  categoryFamily,
  composeRead,
  detectTension,
  evidenceSentence,
  labelFor,
  moodCluster,
  readToParagraph,
} from '@/lib/read';
import {
  emptyProfile,
  nextDuel,
  QUIZ_LENGTH,
  recordPick,
  type AtlasEntry,
  type TasteProfile,
} from '@/lib/taste';

const BANK = bank as unknown as {
  openers: Record<string, string[]>;
  tensions: Record<string, string[]>;
  closers: Record<string, string[]>;
};

const FAMILIES = ['geometric', 'neogrotesque', 'grotesque', 'humanist-sans', 'flared', 'wedge',
  'humanist-serif', 'transitional', 'oldstyle', 'didone', 'slab'];
const CLUSTERS = ['cool', 'warm', 'loud', 'refined', 'forward'];
const TENSIONS = ['serif-brutal', 'sans-literary', 'heavy-fine', 'light-loud', 'wide-severe',
  'narrow-warm', 'soft-cold', 'hard-warm', 'old-future', 'split-category', 'extreme-taste',
  'middle-taste', 'no-tension'];

const genome = (over: Partial<Genome> = {}): Genome => ({
  category: 'humanist serif',
  weight: 'regular',
  width: 'normal-width',
  contrast: 'moderate contrast',
  terminals: 'tapered',
  xheight: 'normal',
  corner: 'crisp',
  texture: 'clean',
  era: 'contemporary',
  mood: ['literary', 'warm'],
  useCase: 'a literary journal',
  ...over,
});

const CATS = ['geometric sans', 'didone serif', 'slab serif', 'grotesque sans', 'humanist serif'] as const;
const atlas: AtlasEntry[] = Array.from({ length: 60 }, (_, i) => ({
  slug: `e${i}`,
  name: `E${i}`,
  genome: genome({
    category: CATS[i % 5],
    weight: (['hairline', 'regular', 'black'] as const)[i % 3],
    width: (['ultra-condensed', 'normal-width', 'extended'] as const)[i % 3],
    contrast: (['monoline', 'moderate contrast', 'extreme contrast'] as const)[i % 3],
    terminals: (['blunt cut', 'tapered', 'ball'] as const)[i % 3],
    mood: [
      (['clinical', 'warm', 'brutalist', 'elegant', 'futuristic'] as const)[i % 5],
      (['severe', 'literary', 'industrial', 'editorial', 'playful'] as const)[i % 5],
    ],
    era: (['1950s Swiss', '15th-century humanist', '19th-century industrial'] as const)[i % 3],
  }),
}));

function playThrough(seed: number): TasteProfile {
  const rng = mulberry32(seed);
  const pickRng = mulberry32(seed ^ 0x5eed);
  let p = emptyProfile();
  for (let i = 0; i < QUIZ_LENGTH; i++) {
    const duel = nextDuel(p, atlas, rng, []);
    if (!duel) break;
    p = recordPick(p, duel, pickRng() < 0.5 ? 'a' : 'b');
  }
  return p;
}

describe('the authored bank', () => {
  it('has an opener for every family and mood cluster', () => {
    for (const f of FAMILIES) {
      for (const c of CLUSTERS) {
        const key = `${f}:${c}`;
        expect(BANK.openers[key], `missing opener ${key}`).toBeTruthy();
        expect(BANK.openers[key].length).toBeGreaterThan(0);
      }
    }
  });

  it('has a line for every tension the detector can emit', () => {
    for (const t of TENSIONS) {
      expect(BANK.tensions[t], `missing tension ${t}`).toBeTruthy();
      expect(BANK.tensions[t].length).toBeGreaterThan(0);
    }
  });

  it('has closers for every decisiveness level', () => {
    for (const d of ['decisive', 'leaning', 'open']) {
      expect(BANK.closers[d]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('carries none of the AI-prose tells the direction bans', () => {
    const banned =
      /\b(leverage|testament|journey|elevate|curated|timeless|unapologetic|seamless|delve|tapestry|resonate)\b/i;
    const lines = [
      ...Object.values(BANK.openers).flat(),
      ...Object.values(BANK.tensions).flat(),
      ...Object.values(BANK.closers).flat(),
    ];
    const offenders = lines.filter((l) => banned.test(l));
    expect(offenders, offenders.slice(0, 3).join(' | ')).toHaveLength(0);
  });

  /**
   * A closer is chosen by decisiveness bucket, and 'decisive' fires at 3, 4 or 5
   * pinned axes — so a line naming a specific number is wrong two thirds of the
   * time. Same for any authored line asserting a count the trigger can't promise.
   */
  it('never asserts a count the trigger cannot guarantee', () => {
    const NUM = 'one|two|three|four|five|six|seven|eight|nine|ten';
    const counting = new RegExp(`\\b(${NUM}|both|all (?:${NUM})) (axes|axis|of them|genes)\\b`, 'i');
    // A hedged range is fine when it spans the whole bucket: 'leaning' fires at
    // exactly 1 or 2 pins, so "one or two axes are settled" is simply true.
    const hedged = new RegExp(`\\b(${NUM}) or (${NUM})\\b`, 'i');

    const lines = [
      ...Object.values(BANK.openers).flat(),
      ...Object.values(BANK.tensions).flat(),
      ...Object.values(BANK.closers).flat(),
    ];
    const offenders = lines.filter((l) => counting.test(l) && !hedged.test(l));
    expect(offenders, offenders.join(' | ')).toHaveLength(0);
  });

  it('punctuates consistently — one apostrophe character, not two', () => {
    const lines = [
      ...Object.values(BANK.openers).flat(),
      ...Object.values(BANK.tensions).flat(),
      ...Object.values(BANK.closers).flat(),
    ];
    const curly = lines.filter((l) => /’/.test(l));
    expect(curly, curly.slice(0, 2).join(' | ')).toHaveLength(0);
  });

  it('does not lean on em-dashes as default punctuation', () => {
    const lines = [
      ...Object.values(BANK.openers).flat(),
      ...Object.values(BANK.tensions).flat(),
      ...Object.values(BANK.closers).flat(),
    ];
    const withDash = lines.filter((l) => /—/.test(l));
    expect(withDash.length / lines.length).toBeLessThan(0.15);
  });
});

describe('classification', () => {
  it('maps a dominant category to its family', () => {
    const p = emptyProfile();
    p.axis.category['didone serif'] = 5;
    expect(categoryFamily(p)).toBe('didone');
  });

  it('maps moods to the right cluster', () => {
    const p = emptyProfile();
    p.moods['clinical'] = 4;
    p.moods['severe'] = 3;
    p.moods['warm'] = 1;
    expect(moodCluster(p)).toBe('cool');
  });

  it('detects a serif-and-brutal contradiction', () => {
    const p = emptyProfile();
    p.axis.category['slab serif'] = 8;
    p.moods['brutalist'] = 4;
    p.moods['industrial'] = 3;
    p.moods['warm'] = 1;
    expect(detectTension(p)).toBe('serif-brutal');
  });

  it('detects an evenly split category vote', () => {
    const p = emptyProfile();
    p.axis.category['geometric sans'] = 5;
    p.axis.category['didone serif'] = 5;
    p.moods['editorial'] = 1;
    expect(detectTension(p)).toBe('split-category');
  });

  it('always returns a tension key that exists in the bank', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const key = detectTension(playThrough(seed));
      expect(TENSIONS).toContain(key);
      expect(BANK.tensions[key]).toBeTruthy();
    }
  });
});

describe('the evidence sentence', () => {
  it('states a count that is literally true', () => {
    const p = emptyProfile();
    p.seen.category = 9;
    p.decisive.category['humanist serif'] = 7;
    p.decisive.category['didone serif'] = 2;
    p.axis.category['humanist serif'] = 7;

    const s = evidenceSentence(p)!;
    expect(s).toContain('7 of the 9 times');
  });

  it('keeps both halves of the ratio as numerals', () => {
    // "five times out of 6" is the tell of a machine-assembled sentence.
    for (let seed = 1; seed <= 40; seed++) {
      const s = evidenceSentence(playThrough(seed));
      if (!s) continue;
      expect(s).not.toMatch(
        /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|once|twice)\b/i,
      );
    }
  });

  it('says nothing rather than inventing a number when evidence is thin', () => {
    const p = emptyProfile();
    p.seen.category = 1;
    p.decisive.category['didone serif'] = 1;
    expect(evidenceSentence(p)).toBeNull();
  });

  it('never claims more hits than there were rounds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p = playThrough(seed);
      const s = evidenceSentence(p);
      if (!s) continue;
      const nums = s.match(/\d+/g)?.map(Number) ?? [];
      for (const n of nums) expect(n).toBeLessThanOrEqual(QUIZ_LENGTH);
    }
  });
});

describe('composeRead', () => {
  it('is deterministic — the same profile always gets the same words', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = playThrough(seed);
      expect(readToParagraph(composeRead(p, 2))).toBe(readToParagraph(composeRead(p, 2)));
    }
  });

  it('always produces an opener, for every profile a real quiz can generate', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const read = composeRead(playThrough(seed), seed % 4);
      expect(read.opener.length).toBeGreaterThan(20);
      expect(read.closer).toBeTruthy();
      expect(read.tension).toBeTruthy();
    }
  });

  it('gives different tastes different verdicts', () => {
    const paras = new Set(
      Array.from({ length: 25 }, (_, i) => readToParagraph(composeRead(playThrough(i + 1), 2))),
    );
    expect(paras.size).toBeGreaterThan(8);
  });

  it('survives a completely empty profile without throwing', () => {
    const read = composeRead(emptyProfile(), 0);
    expect(read.opener.length).toBeGreaterThan(0);
    expect(() => readToParagraph(read)).not.toThrow();
  });

  it('varies the closer with how decisive the picks were', () => {
    const p = playThrough(4);
    expect(composeRead(p, 0).keys.decisiveness).toBe('open');
    expect(composeRead(p, 2).keys.decisiveness).toBe('leaning');
    expect(composeRead(p, 4).keys.decisiveness).toBe('decisive');
  });
});

describe('labelFor', () => {
  it('translates gene slugs into something speakable', () => {
    // These read fine inside a Mixfont prompt and wrong in an English sentence.
    expect(labelFor('width', 'normal-width')).not.toBe('normal-width');
    expect(labelFor('contrast', 'very low contrast')).not.toBe('very low contrast');
  });

  it('falls back to the raw value rather than to nothing', () => {
    expect(labelFor('width', 'not a real value')).toBe('not a real value');
    expect(labelFor('nonsense-axis', 'x')).toBe('x');
  });
});

describe('axisChips', () => {
  it('labels every axis the person actually voted on', () => {
    const chips = axisChips(playThrough(2));
    expect(chips.length).toBeGreaterThan(0);
    for (const c of chips) {
      expect(c.label.length).toBeGreaterThan(0);
      // A chip must never fall through to the raw gene string with no reading.
      expect(typeof c.reads).toBe('string');
    }
  });
});

describe('the specimen word', () => {
  it('is fully covered by the glyphs the subsetter keeps', () => {
    // A character in the markup that the subset omits renders as .notdef, with
    // no error anywhere. These two constants must not drift apart.
    const quiz = readFileSync('components/quiz/Quiz.tsx', 'utf8');
    const script = readFileSync('scripts/subset-atlas.mjs', 'utf8');
    const specimen = quiz.match(/const SPECIMEN = '([^']+)'/)?.[1];
    const subset = script.match(/export const QUIZ_TEXT = '([^']+)'/)?.[1];

    expect(specimen).toBeTruthy();
    expect(subset).toBeTruthy();
    for (const ch of specimen!) expect(subset).toContain(ch);
  });
});
