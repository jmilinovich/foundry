'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import { encodeProfile } from '@/lib/profileCode';
import { apiFetch } from '@/lib/userKey';
import { useEnsureKey } from '../KeyGateProvider';
import { composeRead, axisChips, labelFor, matchReason } from '@/lib/read';
import {
  googleCssUrl,
  googleSpecimenUrl,
  profileToVector,
  recommend,
  type GoogleFont,
  type MatchDetail,
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

function GoogleRow({ font, why, strengths }: { font: GoogleFont; why: string; strengths: MatchDetail[] }) {
  const matched = matchReason(strengths);
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
      <p className="mt-3 text-[15px] leading-relaxed text-ink-dim">
        {matched && <span className="text-ink">Closest to you on {matched.axes}. </span>}
        {why}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
          {font.genome.category} · {font.genome.contrast} · {font.genome.weight}
        </span>
        <a
          href={googleSpecimenUrl(font)}
          target="_blank"
          rel="noreferrer noopener"
          className="-my-3 inline-flex min-h-[44px] items-center font-mono text-[11px] text-ink-faint transition hover:text-ink"
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

/**
 * A house face, given the same three-part shape as a Google row.
 *
 * The differentiated half of the payoff used to be the unexplained half: a
 * Google row got a name, a specimen, a human clause, a link and a pairing, while
 * a Foundry row — the fonts that are the whole reason the site exists — got a
 * name and a line of genome jargon. The reason is composed from data that
 * already existed: the matcher's per-axis closeness, and the authored "reads"
 * clause for the winning value.
 */
function AtlasRow({ entry, strengths }: { entry: AtlasEntry; strengths: MatchDetail[] }) {
  const { family, loaded } = useAtlasFullFont(entry.slug);
  const g = entry.genome;
  const why = matchReason(strengths);
  return (
    <li className="border-b border-line py-6">
      <div
        className="specimen text-[clamp(1.9rem,5.5vw,3.1rem)] leading-[1.1]"
        data-loaded={loaded}
        style={{ fontFamily: `"${family}", Georgia, serif` }}
      >
        {entry.name}
      </div>
      {why && (
        <p className="mt-3 text-[15px] leading-relaxed text-ink-dim">
          <span className="text-ink">Closest to you on {why.axes}.</span>
          {why.reads && ` ${why.reads}.`}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
          {g.category} · {g.contrast} · {g.weight} · {g.terminals}
        </span>
        <a
          href={`/atlas/${entry.slug}.ttf`}
          download={`${entry.name}.ttf`}
          className="-my-3 inline-flex min-h-[44px] items-center font-mono text-[11px] text-ink-faint transition hover:text-ink"
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
  shared = false,
}: {
  profile: TasteProfile;
  atlas: AtlasEntry[];
  google: GoogleFont[];
  /** True when rendered from a shared link rather than your own finished run. */
  shared?: boolean;
}) {
  const router = useRouter();
  const ensureKey = useEnsureKey();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);

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
   * Minting lives here rather than in the quiz.
   *
   * A finished run now redirects to its own /type/<code> URL, so the result is
   * reached two ways: straight off the twelfth pick, and by reloading or
   * revisiting that URL later. Both have to offer the same thing. Keeping the
   * breed action inside Result is what makes the page complete on its own,
   * instead of only working while the quiz component happens to still be
   * mounted.
   */
  const beginRun = useCallback(() => {
    ensureKey(async () => {
      setStarting(true);
      try {
        const res = await apiFetch('/api/runs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tasteSeed: profileToSeed(profile),
            tasteSummary: summarize(profile),
            specimenText: 'Handgloves',
            populationSize: 8,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Could not start');
        router.push(`/run/${data.run.id}`);
      } catch {
        setStarting(false);
      }
    });
  }, [profile, router, ensureKey]);

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

    // On a phone the share sheet is the idiom — it reaches Messages, Mail and
    // every app the person actually uses, which a clipboard copy does not.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'A type profile', url });
        return;
      } catch (err) {
        // Cancelling the sheet is a normal thing to do, not a failure to fall
        // back from. Anything else, drop through to the clipboard.
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

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

  /**
   * The visible field has to hold a link that works when pasted.
   *
   * It used to render `path` — a bare "/type/AgwICh…", which is not a URL and
   * does nothing in someone else's message window. The origin only exists in
   * the browser, so it is filled in after mount; until then the field shows the
   * path, which keeps the server and client markup identical.
   */
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => '',
  );

  return (
    <div className="surface-publish flex min-h-full flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-3.5 sm:px-6">
          <Link href="/" className="font-display text-[15px] tracking-tight text-ink">
            Foundry
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            {shared ? 'a type profile' : 'your type'}
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[720px] px-5 py-12 sm:px-6 sm:py-14">
        {/* ── the read ─────────────────────────────────────────────────── */}
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          the read
        </p>
        {/* The verdict is the headline; the long sentence it belongs to is the
            first line of the read below it. Set as the H1, that sentence ran to
            eight lines of Fraunces on a phone before the reader got anything. */}
        <h1 className="mt-5 font-display text-[clamp(1.9rem,6vw,3rem)] font-normal leading-[1.15] tracking-[-0.015em]">
          {read.verdict}
        </h1>
        {/* The closers are advice to somebody about to run a generation ("spend
            the wildcard slot generously"). A visitor arriving on a shared link
            has no run, no key and no wildcard slot, so the instruction reads as
            nonsense addressed to someone else. They get the verdict; the
            operating advice belongs to the person who earned it. */}
        <div className="mt-5 space-y-3 text-[17px] leading-[1.65] text-ink-dim">
          <p className="text-ink">{read.opener}</p>
          {read.tension && <p>{read.tension}</p>}
          {read.evidence && <p className="text-ink">{read.evidence}</p>}
          {!shared && read.closer && <p>{read.closer}</p>}
        </div>

        {/* The summary line that used to sit here restated the table below it
            word for word — and it was `summarize()`, which builds a string for
            the Mixfont prompt and emits raw gene slugs like "normal-width".
            That function still does its real job on the API payload; it just
            has no business being read by a person. */}
        <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          on the axes
        </p>

        {chips.length > 0 && (
          <ul className="mt-3 space-y-2">
            {chips.map((c) => (
              <li key={c.axis} className="flex gap-3 border-t border-line pt-2">
                <span className="w-[92px] shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  {c.axis}
                </span>
                <span className="text-[14px] text-ink">{c.label}</span>
                {c.reads && <span className="text-[14px] text-ink-dim">{c.reads}</span>}
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
        <Rule label="off the shelf" note="Free from Google Fonts, and installed in about a minute. Not one of them is ours." />
        <ul className="mt-2">
          {googleMatches.map((m) => (
            <GoogleRow key={m.item.family} font={m.item} why={m.item.why} strengths={m.strengths} />
          ))}
        </ul>

        {/* ── what doesn't ─────────────────────────────────────────────── */}
        <Rule label="the house library" note="The house cut 201 faces and froze the lot long before you arrived. These six landed nearest your votes, and they are on no type site but this one." />
        <ul className="mt-2">
          {atlasMatches.map((m) => (
            <AtlasRow key={m.item.slug} entry={m.item} strengths={m.strengths} />
          ))}
        </ul>
        {/* The free path used to stop here at a $1.60 wall behind a third-party
            API key. These six are static files that cost nothing to serve. */}
        <div className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <a
            href={`/api/atlas/kit?p=${encodeURIComponent(code)}`}
            className="inline-flex min-h-[44px] items-center border-2 border-ink px-5 text-[15px] font-medium transition hover:bg-ink hover:text-paper"
          >
            take all six ↓
          </a>
          <span className="font-mono text-[11px] text-ink-dim">
            Six TTFs in one zip, ready to install.
          </span>
        </div>

        {/* ── the verb ─────────────────────────────────────────────────── */}
        <div className="mt-16 border-t-2 border-ink pt-8">
          <p className="text-[17px] leading-[1.6] text-ink-dim">
            Those are the closest things that exist. The point of a foundry is the thing that
            doesn&rsquo;t: eight typefaces bred from this profile, then bred again from whichever
            you keep.
          </p>
          {!shared ? (
            <button
              onClick={beginRun}
              disabled={starting}
              className="mt-6 border border-accent px-5 py-3 text-[15px] font-medium text-accent transition hover:bg-accent hover:text-paper disabled:border-line disabled:text-ink-faint disabled:hover:bg-transparent"
            >
              {starting ? 'minting the first eight…' : 'mint the first eight →'}
            </button>
          ) : (
            // Not Proof Red. On a shared page there is no Breed action, so the
            // accent would teach a first-time visitor that red means "take the
            // quiz" — and DESIGN.md reserves it to Breed and Keep.
            <Link
              href="/quiz"
              className="mt-6 inline-block border-2 border-ink px-5 py-3 text-[15px] font-medium transition hover:bg-ink hover:text-paper"
            >
              get your own read →
            </Link>
          )}
          {/* Who bills, and where the key lives — before the click, not after.
              "eight fonts, about $1.60" named a price with no biller, which a
              first-time reader reasonably parses as Foundry charging them. */}
          <p className="mt-3 max-w-md font-mono text-[11px] leading-relaxed text-ink-dim">
            {!shared
              ? 'about $1.60 for eight fonts, billed by Mixfont to the key you add next. Foundry takes none of it, and the key is stored nowhere but this browser.'
              : 'twelve pairs, no key, no charge'}
          </p>
        </div>

        {/* ── the link ─────────────────────────────────────────────────── */}
        <div className="mt-12 border-t border-line pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-mono text-[11px] text-ink-faint">
              whoever opens it gets your verdict and all twelve faces, downloads included. the profile rides inside the link, so nothing about you sits on a server.
            </p>
            <div className="flex items-center gap-5">
              {/* Every run draws a different twelve rounds now, so retaking is
                  a real thing to offer rather than a reset button. A full
                  navigation is what fetches a new seed from the server. */}
              {!shared && (
                <a
                  href="/quiz"
                  className="-m-2 p-2 font-mono text-[11px] text-ink-faint transition hover:text-ink"
                >
                  ↻ twelve new pairs
                </a>
              )}
              <button
                onClick={share}
                className="-m-2 p-2 font-mono text-[11px] text-ink-dim transition hover:text-ink"
              >
                {copied ? '✓ copied' : failed ? 'blocked, it is selected below ↓' : '⧉ share the link'}
              </button>
            </div>
          </div>
          {/* Always present and always selectable, so the link is obtainable
              even where the clipboard API isn't. */}
          <input
            id="share-url"
            readOnly
            value={origin ? origin + path : path}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-3 w-full border border-line bg-transparent px-3 py-2 font-mono text-[11px] text-ink-dim outline-none transition focus:border-ink focus:text-ink"
          />
        </div>
      </div>
    </div>
  );
}
