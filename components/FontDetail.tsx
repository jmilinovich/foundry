'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { CREDITS } from '@/lib/credits';
import { dollars, type GlyphSetName, type Run } from '@/lib/types';
import { Lineage } from './Lineage';
import { PairLauncher } from './detail/PairLauncher';
import { Poster } from './detail/Poster';
import { SpecimenSheet } from './detail/SpecimenSheet';
import { useFoundryFont } from './useFoundryFont';

type Tab = 'specimen' | 'poster' | 'lineage';

export function FontDetail({ initialRun, fontId }: { initialRun: Run; fontId: string }) {
  const [run, setRun] = useState(initialRun);
  const [tab, setTab] = useState<Tab>('specimen');
  const [text, setText] = useState(initialRun.specimenText || 'Handgloves');
  const [tracking, setTracking] = useState(0);
  const [leading, setLeading] = useState(1.55);
  const [paper, setPaper] = useState(false);
  const [glyphSet, setGlyphSet] = useState<GlyphSetName>('standard');
  const [promoting, setPromoting] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const font = useMemo(() => run.fonts.find((f) => f.id === fontId), [run, fontId]);
  const extended = font?.extended;
  const extendedReady = extended?.status === 'ready';
  const extendedPending = extended?.status === 'generating';

  const { family, isLoaded } = useFoundryFont(fontId, font?.status === 'ready');
  // The extended cut is a separate re-mint at a different URL, so it needs its
  // own FontFace rather than sharing the standard one's.
  const [extFamily, setExtFamily] = useState<string | null>(null);

  useEffect(() => {
    if (!extendedReady || extFamily) return;
    const fam = `foundry-ext-${fontId}`;
    const face = new FontFace(fam, `url(/api/fonts/${fontId}?set=extended)`);
    face
      .load()
      .then((f) => {
        document.fonts.add(f);
        setExtFamily(fam);
      })
      .catch(() => {});
  }, [extendedReady, extFamily, fontId]);

  // Poll while the extended cut is minting — 2-3 minutes for 319 glyphs.
  useEffect(() => {
    if (!extendedPending) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${run.id}`, { cache: 'no-store' });
        const data = await res.json();
        if (data.run) setRun(data.run);
      } catch {
        /* next tick */
      }
    }, 4000);
    return () => clearInterval(t);
  }, [extendedPending, run.id]);

  const promote = useCallback(async () => {
    if (promoting) return;
    setPromoting(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${run.id}/fonts/${fontId}/promote`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Promotion failed');
      setRun(data.run);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPromoting(false);
    }
  }, [promoting, run.id, fontId]);

  if (!font) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24">
        <p className="text-ink-dim">That font isn&rsquo;t in this run.</p>
        <Link href={`/run/${run.id}`} className="mt-4 inline-block text-amber">
          ← back to the run
        </Link>
      </div>
    );
  }

  const activeFamily = glyphSet === 'extended' && extFamily ? extFamily : family;
  const downloadUrl = `/api/fonts/${fontId}?${glyphSet === 'extended' ? 'set=extended&' : ''}download=${encodeURIComponent(font.name)}`;

  const TABS: { id: Tab; label: string; hidden?: boolean }[] = [
    { id: 'specimen', label: 'specimen' },
    { id: 'poster', label: 'poster' },
    { id: 'lineage', label: 'lineage', hidden: font.parents.length === 0 },
  ];

  // Paper mode overrides the theme variables on the container rather than
  // repainting one region, so the header, rules and metadata all flip with the
  // specimen instead of leaving a dark bar floating over a white page.
  const paperVars = {
    '--ground': '#f2efe8',
    '--panel': '#e8e4da',
    '--line': '#d5d0c4',
    '--ink': '#0b0b0c',
    '--ink-dim': '#57534a',
    '--ink-faint': '#8f8a7e',
  } as React.CSSProperties;

  const inPaper = paper && tab === 'specimen';

  return (
    <div
      className="flex min-h-full flex-1 flex-col transition-colors duration-300"
      style={
        inPaper
          ? { ...paperVars, background: 'var(--ground)', color: 'var(--ink)' }
          : undefined
      }
    >
      {pairing && (
        <PairLauncher
          runId={run.id}
          fontId={fontId}
          fontName={font.name}
          specimenText={text || 'Handgloves'}
          onClose={() => setPairing(false)}
        />
      )}

      <header className="sticky top-0 z-20 border-b border-line bg-ground/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3.5">
          <Link
            href={`/run/${run.id}`}
            className="font-mono text-[11px] tracking-widest text-ink-dim hover:text-amber"
          >
            ← GEN {font.generation}
          </Link>

          <span
            className="specimen text-[17px]"
            data-loaded={isLoaded}
            style={{ fontFamily: `"${family}", serif` }}
          >
            {font.name}
          </span>

          <div className="ml-auto flex items-center gap-4">
            {error && <span className="font-mono text-[11px] text-red-400">{error}</span>}

            <button
              onClick={() => setPairing(true)}
              className="rounded border border-line px-2.5 py-1 font-mono text-[11px] text-ink-dim transition hover:border-amber hover:text-amber"
            >
              pair this
            </button>

            {extendedReady ? (
              <div className="flex overflow-hidden rounded border border-line font-mono text-[10.5px]">
                {(['standard', 'extended'] as GlyphSetName[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setGlyphSet(s)}
                    className={`px-2 py-1 transition ${
                      glyphSet === s ? 'bg-amber text-ground' : 'text-ink-faint hover:text-ink-dim'
                    }`}
                  >
                    {s === 'standard' ? '72' : '319'}
                  </button>
                ))}
              </div>
            ) : extendedPending ? (
              <span className="font-mono text-[11px] text-amber">
                minting 319 glyphs · {Math.round(extended?.progress ?? 0)}%
              </span>
            ) : (
              <button
                onClick={promote}
                disabled={promoting}
                title="Re-mint at 319 glyphs — accents, curly quotes, dashes"
                className="rounded border border-line px-2.5 py-1 font-mono text-[11px] text-ink-dim transition hover:border-amber hover:text-amber disabled:opacity-50"
              >
                {promoting ? 'promoting…' : `promote to 319 · ${dollars(CREDITS.extended)}`}
              </button>
            )}

            <a
              href={downloadUrl}
              download
              className="font-mono text-[11px] text-ink-faint hover:text-amber"
            >
              ↓ ttf
            </a>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1400px] items-center gap-5 px-6 pb-3">
          {TABS.filter((t) => !t.hidden).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`font-mono text-[11px] transition ${
                tab === t.id ? 'text-amber' : 'text-ink-faint hover:text-ink-dim'
              }`}
            >
              {t.label}
            </button>
          ))}

          {tab === 'specimen' && (
            <div className="ml-auto flex flex-wrap items-center gap-4">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-44 rounded border border-line bg-panel px-2.5 py-1 text-[13px] text-ink outline-none transition focus:border-amber"
              />
              <label className="flex items-center gap-2 font-mono text-[10px] text-ink-faint">
                tracking
                <input
                  type="range"
                  min={-0.06}
                  max={0.3}
                  step={0.005}
                  value={tracking}
                  onChange={(e) => setTracking(Number(e.target.value))}
                  className="w-20"
                />
                <span className="w-10 tabular-nums">{tracking.toFixed(3)}</span>
              </label>
              <label className="flex items-center gap-2 font-mono text-[10px] text-ink-faint">
                leading
                <input
                  type="range"
                  min={1}
                  max={2.2}
                  step={0.05}
                  value={leading}
                  onChange={(e) => setLeading(Number(e.target.value))}
                  className="w-20"
                />
                <span className="w-7 tabular-nums">{leading.toFixed(2)}</span>
              </label>
              <button
                onClick={() => setPaper((p) => !p)}
                className="rounded border border-line px-2 py-1 font-mono text-[10px] text-ink-faint transition hover:border-amber hover:text-amber"
              >
                {paper ? 'on paper' : 'on ink'}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          {tab === 'specimen' && (
            <SpecimenSheet
              fontId={fontId}
              family={activeFamily}
              text={text || 'Handgloves'}
              tracking={tracking}
              leading={leading}
              glyphSet={glyphSet === 'extended' && extFamily ? 'extended' : 'standard'}
            />
          )}

          {tab === 'poster' && (
            <Poster
              display={font}
              specimen={text || 'Handgloves'}
              glyphSet={glyphSet === 'extended' && extendedReady ? 'extended' : 'standard'}
            />
          )}

          {tab === 'lineage' && (
            <Lineage child={font} fonts={run.fonts} text={text || 'Handgloves'} inline />
          )}
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-[1400px] px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            prompt
          </p>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-dim">{font.prompt}</p>
        </div>
      </footer>
    </div>
  );
}
