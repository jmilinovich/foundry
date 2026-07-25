'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { CREDITS } from '@/lib/credits';
import { STANCES, type Genome, type Slot, type Stance } from '@/lib/genome';
import type { Partner } from '@/lib/pairing';
import { dollars } from '@/lib/types';
import { PairLauncher } from './detail/PairLauncher';
import { useAtlasFullFont, useAtlasSheetFont } from './quiz/useAtlasFont';

const HEADLINE = 'The quiet part';
const BODY =
  'A typeface earns its keep in the places nobody looks at closely. Not the masthead, ' +
  'where any competent drawing will pass, but the third paragraph of a long column, at ' +
  'sixteen pixels, on a screen held at arm’s length in bad light.';

/** Weights we ask Google for: one for setting text, one for emphasis. */
const GOOGLE_WEIGHTS = [400, 700];

function googleCss(name: string, weights?: number[]): string {
  const list = (weights?.filter((w) => GOOGLE_WEIGHTS.includes(w)) ?? []).length
    ? weights!.filter((w) => GOOGLE_WEIGHTS.includes(w)).join(';')
    : '400';
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(
    /%20/g,
    '+',
  )}:wght@${list}&display=swap`;
}

/**
 * The partner's face, whichever library it came from.
 *
 * A house face is a FontFace we load ourselves; a Google family is a stylesheet
 * the browser fetches. Both end up as a family name, so the preview does not
 * care which it got — which is the point of ranking them on one list.
 */
function usePartnerFace(partner: Partner | null) {
  const houseSlug = partner?.source === 'house' ? partner.id : null;
  const { family: houseFamily, loaded } = useAtlasFullFont(houseSlug);
  if (!partner) return { family: 'inherit', link: null, loaded: true };
  if (partner.source === 'house') {
    return { family: `"${houseFamily}", Georgia, serif`, link: null, loaded };
  }
  return {
    family: `"${partner.id}", Georgia, serif`,
    link: googleCss(partner.id, partner.staticWeights),
    // A webfont stylesheet has no load event we can read here; `display=swap`
    // means it paints in the fallback and swaps, which is correct for body copy.
    loaded: true,
  };
}

export function PairFinder({
  slug,
  name,
  genome,
  lists,
}: {
  slug: string;
  name: string;
  genome: Genome;
  lists: Record<string, Partner[]>;
}) {
  const [slot, setSlot] = useState<Slot>('text');
  const [stance, setStance] = useState<Stance>('classic');
  const [chosen, setChosen] = useState(0);
  const [breeding, setBreeding] = useState(false);

  const partners = useMemo(() => lists[`${slot}:${stance}`] ?? [], [lists, slot, stance]);
  const partner = partners[Math.min(chosen, partners.length - 1)] ?? null;

  const locked = useAtlasSheetFont(slug);
  const other = usePartnerFace(partner);

  const lockedFamily = `"${locked.family}", Georgia, serif`;
  // `slot` names what we went looking for, so the locked face takes the other
  // role: hunting for body copy means this face is the display half.
  const displayFamily = slot === 'text' ? lockedFamily : other.family;
  const textFamily = slot === 'text' ? other.family : lockedFamily;

  const pick = (s: Slot) => {
    setSlot(s);
    setChosen(0);
  };

  return (
    <div className="surface-publish flex min-h-full flex-1 flex-col">
      {other.link && <link rel="stylesheet" href={other.link} />}

      {breeding && (
        <PairLauncher
          runId="atlas"
          fontId={slug}
          fontName={name}
          specimenText={HEADLINE}
          onClose={() => setBreeding(false)}
        />
      )}

      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5 sm:px-6">
          <Link
            href={`/collection/${slug}`}
            className="-my-2 flex items-center py-2 font-mono text-[11px] tracking-widest text-ink-dim hover:text-ink"
          >
            ← {name.toUpperCase()}
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            pairing
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-10 sm:px-6">
        <h1 className="max-w-2xl font-display text-[clamp(1.75rem,5vw,2.6rem)] leading-[1.1] tracking-[-0.015em]">
          What sits well with {name}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-dim">
          Ranked against every face in the house library and {' '}
          <span className="text-ink">149 Google families</span>, on how well each one answers this
          one. Free, and nothing is generated.
        </p>

        {/* What we're looking for. */}
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-line pt-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              looking for
            </p>
            <div className="mt-2 flex gap-3">
              {([
                ['text', 'body copy'],
                ['display', 'a display face'],
              ] as [Slot, string][]).map(([s, label]) => (
                <button
                  key={s}
                  onClick={() => pick(s)}
                  className={`rounded border px-3 py-2 font-mono text-[11px] transition sm:py-1 ${
                    slot === s
                      ? 'border-ink text-ink'
                      : 'border-line text-ink-faint hover:border-ink hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              relationship
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {STANCES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setStance(s.id);
                    setChosen(0);
                  }}
                  title={s.blurb}
                  className={`rounded border px-3 py-2 font-mono text-[11px] transition sm:py-1 ${
                    stance === s.id
                      ? 'border-ink text-ink'
                      : 'border-line text-ink-faint hover:border-ink hover:text-ink'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-ink-faint">
          {STANCES.find((s) => s.id === stance)?.blurb}
        </p>

        {/* The pair, applied. */}
        <section className="mt-10 border-t-2 border-ink pt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            {slot === 'text' ? `${name} over ` : 'body copy under '}
            <span className="text-ink">{partner?.name ?? '—'}</span>
          </p>
          <h2
            className="mt-4 leading-[1.02]"
            style={{ fontFamily: displayFamily, fontSize: 'clamp(2.2rem,7vw,4.2rem)' }}
          >
            {HEADLINE}
          </h2>
          <p
            className="mt-5 max-w-[62ch] text-[17px] leading-[1.55]"
            style={{ fontFamily: textFamily }}
          >
            {BODY}
          </p>
        </section>

        {/* The ranking. */}
        <section className="mt-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            best {partners.length} of 350
          </p>
          <ul className="mt-4">
            {partners.map((p, i) => {
              const active = p === partner;
              return (
                <li key={`${p.source}:${p.id}`}>
                  <button
                    onClick={() => setChosen(i)}
                    aria-pressed={active}
                    className={`flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line py-3 text-left transition ${
                      active ? 'text-ink' : 'text-ink-dim hover:text-ink'
                    }`}
                  >
                    <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                      {active ? '●' : '○'} {(p.score * 100).toFixed(0)}%
                    </span>
                    <span className="text-[17px]">{p.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                      {p.source === 'google' ? 'google fonts' : 'house'}
                    </span>
                    <span className="w-full font-mono text-[11px] text-ink-faint sm:w-auto sm:flex-1 sm:text-right">
                      {p.why}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {partner && (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {partner.source === 'google' ? (
                <a
                  href={`https://fonts.google.com/specimen/${partner.id.replace(/\s+/g, '+')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] text-ink-dim underline underline-offset-4 hover:text-ink"
                >
                  get {partner.name} from Google Fonts →
                </a>
              ) : (
                <>
                  <Link
                    href={`/collection/${partner.id}`}
                    className="font-mono text-[11px] text-ink-dim underline underline-offset-4 hover:text-ink"
                  >
                    {partner.name} specimen →
                  </Link>
                  <a
                    href={`/api/atlas/kit?slug=${partner.id}`}
                    download
                    className="font-mono text-[11px] text-ink-faint hover:text-ink"
                  >
                    ↓ kit
                  </a>
                </>
              )}
            </div>
          )}
        </section>

        {/* The escape hatch, and the only thing here that costs anything. */}
        <section className="mt-14 border-t border-line pt-6">
          <p className="max-w-xl text-[15px] leading-relaxed text-ink-dim">
            None of these? Draw one instead. Foundry mints six candidates against this face and you
            judge them the same way you judged the quiz.
          </p>
          <button
            onClick={() => setBreeding(true)}
            className="mt-4 rounded border border-accent px-4 py-2.5 font-mono text-[12px] text-accent transition hover:bg-accent hover:text-paper"
          >
            breed a partner · {dollars(CREDITS.standard * 6)}
          </button>
        </section>

        <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          {genome.category} · {genome.weight} · {genome.width}
        </p>
      </main>
    </div>
  );
}
