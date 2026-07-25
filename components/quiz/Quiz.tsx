'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { mulberry32 } from '@/lib/genome';
import { encodeProfile } from '@/lib/profileCode';
import type { WorldImage } from '@/lib/world';
import {
  emptyProfile,
  nextDuel,
  QUIZ_LENGTH,
  recordPick,
  recordSkip,
  type AtlasEntry,
  type Duel,
  type TasteProfile,
} from '@/lib/taste';
import { useAtlasFont, useAtlasPreload, useWorldPreload } from './useAtlasFont';

/**
 * The specimen word. Must stay within the glyphs subset by
 * scripts/subset-atlas.mjs — `npm test` asserts the two agree, because a
 * character outside the subset renders as .notdef with no visible error.
 */
const SPECIMEN = 'Handgloves';

/**
 * How long the chosen pane is held before the next pair arrives.
 *
 * It does two jobs at once: it acknowledges the tap on a device where we
 * suppressed the OS's own feedback, and it is the window during which a second
 * tap is ignored. Long enough to read as deliberate, short enough that twelve
 * of them do not feel like waiting.
 */
const PICK_HOLD_MS = 190;

/**
 * Mid-run state, kept for the length of the tab.
 *
 * A phone can drop a backgrounded tab at any time, and people reload by
 * accident. Losing eleven answers to that is the kind of thing you only forgive
 * once. The whole profile goes in — including `shown`, which the URL code omits
 * — so a resumed run still never repeats a specimen.
 */
const SAVE_KEY = 'foundry.quiz.v1';

function save(profile: TasteProfile) {
  try {
    sessionStorage.setItem(SAVE_KEY, JSON.stringify(profile));
  } catch {
    /* private mode, quota, or no storage at all — the quiz still works */
  }
}

function clearSaved() {
  try {
    sessionStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

function loadSaved(): TasteProfile | null {
  try {
    const raw = sessionStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as TasteProfile;
    // Only resume a run that is genuinely mid-flight.
    return p && p.round > 0 && p.round < QUIZ_LENGTH ? p : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Panes
// ---------------------------------------------------------------------------

/**
 * How a pane is behaving during the brief hold after a tap.
 *
 * The loop used to give no response at all: you tapped and two different words
 * appeared, with nothing confirming which one you had chosen or that the tap
 * had even registered. On touch that is worse than flat, because we deliberately
 * suppressed the browser's own tap highlight. `chosen` firms the border to ink;
 * `passed` steps the other pane back. Compositor-only properties, inside the
 * micro-state budget DESIGN.md allows for the loop.
 */
type PickState = 'idle' | 'chosen' | 'passed';

/**
 * The em-width the round has to accommodate.
 *
 * The wider of the two faces on screen, so the shared point size is as large as
 * this pair allows without the broader one clipping. A world duel shows no type
 * and needs no value. Unmeasured faces fall back to the atlas-wide worst case —
 * safe, just conservative.
 */
const WIDEST_EM = 6.4;

function duelEm(duel: Duel): number {
  if (duel.kind !== 'type') return WIDEST_EM;
  return Math.min(WIDEST_EM, Math.max(duel.a.w ?? WIDEST_EM, duel.b.w ?? WIDEST_EM));
}

const paneState: Record<PickState, string> = {
  idle: 'border-line',
  chosen: 'border-ink',
  passed: 'border-line opacity-35',
};

function SpecimenPane({
  entry,
  side,
  state,
  onPick,
}: {
  entry: AtlasEntry;
  side: 'left' | 'right';
  state: PickState;
  onPick: () => void;
}) {
  const { family, loaded } = useAtlasFont(entry.slug);
  return (
    <button
      onClick={onPick}
      aria-label={`Option ${side === 'left' ? 1 : 2} of 2: ${entry.name}, ${entry.genome.category}, ${entry.genome.weight}, ${entry.genome.width}`}
      className={`pane group relative flex h-full min-h-0 select-none flex-col items-center justify-center overflow-hidden border px-3 py-4 transition-all duration-200 focus-visible:border-ink focus-visible:outline-none sm:h-[42vh] sm:max-h-[430px] sm:min-h-[160px] sm:px-6 sm:py-10 ${paneState[state]} ${state === 'idle' ? 'hover:border-ink-faint' : ''}`}
    >
      <div
        aria-hidden="true"
        className="specimen duel-specimen max-w-full text-center leading-[0.95] transition-transform duration-200 group-hover:scale-[1.02]"
        data-loaded={loaded}
        style={{ fontFamily: `"${family}", serif` }}
      >
        {SPECIMEN}
      </div>
      {/* Hidden on mobile: the panes are stacked there, so a left/right arrow
          points at nothing, and the row is worth more as specimen height. */}
      <span className="mt-8 hidden font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint transition group-hover:text-ink sm:block">
        {side === 'left' ? '← this' : 'that →'}
      </span>
    </button>
  );
}

function WorldPane({
  image,
  side,
  state,
  onPick,
}: {
  image: WorldImage;
  side: 'left' | 'right';
  state: PickState;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      aria-label={`Option ${side === 'left' ? 1 : 2} of 2: ${image.caption}`}
      className={`pane group relative flex h-full min-h-0 select-none flex-col overflow-hidden border text-left transition-all duration-200 focus-visible:border-ink focus-visible:outline-none sm:h-auto ${paneState[state]} ${state === 'idle' ? 'hover:border-ink-faint' : ''}`}
    >
      {/* `contain`, not `cover`. The lettering is the thing being judged, and a
          cover crop routinely slices the top off a poster or the end off a shop
          sign — which would make the vote a verdict on our cropping. Letterboxed
          on the panel ground it reads as a plate in a catalogue. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1 sm:h-[42vh] sm:max-h-[430px] sm:min-h-[160px] sm:flex-none sm:p-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/world/${image.file}`}
          alt={image.caption}
          className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
          loading="eager"
        />
      </div>
      <div className="shrink-0 border-t border-line px-3 py-2 sm:px-4 sm:py-3">
        <p className="text-[13px] leading-snug text-ink sm:text-[14px]">{image.caption}</p>
        {/* The credit rides with the image everywhere it appears — these are
            other people's photographs, used under the licence named here. */}
        <p className="mt-0.5 truncate font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint sm:mt-1">
          {image.credit.artist} · {image.credit.licence}
        </p>
        <span className="mt-2 hidden font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint transition group-hover:text-ink sm:block">
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
  seed,
}: {
  atlas: AtlasEntry[];
  world: WorldImage[];
  /** Rolled per request on the server; see app/quiz/page.tsx. */
  seed: number;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<TasteProfile>(emptyProfile);
  /** Which pane was just chosen, held briefly so the tap is acknowledged. */
  const [chosen, setChosen] = useState<'a' | 'b' | null>(null);
  /** True once the twelfth answer is in and we are navigating to the verdict. */
  const [finishing, setFinishing] = useState(false);
  /** Every previous (profile, duel) so a mis-tap can be taken back. */
  const [past, setPast] = useState<{ profile: TasteProfile; duel: Duel }[]>([]);
  /**
   * Closed for the length of the pick animation.
   *
   * Without it a double-tap casts two votes: the handler swaps in the next pair
   * synchronously, so the second tap of a double lands on a *different* duel at
   * the identical screen coordinates. Suppressing the OS double-tap-to-zoom
   * made that easier to do by accident, not harder.
   */
  const lockRef = useRef(false);

  // One RNG for the whole run, seeded from the server's per-request number, so
  // every visitor gets a different twelve rounds while a single run stays
  // internally consistent and doesn't reshuffle on every render.
  const rng = useMemo(() => mulberry32(seed), [seed]);

  // The first duel is computed during the initial render rather than in a mount
  // effect, so round one paints with real specimens instead of an empty frame
  // that fills in a tick later. Safe because both sides derive it from the same
  // server-supplied seed, so there's no hydration gap.
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

  // The photographs get the same treatment, a beat later. A world round used to
  // wait on a cold fetch of two full-size images, and round 2 is a world round.
  const worldFiles = useMemo(() => world.map((w) => w.file), [world]);
  useWorldPreload(worldFiles);

  /**
   * Hand off to the verdict's own URL rather than swapping it in.
   *
   * The result used to render inline while the address bar still said /quiz, so
   * it was React state and nothing else: a refresh, a back gesture or a phone
   * dropping the tab lost ninety seconds of work with no way back. Replacing
   * the history entry means the verdict has an address the moment it exists,
   * and the profile survives everything. `?r=1` marks it as your own run rather
   * than a link someone sent you; the share URL never carries it.
   */
  const finish = useCallback(
    (p: TasteProfile) => {
      setFinishing(true);
      clearSaved();
      router.replace(`/type/${encodeProfile(p)}?r=1`);
    },
    [router],
  );

  const advance = useCallback(
    (p: TasteProfile) => {
      if (p.round >= QUIZ_LENGTH) {
        finish(p);
        return;
      }
      setDuel(nextDuel(p, atlas, rng, world));
    },
    [atlas, rng, world, finish],
  );

  /**
   * The live profile and duel, readable without closing over them.
   *
   * `commit` used to capture both, which made it a new function on every render
   * and meant the keydown listener was torn down and re-added constantly. Worse,
   * a handler could still be holding the previous round's profile: an answer
   * would be recorded against stale state and the round counter would not move,
   * so every second keypress was silently swallowed. Reading through a ref keeps
   * the callback identity stable and the data always current.
   */
  const live = useRef<{ profile: TasteProfile; duel: Duel | null }>({ profile, duel });

  /** Record a vote (or a skip), hold the acknowledgement, then move on. */
  const commit = useCallback(
    (winner: 'a' | 'b' | null) => {
      const { profile: p, duel: d } = live.current;
      if (!d || lockRef.current) return;
      lockRef.current = true;

      const next = winner === null ? recordSkip(p, d) : recordPick(p, d, winner);

      // Advance the ref NOW, not on the next render. React commits the new
      // profile a frame or more later, and the lock lifts on a fixed timer, so
      // a quick second answer could arrive in between and be recorded against
      // the round that had already been answered — the counter would not move
      // and the vote would be lost. Clearing `duel` here also means no pick is
      // accepted until the next pair has genuinely been rendered.
      live.current = { profile: next, duel: null };

      setChosen(winner);
      setPast((stack) => [...stack, { profile: p, duel: d }]);

      // The lock is NOT lifted here. It lifts when the next pair has actually
      // rendered (see the effect below), because a timer only knows how long
      // the animation lasts, not when React has caught up. Releasing on the
      // timer left a window in which an answer was accepted but the state
      // behind it was still the previous round's, and the vote vanished.
      window.setTimeout(() => {
        setProfile(next);
        save(next);
        advance(next);
        setChosen(null);
      }, PICK_HOLD_MS);
    },
    [advance],
  );

  /**
   * Publish the new round and open for answers, in that order.
   *
   * Both happen here, after the pair is genuinely on screen. Tying it to the
   * render rather than to a timer is what makes fast answering safe: until this
   * runs, `live.current.duel` is null and every pick is refused, so there is no
   * moment where an answer is accepted against a round already counted. Doing
   * it in one effect also keeps the two in step — releasing the lock while the
   * ref still held the previous pair is exactly the bug this replaced.
   */
  useEffect(() => {
    if (!duel) return;
    live.current = { profile, duel };
    lockRef.current = false;
  }, [duel, profile]);

  const pick = useCallback((winner: 'a' | 'b') => commit(winner), [commit]);
  const skip = useCallback(() => commit(null), [commit]);

  /**
   * Take back the last answer, specimens and all.
   *
   * The pair you get if you answer again is not the pair you just saw — the
   * generator has moved on and is not rewound. That is deliberate: what needs
   * undoing is the vote, and re-running the selector off a restored profile is
   * both simpler and impossible to desynchronise.
   */
  const undo = useCallback(() => {
    if (lockRef.current || past.length === 0) return;
    const prev = past[past.length - 1];
    setProfile(prev.profile);
    setDuel(prev.duel);
    setPast(past.slice(0, -1));
    save(prev.profile);
  }, [past]);

  /**
   * Pick up an interrupted run.
   *
   * Restoring in an effect rather than during render keeps the server and
   * client markup identical; the cost is one frame of round 1 before the real
   * round appears, on the rare path where there is anything to resume at all.
   */
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps --
     Reading sessionStorage is inherently a post-mount operation: doing it during
     render would diverge from the server markup. Mount only, because a later run
     would fight the live profile. */
  useEffect(() => {
    const saved = loadSaved();
    if (!saved) return;
    setProfile(saved);
    setDuel(nextDuel(saved, atlas, rng, world));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

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

  const pct = Math.round((Math.min(profile.round, QUIZ_LENGTH) / QUIZ_LENGTH) * 100);
  const stateFor = (side: 'a' | 'b'): PickState =>
    chosen === null ? 'idle' : chosen === side ? 'chosen' : 'passed';

  /**
   * The beat between the last pick and the verdict.
   *
   * The read used to appear in the same commit as the twelfth tap: cool bench
   * with two words on it, then instantly a warm page carrying a 30-word
   * judgement and twelve typefaces. This holds the bench for the length of the
   * navigation, which is real work rather than an invented pause.
   */
  if (finishing || done) {
    return (
      <div className="quiz-viewport surface-judge flex flex-col items-center justify-center px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          twelve rounds
        </p>
        <p className="mt-4 font-display text-[clamp(1.4rem,5vw,2rem)] leading-tight">
          Reading them back.
        </p>
      </div>
    );
  }

  const prompt =
    duel?.kind === 'world'
      ? '← or → for the world you would rather live in · ↓ if neither · judge the lettering, not the photograph'
      : '← or → for the one you would rather set · ↓ if neither earns it';

  return (
    // One viewport tall, never scrolling. On a phone the two options stack, and
    // both still have to be on screen at once — an A/B you have to scroll
    // through is not an A/B.
    // overflow-y-auto rather than hidden: the layout is built so the pair always
    // fits, but a short landscape window is a real device state and losing the
    // prompt off the bottom edge would be worse than a scrollbar nobody uses.
    <div className="quiz-viewport surface-judge flex flex-col overflow-y-auto">
      <header className="shrink-0 border-b border-line">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-3 sm:px-6 sm:py-3.5">
          <Link
            href="/"
            className="font-mono text-[11px] tracking-widest text-ink-dim transition hover:text-ink"
          >
            ← FOUNDRY
          </Link>
          <span className="font-mono text-[11px] text-ink-faint">nothing you pick leaves this browser</span>
        </div>
      </header>

      <div className="mx-auto flex w-full min-h-0 max-w-[1100px] flex-1 flex-col justify-center px-5 py-4 sm:px-6 sm:py-6">
      <div className="flex shrink-0 items-center justify-between">
        <span className="font-mono text-[11px] tracking-widest text-ink-dim">
          {profile.round + 1} / {QUIZ_LENGTH}
        </span>
        {/* Real 44px targets. The previous -m-2 p-2 gave about 30px, which is
            below every platform's minimum and this is a twelve-tap loop. */}
        <div className="-mr-3 flex items-center">
          {past.length > 0 && (
            <button
              onClick={undo}
              aria-label="Undo the last answer"
              className="-my-3 inline-flex min-h-[44px] items-center px-3 font-mono text-[11px] text-ink-faint transition hover:text-ink"
            >
              ↶ undo
            </button>
          )}
          <button
            onClick={skip}
            className="-my-3 inline-flex min-h-[44px] items-center px-3 font-mono text-[11px] text-ink-faint transition hover:text-ink"
          >
            <span className="sm:hidden">neither</span>
            <span className="hidden sm:inline">neither ↓</span>
          </button>
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuenow={profile.round}
        aria-valuemin={0}
        aria-valuemax={QUIZ_LENGTH}
        aria-label={`Round ${profile.round + 1} of ${QUIZ_LENGTH}`}
        className="mt-3 h-px w-full shrink-0 bg-line"
      >
        <div className="h-px bg-signal transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {duel && (
        // Mobile: two rows sharing the leftover height, so the pair always fits.
        // Desktop: two columns at their own fixed height, centred.
        //
        // --duel-em is the wider of the two faces on screen. Both panes read the
        // same value, so the comparison stays honest while the pair is set as
        // large as this particular round allows.
        <div
          className="mt-4 grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-3 sm:mt-6 sm:flex-none sm:grid-cols-2 sm:grid-rows-1 sm:gap-4"
          style={{ '--duel-em': duelEm(duel) } as React.CSSProperties}
        >
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
              <WorldPane key={duel.a.id} image={duel.a} side="left" state={stateFor('a')} onPick={() => pick('a')} />
              <WorldPane key={duel.b.id} image={duel.b} side="right" state={stateFor('b')} onPick={() => pick('b')} />
            </>
          ) : (
            <>
              <SpecimenPane key={duel.a.slug} entry={duel.a} side="left" state={stateFor('a')} onPick={() => pick('a')} />
              <SpecimenPane key={duel.b.slug} entry={duel.b} side="right" state={stateFor('b')} onPick={() => pick('b')} />
            </>
          )}
        </div>
      )}

        <p className="mt-4 shrink-0 text-center font-mono text-[11px] leading-relaxed text-ink-faint sm:mt-6">
          {/* The keyboard hint is meaningless on a touch device, and the
              instruction differs: you tap a pane rather than press an arrow. */}
          <span className="sm:hidden">
            {duel?.kind === 'world' ? 'tap the world you would rather live in · judge the lettering, not the photograph' : 'tap the one you would rather set · neither is a real answer'}
          </span>
          <span className="hidden sm:inline">{prompt}</span>
        </p>
      </div>
    </div>
  );
}
