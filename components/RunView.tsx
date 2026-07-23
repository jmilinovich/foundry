'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { CREDITS } from '@/lib/credits';
import { dollars, type FontRecord, type Run } from '@/lib/types';
import { Lineage } from './Lineage';
import { Specimen } from './Specimen';

export function RunView({ initialRun }: { initialRun: Run }) {
  const [run, setRun] = useState(initialRun);
  const [viewGen, setViewGen] = useState(initialRun.generation);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [text, setText] = useState(initialRun.specimenText);
  const [size, setSize] = useState(56);
  const [breeding, setBreeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineageOf, setLineageOf] = useState<FontRecord | null>(null);

  const generation = useMemo(
    () => run.fonts.filter((f) => f.generation === viewGen),
    [run, viewGen],
  );
  const pending = generation.some((f) => f.status === 'queued' || f.status === 'generating');
  const isLatest = viewGen === run.generation;

  // --- poll while anything is in flight ---------------------------------
  useEffect(() => {
    if (!pending) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/runs/${run.id}`, { cache: 'no-store' });
        const data = await res.json();
        if (!stop && data.run) setRun(data.run);
      } catch {
        /* transient — the next tick will retry */
      }
    };
    const t = setInterval(tick, 2500);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [pending, run.id]);

  const toggle = useCallback(
    (id: string) => {
      if (!isLatest) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [isLatest],
  );

  const breedNext = useCallback(async () => {
    if (!selected.size || breeding) return;
    setBreeding(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${run.id}/breed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ survivorIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Breeding failed');
      setRun(data.run);
      setViewGen(data.run.generation);
      setSelected(new Set());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBreeding(false);
    }
  }, [selected, breeding, run.id]);

  // --- keyboard: 1-9 to pick, Enter to breed -----------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Enter' && selected.size) {
        e.preventDefault();
        breedNext();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        const f = generation[n - 1];
        if (f?.status === 'ready') toggle(f.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [generation, toggle, breedNext, selected.size]);

  const readyCount = generation.filter((f) => f.status === 'ready').length;
  // One survivor is carried forward unchanged and cloned from disk, so it's free.
  const nextCost = (run.populationSize - 1) * CREDITS.standard;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {lineageOf && (
        <Lineage
          child={lineageOf}
          fonts={run.fonts}
          text={text || 'Handgloves'}
          onClose={() => setLineageOf(null)}
        />
      )}
      <header className="sticky top-0 z-20 border-b border-line bg-ground/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3.5">
          <Link href="/" className="font-mono text-[11px] tracking-widest text-ink-dim hover:text-amber">
            ← FOUNDRY
          </Link>

          <div className="flex items-baseline gap-2 font-mono text-[11px] text-ink-faint">
            <span className="text-ink-dim">{run.seedText || 'open search'}</span>
            <span>·</span>
            <span>gen {viewGen}</span>
            <span>·</span>
            <span>{dollars(run.creditsSpent)} spent</span>
          </div>

          <div className="ml-auto flex flex-1 items-center gap-4 sm:flex-none">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type to re-set every specimen"
              className="w-full min-w-0 rounded border border-line bg-panel px-3 py-1.5 text-sm text-ink outline-none transition focus:border-amber sm:w-72"
            />
            <label className="hidden items-center gap-2 font-mono text-[11px] text-ink-faint sm:flex">
              <input
                type="range"
                min={22}
                max={120}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-24"
              />
              <span className="w-8 tabular-nums">{size}</span>
            </label>
          </div>
        </div>

        {run.generation > 0 && (
          <div className="mx-auto flex max-w-[1600px] items-center gap-1.5 px-6 pb-3">
            {Array.from({ length: run.generation + 1 }, (_, g) => (
              <button
                key={g}
                onClick={() => {
                  setViewGen(g);
                  setSelected(new Set());
                }}
                className={`rounded px-2 py-0.5 font-mono text-[11px] transition ${
                  g === viewGen
                    ? 'bg-amber text-ground'
                    : 'text-ink-faint hover:bg-panel hover:text-ink-dim'
                }`}
              >
                {g}
              </button>
            ))}
            <span className="ml-2 font-mono text-[10px] text-ink-faint">
              {isLatest ? 'current generation' : 'history — breeding happens on the latest'}
            </span>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {generation.map((f, i) => (
            <Specimen
              key={f.id}
              font={f}
              runId={run.id}
              text={text || 'Handgloves'}
              size={size}
              selected={selected.has(f.id)}
              dimmed={selected.size > 0}
              index={i}
              onToggle={toggle}
              onLineage={setLineageOf}
            />
          ))}
        </div>

        {pending && (
          <p className="mt-8 text-center font-mono text-[11px] text-ink-faint">
            minting {generation.filter((f) => f.status !== 'ready' && f.status !== 'failed').length}{' '}
            typefaces · about 25 seconds each
          </p>
        )}
      </main>

      <footer className="sticky bottom-0 z-20 border-t border-line bg-ground/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-6 py-3.5">
          <p className="font-mono text-[11px] text-ink-faint">
            {isLatest ? (
              selected.size ? (
                <>
                  <span className="text-amber">{selected.size} kept</span> · press 1–9 to pick,
                  enter to breed
                </>
              ) : (
                <>pick the ones you like · {readyCount}/{generation.length} ready</>
              )
            ) : (
              <>viewing generation {viewGen}</>
            )}
          </p>

          {error && <p className="font-mono text-[11px] text-red-400">{error}</p>}

          <div className="ml-auto flex items-center gap-4">
            {isLatest && selected.size > 0 && (
              <span className="font-mono text-[11px] text-ink-faint">{dollars(nextCost)}</span>
            )}
            <button
              onClick={breedNext}
              disabled={!isLatest || !selected.size || breeding || pending}
              className="rounded bg-amber px-4 py-2 text-sm font-medium text-ground transition disabled:cursor-not-allowed disabled:bg-panel disabled:text-ink-faint hover:enabled:brightness-110"
            >
              {breeding ? 'breeding…' : `breed generation ${run.generation + 1}`}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
