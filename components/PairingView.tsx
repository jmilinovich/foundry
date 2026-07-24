'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { CREDITS } from '@/lib/credits';
import { STANCES } from '@/lib/genome';
import { toGenotype } from '@/lib/genome';
import { rememberRun } from '@/lib/localRuns';
import { apiFetch } from '@/lib/userKey';
import { useEnsureKey } from './KeyGateProvider';
import { SAMPLE_PARAGRAPH } from '@/lib/glyphs';
import { dollars, type FontRecord, type PairingMeta } from '@/lib/types';
import { Poster } from './detail/Poster';
import { useFoundryFont } from './useFoundryFont';

type Tab = 'pair' | 'poster';

export function PairingView({
  runId,
  pairing,
  display,
  text,
  displayRunId,
  textRunId,
  specimenText,
}: {
  runId: string;
  pairing: PairingMeta;
  /** Resolved into roles already — whichever slot each font actually fills. */
  display: FontRecord;
  text: FontRecord;
  displayRunId: string;
  textRunId: string;
  specimenText: string;
}) {
  const [tab, setTab] = useState<Tab>('pair');
  const [headline, setHeadline] = useState(specimenText || 'Handgloves');
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<{ display?: boolean; text?: boolean }>({
    display: display.extended?.status === 'ready',
    text: text.extended?.status === 'ready',
  });

  const displayFace = useFoundryFont(display.id, true);
  const textFace = useFoundryFont(text.id, true);
  const stance = STANCES.find((s) => s.id === pairing.stance);

  useEffect(() => {
    rememberRun(runId, `${display.name} + ${text.name}`, 'pair');
  }, [runId, display.name, text.name]);

  const dFam = `"${displayFace.family}", serif`;
  const tFam = `"${textFace.family}", serif`;
  const loaded = displayFace.isLoaded && textFace.isLoaded;

  const bothPromoted = promoted.display && promoted.text;
  const ensureKey = useEnsureKey();

  const promoteBoth = useCallback(() => {
    if (promoting || bothPromoted) return;
    ensureKey(async () => {
      setPromoting(true);
      setError(null);
      try {
        const targets: [string, string][] = [
          [displayRunId, display.id],
          [textRunId, text.id],
        ];
        await Promise.all(
          targets.map(async ([rid, fid]) => {
            const res = await apiFetch(`/api/runs/${rid}/fonts/${fid}/promote`, { method: 'POST' });
            if (!res.ok) {
              const d = await res.json().catch(() => ({}));
              throw new Error(d.error ?? 'Promotion failed');
            }
          }),
        );
        setPromoted({ display: true, text: true });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setPromoting(false);
      }
    });
  }, [promoting, bothPromoted, displayRunId, textRunId, display.id, text.id, ensureKey]);

  // Nudge the runs to sync so the 319-glyph cuts land.
  useEffect(() => {
    if (!promoting && !bothPromoted) return;
    const t = setInterval(() => {
      apiFetch(`/api/runs/${runId}`, { cache: 'no-store' }).catch(() => {});
      if (displayRunId !== runId) apiFetch(`/api/runs/${displayRunId}`, { cache: 'no-store' }).catch(() => {});
    }, 6000);
    return () => clearInterval(t);
  }, [promoting, bothPromoted, runId, displayRunId]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-ground/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3.5">
          <Link href="/" className="font-mono text-[11px] tracking-widest text-ink-dim hover:text-amber">
            ← FOUNDRY
          </Link>
          <span className="font-mono text-[11px] text-ink-faint">
            pair · {stance?.label ?? pairing.stance}
          </span>

          <div className="ml-auto flex items-center gap-4">
            {error && <span className="font-mono text-[11px] text-red-400">{error}</span>}

            <button
              onClick={promoteBoth}
              disabled={promoting || bothPromoted}
              title="Re-mint both faces at 319 glyphs"
              className="rounded border border-line px-2.5 py-1 font-mono text-[11px] text-ink-dim transition hover:border-amber hover:text-amber disabled:opacity-50"
            >
              {bothPromoted
                ? '319 glyphs ✓'
                : promoting
                  ? 'promoting both…'
                  : `promote pair · ${dollars(CREDITS.extended * 2)}`}
            </button>

            <a
              href={`/api/fonts/${display.id}?download=${encodeURIComponent(display.name)}`}
              download
              className="font-mono text-[11px] text-ink-faint hover:text-amber"
            >
              ↓ display
            </a>
            <a
              href={`/api/fonts/${text.id}?download=${encodeURIComponent(text.name)}`}
              download
              className="font-mono text-[11px] text-ink-faint hover:text-amber"
            >
              ↓ text
            </a>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1400px] items-center gap-5 px-6 pb-3">
          {(['pair', 'poster'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`font-mono text-[11px] transition ${
                tab === t ? 'text-amber' : 'text-ink-faint hover:text-ink-dim'
              }`}
            >
              {t}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-5">
            {tab === 'pair' && (
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-56 rounded border border-line bg-panel px-2.5 py-1 text-[13px] text-ink outline-none transition focus:border-amber"
              />
            )}
            <Link
              href={`/run/${runId}`}
              className="font-mono text-[11px] text-ink-faint hover:text-amber"
            >
              back to the session
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-10">
        {tab === 'poster' ? (
          <Poster display={display} text={text} specimen={headline} glyphSet="standard" />
        ) : (
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              {/* The pair doing its job, at the sizes it will actually run at. */}
              <div
                className="specimen leading-[1.02]"
                data-loaded={loaded}
                style={{ fontFamily: dFam, fontSize: 'clamp(2.5rem, 7vw, 5.5rem)' }}
              >
                {headline}
              </div>

              <p
                className="specimen mt-6 max-w-2xl"
                data-loaded={loaded}
                style={{ fontFamily: tFam, fontSize: 21, lineHeight: 1.5 }}
              >
                {SAMPLE_PARAGRAPH}
              </p>

              <div className="mt-14 grid gap-10 sm:grid-cols-2">
                {[
                  { h: 36, b: 17 },
                  { h: 26, b: 15 },
                ].map(({ h, b }) => (
                  <div key={h}>
                    <div className="mb-3 font-mono text-[10px] tabular-nums text-ink-faint">
                      {h} / {b}
                    </div>
                    <div
                      className="specimen leading-[1.1]"
                      data-loaded={loaded}
                      style={{ fontFamily: dFam, fontSize: h }}
                    >
                      {headline}
                    </div>
                    <p
                      className="specimen mt-2.5"
                      data-loaded={loaded}
                      style={{ fontFamily: tFam, fontSize: b, lineHeight: 1.62 }}
                    >
                      {SAMPLE_PARAGRAPH}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="space-y-8">
              {(
                [
                  ['display', display, dFam, displayRunId],
                  ['text', text, tFam, textRunId],
                ] as const
              ).map(([role, font, fam, rid]) => (
                <div key={role} className="border-t border-line pt-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                    {role} face
                  </div>
                  <Link
                    href={`/run/${rid}/font/${font.id}`}
                    className="specimen mt-2 block text-[26px] leading-tight transition hover:text-amber"
                    data-loaded={loaded}
                    style={{ fontFamily: fam }}
                  >
                    {font.name}
                  </Link>
                  <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-ink-faint">
                    {toGenotype(font.genome)}
                  </p>
                  {font.extended?.status === 'ready' && (
                    <p className="mt-2 font-mono text-[10px] text-amber">319 glyphs available</p>
                  )}
                  {font.extended?.status === 'generating' && (
                    <p className="mt-2 font-mono text-[10px] text-amber">
                      minting 319 glyphs · {Math.round(font.extended.progress)}%
                    </p>
                  )}
                </div>
              ))}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
