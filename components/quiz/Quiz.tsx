'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { mulberry32 } from '@/lib/genome';
import type { GoogleFont } from '@/lib/recommend';
import { apiFetch } from '@/lib/userKey';
import type { WorldImage } from '@/lib/world';
import { useEnsureKey } from '../KeyGateProvider';
import {
  emptyProfile,
  nextDuel,
  profileToSeed,
  QUIZ_LENGTH,
  recordPick,
  recordSkip,
  summarize,
  type AtlasEntry,
  type Duel,
  type TasteProfile,
} from '@/lib/taste';
import { Result } from './Result';
import { useAtlasFont, useAtlasPreload } from './useAtlasFont';

/**
 * The specimen word. Must stay within the glyphs subset by
 * scripts/subset-atlas.mjs — `npm test` asserts the two agree, because a
 * character outside the subset renders as .notdef with no visible error.
 */
const SPECIMEN = 'Handgloves';

// ---------------------------------------------------------------------------
// Panes
// ---------------------------------------------------------------------------

function SpecimenPane({
  entry,
  side,
  onPick,
}: {
  entry: AtlasEntry;
  side: 'left' | 'right';
  onPick: () => void;
}) {
  const { family, loaded } = useAtlasFont(entry.slug);
  return (
    <button
      onClick={onPick}
      className="group relative flex h-[42vh] max-h-[430px] min-h-[220px] flex-col items-center justify-center border border-line bg-panel px-6 py-10 transition-colors duration-200 hover:border-ink-faint focus-visible:border-ink focus-visible:outline-none"
    >
      <div
        className="specimen text-center leading-[0.95] transition-transform duration-200 group-hover:scale-[1.02]"
        data-loaded={loaded}
        style={{ fontFamily: `"${family}", serif`, fontSize: 'clamp(2.75rem, 7vw, 5.5rem)' }}
      >
        {SPECIMEN}
      </div>
      <span className="mt-8 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint transition group-hover:text-ink">
        {side === 'left' ? '← this' : 'that →'}
      </span>
    </button>
  );
}

function WorldPane({
  image,
  side,
  onPick,
}: {
  image: WorldImage;
  side: 'left' | 'right';
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      className="group relative flex flex-1 flex-col overflow-hidden border border-line bg-panel text-left transition-colors duration-200 hover:border-ink-faint focus-visible:border-ink focus-visible:outline-none"
    >
      {/* `contain`, not `cover`. The lettering is the thing being judged, and a
          cover crop routinely slices the top off a poster or the end off a shop
          sign — which would make the vote a verdict on our cropping. Letterboxed
          on the panel ground it reads as a plate in a catalogue. */}
      <div className="relative flex h-[42vh] max-h-[430px] min-h-[220px] items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/world/${image.file}`}
          alt={image.caption}
          className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
          loading="eager"
        />
      </div>
      <div className="border-t border-line px-4 py-3">
        <p className="text-[14px] leading-snug text-ink">{image.caption}</p>
        {/* The credit rides with the image everywhere it appears — these are
            other people's photographs, used under the licence named here. */}
        <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
          {image.credit.artist} · {image.credit.licence}
        </p>
        <span className="mt-2 block font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint transition group-hover:text-ink">
          {side === 'left' ? '← this' : 'that →'}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// The quiz
// ---------------------------------------------------------------------------

export function Quiz({
  atlas,
  world,
  google,
}: {
  atlas: AtlasEntry[];
  world: WorldImage[];
  google: GoogleFont[];
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<TasteProfile>(emptyProfile);
  const [starting, setStarting] = useState(false);

  // One seeded RNG for the whole session, so a run is reproducible and the
  // duels don't reshuffle on every render.
  const rng = useMemo(() => mulberry32(0xf0f0 ^ atlas.length), [atlas.length]);

  // The first duel is computed during the initial render rather than in a mount
  // effect, so round one paints with real specimens instead of an empty frame
  // that fills in a tick later. Safe because the RNG is seeded: the server and
  // the client independently derive the same pair, so there's no hydration gap.
  const [duel, setDuel] = useState<Duel | null>(() => nextDuel(emptyProfile(), atlas, rng, world));

  // Warm the whole atlas from the first paint. Each duel still waits for its
  // own two faces, but after round one that wait is already over.
  //
  // Round one's two faces jump the queue. Without that they sit wherever they
  // fall in manifest order, possibly behind 190 fonts nobody needs yet, and the
  // only gate a visitor ever actually sees gets longer. The preloader keys its
  // effect on the manifest length, so it reads this on the first render only —
  // which is exactly the duel we want prioritised.
  const slugs = useMemo(() => atlas.map((a) => a.slug), [atlas]);
  useAtlasPreload(slugs, duel?.kind === 'type' ? [duel.a.slug, duel.b.slug] : []);

  const advance = useCallback(
    (p: TasteProfile) => {
      if (p.round >= QUIZ_LENGTH) {
        setDuel(null);
        return;
      }
      setDuel(nextDuel(p, atlas, rng, world));
    },
    [atlas, rng, world],
  );

  const pick = useCallback(
    (winner: 'a' | 'b') => {
      if (!duel) return;
      const next = recordPick(profile, duel, winner);
      setProfile(next);
      advance(next);
    },
    [duel, profile, advance],
  );

  const skip = useCallback(() => {
    const next = recordSkip(profile, duel);
    setProfile(next);
    advance(next);
  }, [profile, duel, advance]);

  const done = profile.round >= QUIZ_LENGTH || (!duel && profile.round > 0);

  // Keyboard: ← / → to pick, ↓ to skip.
  //
  // Detached the moment the quiz is over. The result screen renders in place of
  // the duels but this effect would otherwise keep running, and ↓ there still
  // advanced profile.round — which feeds profileSeed, which chooses the
  // wording of the read and encodes into the share URL. Pressing an arrow key
  // while reading your own result would quietly rewrite it, and change the link
  // you were about to send.
  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      // Don't steal arrow keys from the share field or any other input.
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'ArrowLeft') pick('a');
      else if (e.key === 'ArrowRight') pick('b');
      else if (e.key === 'ArrowDown') skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, skip, done]);

  const ensureKey = useEnsureKey();
  const beginRun = useCallback(() => {
    ensureKey(async () => {
      setStarting(true);
      const seed = profileToSeed(profile);
      const summary = summarize(profile);
      try {
        const res = await apiFetch('/api/runs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tasteSeed: seed,
            tasteSummary: summary,
            specimenText: SPECIMEN,
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

  const pct = Math.round((Math.min(profile.round, QUIZ_LENGTH) / QUIZ_LENGTH) * 100);

  if (done) {
    return (
      <Result
        profile={profile}
        atlas={atlas}
        google={google}
        onBegin={beginRun}
        starting={starting}
      />
    );
  }

  const prompt =
    duel?.kind === 'world'
      ? 'which world would you rather live in?'
      : 'pick the one you like more';

  return (
    <div className="surface-judge flex min-h-full flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-3.5">
          <Link
            href="/"
            className="font-mono text-[11px] tracking-widest text-ink-dim transition hover:text-ink"
          >
            ← FOUNDRY
          </Link>
          <span className="font-mono text-[11px] text-ink-faint">find your type</span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col justify-center px-6 py-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-widest text-ink-faint">
          {profile.round + 1} / {QUIZ_LENGTH}
        </span>
        <button onClick={skip} className="font-mono text-[11px] text-ink-faint hover:text-ink">
          no preference ↓
        </button>
      </div>
      <div className="mt-3 h-px w-full bg-line">
        <div className="h-px bg-signal transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {duel && (
        <div className="mt-6 grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          {/* The keys are load-bearing, not hygiene. Without them React reuses
              the same specimen node across duels: one commit swaps fontFamily to
              the incoming face *and* flips data-loaded to false, so the .specimen
              rule fades the new word out from opacity 1 over 300ms — rendering it
              in the fallback serif the whole way down. That is precisely the
              flash this feature exists to remove, and it appears exactly when the
              preload sweep hasn't landed yet (slow connection, first rounds).
              A fresh node starts at opacity 0 and only ever fades in. */}
          {duel.kind === 'world' ? (
            <>
              <WorldPane key={duel.a.id} image={duel.a} side="left" onPick={() => pick('a')} />
              <WorldPane key={duel.b.id} image={duel.b} side="right" onPick={() => pick('b')} />
            </>
          ) : (
            <>
              <SpecimenPane key={duel.a.slug} entry={duel.a} side="left" onPick={() => pick('a')} />
              <SpecimenPane key={duel.b.slug} entry={duel.b} side="right" onPick={() => pick('b')} />
            </>
          )}
        </div>
      )}

        <p className="mt-6 text-center font-mono text-[11px] text-ink-faint">
          {prompt} · ← / → · this isn&rsquo;t a test, go on instinct
        </p>
      </div>
    </div>
  );
}
