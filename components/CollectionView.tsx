'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { CATEGORY, CONTRAST, WEIGHT, WIDTH } from '@/lib/genome';
import type { AtlasEntry } from '@/lib/taste';
import { useAtlasFullFont } from './quiz/useAtlasFont';

/**
 * The catalogue.
 *
 * One row per face, the name set in the face itself — a foundry's showing sheet,
 * not a data table. Filters are the genome axes the quiz already teaches, so the
 * vocabulary a visitor picks up in twelve rounds is the vocabulary that browses
 * the library.
 *
 * Rows load their own woff2 on demand rather than all 201 up front: the quiz
 * preloads a 2 KB subset per face because it needs every one of them within
 * ninety seconds, but a catalogue is read a screen at a time and 201 full cuts
 * would be 2.8 MB for a page most people scroll a third of.
 */

const ANY = 'any';

/** The axes worth filtering on — the same five the quiz probes. */
const FILTERS = [
  { key: 'category', label: 'class', values: CATEGORY },
  { key: 'weight', label: 'weight', values: WEIGHT },
  { key: 'width', label: 'width', values: WIDTH },
  { key: 'contrast', label: 'contrast', values: CONTRAST },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function Row({ entry }: { entry: AtlasEntry }) {
  const { family, loaded } = useAtlasFullFont(entry.slug);
  const g = entry.genome;
  return (
    <li className="border-b border-line py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        {/* The name is the way in to the full sheet; the download stays its own
            target so a click on one is never a click on the other. */}
        <Link
          href={`/collection/${entry.slug}`}
          className="specimen text-[clamp(1.6rem,4.5vw,2.4rem)] leading-[1.15]"
          data-loaded={loaded}
          style={{ fontFamily: `"${family}", Georgia, serif` }}
        >
          {entry.name}
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href={`/collection/${entry.slug}`}
            className="font-mono text-[11px] text-ink-dim transition hover:text-ink"
          >
            specimen →
          </Link>
          <a
            href={`/atlas/${entry.slug}.ttf`}
            download={`${entry.name}.ttf`}
            className="font-mono text-[11px] text-ink-faint transition hover:text-ink"
          >
            ↓ ttf
          </a>
        </div>
      </div>
      <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
        {g.category} · {g.weight} · {g.width} · {g.contrast} · {g.era}
      </p>
    </li>
  );
}

export function CollectionView({ atlas }: { atlas: AtlasEntry[] }) {
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    category: ANY,
    weight: ANY,
    width: ANY,
    contrast: ANY,
  });
  /** Rendered in pages so a filter change doesn't mount 201 FontFaces at once. */
  const [shown, setShown] = useState(30);

  const matching = useMemo(
    () =>
      atlas.filter((e) =>
        FILTERS.every((f) => {
          const want = filters[f.key];
          return want === ANY || e.genome[f.key] === want;
        }),
      ),
    [atlas, filters],
  );

  const set = (key: FilterKey, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setShown(30);
  };

  const active = FILTERS.some((f) => filters[f.key] !== ANY);

  return (
    <div className="surface-publish flex min-h-full flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[900px] items-center justify-between px-5 py-3.5 sm:px-6">
          <Link href="/" className="font-display text-[15px] tracking-tight text-ink">
            Foundry
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            the house library
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[900px] px-5 py-12 sm:px-6 sm:py-14">
        <h1 className="font-display text-[clamp(2rem,7vw,3.2rem)] leading-[1.1] tracking-[-0.015em]">
          The house library
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-dim">
          All {atlas.length} faces the house has cut, frozen the day they were drawn. Every type
          pair in the quiz comes out of this list, and so do the six the read hands back. Open any
          name for its full specimen, or take the TTF straight from here.
        </p>

        {/* ── filters ──────────────────────────────────────────────────── */}
        <div className="mt-10 space-y-3 border-t border-line pt-5">
          {FILTERS.map((f) => (
            <div key={f.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="w-[70px] shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                {f.label}
              </span>
              <button
                onClick={() => set(f.key, ANY)}
                className={`font-mono text-[11px] transition ${
                  filters[f.key] === ANY ? 'text-ink' : 'text-ink-faint hover:text-ink-dim'
                }`}
              >
                any
              </button>
              {f.values.map((v) => (
                <button
                  key={v}
                  onClick={() => set(f.key, v)}
                  className={`font-mono text-[11px] transition ${
                    filters[f.key] === v ? 'text-ink' : 'text-ink-faint hover:text-ink-dim'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-mono text-[11px] text-ink-dim">
            {matching.length} {matching.length === 1 ? 'face' : 'faces'}
          </span>
          {active && (
            <button
              onClick={() =>
                setFilters({ category: ANY, weight: ANY, width: ANY, contrast: ANY })
              }
              className="font-mono text-[11px] text-ink-faint transition hover:text-ink"
            >
              clear
            </button>
          )}
        </div>

        {matching.length === 0 ? (
          <p className="mt-10 text-[15px] leading-relaxed text-ink-dim">
            Nothing in the library sits at that combination. The genome allows it; the house has
            not cut one yet. Loosen a filter, or{' '}
            <Link href="/quiz" className="text-ink underline underline-offset-4">
              have your taste read
            </Link>{' '}
            and breed the face that is missing.
          </p>
        ) : (
          <>
            <ul className="mt-2">
              {matching.slice(0, shown).map((e) => (
                <Row key={e.slug} entry={e} />
              ))}
            </ul>
            {shown < matching.length && (
              <button
                onClick={() => setShown((n) => n + 40)}
                className="mt-8 inline-flex min-h-[44px] items-center border-2 border-ink px-5 text-[15px] font-medium transition hover:bg-ink hover:text-paper"
              >
                show {Math.min(40, matching.length - shown)} more ↓
              </button>
            )}
          </>
        )}

        <div className="mt-16 border-t-2 border-ink pt-8">
          <p className="max-w-xl text-[17px] leading-[1.6] text-ink-dim">
            Every one of these was drawn before you arrived. If none of them is the face you want,
            the quiz reads your taste and breeds one that is.
          </p>
          <Link
            href="/quiz"
            className="mt-6 inline-flex min-h-[44px] items-center border-2 border-ink px-5 text-[15px] font-medium transition hover:bg-ink hover:text-paper"
          >
            have your taste read →
          </Link>
        </div>
      </div>
    </div>
  );
}
