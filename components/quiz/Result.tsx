'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { encodeProfile } from '@/lib/profileCode';
import { composeRead, axisChips, labelFor } from '@/lib/read';
import {
  googleCssUrl,
  googleSpecimenUrl,
  profileToVector,
  recommend,
  type GoogleFont,
} from '@/lib/recommend';
import { profileToSeed, summarize, type AtlasEntry, type TasteProfile } from '@/lib/taste';
import { useAtlasFullFont } from './useAtlasFont';

/**
 * The payoff.
 *
 * A quiz that ends in a receipt ("here is your profile, now pay $1.60") teaches
 * you nothing. This screen is the result instead: a verdict on your taste, then
 * two libraries of real typefaces that fit it — the ones that already exist and
 * are free to use, and the ones that exist only here.
 *
 * This is a *publishing* surface, so it sits on warm paper while the duels
 * behind it sit on the cool bench. See DESIGN.md: judging screens must not have
 * a personality that competes with the specimen; a result is exactly the place
 * where the foundry is allowed to have one.
 *
 * Everything on it is derived, not fetched. The same votes always produce the
 * same verdict and the same twelve fonts, which is what makes the link at the
 * bottom worth sending.
 */

const HOW_MANY = 6;

/** A section label in the instrument voice. */
function Rule({ label, note }: { label: string; note?: string }) {
  return (
    <div className="mt-16 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          {label}
        </span>
        {note && <span className="text-[13px] text-ink-dim">{note}</span>}
      </div>
    </div>
  );
}

function GoogleRow({ font, why }: { font: GoogleFont; why: string }) {
  const weight = font.staticWeights.includes(400) ? 400 : (font.staticWeights[0] ?? 400);
  return (
    <li className="border-b border-line py-6">
      {/* React hoists these into <head>; one request per family keeps the
          specimen honest — you are reading the actual typeface, not a stand-in. */}
      <link rel="stylesheet" href={googleCssUrl(font, [weight])} />
      <div
        className="text-[clamp(1.9rem,5.5vw,3.1rem)] leading-[1.1] tracking-[-0.01em]"
        style={{ fontFamily: `"${font.family}", Georgia, serif`, fontWeight: weight }}
      >
        {font.family}
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-dim">{why}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
          {font.genome.category} · {font.genome.contrast} · {font.genome.weight}
        </span>
        <a
          href={googleSpecimenUrl(font)}
          target="_blank"
          rel="noreferrer noopener"
          className="font-mono text-[11px] text-ink-faint transition hover:text-ink"
        >
          ↗ google fonts
        </a>
        {font.pairsWith && (
          <span className="font-mono text-[11px] text-ink-faint">pairs with {font.pairsWith}</span>
        )}
      </div>
    </li>
  );
}

function AtlasRow({ entry }: { entry: AtlasEntry }) {
  const { family, loaded } = useAtlasFullFont(entry.slug);
  const g = entry.genome;
  return (
    <li className="border-b border-line py-6">
      <div
        className="specimen text-[clamp(1.9rem,5.5vw,3.1rem)] leading-[1.1]"
        data-loaded={loaded}
        style={{ fontFamily: `"${family}", Georgia, serif` }}
      >
        {entry.name}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
          {g.category} · {g.contrast} · {g.weight} · {g.terminals}
        </span>
        <a
          href={`/atlas/${entry.slug}.ttf`}
          download={`${entry.name}.ttf`}
          className="font-mono text-[11px] text-ink-faint transition hover:text-ink"
        >
          ↓ ttf
        </a>
      </div>
    </li>
  );
}

export function Result({
  profile,
  atlas,
  google,
  onBegin,
  starting,
  shared = false,
}: {
  profile: TasteProfile;
  atlas: AtlasEntry[];
  google: GoogleFont[];
  onBegin?: () => void;
  starting?: boolean;
  /** True when rendered from a shared link rather than a just-finished quiz. */
  shared?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const { read, chips, googleMatches, atlasMatches, pins, code } = useMemo(() => {
    const seed = profileToSeed(profile);
    const pinned = Object.entries(seed.pinned);
    const vec = profileToVector(profile);
    return {
      read: composeRead(profile, pinned.length),
      chips: axisChips(profile),
      googleMatches: recommend(vec, google, HOW_MANY),
      atlasMatches: recommend(vec, atlas, HOW_MANY),
      pins: pinned,
      code: encodeProfile(profile),
    };
  }, [profile, atlas, google]);

  const path = `/type/${code}`;

  /**
   * Copy, but never silently.
   *
   * `navigator.clipboard` rejects on an insecure origin, when the document
   * isn't focused, or when the permission is refused — and an uncaught reject
   * leaves the button saying "copy link" forever with no hint anything went
   * wrong. On failure we select the visible URL instead, so there is always a
   * way to get the link out.
   */
  const share = useCallback(async () => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setFailed(true);
      const el = document.getElementById('share-url') as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }
  }, [path]);

  return (
    <div className="surface-publish flex min-h-full flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-3.5">
          <Link href="/" className="font-display text-[15px] tracking-tight text-ink">
            Foundry
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            {shared ? 'a type profile' : 'your type'}
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[720px] px-6 py-14">
        {/* ── the read ─────────────────────────────────────────────────── */}
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          the read
        </p>
        <h1 className="mt-5 font-display text-[clamp(1.6rem,4.4vw,2.35rem)] font-normal leading-[1.28] tracking-[-0.01em]">
          {read.opener}
        </h1>
        {/* The closers are advice to somebody about to run a generation ("spend
            the wildcard slot generously"). A visitor arriving on a shared link
            has no run, no key and no wildcard slot, so the instruction reads as
            nonsense addressed to someone else. They get the verdict; the
            operating advice belongs to the person who earned it. */}
        <div className="mt-5 space-y-3 text-[17px] leading-[1.65] text-ink-dim">
          {read.tension && <p>{read.tension}</p>}
          {read.evidence && <p className="text-ink">{read.evidence}</p>}
          {!shared && read.closer && <p>{read.closer}</p>}
        </div>

        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          in short
        </p>
        <p className="mt-2 font-mono text-[12.5px] leading-relaxed text-ink-dim">
          {summarize(profile)}
        </p>

        {chips.length > 0 && (
          <ul className="mt-6 space-y-2">
            {chips.map((c) => (
              <li key={c.axis} className="flex gap-3 border-t border-line pt-2">
                <span className="w-[92px] shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  {c.axis}
                </span>
                <span className="text-[14px] text-ink">{c.label}</span>
                {c.reads && <span className="text-[14px] text-ink-faint">{c.reads}</span>}
              </li>
            ))}
          </ul>
        )}

        {/* "You never wavered" was a lie: an axis pins at a 55% share with a
            1.6x margin, so a 4-2 split pins. Say what is actually true, and say
            it with the authored labels rather than the raw gene slugs the chips
            above already translate. */}
        {pins.length > 0 && (
          <p className="mt-6 text-[15px] leading-relaxed text-ink-dim">
            You kept coming back to{' '}
            <span className="text-ink">
              {pins.map(([axis, v]) => labelFor(axis, String(v))).join(', ')}
            </span>
            .
          </p>
        )}

        {/* ── what exists ──────────────────────────────────────────────── */}
        <Rule label="what exists" note="Free, and installable this afternoon." />
        <ul className="mt-2">
          {googleMatches.map((m) => (
            <GoogleRow key={m.item.family} font={m.item} why={m.item.why} />
          ))}
        </ul>

        {/* ── what doesn't ─────────────────────────────────────────────── */}
        <Rule label="from the foundry" note="Drawn for this profile. They exist nowhere else." />
        <ul className="mt-2">
          {atlasMatches.map((m) => (
            <AtlasRow key={m.item.slug} entry={m.item} />
          ))}
        </ul>

        {/* ── the verb ─────────────────────────────────────────────────── */}
        <div className="mt-16 border-t-2 border-ink pt-8">
          <p className="text-[17px] leading-[1.6] text-ink-dim">
            Those are the closest things that exist. The point of a foundry is the thing that
            doesn&rsquo;t: eight typefaces bred from this profile, then bred again from whichever
            you keep.
          </p>
          {onBegin ? (
            <button
              onClick={onBegin}
              disabled={starting}
              className="mt-6 border border-accent px-5 py-3 text-[15px] font-medium text-accent transition hover:bg-accent hover:text-paper disabled:border-line disabled:text-ink-faint disabled:hover:bg-transparent"
            >
              {starting ? 'minting generation 0…' : 'breed your own →'}
            </button>
          ) : (
            // Not Proof Red. On a shared page there is no Breed action, so the
            // accent would teach a first-time visitor that red means "take the
            // quiz" — and DESIGN.md reserves it to Breed and Keep.
            <Link
              href="/quiz"
              className="mt-6 inline-block border-2 border-ink px-5 py-3 text-[15px] font-medium transition hover:bg-ink hover:text-paper"
            >
              take it yourself →
            </Link>
          )}
          <p className="mt-3 font-mono text-[11px] text-ink-faint">
            {onBegin
              ? 'eight fonts, about $1.60 · you’ll add your Mixfont key next'
              : 'twelve rounds, no key, free'}
          </p>
        </div>

        {/* ── the link ─────────────────────────────────────────────────── */}
        <div className="mt-12 border-t border-line pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-mono text-[11px] text-ink-faint">
              the whole profile lives inside this link. nothing is stored.
            </p>
            <button
              onClick={share}
              className="font-mono text-[11px] text-ink-dim transition hover:text-ink"
            >
              {copied ? '✓ copied' : failed ? 'select it →' : '⧉ copy link'}
            </button>
          </div>
          {/* Always present and always selectable, so the link is obtainable
              even where the clipboard API isn't. */}
          <input
            id="share-url"
            readOnly
            value={path}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-3 w-full border border-line bg-transparent px-3 py-2 font-mono text-[11px] text-ink-dim outline-none transition focus:border-ink focus:text-ink"
          />
        </div>
      </div>
    </div>
  );
}
