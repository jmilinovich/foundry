'use client';

import { useCallback, useRef, useState } from 'react';

import { SAMPLE_PARAGRAPH } from '@/lib/glyphs';
import type { FontRecord } from '@/lib/types';
import { useEmbeddedFace } from './useEmbeddedFace';

/**
 * The pair, seen doing its job — an applied specimen rather than a size ramp.
 * Both faces are embedded as data URIs so the whole sheet exports to PNG with
 * the real fonts baked in (the FontFace API is invisible to html-to-image).
 */
export function PairLookbook({
  display,
  text,
  headline,
}: {
  display: FontRecord;
  text: FontRecord;
  headline: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const d = useEmbeddedFace(display.id, 'standard');
  const t = useEmbeddedFace(text.id, 'standard');
  const ready = d.ready && t.ready;
  const dFam = `"${d.family}", serif`;
  const tFam = `"${t.family}", serif`;

  const exportPng = useCallback(async () => {
    if (!sheetRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(sheetRef.current, {
        pixelRatio: 2,
        backgroundColor: '#f2efe8',
        skipFonts: true, // faces are inlined in the node already
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = `${display.name} + ${text.name} lookbook`.replace(/[^a-zA-Z0-9 +]/g, '') + '.png';
      a.click();
    } catch (err) {
      setError((err as Error).message ?? 'export failed');
    } finally {
      setBusy(false);
    }
  }, [busy, display.name, text.name]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          the pair, applied
        </p>
        <div className="flex items-center gap-4">
          {error && <span className="font-mono text-[11px] text-ink-dim">{error}</span>}
          <button
            onClick={exportPng}
            disabled={busy || !ready}
            className="rounded border border-line px-2.5 py-1 font-mono text-[11px] text-ink-dim transition hover:border-ink hover:text-ink disabled:opacity-50"
          >
            {busy ? 'rendering…' : ready ? '↓ png' : 'embedding…'}
          </button>
        </div>
      </div>

      <div ref={sheetRef} style={{ background: '#f2efe8' }}>
        <style dangerouslySetInnerHTML={{ __html: d.css + t.css }} />

        {/* 1 — editorial: headline (display) over a deck + columns (text) */}
        <section style={{ paddingBottom: 8 }}>
          <div
            className="specimen break-words leading-[0.95]"
            data-loaded={ready}
            style={{ fontFamily: dFam, fontSize: 'clamp(2.5rem, 7vw, 5.5rem)', letterSpacing: '-0.01em' }}
          >
            {headline}
          </div>
          <p
            className="specimen mt-5 max-w-2xl"
            data-loaded={ready}
            style={{ fontFamily: tFam, fontSize: 22, lineHeight: 1.45, color: '#3b362f' }}
          >
            A display face carries the headline; a working text face carries everything else. Here
            they are, splitting the labor of a page.
          </p>
          <div className="mt-8 grid gap-9 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <p
                key={i}
                className="specimen"
                data-loaded={ready}
                style={{ fontFamily: tFam, fontSize: 16, lineHeight: 1.62 }}
              >
                {SAMPLE_PARAGRAPH}
              </p>
            ))}
          </div>
        </section>

        {/* 2 — pull-quote in the display face */}
        <section style={{ borderTop: '1px solid #d9d4c8', marginTop: 40, paddingTop: 40 }}>
          <blockquote
            className="specimen max-w-3xl leading-[1.08]"
            data-loaded={ready}
            style={{ fontFamily: dFam, fontSize: 'clamp(1.6rem, 4vw, 3rem)' }}
          >
            “Bred from the fonts you liked — not the words you couldn’t find.”
          </blockquote>
        </section>

        {/* 3 — the pair in an interface */}
        <section style={{ borderTop: '1px solid #d9d4c8', marginTop: 40, paddingTop: 40, paddingBottom: 8 }}>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            in an interface
          </div>
          <div
            className="mt-4 max-w-sm rounded-lg border p-6"
            style={{ borderColor: '#d9d4c8', background: '#faf8f4' }}
          >
            <div
              className="specimen leading-[1.05]"
              data-loaded={ready}
              style={{ fontFamily: dFam, fontSize: 30 }}
            >
              {display.name}
            </div>
            <p
              className="specimen mt-2"
              data-loaded={ready}
              style={{ fontFamily: tFam, fontSize: 14, lineHeight: 1.55, color: '#3b362f' }}
            >
              A headline set in the display face, with the body and labels below carried by the text
              face — the same split, at interface scale.
            </p>
            <div
              className="mt-4 inline-block rounded px-3 py-1.5 text-[13px]"
              style={{ fontFamily: tFam, background: '#b7302a', color: '#f2efe8' }}
            >
              Download pair
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
