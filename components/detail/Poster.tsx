'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { toGenotype } from '@/lib/genome';
import { SAMPLE_PARAGRAPH } from '@/lib/glyphs';
import type { FontRecord, GlyphSetName } from '@/lib/types';
import { useEmbeddedFace } from './useEmbeddedFace';

// Fixed poster geometry so the export is deterministic; the wrapper scales it
// down to fit whatever viewport you're looking at it in.
const W = 900;
const H = 1350;

export function Poster({
  display,
  text,
  specimen,
  glyphSet,
}: {
  display: FontRecord;
  /** Present in pair mode: the text face that sets the body copy. */
  text?: FontRecord | null;
  specimen: string;
  glyphSet: GlyphSetName;
}) {
  const posterRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayFace = useEmbeddedFace(display.id, glyphSet);
  const textFace = useEmbeddedFace(text?.id ?? null, glyphSet);
  const isPair = !!text;

  // Fit the fixed-size poster into the available width.
  useEffect(() => {
    const fit = () => {
      const w = wrapRef.current?.clientWidth ?? W;
      setScale(Math.min(1, w / W));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const bodyFamily = isPair && textFace.ready ? textFace.family : displayFace.family;

  const exportPng = useCallback(async () => {
    if (!posterRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 2,
        width: W,
        height: H,
        backgroundColor: '#0b0b0c',
        // The faces are already inlined as data URIs inside the node, so there
        // is nothing for the library to go and fetch.
        skipFonts: true,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${display.name.replace(/[^a-zA-Z0-9 _-]/g, '')}${isPair ? ' pair' : ''} specimen.png`;
      a.click();
    } catch (err) {
      setError((err as Error).message ?? 'export failed');
    } finally {
      setBusy(false);
    }
  }, [busy, display.name, isPair]);

  const ready = displayFace.ready && (!isPair || textFace.ready);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[11px] text-ink-faint">
          {isPair ? 'pair specimen' : 'specimen'} · 900 × 1350 · exports at 2×
        </p>
        <div className="flex items-center gap-4">
          {error && <span className="font-mono text-[11px] text-red-400">{error}</span>}
          <button
            onClick={exportPng}
            disabled={busy || !ready}
            className="rounded bg-accent px-3 py-1.5 font-mono text-[11px] text-paper transition disabled:bg-panel disabled:text-ink-faint hover:enabled:brightness-110"
          >
            {busy ? 'rendering…' : ready ? '↓ png' : 'embedding fonts…'}
          </button>
        </div>
      </div>

      <div ref={wrapRef} className="w-full">
        <div
          style={{
            height: H * scale,
            width: W * scale,
            margin: '0 auto',
          }}
        >
          <div
            ref={posterRef}
            style={{
              width: W,
              height: H,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              background: '#0b0b0c',
              color: '#f2efe8',
            }}
            className="relative overflow-hidden"
          >
            <style dangerouslySetInnerHTML={{ __html: displayFace.css + textFace.css }} />

            {/* top rule */}
            <div
              className="absolute inset-x-0 top-0 flex items-baseline justify-between px-14 pt-12"
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.2em' }}
            >
              <span style={{ color: '#8b877e' }}>FOUNDRY</span>
              <span style={{ color: '#4a4741' }}>
                GEN {display.generation} · {display.lineage.toUpperCase()}
                {glyphSet === 'extended' ? ' · 319' : ' · 72'}
              </span>
            </div>

            {/* the giant — cropped at the baseline so it bleeds off the grid */}
            <div
              style={{
                fontFamily: `"${displayFace.family}", serif`,
                fontSize: 430,
                // Enough clearance that a tall ascender can't ride up into the
                // top rule — some of these faces have very long extenders.
                lineHeight: 0.82,
                marginTop: 150,
                marginLeft: 44,
                letterSpacing: '-0.03em',
              }}
            >
              Aa
            </div>

            {/* Information block anchored to the foot, so the composition is a
                giant up top, data at the bottom, and air in between rather than
                a stack that runs out halfway down. */}
            <div className="absolute inset-x-0 px-14" style={{ bottom: 122 }}>
              <div
                style={{
                  fontFamily: `"${displayFace.family}", serif`,
                  fontSize: 72,
                  lineHeight: 1.02,
                  letterSpacing: '-0.02em',
                }}
              >
                {display.name}
              </div>

              {isPair && text && (
                <div
                  style={{
                    fontFamily: `"${textFace.family}", serif`,
                    fontSize: 28,
                    marginTop: 12,
                    color: '#8b877e',
                  }}
                >
                  set with {text.name}
                </div>
              )}

              <div
                style={{
                  fontFamily: `"${displayFace.family}", serif`,
                  fontSize: 24,
                  lineHeight: 1.5,
                  marginTop: 26,
                  color: '#8b877e',
                  wordBreak: 'break-all',
                }}
              >
                ABCDEFGHIJKLMNOPQRSTUVWXYZ
                <br />
                abcdefghijklmnopqrstuvwxyz 0123456789
              </div>

              {/* A short waterfall — specimen furniture, and it fills the middle. */}
              <div style={{ marginTop: 30 }}>
                {[46, 30, 20].map((size) => (
                  <div
                    key={size}
                    style={{
                      fontFamily: `"${displayFace.family}", serif`,
                      fontSize: size,
                      lineHeight: 1.28,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    }}
                  >
                    {specimen}
                  </div>
                ))}
              </div>

              <div
                style={{
                  fontFamily: `"${bodyFamily}", serif`,
                  fontSize: 16.5,
                  lineHeight: 1.6,
                  marginTop: 32,
                  maxWidth: 600,
                }}
              >
                {SAMPLE_PARAGRAPH}
              </div>
            </div>

            {/* bottom rule — the genome, as the spec block */}
            <div
              className="absolute inset-x-0 bottom-0 px-14 pb-12"
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: '#4a4741' }}
            >
              <div style={{ borderTop: '1px solid #232326', paddingTop: 14, lineHeight: 1.7 }}>
                <div>{toGenotype(display.genome)}</div>
                {isPair && text && <div style={{ marginTop: 4 }}>{toGenotype(text.genome)}</div>}
              </div>
            </div>

            {/* the specimen string, small, set vertically in the right margin */}
            <div
              className="absolute"
              style={{
                right: 22,
                top: 300,
                fontFamily: `"${displayFace.family}", serif`,
                fontSize: 16,
                color: '#4a4741',
                writingMode: 'vertical-rl',
                letterSpacing: '0.25em',
              }}
            >
              {specimen}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
