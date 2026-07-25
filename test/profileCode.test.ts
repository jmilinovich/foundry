import { describe, expect, it } from 'vitest';

import { mulberry32, type Genome } from '@/lib/genome';
import { decodeProfile, encodeProfile, profileSeed } from '@/lib/profileCode';
import {
  emptyProfile,
  nextDuel,
  QUIZ_AXES,
  QUIZ_LENGTH,
  recordPick,
  type AtlasEntry,
} from '@/lib/taste';
import type { WorldImage } from '@/lib/world';

const genome = (over: Partial<Genome> = {}): Genome => ({
  category: 'humanist serif',
  weight: 'regular',
  width: 'normal-width',
  contrast: 'moderate contrast',
  terminals: 'tapered',
  xheight: 'normal',
  corner: 'crisp',
  texture: 'clean',
  era: '15th-century humanist',
  mood: ['literary', 'warm'],
  useCase: 'a literary journal',
  ...over,
});

const CATS = ['geometric sans', 'didone serif', 'slab serif', 'grotesque sans'] as const;
const atlas: AtlasEntry[] = Array.from({ length: 60 }, (_, i) => ({
  slug: `e${i}`,
  name: `E${i}`,
  genome: genome({
    category: CATS[i % 4],
    weight: i % 3 ? 'bold' : 'hairline',
    width: i % 5 ? 'normal-width' : 'ultra-condensed',
  }),
}));

const world: WorldImage[] = Array.from({ length: 20 }, (_, i) => ({
  id: `w${i}`,
  file: `w${i}.jpg`,
  theme: i % 2 ? 'poster' : 'neon',
  caption: 'x',
  mood: i % 2 ? ['clinical', 'severe'] : ['warm', 'nostalgic'],
  era: i % 2 ? '1950s Swiss' : '19th-century industrial',
  category: i % 3 === 0 ? 'slab serif' : undefined,
  credit: { artist: 'a', licence: 'CC0', licenceUrl: null, source: 'https://example.org' },
}));

/** Play a whole quiz, deterministically, choosing sides from a seeded stream. */
function playThrough(seed: number) {
  const rng = mulberry32(seed);
  const pickRng = mulberry32(seed ^ 0xbeef);
  let p = emptyProfile();
  for (let i = 0; i < QUIZ_LENGTH; i++) {
    const duel = nextDuel(p, atlas, rng, world);
    if (!duel) break;
    p = recordPick(p, duel, pickRng() < 0.5 ? 'a' : 'b');
  }
  return p;
}

describe('profile codes', () => {
  it('round-trips a real played-through profile exactly', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const original = playThrough(seed);
      const back = decodeProfile(encodeProfile(original));
      expect(back).not.toBeNull();

      expect(back!.round).toBe(original.round);
      expect(back!.moods).toEqual(original.moods);
      expect(back!.eras).toEqual(original.eras);
      for (const ax of QUIZ_AXES) {
        expect(back!.axis[ax]).toEqual(original.axis[ax]);
        expect(back!.decisive[ax]).toEqual(original.decisive[ax]);
        expect(back!.seen[ax]).toBe(original.seen[ax]);
      }
    }
  });

  it('preserves the exact vote weights, including the 0.25 and 0.4 quanta', () => {
    const p = playThrough(3);
    const back = decodeProfile(encodeProfile(p))!;
    const weights = Object.values(back.axis.category);
    expect(weights.length).toBeGreaterThan(0);
    // Every weight must be an exact multiple of 1/20 and match the original.
    for (const w of weights) expect(Math.round(w * 20)).toBeCloseTo(w * 20, 10);
    expect(back.axis.category).toEqual(p.axis.category);
  });

  it('produces a URL-safe code', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const code = encodeProfile(playThrough(seed));
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(encodeURIComponent(code)).toBe(code);
    }
  });

  it('stays a sane length', () => {
    const code = encodeProfile(playThrough(11));
    expect(code.length).toBeLessThan(260);
  });

  it('is stable — the same profile always encodes identically', () => {
    const a = playThrough(5);
    const b = playThrough(5);
    expect(encodeProfile(a)).toBe(encodeProfile(b));
    expect(profileSeed(a)).toBe(profileSeed(b));
  });

  it('gives different profiles different codes', () => {
    const codes = new Set(Array.from({ length: 25 }, (_, i) => encodeProfile(playThrough(i + 1))));
    expect(codes.size).toBeGreaterThan(20);
  });

  it('returns null for junk rather than throwing', () => {
    for (const junk of ['', 'x', '!!!!', 'AAAA', 'not-a-real-code', '~~~', 'a'.repeat(500)]) {
      expect(() => decodeProfile(junk)).not.toThrow();
    }
    expect(decodeProfile('')).toBeNull();
  });

  /**
   * A truncated link is the realistic corruption: chat clients clip URLs. The
   * dangerous outcome isn't an error, it's a *plausible* profile — the
   * recipient reading a confident verdict that isn't the one that was sent.
   */
  it('rejects every truncation of a real code', () => {
    for (const seed of [3, 9, 17]) {
      const code = encodeProfile(playThrough(seed));
      for (let cut = 1; cut < code.length; cut++) {
        expect(decodeProfile(code.slice(0, cut)), `truncation at ${cut} decoded`).toBeNull();
      }
    }
  });

  it('never decodes a corrupted character into a different profile', () => {
    // The honest property is not "always null": the final base64 character
    // carries spare bits, so some substitutions there decode to the identical
    // byte string and are not corruption at all. What must never happen is a
    // mangled code yielding a *different*, plausible profile.
    const original = playThrough(6);
    const code = encodeProfile(original);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

    for (let i = 0; i < code.length; i++) {
      for (const shift of [1, 7, 31]) {
        const swap = alphabet[(alphabet.indexOf(code[i]) + shift) % alphabet.length];
        if (swap === code[i]) continue;
        const back = decodeProfile(code.slice(0, i) + swap + code.slice(i + 1));
        if (back !== null) expect(encodeProfile(back)).toBe(code);
      }
    }
  });

  it('rejects codes with extra bytes appended', () => {
    const code = encodeProfile(playThrough(12));
    expect(decodeProfile(`${code}AAAA`)).toBeNull();
  });

  it('rejects a code with an unknown version byte', () => {
    const bytes = Buffer.from([99, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const code = bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeProfile(code)).toBeNull();
  });

  it('drops unknown axis values rather than corrupting the tally', () => {
    const p = emptyProfile();
    p.axis.category['not a real category'] = 3;
    p.axis.category['didone serif'] = 2;
    const back = decodeProfile(encodeProfile(p))!;
    expect(back.axis.category['didone serif']).toBe(2);
    expect(back.axis.category['not a real category']).toBeUndefined();
  });
});
