import { describe, expect, it } from 'vitest';

import { mulberry32, type Genome } from '@/lib/genome';
import googleFonts from '@/lib/data/google-fonts.json';
import { decodeProfile, encodeProfile } from '@/lib/profileCode';
import { composeRead, readToParagraph } from '@/lib/read';
import { profileToVector, recommend, type GoogleFont } from '@/lib/recommend';
import {
  emptyProfile,
  nextDuel,
  profileToSeed,
  QUIZ_LENGTH,
  recordPick,
  recordSkip,
  type AtlasEntry,
  type TasteProfile,
} from '@/lib/taste';

/**
 * The load-bearing promise of the share link: what the sender saw is what the
 * recipient sees. These tests run the whole pipeline — play, encode, decode,
 * recompose — and compare the finished text and font lists, not just the
 * intermediate tallies.
 */

const GOOGLE = googleFonts as unknown as GoogleFont[];

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

const CATS = ['geometric sans', 'didone serif', 'slab serif', 'grotesque sans', 'humanist sans'] as const;
const atlas: AtlasEntry[] = Array.from({ length: 80 }, (_, i) => ({
  slug: `e${i}`,
  name: `E${i}`,
  genome: genome({
    category: CATS[i % 5],
    weight: (['hairline', 'light', 'regular', 'bold', 'black'] as const)[i % 5],
    width: (['ultra-condensed', 'condensed', 'normal-width', 'wide', 'extended'] as const)[i % 5],
    contrast: (['monoline', 'low contrast', 'moderate contrast', 'high contrast', 'extreme contrast'] as const)[i % 5],
    terminals: (['blunt cut', 'sheared', 'tapered', 'rounded', 'ball'] as const)[i % 5],
    mood: [
      (['clinical', 'warm', 'brutalist', 'elegant', 'futuristic'] as const)[i % 5],
      (['severe', 'literary', 'industrial', 'editorial', 'playful'] as const)[i % 5],
    ],
    era: (['1950s Swiss', '15th-century humanist', '19th-century industrial', '1920s Bauhaus', 'contemporary'] as const)[i % 5],
  }),
}));

function play(seed: number): TasteProfile {
  const rng = mulberry32(seed);
  const pickRng = mulberry32(seed ^ 0xa5a5);
  let p = emptyProfile();
  for (let i = 0; i < QUIZ_LENGTH; i++) {
    const duel = nextDuel(p, atlas, rng, []);
    if (!duel) break;
    p = pickRng() < 0.12 ? recordSkip(p, duel) : recordPick(p, duel, pickRng() < 0.5 ? 'a' : 'b');
  }
  return p;
}

/** Everything the result screen actually renders, as comparable values. */
function render(profile: TasteProfile) {
  const pinned = Object.keys(profileToSeed(profile).pinned).length;
  const vec = profileToVector(profile);
  return {
    read: readToParagraph(composeRead(profile, pinned)),
    google: recommend(vec, GOOGLE, 6).map((m) => m.item.family),
    atlas: recommend(vec, atlas, 6).map((m) => m.item.slug),
  };
}

describe('a shared link renders what the sender saw', () => {
  it('reproduces the read and both font lists exactly', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const original = play(seed);
      const revived = decodeProfile(encodeProfile(original));
      expect(revived, `seed ${seed} failed to decode`).not.toBeNull();
      expect(render(revived!), `seed ${seed}`).toEqual(render(original));
    }
  });

  it('survives a second trip through the encoder unchanged', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const code = encodeProfile(play(seed));
      expect(encodeProfile(decodeProfile(code)!)).toBe(code);
    }
  });
});

describe('the result does not drift once the quiz is over', () => {
  /**
   * profileSeed() hashes the encoded profile, and `round` is part of that. So
   * anything that advances the round after the quiz ends re-rolls the wording
   * of the read and changes the share URL. The keyboard handler used to keep
   * running on the result screen, which made ↓ do exactly that.
   */
  it('changes the read if the round advances — so the round must not advance', () => {
    const finished = play(4);
    const before = render(finished);
    const nudged = recordSkip(finished, null);

    expect(nudged.round).toBe(finished.round + 1);
    // Demonstrates why the listener has to be detached: the output really is
    // sensitive to a stray keypress.
    expect(encodeProfile(nudged)).not.toBe(encodeProfile(finished));
    // And the finished profile itself is stable when nothing touches it.
    expect(render(finished)).toEqual(before);
  });

  it('is stable across repeated renders of the same profile', () => {
    const p = play(9);
    const first = render(p);
    for (let i = 0; i < 5; i++) expect(render(p)).toEqual(first);
  });
});
