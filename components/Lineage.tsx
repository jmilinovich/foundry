'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Genome } from '@/lib/genome';
import { loadFont, pair, sampleString, type GlyphCloud, type Pt } from '@/lib/morph';
import type { FontRecord } from '@/lib/types';

const POINTS_PER_GLYPH = 260;

/** Which genes actually changed between parent and child. */
function diff(from: Genome, to: Genome): { gene: string; from: string; to: string }[] {
  const out: { gene: string; from: string; to: string }[] = [];
  for (const key of Object.keys(to) as (keyof Genome)[]) {
    const a = Array.isArray(from[key]) ? (from[key] as string[]).join('+') : String(from[key]);
    const b = Array.isArray(to[key]) ? (to[key] as string[]).join('+') : String(to[key]);
    if (a !== b) out.push({ gene: key, from: a, to: b });
  }
  return out;
}

// Deterministic per-point scatter, so the swarm blooms outward instead of
// sliding in straight lines — and looks the same on every replay.
function scatter(i: number): { dx: number; dy: number } {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  const angle = (a - Math.floor(a)) * Math.PI * 2;
  const mag = 14 + (b - Math.floor(b)) * 42;
  return { dx: Math.cos(angle) * mag, dy: Math.sin(angle) * mag };
}

export function Lineage({
  child,
  fonts,
  text,
  onClose,
  inline = false,
}: {
  child: FontRecord;
  fonts: FontRecord[];
  text: string;
  onClose?: () => void;
  /** Rendered as a tab on the font detail page rather than a fullscreen overlay. */
  inline?: boolean;
}) {
  const parents = useMemo(
    () => child.parents.map((id) => fonts.find((f) => f.id === id)).filter((f): f is FontRecord => !!f),
    [child.parents, fonts],
  );
  const [parentId, setParentId] = useState(parents[0]?.id ?? '');
  const parent = parents.find((p) => p.id === parentId) ?? parents[0];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!parent) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf = 0;
    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        const [fa, fb] = await Promise.all([
          loadFont(`/api/fonts/${parent.id}`),
          loadFont(`/api/fonts/${child.id}`),
        ]);
        if (cancelled) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssW = canvas.clientWidth;
        const cssH = canvas.clientHeight;
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;

        const box = { width: cssW * 0.8, height: cssH * 0.56 };
        const pad = { x: (cssW - box.width) / 2, y: (cssH - box.height) / 2 };

        const from = sampleString(fa, text, POINTS_PER_GLYPH, box);
        const to = sampleString(fb, text, POINTS_PER_GLYPH, box);
        const pairs = pair(from, to);
        if (!pairs.length) throw new Error('no outlines to sample');

        setStatus('ready');

        const ctx = canvas.getContext('2d')!;
        ctx.scale(dpr, dpr);

        const DURATION = 2200;
        const HOLD = 1100;
        const CYCLE = (DURATION + HOLD) * 2;
        const start = performance.now();

        const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

        const drawFill = (clouds: GlyphCloud[], alpha: number) => {
          if (alpha <= 0.01) return;
          ctx.fillStyle = `rgba(242, 239, 232, ${alpha})`;
          // One path per glyph. Condensed faces have tight sidebearings, so
          // filling the whole string as a single evenodd path lets adjacent
          // glyphs cancel each other's winding and eat their own strokes.
          for (const glyph of clouds) {
            ctx.beginPath();
            for (const contour of glyph.contours) {
              contour.forEach((pt, i) => {
                const x = pt.x + pad.x;
                const y = pt.y + pad.y;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              });
              ctx.closePath();
            }
            // evenodd within a glyph so counters (the hole in an `o`) punch through.
            ctx.fill('evenodd');
          }
        };

        const frame = (now: number) => {
          if (cancelled) return;
          const elapsed = (now - start) % CYCLE;

          // 0 → 1 → hold → 1 → 0 → hold
          let raw: number;
          if (elapsed < DURATION) raw = elapsed / DURATION;
          else if (elapsed < DURATION + HOLD) raw = 1;
          else if (elapsed < DURATION * 2 + HOLD) raw = 1 - (elapsed - DURATION - HOLD) / DURATION;
          else raw = 0;

          const t = ease(Math.max(0, Math.min(1, raw)));

          ctx.clearRect(0, 0, cssW, cssH);

          const fromFill = Math.max(0, Math.min(1, 1 - t / 0.16));
          const toFill = Math.max(0, Math.min(1, (t - 0.84) / 0.16));
          drawFill(from, fromFill);
          drawFill(to, toFill);

          const swarm = 1 - Math.max(fromFill, toFill);
          if (swarm > 0.01) {
            const bloom = Math.sin(Math.PI * t);
            let i = 0;
            pairs.forEach((glyph, gi) => {
              // Stagger the glyphs so the change reads as a wave across the word.
              const lag = Math.max(0, Math.min(1, (t - gi * 0.035) / (1 - gi * 0.035 || 1)));
              const gt = ease(lag);
              const gBloom = Math.sin(Math.PI * gt);
              for (let k = 0; k < glyph.from.length; k++, i++) {
                const a: Pt = glyph.from[k];
                const b: Pt = glyph.to[k];
                const s = scatter(i);
                const x = a.x + (b.x - a.x) * gt + s.dx * gBloom * 0.5 + pad.x;
                const y = a.y + (b.y - a.y) * gt + s.dy * gBloom * 0.5 + pad.y;
                ctx.fillStyle =
                  bloom > 0.6
                    ? `rgba(255, 138, 61, ${swarm * 0.85})`
                    : `rgba(242, 239, 232, ${swarm * 0.8})`;
                ctx.fillRect(x, y, 1.4, 1.4);
              }
            });
          }

          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [parent, child.id, text]);

  useEffect(() => {
    if (inline || !onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, inline]);

  if (!parent) return null;
  const changes = diff(parent.genome, child.genome);

  return (
    <div
      className={
        inline ? 'flex flex-col' : 'fixed inset-0 z-50 flex flex-col bg-ground'
      }
      onClick={inline ? undefined : onClose}
    >
      <div
        className={`mx-auto flex w-full max-w-[1200px] flex-col ${inline ? '' : 'h-full px-6 py-6'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <div className="font-mono text-[11px] text-ink-faint">
            <span className="text-ink-dim">{parent.name}</span>
            <span className="mx-2 text-amber">→</span>
            <span className="text-ink-dim">{child.name}</span>
          </div>
          {!inline && (
            <button
              onClick={onClose}
              className="font-mono text-[11px] text-ink-faint hover:text-amber"
            >
              esc
            </button>
          )}
        </div>

        <canvas
          ref={canvasRef}
          className={inline ? 'h-[460px] w-full' : 'min-h-0 w-full flex-1'}
        />

        {status === 'loading' && (
          <p className="text-center font-mono text-[11px] text-ink-faint">sampling outlines…</p>
        )}
        {status === 'error' && (
          <p className="text-center font-mono text-[11px] text-red-400">
            couldn&apos;t sample these outlines
          </p>
        )}

        {parents.length > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {parents.map((p) => (
              <button
                key={p.id}
                onClick={() => setParentId(p.id)}
                className={`rounded border px-2 py-1 font-mono text-[10.5px] transition ${
                  p.id === parent.id
                    ? 'border-amber text-amber'
                    : 'border-line text-ink-faint hover:text-ink-dim'
                }`}
              >
                from {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            {changes.length} genes changed
          </p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
            {changes.map((c) => (
              <span key={c.gene} className="font-mono text-[11px]">
                <span className="text-ink-faint">{c.gene}</span>{' '}
                <span className="text-ink-faint line-through decoration-ink-faint/50">{c.from}</span>{' '}
                <span className="text-amber">{c.to}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
