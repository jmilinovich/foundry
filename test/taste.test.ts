import { describe, expect, it } from 'vitest';

import { mulberry32, type Genome } from '@/lib/genome';
import {
  emptyProfile,
  nextDuel,
  QUIZ_AXES,
  QUIZ_LENGTH,
  recordPick,
  recordSkip,
  type AtlasEntry,
  type TypeDuel,
  type WorldDuel,
} from '@/lib/taste';
import { isWorldRound, WORLD_AXIS_WEIGHT, type WorldImage } from '@/lib/world';

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

const entry = (slug: string, over: Partial<Genome> = {}): AtlasEntry => ({
  slug,
  name: slug,
  genome: genome(over),
});

const image = (id: string, over: Partial<WorldImage> = {}): WorldImage => ({
  id,
  file: `${id}.jpg`,
  theme: 'poster',
  caption: 'a poster',
  mood: ['industrial', 'brutalist'],
  era: '19th-century industrial',
  credit: { artist: 'x', licence: 'CC0', licenceUrl: null, source: 'https://example.org' },
  ...over,
});

describe('recordPick — specimen duels', () => {
  it('gives a full vote on the axes that differed and a quarter elsewhere', () => {
    const duel: TypeDuel = {
      kind: 'type',
      a: entry('a', { category: 'didone serif' }),
      b: entry('b'),
      targets: ['category'],
    };
    const p = recordPick(emptyProfile(), duel, 'a');

    expect(p.axis.category['didone serif']).toBe(1);
    // Weight didn't differ in this duel, so it rides along quietly.
    expect(p.axis.weight['regular']).toBe(0.25);
    expect(p.seen.category).toBe(1);
    expect(p.seen.weight).toBe(0);
  });

  it('counts decisive votes separately from the weighted tally', () => {
    const duel: TypeDuel = {
      kind: 'type',
      a: entry('a', { category: 'didone serif' }),
      b: entry('b'),
      targets: ['category'],
    };
    let p = recordPick(emptyProfile(), duel, 'a');
    p = recordPick(p, { ...duel, a: entry('c', { category: 'didone serif' }) }, 'a');

    // Two decisive picks: the tally says 2, and the decisive count says 2 —
    // but the decisive count is the only one safe to quote as "twice".
    expect(p.decisive.category['didone serif']).toBe(2);
    expect(p.seen.category).toBe(2);
  });

  it('records the winner only, never the loser', () => {
    const duel: TypeDuel = {
      kind: 'type',
      a: entry('a', { category: 'didone serif' }),
      b: entry('b', { category: 'geometric sans' }),
      targets: ['category'],
    };
    const p = recordPick(emptyProfile(), duel, 'b');
    expect(p.axis.category['geometric sans']).toBe(1);
    expect(p.axis.category['didone serif']).toBeUndefined();
  });
});

describe('recordPick — world duels', () => {
  it('counts mood and era at full strength', () => {
    const duel: WorldDuel = { kind: 'world', a: image('a'), b: image('b') };
    const p = recordPick(emptyProfile(), duel, 'a');

    expect(p.moods['industrial']).toBe(1);
    expect(p.moods['brutalist']).toBe(1);
    expect(p.eras['19th-century industrial']).toBe(1);
  });

  it('discounts letterform axes, and only counts ones the image was tagged with', () => {
    const duel: WorldDuel = {
      kind: 'world',
      a: image('a', { category: 'slab serif' }),
      b: image('b'),
    };
    const p = recordPick(emptyProfile(), duel, 'a');

    expect(p.axis.category['slab serif']).toBe(WORLD_AXIS_WEIGHT);
    // No weight was legible in the photograph, so no weight vote was cast.
    expect(Object.keys(p.axis.weight)).toHaveLength(0);
    // A photograph is never decisive evidence about letterforms.
    expect(Object.keys(p.decisive.category)).toHaveLength(0);
  });

  it('a world pick cannot outvote a specimen pick on the same axis', () => {
    const world: WorldDuel = {
      kind: 'world',
      a: image('w', { category: 'slab serif' }),
      b: image('x'),
    };
    const spec: TypeDuel = {
      kind: 'type',
      a: entry('s', { category: 'didone serif' }),
      b: entry('t'),
      targets: ['category'],
    };
    let p = recordPick(emptyProfile(), world, 'a');
    p = recordPick(p, spec, 'a');

    expect(p.axis.category['didone serif']).toBeGreaterThan(p.axis.category['slab serif']);
  });
});

describe('recordSkip', () => {
  it('advances the round and burns the specimens without recording a vote', () => {
    const duel: TypeDuel = { kind: 'type', a: entry('a'), b: entry('b'), targets: ['category'] };
    const p = recordSkip(emptyProfile(), duel);

    expect(p.round).toBe(1);
    expect(p.shown).toEqual(['a', 'b']);
    for (const ax of QUIZ_AXES) expect(Object.keys(p.axis[ax])).toHaveLength(0);
  });

  it('burns world images on the world side', () => {
    const duel: WorldDuel = { kind: 'world', a: image('a'), b: image('b') };
    const p = recordSkip(emptyProfile(), duel);
    expect(p.worldShown).toEqual(['a', 'b']);
    expect(Object.keys(p.moods)).toHaveLength(0);
  });
});

describe('duel scheduling', () => {
  const atlas = Array.from({ length: 40 }, (_, i) =>
    entry(`e${i}`, {
      category: i % 2 ? 'didone serif' : 'geometric sans',
      weight: i % 3 ? 'bold' : 'light',
    }),
  );
  const world = Array.from({ length: 20 }, (_, i) =>
    image(`w${i}`, {
      mood: i % 2 ? ['clinical', 'severe'] : ['warm', 'literary'],
      era: i % 2 ? '1950s Swiss' : '15th-century humanist',
      theme: i % 3 ? 'poster' : 'neon',
    }),
  );

  it('puts a world duel on the scheduled rounds and specimens elsewhere', () => {
    const rng = mulberry32(42);
    for (let round = 0; round < QUIZ_LENGTH; round++) {
      const p = { ...emptyProfile(), round };
      const duel = nextDuel(p, atlas, rng, world);
      expect(duel).not.toBeNull();
      expect(duel!.kind).toBe(isWorldRound(round) ? 'world' : 'type');
    }
  });

  it('falls back to a specimen duel when there are no images', () => {
    const rng = mulberry32(1);
    const p = { ...emptyProfile(), round: 1 }; // a world round
    expect(isWorldRound(1)).toBe(true);
    expect(nextDuel(p, atlas, rng, [])!.kind).toBe('type');
  });

  it('never repeats a specimen across a full run', () => {
    const rng = mulberry32(7);
    let p = emptyProfile();
    const seen = new Set<string>();
    for (let i = 0; i < QUIZ_LENGTH; i++) {
      const duel = nextDuel(p, atlas, rng, world);
      if (!duel) break;
      const ids = duel.kind === 'world' ? [duel.a.id, duel.b.id] : [duel.a.slug, duel.b.slug];
      for (const id of ids) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
      p = recordPick(p, duel, 'a');
    }
  });

  it('never pairs a specimen against itself', () => {
    const rng = mulberry32(99);
    let p = emptyProfile();
    for (let i = 0; i < QUIZ_LENGTH; i++) {
      const duel = nextDuel(p, atlas, rng, world);
      if (!duel) break;
      if (duel.kind === 'world') expect(duel.a.id).not.toBe(duel.b.id);
      else expect(duel.a.slug).not.toBe(duel.b.slug);
      p = recordPick(p, duel, 'b');
    }
  });
});
