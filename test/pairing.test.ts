import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import googleFonts from '@/lib/data/google-fonts.json';
import { STANCES, type Genome, type Stance } from '@/lib/genome';
import { explainMatch, findPartners, readableAsText, scorePartner } from '@/lib/pairing';
import type { GoogleFont } from '@/lib/recommend';
import type { AtlasEntry } from '@/lib/taste';

const ATLAS = JSON.parse(readFileSync('public/atlas/manifest.json', 'utf8')) as AtlasEntry[];
const GOOGLE = googleFonts as unknown as GoogleFont[];
const anyFace = ATLAS[0];

const opts = (stance: Stance, slot: 'text' | 'display' = 'text') => ({
  slot,
  stance,
  house: ATLAS,
  google: GOOGLE,
  excludeSlug: anyFace.slug,
});

describe('pairing costs nothing and always answers', () => {
  it('finds partners for every face in the library, in every stance', () => {
    for (const e of ATLAS) {
      for (const { id } of STANCES) {
        const p = findPartners(e.genome, {
          slot: 'text',
          stance: id,
          house: ATLAS,
          google: GOOGLE,
          excludeSlug: e.slug,
        });
        // An empty list is a dead end on a page whose whole purpose is to
        // answer "what do I set the body copy in".
        expect(p.length, `${e.slug} / ${id}`).toBeGreaterThan(0);
      }
    }
  });

  it('never offers a face against itself', () => {
    for (const { id } of STANCES) {
      const p = findPartners(anyFace.genome, opts(id));
      expect(p.some((m) => m.source === 'house' && m.id === anyFace.slug)).toBe(false);
    }
  });

  it('draws on both libraries rather than one', () => {
    // If either library never surfaces, the ranking is broken or the weighting
    // has quietly excluded one of them.
    const all = ATLAS.slice(0, 40).flatMap((e) =>
      findPartners(e.genome, {
        slot: 'text',
        stance: 'classic',
        house: ATLAS,
        google: GOOGLE,
        excludeSlug: e.slug,
      }),
    );
    expect(all.some((m) => m.source === 'google')).toBe(true);
    expect(all.some((m) => m.source === 'house')).toBe(true);
  });
});

describe('the body-copy slot only offers body copy', () => {
  it('never suggests a display, script or mono Google family as text', () => {
    const byFamily = new Map(GOOGLE.map((f) => [f.family, f]));
    for (const e of ATLAS.slice(0, 60)) {
      for (const { id } of STANCES) {
        for (const m of findPartners(e.genome, {
          slot: 'text',
          stance: id,
          house: ATLAS,
          google: GOOGLE,
          excludeSlug: e.slug,
        })) {
          if (m.source !== 'google') continue;
          // Courier Prime scored 79% as the partner for a didone before this
          // gate existed. On the axes it is measured on it genuinely is close;
          // nobody sets a paragraph in it under a display serif.
          expect(byFamily.get(m.id)?.kind, `${m.id} for ${e.slug}`).toBe('text');
        }
      }
    }
  });

  it('never suggests a house face that is unreadable at 16px', () => {
    for (const e of ATLAS.slice(0, 60)) {
      for (const m of findPartners(e.genome, opts('classic'))) {
        if (m.source !== 'house') continue;
        expect(readableAsText(m.genome), `${m.id}`).toBe(true);
      }
    }
  });

  it('applies no such gate to the display slot', () => {
    // Looking for a display face should be able to return something with
    // extreme weight or width — that is the whole point of a display face.
    const wide = ATLAS.filter((e) => !readableAsText(e.genome));
    expect(wide.length).toBeGreaterThan(0);
  });
});

describe('a stance means what it says', () => {
  const distance = (a: string[], x: string, y: string) =>
    Math.abs(a.indexOf(x) - a.indexOf(y)) / (a.length - 1);

  it('superfamily returns nearer category matches than tension does', () => {
    let superSum = 0;
    let tensionSum = 0;
    const sample = ATLAS.slice(0, 40);
    for (const e of sample) {
      const s = findPartners(e.genome, { ...opts('superfamily'), excludeSlug: e.slug, limit: 3 });
      const t = findPartners(e.genome, { ...opts('tension'), excludeSlug: e.slug, limit: 3 });
      const cats = [...new Set(ATLAS.map((x) => x.genome.category))];
      for (const m of s) superSum += distance(cats, e.genome.category, m.genome.category);
      for (const m of t) tensionSum += distance(cats, e.genome.category, m.genome.category);
    }
    // Not a threshold on either number — just the ordering the stance promises.
    expect(superSum).toBeLessThan(tensionSum);
  });

  it('scores a face against itself as a near-perfect superfamily match', () => {
    const { score } = scorePartner(anyFace.genome, anyFace.genome, 'superfamily');
    expect(score).toBeGreaterThan(0.95);
  });

  it('scores a face against itself poorly under tension', () => {
    const { score } = scorePartner(anyFace.genome, anyFace.genome, 'tension');
    expect(score).toBeLessThan(0.5);
  });
});

describe('the explanation names something a person would notice', () => {
  /**
   * Ranking the reasons by raw satisfaction made corner and texture win almost
   * every time — nearly every face is crisp and clean, so those scored a
   * perfect 1.0 constantly and "the same corner treatment, the same surface"
   * became the caption on the entire list. Reasons are ranked by contribution.
   */
  it('does not fall back to corner and texture for everything', () => {
    const reasons = ATLAS.slice(0, 50).flatMap((e) =>
      findPartners(e.genome, { ...opts('classic'), excludeSlug: e.slug, limit: 3 }).map((m) => m.why),
    );
    const dull = reasons.filter((r) => /corner|surface/.test(r)).length;
    expect(dull / reasons.length).toBeLessThan(0.34);
  });

  it('always says something', () => {
    for (const e of ATLAS.slice(0, 30)) {
      for (const { id } of STANCES) {
        for (const m of findPartners(e.genome, { ...opts(id), excludeSlug: e.slug, limit: 3 })) {
          expect(m.why.length, `${m.id}`).toBeGreaterThan(8);
        }
      }
    }
  });

  it('reports nothing rather than inventing a reason when nothing fits', () => {
    expect(explainMatch([])).toBe('a loose fit on every axis');
  });
});

describe('the ranking is deterministic', () => {
  /**
   * The result is a linkable page rendered at build time. If the order moved
   * between two evaluations the page would contradict itself between deploys.
   */
  it('returns the identical list for the identical input', () => {
    for (const { id } of STANCES) {
      const a = findPartners(anyFace.genome, opts(id));
      const b = findPartners(anyFace.genome, opts(id));
      expect(a).toEqual(b);
    }
  });

  it('breaks score ties by name so equal matches never reshuffle', () => {
    const p = findPartners(anyFace.genome, { ...opts('classic'), limit: 40 });
    for (let i = 1; i < p.length; i++) {
      if (p[i].score !== p[i - 1].score) continue;
      expect(p[i - 1].name.localeCompare(p[i].name)).toBeLessThanOrEqual(0);
    }
  });
});

describe('pairing runs no model and needs no network', () => {
  it('is pure arithmetic over data already on disk', () => {
    const src = readFileSync('lib/pairing.ts', 'utf8');
    expect(src).not.toMatch(/\bfetch\(|mixfont|openai|anthropic|api\./i);
    expect(src).not.toMatch(/Math\.random|Date\.now/);
  });
});

describe('the matcher and the generator agree on every stance', () => {
  /**
   * lib/pairing.ts restates STANCE_RULES from genome.ts rather than importing
   * it, because one describes how to draw a partner and the other how to
   * recognise one. They are allowed to diverge deliberately, but not by
   * accident: a silent drift would mean the free list and the paid generation
   * are answering different questions under the same word.
   */
  it('carries the same relation for every axis in both files', () => {
    const grab = (src: string, name: string) => {
      const start = src.indexOf(`const ${name}`);
      const body = src.slice(start, src.indexOf('\n};', start));
      const out: Record<string, Record<string, string>> = {};
      let stance = '';
      for (const line of body.split('\n')) {
        const s = line.match(/^\s{2}(\w+):\s*\{/);
        if (s) {
          stance = s[1];
          out[stance] = {};
          continue;
        }
        const a = line.match(/^\s{4}(\w+):\s*'(\w+)'/);
        if (a && stance) out[stance][a[1]] = a[2];
      }
      return out;
    };

    const gen = grab(readFileSync('lib/genome.ts', 'utf8'), 'STANCE_RULES');
    const match = grab(readFileSync('lib/pairing.ts', 'utf8'), 'INTENT');

    expect(Object.keys(gen).sort()).toEqual(Object.keys(match).sort());
    for (const stance of Object.keys(gen)) {
      for (const axis of Object.keys(match[stance])) {
        expect(match[stance][axis], `${stance}.${axis}`).toBe(gen[stance][axis]);
      }
    }
  });
});

describe('every genome axis the matcher reads actually exists in both libraries', () => {
  it('has a complete genome on every Google family', () => {
    const AXES = ['category', 'weight', 'width', 'contrast', 'terminals', 'xheight', 'corner', 'texture', 'era'];
    for (const f of GOOGLE) {
      for (const ax of AXES) {
        expect((f.genome as unknown as Record<string, unknown>)[ax], `${f.family}.${ax}`).toBeTruthy();
      }
      expect(f.genome.mood).toHaveLength(2);
    }
  });

  it('has a complete genome on every house face', () => {
    for (const e of ATLAS) {
      expect((e.genome as unknown as Record<string, string>).xheight, e.slug).toBeTruthy();
      expect((e.genome as unknown as Record<string, string>).corner, e.slug).toBeTruthy();
      expect((e.genome as unknown as Record<string, string>).texture, e.slug).toBeTruthy();
    }
  });
});

/** Guard the type import so an unused-import cleanup can't silently widen it. */
const _typed: Genome = anyFace.genome;
void _typed;
