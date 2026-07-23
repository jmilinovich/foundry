/**
 * Outline sampling for the parent → child morph.
 *
 * True outline interpolation between two unrelated typefaces is a research
 * problem: the contours don't correspond, the point counts differ, and the
 * topology can differ outright (a single-storey `a` against a double-storey
 * one). Faking it produces tearing that looks worse than no morph at all.
 *
 * So we don't interpolate outlines — we interpolate a *point cloud* sampled
 * evenly along each glyph's outline by arc length. Correspondence is
 * glyph-to-glyph and index-to-index, which is well-defined no matter how
 * different the two letterforms are, and the swarm in between is the part
 * worth watching anyway.
 */

// opentype.js' ESM build has no default export — named imports only.
import { parse, type Font, type Path } from 'opentype.js';

export type Pt = { x: number; y: number };

const CURVE_SAMPLES = 14;

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u,
    b = 3 * u * u * t,
    c = 3 * u * t * t,
    d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function quad(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

/** Flatten an opentype Path into closed polylines, one per contour. */
export function flatten(path: Path): Pt[][] {
  const contours: Pt[][] = [];
  let current: Pt[] = [];
  let cursor: Pt = { x: 0, y: 0 };

  for (const cmd of path.commands) {
    switch (cmd.type) {
      case 'M':
        if (current.length > 1) contours.push(current);
        current = [{ x: cmd.x, y: cmd.y }];
        cursor = { x: cmd.x, y: cmd.y };
        break;
      case 'L':
        current.push({ x: cmd.x, y: cmd.y });
        cursor = { x: cmd.x, y: cmd.y };
        break;
      case 'C': {
        const end = { x: cmd.x, y: cmd.y };
        for (let i = 1; i <= CURVE_SAMPLES; i++) {
          current.push(
            cubic(cursor, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 }, end, i / CURVE_SAMPLES),
          );
        }
        cursor = end;
        break;
      }
      case 'Q': {
        const end = { x: cmd.x, y: cmd.y };
        for (let i = 1; i <= CURVE_SAMPLES; i++) {
          current.push(quad(cursor, { x: cmd.x1, y: cmd.y1 }, end, i / CURVE_SAMPLES));
        }
        cursor = end;
        break;
      }
      case 'Z':
        if (current.length > 1) {
          current.push({ ...current[0] });
          contours.push(current);
        }
        current = [];
        break;
    }
  }
  if (current.length > 1) contours.push(current);
  return contours;
}

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Resample a set of contours to exactly `n` points, distributed between
 * contours in proportion to their perimeter so the counter of an `o` gets its
 * fair share and doesn't collapse.
 */
export function resample(contours: Pt[][], n: number): Pt[] {
  if (!contours.length) return [];

  const lengths = contours.map((c) => {
    let total = 0;
    for (let i = 1; i < c.length; i++) total += dist(c[i - 1], c[i]);
    return total;
  });
  const grand = lengths.reduce((a, b) => a + b, 0);
  if (grand === 0) return [];

  const out: Pt[] = [];
  contours.forEach((contour, ci) => {
    const share = ci === contours.length - 1 ? n - out.length : Math.round((lengths[ci] / grand) * n);
    const count = Math.max(0, share);
    if (count === 0 || lengths[ci] === 0) return;

    const stepLen = lengths[ci] / count;
    let seg = 1;
    let walked = 0;
    let acc = dist(contour[0], contour[1]);

    for (let k = 0; k < count; k++) {
      const target = k * stepLen;
      while (acc < target && seg < contour.length - 1) {
        walked = acc;
        seg++;
        acc += dist(contour[seg - 1], contour[seg]);
      }
      const segLen = acc - walked || 1;
      const t = Math.max(0, Math.min(1, (target - walked) / segLen));
      const a = contour[seg - 1];
      const b = contour[seg];
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  });

  // Rounding can leave us a point or two short of n.
  while (out.length < n && out.length) out.push({ ...out[out.length - 1] });
  return out.slice(0, n);
}

export type GlyphCloud = {
  /** Evenly resampled outline points — what the morph interpolates. */
  points: Pt[];
  /** The placed contours, so the canvas can fill crisp letterforms at rest. */
  contours: Pt[][];
};

export async function loadFont(url: string): Promise<Font> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load font: ${res.status}`);
  return parse(await res.arrayBuffer());
}

/**
 * Sample a string in a font, one cloud per character, normalised so that the
 * whole string fits `box`. Normalising globally (rather than per glyph) keeps
 * each typeface's own proportions intact — the width difference between a
 * condensed parent and an extended child is part of what you're watching.
 */
export function sampleString(
  font: Font,
  text: string,
  pointsPerGlyph: number,
  box: { width: number; height: number },
): GlyphCloud[] {
  const SIZE = 200;
  const paths = font.getPaths(text, 0, 0, SIZE);

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of paths) {
    const bb = p.getBoundingBox();
    if (!isFinite(bb.x1)) continue;
    minX = Math.min(minX, bb.x1);
    minY = Math.min(minY, bb.y1);
    maxX = Math.max(maxX, bb.x2);
    maxY = Math.max(maxY, bb.y2);
  }
  if (!isFinite(minX)) return [];

  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = Math.min(box.width / w, box.height / h);
  const offX = (box.width - w * scale) / 2 - minX * scale;
  const offY = (box.height - h * scale) / 2 - minY * scale;

  const place = (p: Pt): Pt => ({ x: p.x * scale + offX, y: p.y * scale + offY });

  return paths.map((path) => {
    const contours = flatten(path).map((c) => c.map(place));
    return { points: resample(contours, pointsPerGlyph), contours };
  });
}

/** Pair two strings' clouds by glyph index, padding whichever is shorter. */
export function pair(a: GlyphCloud[], b: GlyphCloud[]): { from: Pt[]; to: Pt[] }[] {
  const n = Math.max(a.length, b.length);
  const out: { from: Pt[]; to: Pt[] }[] = [];
  for (let i = 0; i < n; i++) {
    const from = a[i]?.points ?? [];
    const to = b[i]?.points ?? [];
    if (!from.length || !to.length) continue;
    const count = Math.min(from.length, to.length);
    out.push({ from: from.slice(0, count), to: to.slice(0, count) });
  }
  return out;
}
