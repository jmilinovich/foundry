import { describe, expect, it } from 'vitest';

import googleFonts from '@/lib/data/google-fonts.json';
import type { Genome } from '@/lib/genome';
import {
  genomeDistance,
  googleCssUrl,
  profileToVector,
  recommend,
  scoreGenome,
  type GoogleFont,
} from '@/lib/recommend';
import { emptyProfile, type AtlasEntry, type TasteProfile } from '@/lib/taste';

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

/** A profile that voted hard and consistently for one set of genes. */
function profileFor(votes: Partial<Record<string, string>>, moods: string[] = []): TasteProfile {
  const p = emptyProfile();
  for (const [ax, v] of Object.entries(votes)) {
    if (!v) continue;
    p.axis[ax as keyof typeof p.axis][v] = 8;
    p.decisive[ax as keyof typeof p.decisive][v] = 8;
    p.seen[ax as keyof typeof p.seen] = 8;
  }
  for (const m of moods) p.moods[m] = 5;
  p.round = 12;
  return p;
}

describe('profileToVector', () => {
  it('collapses an axis to the weighted mean index', () => {
    const p = emptyProfile();
    // grotesque sans is index 2, humanist sans is index 3; equal weight → 2.5
    p.axis.category['grotesque sans'] = 3;
    p.axis.category['humanist sans'] = 3;
    expect(profileToVector(p).axis.category).toBeCloseTo(2.5);
  });

  it('leaves an unvoted axis undefined rather than defaulting it to zero', () => {
    const vec = profileToVector(emptyProfile());
    expect(vec.axis.category).toBeUndefined();
    expect(vec.axis.weight).toBeUndefined();
  });

  it('ignores values that are not part of the genome', () => {
    const p = emptyProfile();
    p.axis.category['a brand identity'] = 99; // a legacy value; not a category
    p.axis.category['didone serif'] = 1;
    // Index of didone is 9; the junk must not drag the mean.
    expect(profileToVector(p).axis.category).toBeCloseTo(9);
  });
});

describe('scoreGenome', () => {
  it('scores an exact match at or near 1 and an opposite one much lower', () => {
    const vec = profileToVector(profileFor({ category: 'didone serif', contrast: 'extreme contrast' }));
    const near = scoreGenome(vec, genome({ category: 'didone serif', contrast: 'extreme contrast' }));
    const far = scoreGenome(vec, genome({ category: 'geometric sans', contrast: 'monoline' }));

    expect(near.score).toBeGreaterThan(0.9);
    expect(far.score).toBeLessThan(0.45);
    expect(near.score).toBeGreaterThan(far.score);
  });

  it('never returns a score outside 0..1', () => {
    const vec = profileToVector(profileFor({ category: 'slab serif', weight: 'ultra-heavy' }, ['brutalist']));
    for (const f of GOOGLE) {
      const { score } = scoreGenome(vec, f.genome);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('an empty profile does not crash or pretend to know anything', () => {
    const vec = profileToVector(emptyProfile());
    const { score, strengths } = scoreGenome(vec, genome());
    expect(Number.isFinite(score)).toBe(true);
    expect(strengths).toEqual([]);
  });
});

describe('recommend', () => {
  const library: AtlasEntry[] = [
    ...Array.from({ length: 8 }, (_, i) => ({
      slug: `didone${i}`,
      name: `Didone ${i}`,
      genome: genome({ category: 'didone serif', contrast: 'extreme contrast' }),
    })),
    { slug: 'geo', name: 'Geo', genome: genome({ category: 'geometric sans', contrast: 'monoline' }) },
    { slug: 'slab', name: 'Slab', genome: genome({ category: 'slab serif', contrast: 'monoline' }) },
  ];

  it('returns the requested number of results', () => {
    const vec = profileToVector(profileFor({ category: 'didone serif' }));
    expect(recommend(vec, library, 6)).toHaveLength(6);
  });

  it('puts the closest match first', () => {
    const vec = profileToVector(profileFor({ category: 'geometric sans', contrast: 'monoline' }));
    expect(recommend(vec, library, 3)[0].item.slug).toBe('geo');
  });

  it('does not return six copies of the same idea', () => {
    // Eight identical didones are in the library; diversity must skip the clones
    // before falling back to them.
    const vec = profileToVector(profileFor({ category: 'didone serif' }));
    const picks = recommend(vec, library, 3);
    const distinctGenomes = new Set(picks.map((p) => JSON.stringify(p.item.genome)));
    expect(distinctGenomes.size).toBeGreaterThan(1);
  });

  it('backfills rather than returning short when the library is clustered', () => {
    const vec = profileToVector(profileFor({ category: 'didone serif' }));
    expect(recommend(vec, library, 9)).toHaveLength(9);
  });

  it('is deterministic', () => {
    const vec = profileToVector(profileFor({ category: 'humanist serif' }, ['literary']));
    const a = recommend(vec, GOOGLE, 6).map((m) => m.item.family);
    const b = recommend(vec, GOOGLE, 6).map((m) => m.item.family);
    expect(a).toEqual(b);
  });
});

describe('the real Google Fonts library', () => {
  it('matches a strong didone profile to actual didones', () => {
    const vec = profileToVector(
      profileFor({ category: 'didone serif', contrast: 'extreme contrast', weight: 'regular' }, ['elegant', 'editorial']),
    );
    const picks = recommend(vec, GOOGLE, 6);
    const serifs = picks.filter((p) => /serif/.test(p.item.genome.category));
    expect(serifs.length).toBeGreaterThanOrEqual(4);
  });

  it('matches a geometric monoline profile to sans faces, not serifs', () => {
    const vec = profileToVector(
      profileFor({ category: 'geometric sans', contrast: 'monoline', terminals: 'blunt cut' }, ['futuristic', 'clinical']),
    );
    const picks = recommend(vec, GOOGLE, 6);
    const sans = picks.filter((p) => /sans/.test(p.item.genome.category));
    expect(sans.length).toBeGreaterThanOrEqual(5);
  });

  it('gives different profiles different recommendations', () => {
    const a = recommend(
      profileToVector(profileFor({ category: 'didone serif', contrast: 'extreme contrast' })),
      GOOGLE,
      6,
    ).map((m) => m.item.family);
    const b = recommend(
      profileToVector(profileFor({ category: 'geometric sans', contrast: 'monoline' })),
      GOOGLE,
      6,
    ).map((m) => m.item.family);
    expect(a).not.toEqual(b);
    expect(a.filter((f) => b.includes(f)).length).toBeLessThan(3);
  });
});

describe('specialist faces do not crowd out usable ones', () => {
  it('caps scripts at one per set, even when they score well', () => {
    for (const profile of [
      profileFor({ category: 'geometric sans', contrast: 'monoline', weight: 'light' }, ['elegant']),
      profileFor({ category: 'humanist sans', contrast: 'low contrast' }, ['warm', 'playful']),
      profileFor({ category: 'slab serif', weight: 'bold' }, ['playful', 'nostalgic']),
    ]) {
      const picks = recommend(profileToVector(profile), GOOGLE, 6);
      const scripts = picks.filter((p) => p.item.kind === 'script');
      expect(scripts.length).toBeLessThanOrEqual(1);
    }
  });

  it('keeps most of a set usable for setting text', () => {
    for (let i = 0; i < 5; i++) {
      const profile = profileFor(
        {
          category: (['geometric sans', 'didone serif', 'slab serif', 'humanist sans', 'grotesque sans'] as const)[i],
          contrast: (['monoline', 'extreme contrast', 'low contrast', 'moderate contrast', 'very low contrast'] as const)[i],
        },
        [(['futuristic', 'elegant', 'industrial', 'warm', 'clinical'] as const)[i]],
      );
      const picks = recommend(profileToVector(profile), GOOGLE, 6);
      const specialist = picks.filter((p) => p.item.kind === 'script' || p.item.kind === 'display');
      expect(specialist.length).toBeLessThanOrEqual(3);
    }
  });

  it('still returns a full set', () => {
    const picks = recommend(profileToVector(profileFor({ category: 'didone serif' })), GOOGLE, 6);
    expect(picks).toHaveLength(6);
    expect(new Set(picks.map((p) => p.item.family)).size).toBe(6);
  });
});

describe('genomeDistance', () => {
  it('is zero for identical genomes and symmetric', () => {
    const a = genome({ category: 'didone serif' });
    const b = genome({ category: 'geometric sans' });
    expect(genomeDistance(a, a)).toBe(0);
    expect(genomeDistance(a, b)).toBeCloseTo(genomeDistance(b, a));
  });
});

describe('googleCssUrl', () => {
  it('builds a valid CSS2 URL and escapes multi-word families', () => {
    const font = GOOGLE.find((f) => f.family.includes(' '))!;
    const url = googleCssUrl(font);
    expect(url.startsWith('https://fonts.googleapis.com/css2?family=')).toBe(true);
    expect(url).not.toContain(' ');
    expect(() => new URL(url)).not.toThrow();
  });

  it('only ever requests weights the family actually ships', () => {
    for (const font of GOOGLE.slice(0, 40)) {
      const url = googleCssUrl(font, [400, 700]);
      const wght = decodeURIComponent(url).split('wght@')[1]?.split('&')[0] ?? '';
      for (const w of wght.split(';').filter(Boolean)) {
        expect(font.staticWeights).toContain(Number(w));
      }
    }
  });
});
