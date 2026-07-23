'use client';

import Link from 'next/link';

import { toGenotype } from '@/lib/genome';
import type { FontRecord, PairingMeta } from '@/lib/types';
import { useFoundryFont } from './useFoundryFont';

/** Short enough to read at a glance across eight cards, long enough to judge. */
const BODY =
  'A typeface earns its keep in the places nobody looks at closely — the third ' +
  'paragraph of a long column, at sixteen pixels, in bad light. That is where ' +
  'taste stops and infrastructure begins.';

const BADGE: Record<FontRecord['lineage'], string> = {
  seed: 'seed',
  elite: 'kept',
  child: 'child',
  wildcard: 'wildcard',
};

export function PairCandidate({
  font,
  lockedId,
  pairing,
  runId,
  headline,
  selected,
  dimmed,
  index,
  onToggle,
  onRetry,
}: {
  font: FontRecord;
  /** The fixed half of the pair. Always a ready font, so it just needs an id. */
  lockedId: string;
  pairing: PairingMeta;
  runId: string;
  headline: string;
  selected: boolean;
  dimmed: boolean;
  index: number;
  onToggle: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const ready = font.status === 'ready';
  const failed = font.status === 'failed';
  const candidate = useFoundryFont(font.id, ready);
  const lockedFace = useFoundryFont(lockedId, true);

  // The candidate fills one slot; the locked face fills the other.
  const displayFamily = pairing.slot === 'display' ? candidate.family : lockedFace.family;
  const textFamily = pairing.slot === 'display' ? lockedFace.family : candidate.family;
  const loaded = candidate.isLoaded && lockedFace.isLoaded;

  const shell = failed
    ? 'border-red-900/40 bg-red-950/[0.12]'
    : selected
      ? 'border-amber bg-amber/[0.04] shadow-[0_0_0_1px_var(--amber),0_10px_40px_-16px_rgba(255,138,61,0.5)]'
      : `border-line bg-panel${ready ? ' hover:border-ink-faint' : ''}`;

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
      className={`group relative flex flex-col overflow-hidden rounded-lg border p-6 text-left outline-none transition-all duration-300 focus-visible:border-amber/70 ${shell} ${
        ready ? 'rise cursor-pointer' : ''
      } ${dimmed && !selected ? 'opacity-45 hover:opacity-90' : 'opacity-100'}`}
    >
      {!ready && !failed && <div className="shimmer pointer-events-none absolute inset-0" />}

      <div className="relative flex items-center justify-between">
        <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          {failed ? 'failed' : BADGE[font.lineage]}
        </span>
        {ready ? (
          <span className="flex items-center gap-3 opacity-0 transition group-hover:opacity-100">
            <Link
              href={`/run/${runId}/font/${font.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-[11px] text-ink-faint hover:text-amber"
            >
              ↗ open
            </Link>
            <a
              href={`/api/fonts/${font.id}?download=${encodeURIComponent(font.name)}`}
              onClick={(e) => e.stopPropagation()}
              download
              className="font-mono text-[11px] text-ink-faint hover:text-amber"
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

      {/* The mini article block — the actual job these two faces will do. */}
      <div className="relative mt-5 min-h-[190px]">
        {failed ? (
          <div>
            <p className="text-sm leading-relaxed text-red-400/70">{font.error}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry(font.id);
              }}
              className="mt-3 rounded border border-line px-2 py-1 font-mono text-[11px] text-ink-dim transition hover:border-amber hover:text-amber"
            >
              ↻ retry · $0.20
            </button>
          </div>
        ) : ready ? (
          <>
            <div
              className="specimen leading-[1.06]"
              data-loaded={loaded}
              style={{ fontFamily: `"${displayFamily}", serif`, fontSize: 34 }}
            >
              {headline}
            </div>
            <p
              className="specimen mt-3.5"
              data-loaded={loaded}
              style={{ fontFamily: `"${textFamily}", serif`, fontSize: 15, lineHeight: 1.62 }}
            >
              {BODY}
            </p>
          </>
        ) : (
          <div className="h-px w-full bg-line">
            <div
              className="h-px bg-amber/60 transition-all duration-700"
              style={{ width: `${Math.max(2, font.progress)}%` }}
            />
          </div>
        )}
      </div>

      <div className="relative mt-auto border-t border-line pt-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          {pairing.slot === 'text' ? 'text face' : 'display face'}
        </div>
        <div className="mt-1 text-[14px] text-ink-dim">{font.name}</div>
        <p
          className="mt-1.5 font-mono text-[10.5px] leading-relaxed text-ink-faint"
          title={font.prompt}
        >
          {toGenotype(font.genome)}
        </p>
      </div>
    </div>
  );
}
