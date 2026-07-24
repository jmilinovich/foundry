'use client';

import Link from 'next/link';

import { toGenotype } from '@/lib/genome';
import type { FontRecord } from '@/lib/types';
import { useFoundryFont } from './useFoundryFont';

// Demoted from shouty pills to mono captions — a chip competes with the specimen
// it labels. Only `kept` carries Proof Red, because it IS the Keep verb's residue.
const BADGE: Record<FontRecord['lineage'], { label: string; className: string }> = {
  seed: { label: '· seed', className: 'text-ink-faint' },
  elite: { label: '✳ kept', className: 'text-accent' },
  child: { label: '→ child', className: 'text-ink-dim' },
  wildcard: { label: '✳ wildcard', className: 'text-ink-faint' },
};

export function Specimen({
  font,
  runId,
  text,
  size,
  selected,
  dimmed,
  index,
  onToggle,
  onLineage,
  onRetry,
}: {
  font: FontRecord;
  runId: string;
  text: string;
  size: number;
  selected: boolean;
  dimmed: boolean;
  index: number;
  onToggle: (id: string) => void;
  onLineage: (font: FontRecord) => void;
  onRetry: (id: string) => void;
}) {
  const ready = font.status === 'ready';
  const failed = font.status === 'failed';
  const { family, isLoaded } = useFoundryFont(font.id, ready);
  const genotype = toGenotype(font.genome);

  // Every state shares one shell, so the grid never reflows as fonts land.
  const bodyHeight = Math.round(size * 1.5);

  const shell = failed
    ? 'border-line bg-panel'
    : selected
      ? 'border-accent bg-accent/[0.05] shadow-[0_0_0_1px_var(--accent)]'
      : 'border-line bg-panel' + (ready ? ' hover:border-ink-faint' : '');

  return (
    <div
      role={ready ? 'button' : undefined}
      tabIndex={ready ? 0 : undefined}
      onClick={ready ? () => onToggle(font.id) : undefined}
      onKeyDown={
        ready
          ? (e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onToggle(font.id);
              }
            }
          : undefined
      }
      style={ready ? { animationDelay: `${Math.min(index, 12) * 45}ms` } : undefined}
      className={`group relative flex flex-col overflow-hidden rounded-lg border p-5 text-left outline-none transition-all duration-300 focus-visible:border-accent ${shell} ${
        ready ? 'rise cursor-pointer' : ''
      } ${dimmed && !selected ? 'opacity-45 hover:opacity-90' : 'opacity-100'}`}
    >
      {!ready && !failed && <div className="shimmer pointer-events-none absolute inset-0" />}

      <div className="relative flex items-center justify-between">
        <span
          className={`font-mono text-[10px] uppercase tracking-widest ${
            failed ? 'text-ink-dim' : BADGE[font.lineage].className
          }`}
        >
          {failed ? 'failed' : BADGE[font.lineage].label}
        </span>

        {ready ? (
          <span className="flex items-center gap-3 opacity-0 transition group-hover:opacity-100">
            <Link
              href={`/run/${runId}/font/${font.id}`}
              onClick={(e) => e.stopPropagation()}
              title="Open the full specimen"
              className="font-mono text-[11px] text-ink-faint hover:text-ink"
            >
              ↗ open
            </Link>
            {font.parents.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLineage(font);
                }}
                title="Watch this font emerge from its parent"
                className="font-mono text-[11px] text-ink-faint hover:text-ink"
              >
                ⟲ lineage
              </button>
            )}
            <a
              href={`/api/fonts/${font.id}?download=${encodeURIComponent(font.name)}`}
              onClick={(e) => e.stopPropagation()}
              download
              title="Download TTF"
              className="font-mono text-[11px] text-ink-faint hover:text-ink"
            >
              ↓ ttf
            </a>
          </span>
        ) : (
          <span className="font-mono text-[11px] tabular-nums text-ink-faint">
            {failed ? '' : font.progress > 0 ? `${Math.round(font.progress)}%` : 'queued'}
          </span>
        )}
      </div>

      <div
        className="relative mt-5 flex items-center"
        style={{ minHeight: `${bodyHeight}px` }}
      >
        {ready ? (
          <div
            className="specimen w-full break-words leading-[1.05]"
            data-loaded={isLoaded}
            style={{ fontFamily: `"${family}", serif`, fontSize: `${size}px` }}
          >
            {text}
          </div>
        ) : failed ? (
          <div>
            <p className="text-sm leading-relaxed text-ink-dim">{font.error}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry(font.id);
              }}
              className="mt-3 rounded border border-line px-2 py-1 font-mono text-[11px] text-ink-dim transition hover:border-ink hover:text-ink"
            >
              ↻ retry · $0.20
            </button>
          </div>
        ) : (
          <div className="w-full">
            <div className="h-px w-full bg-line">
              <div
                className="h-px bg-signal transition-all duration-700"
                style={{ width: `${Math.max(2, font.progress)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="relative mt-auto border-t border-line pt-3">
        {ready ? (
          <Link
            href={`/run/${runId}/font/${font.id}`}
            onClick={(e) => e.stopPropagation()}
            className="specimen block text-[15px] text-ink-dim transition hover:text-ink"
            data-loaded={isLoaded}
            style={{ fontFamily: `"${family}", serif` }}
          >
            {font.name}
          </Link>
        ) : (
          <div className="text-[15px] text-ink-faint">{font.name}</div>
        )}
        <p
          className="mt-1.5 font-mono text-[10.5px] leading-relaxed text-ink-faint"
          title={font.prompt}
        >
          {genotype}
        </p>
      </div>
    </div>
  );
}
