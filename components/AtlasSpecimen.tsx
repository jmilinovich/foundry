'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { CREDITS } from '@/lib/credits';
import { toGenotype, type Genome } from '@/lib/genome';
import { seedFromGenome } from '@/lib/taste';
import { dollars } from '@/lib/types';
import { apiFetch } from '@/lib/userKey';
import { useEnsureKey } from './KeyGateProvider';
import { SpecimenSheet } from './detail/SpecimenSheet';
import { useAtlasSheetFont } from './quiz/useAtlasFont';

/** The genome as foundry technical credits, in the order a spec sheet reads. */
function genomeCredits(g: Genome): [string, string][] {
  return [
    ['Category', g.category],
    ['Weight', g.weight],
    ['Width', g.width],
    ['Contrast', g.contrast],
    ['Terminals', g.terminals],
    ['x-height', g.xheight],
    ['Corner', g.corner],
    ['Texture', g.texture],
    ['Era', g.era],
    ['Mood', g.mood.join(' · ')],
    ['Drawn for', g.useCase],
  ];
}

/** Same population size the quiz starts a run with, so the price matches. */
const POPULATION = 8;

export function AtlasSpecimen({
  slug,
  name,
  genome,
  prompt,
}: {
  slug: string;
  name: string;
  genome: Genome;
  prompt: string;
}) {
  const router = useRouter();
  const ensureKey = useEnsureKey();
  // The complete TTF, which is also the file SpecimenSheet parses for the
  // character grid — one fetch, and the grid can never show a glyph the page
  // then renders in a fallback.
  const { family, loaded } = useAtlasSheetFont(slug);

  const [text, setText] = useState('Handgloves');
  const [tracking, setTracking] = useState(0);
  const [leading, setLeading] = useState(1.55);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Breed from this face.
   *
   * The seed peaks on this font's genes rather than pinning all of them, so the
   * first generation is a family around it. See seedFromGenome.
   */
  const breed = useCallback(() => {
    ensureKey(async () => {
      setStarting(true);
      setError(null);
      try {
        const res = await apiFetch('/api/runs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tasteSeed: seedFromGenome(genome),
            tasteSummary: `after ${name}`,
            specimenText: text || 'Handgloves',
            populationSize: POPULATION,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Could not start');
        router.push(`/run/${data.run.id}`);
      } catch (err) {
        setError((err as Error).message);
        setStarting(false);
      }
    });
  }, [ensureKey, genome, name, text, router]);

  /**
   * Copy the genome. `navigator.clipboard` rejects on an insecure origin or an
   * unfocused document, and an uncaught reject would leave the button claiming
   * success, so the failure is reported rather than swallowed.
   */
  const copyGenome = useCallback(async () => {
    const line = `${name} — ${toGenotype(genome)}`;
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Could not reach the clipboard. The genome is printed below.');
    }
  }, [genome, name]);

  /**
   * `py-2.5` on a phone puts these at ~44px, the documented minimum thumb
   * target; they measured 27px, which is a coin-flip to hit. Desktop keeps the
   * tighter setting, where a pointer is exact and the chrome should stay quiet.
   */
  const action =
    'flex items-center rounded border border-line px-3 py-2.5 font-mono text-[11px] text-ink-dim transition hover:border-ink hover:text-ink disabled:opacity-50 sm:px-2.5 sm:py-1';

  return (
    <div className="surface-publish flex min-h-full flex-1 flex-col">

      <header className="sticky top-0 z-20 border-b border-line bg-ground/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3.5">
          <Link
            href="/collection"
            className="-my-2 flex items-center py-2 font-mono text-[11px] tracking-widest text-ink-dim hover:text-ink"
          >
            ← COLLECTION
          </Link>

          <span
            className="specimen text-[17px]"
            data-loaded={loaded}
            style={{ fontFamily: `"${family}", Georgia, serif` }}
          >
            {name}
          </span>

          <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint sm:inline">
            house library
          </span>

          {error && (
            <span className="order-last w-full font-mono text-[11px] text-ink-dim sm:order-none sm:w-auto">
              {error}
            </span>
          )}
        </div>

        {/*
          Six controls will not sit on one line on a phone, and letting them wrap
          stacks three rows of chrome above a page whose entire job is to show
          you a typeface. They scroll sideways instead, which keeps the header
          one row tall at every width and keeps the order meaningful: the free
          things first, the one that costs money last.
        */}
        <div className="flex gap-3 overflow-x-auto px-6 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-auto sm:max-w-[1400px] sm:justify-end">
          <button onClick={copyGenome} className={action}>
            {copied ? 'copied' : 'copy genome'}
          </button>

          <a
            href={`/atlas/${slug}.ttf`}
            download={`${name}.ttf`}
            className={`${action} whitespace-nowrap`}
          >
            ↓ ttf
          </a>

          <a
            href={`/api/atlas/kit?slug=${slug}`}
            download
            title="TTF + @font-face CSS + a README specimen, zipped"
            className={`${action} whitespace-nowrap`}
          >
            ↓ kit
          </a>

          {/* Free, and the default. Breeding a partner is one click further in,
              on the page that shows what 350 existing faces already offer. */}
          <Link href={`/collection/${slug}/pair`} className={`${action} whitespace-nowrap`}>
            pair this
          </Link>

          {/* Proof Red is reserved to Breed and Keep — see DESIGN.md. */}
          <button
            onClick={breed}
            disabled={starting}
            title="Start a run from this font's genes"
            className="flex items-center whitespace-nowrap rounded border border-accent px-3 py-2.5 font-mono text-[11px] text-accent transition hover:bg-accent hover:text-paper disabled:opacity-50 sm:px-2.5 sm:py-1"
          >
            {starting ? 'starting…' : `breed · ${dollars(CREDITS.standard * POPULATION)}`}
          </button>
        </div>

        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-6 pb-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Specimen text"
            className="w-full rounded border border-line bg-panel px-2.5 py-1 text-[13px] text-ink outline-none transition focus:border-ink sm:w-44"
          />
          <label className="flex flex-1 items-center gap-2 font-mono text-[10px] text-ink-faint sm:flex-none">
            tracking
            <input
              type="range"
              min={-0.06}
              max={0.3}
              step={0.005}
              value={tracking}
              onChange={(e) => setTracking(Number(e.target.value))}
              className="min-w-0 flex-1 sm:w-20 sm:flex-none"
            />
            <span className="w-10 shrink-0 tabular-nums">{tracking.toFixed(3)}</span>
          </label>
          <label className="flex flex-1 items-center gap-2 font-mono text-[10px] text-ink-faint sm:flex-none">
            leading
            <input
              type="range"
              min={1}
              max={2.2}
              step={0.05}
              value={leading}
              onChange={(e) => setLeading(Number(e.target.value))}
              className="min-w-0 flex-1 sm:w-20 sm:flex-none"
            />
            <span className="w-7 shrink-0 tabular-nums">{leading.toFixed(2)}</span>
          </label>
        </div>
      </header>

      {/*
        The sheet fades in with its face rather than painting first in Times.
        Gating only the 17px header name while the 176px hero rendered ungated
        had it exactly backwards: the largest type on the page was the part that
        flashed a stand-in and then reflowed.
      */}
      <main className="specimen flex-1" data-loaded={loaded}>
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          <SpecimenSheet
            fontUrl={`/atlas/${slug}.ttf`}
            family={family}
            text={text || 'Handgloves'}
            tracking={tracking}
            leading={leading}
            weightLabel={genome.weight.toUpperCase()}
            genome={genomeCredits(genome)}
          />
        </div>
      </main>

      {/* The prompt is derived from the genome at render time rather than stored
          at mint time. For faces cut before the width wording was corrected the
          sentence about proportion is new, so this is what the genome asks for
          today and not necessarily the exact string that produced these
          outlines. Labelled for what it is rather than as provenance. */}
      <footer className="border-t border-line">
        <div className="mx-auto max-w-[1400px] px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            what this genome asks for
          </p>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-dim">{prompt}</p>
        </div>
      </footer>
    </div>
  );
}
