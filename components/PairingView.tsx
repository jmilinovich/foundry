'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { CREDITS } from '@/lib/credits';
import { STANCES } from '@/lib/genome';
import { toGenotype } from '@/lib/genome';
import { rememberRun } from '@/lib/localRuns';
import { apiFetch } from '@/lib/userKey';
import { useEnsureKey } from './KeyGateProvider';
import { ATLAS_RUN, dollars, type FontRecord, type PairingMeta } from '@/lib/types';
import { PairLookbook } from './detail/PairLookbook';
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
  /** Either half coming from the frozen house library rules out a re-mint. */
  const housePaired = displayRunId === ATLAS_RUN || textRunId === ATLAS_RUN;
  const ensureKey = useEnsureKey();

  const promoteBoth = useCallback(() => {
    if (promoting || bothPromoted || housePaired) return;
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
  }, [promoting, bothPromoted, housePaired, displayRunId, textRunId, display.id, text.id, ensureKey]);

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
          <Link href="/" className="font-mono text-[11px] tracking-widest text-ink-dim hover:text-ink">
            ← FOUNDRY
          </Link>
          <span className="font-mono text-[11px] text-ink-faint">
            pair · {stance?.label ?? pairing.stance}
          </span>

          <div className="ml-auto flex items-center gap-4">
            {error && <span className="font-mono text-[11px] text-ink-dim">{error}</span>}

            {/*
              A house face has no 319-glyph cut and no way to mint one: the
              library is frozen, and readFontFile serves only its standard set.
              Offering the button anyway charged for the half that CAN be
              promoted and then 404'd on the half that can't, leaving the
              visitor billed $0.50 with the button still lit at $1.00. It is
              unreachable by construction, so it isn't offered.
            */}
            {housePaired ? (
              <span
                className="font-mono text-[11px] text-ink-faint"
                title="The house library is frozen at its 78-glyph cut"
              >
                house face · 78 glyphs
              </span>
            ) : (
              <button
                onClick={promoteBoth}
                disabled={promoting || bothPromoted}
                title="Re-mint both faces at 319 glyphs"
                className="rounded border border-line px-2.5 py-1 font-mono text-[11px] text-ink-dim transition hover:border-ink hover:text-ink disabled:opacity-50"
              >
                {bothPromoted
                  ? '319 glyphs ✓'
                  : promoting
                    ? 'promoting both…'
                    : `promote pair · ${dollars(CREDITS.extended * 2)}`}
              </button>
            )}

            {/* The whole pair as one kit — both fonts + wired CSS + specimen. */}
            <a
              href={`/api/pairings/${runId}/kit`}
              download
              title="Both fonts + @font-face CSS + a README specimen, zipped"
              className="rounded border border-line px-2.5 py-1 font-mono text-[11px] text-ink-dim transition hover:border-ink hover:text-ink"
            >
              ↓ download pair
            </a>
            <span className="font-mono text-[11px] text-ink-faint">
              <a
                href={`/api/fonts/${display.id}?download=${encodeURIComponent(display.name)}`}
                download
                className="hover:text-ink"
              >
                ttf: display
              </a>
              {' · '}
              <a
                href={`/api/fonts/${text.id}?download=${encodeURIComponent(text.name)}`}
                download
                className="hover:text-ink"
              >
                text
              </a>
            </span>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1400px] items-center gap-5 px-6 pb-3">
          {(['pair', 'poster'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`font-mono text-[11px] transition ${
                tab === t ? 'text-ink' : 'text-ink-faint hover:text-ink-dim'
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
                className="w-56 rounded border border-line bg-panel px-2.5 py-1 text-[13px] text-ink outline-none transition focus:border-ink"
              />
            )}
            <Link
              href={`/run/${runId}`}
              className="font-mono text-[11px] text-ink-faint hover:text-ink"
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
            {/* The pair seen doing its job — applied, and exportable as a PNG. */}
            <PairLookbook display={display} text={text} headline={headline} />

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
                    className="specimen mt-2 block text-[26px] leading-tight transition hover:text-ink"
                    data-loaded={loaded}
                    style={{ fontFamily: fam }}
                  >
                    {font.name}
                  </Link>
                  <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-ink-faint">
                    {toGenotype(font.genome)}
                  </p>
                  {font.extended?.status === 'ready' && (
                    <p className="mt-2 font-mono text-[10px] text-ink">319 glyphs available</p>
                  )}
                  {font.extended?.status === 'generating' && (
                    <p className="mt-2 font-mono text-[10px] text-ink">
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
