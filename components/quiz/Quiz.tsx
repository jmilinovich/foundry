'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { mulberry32 } from '@/lib/genome';
import {
  emptyProfile,
  nextDuel,
  profileToSeed,
  QUIZ_LENGTH,
  recordPick,
  summarize,
  type AtlasEntry,
  type Duel,
  type TasteProfile,
} from '@/lib/taste';
import { useAtlasFont } from './useAtlasFont';

const SPECIMEN = 'Handgloves';

function Card({
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
      className="group relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-xl border border-line bg-panel px-6 py-12 transition-all duration-200 hover:border-amber hover:bg-amber/[0.03] focus-visible:border-amber focus-visible:outline-none"
    >
      <div
        className="specimen text-center leading-[0.95] transition-transform duration-200 group-hover:scale-[1.03]"
        data-loaded={loaded}
        style={{ fontFamily: `"${family}", serif`, fontSize: 'clamp(2.75rem, 7vw, 5.5rem)' }}
      >
        {SPECIMEN}
      </div>
      <span className="mt-8 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint transition group-hover:text-amber">
        {side === 'left' ? '← this' : 'that →'}
      </span>
    </button>
  );
}

export function Quiz({ atlas }: { atlas: AtlasEntry[] }) {
  const router = useRouter();
  const [profile, setProfile] = useState<TasteProfile>(emptyProfile);
  const [duel, setDuel] = useState<Duel | null>(null);
  const [starting, setStarting] = useState(false);

  // One seeded RNG for the whole session, so a run is reproducible and the
  // duels don't reshuffle on every render.
  const rng = useMemo(() => mulberry32(0xf0f0 ^ atlas.length), [atlas.length]);

  const advance = useCallback(
    (p: TasteProfile) => {
      if (p.round >= QUIZ_LENGTH) {
        setDuel(null);
        return;
      }
      setDuel(nextDuel(p, atlas, rng));
    },
    [atlas, rng],
  );

  useEffect(() => {
    advance(emptyProfile());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Advance the round counter without recording a vote.
    const next = { ...profile, round: profile.round + 1, shown: duel ? [...profile.shown, duel.a.slug, duel.b.slug] : profile.shown };
    setProfile(next);
    advance(next);
  }, [profile, duel, advance]);

  // Keyboard: ← / → to pick, ↓ to skip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') pick('a');
      else if (e.key === 'ArrowRight') pick('b');
      else if (e.key === 'ArrowDown') skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, skip]);

  const done = profile.round >= QUIZ_LENGTH || (!duel && profile.round > 0);

  const beginRun = useCallback(async () => {
    setStarting(true);
    const seed = profileToSeed(profile);
    const summary = summarize(profile);
    try {
      const res = await fetch('/api/runs', {
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
  }, [profile, router]);

  const pct = Math.round((Math.min(profile.round, QUIZ_LENGTH) / QUIZ_LENGTH) * 100);

  if (done) {
    return <Summary profile={profile} onBegin={beginRun} starting={starting} />;
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1100px] flex-1 flex-col px-6 py-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-widest text-ink-faint">
          {profile.round + 1} / {QUIZ_LENGTH}
        </span>
        <button onClick={skip} className="font-mono text-[11px] text-ink-faint hover:text-amber">
          no preference ↓
        </button>
      </div>
      <div className="mt-3 h-px w-full bg-line">
        <div className="h-px bg-amber transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {duel && (
        <div className="mt-6 grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <Card entry={duel.a} side="left" onPick={() => pick('a')} />
          <Card entry={duel.b} side="right" onPick={() => pick('b')} />
        </div>
      )}

      <p className="mt-6 text-center font-mono text-[11px] text-ink-faint">
        pick the one you like more · ← / → · this isn&rsquo;t a test, go on instinct
      </p>
    </div>
  );
}

function Summary({
  profile,
  onBegin,
  starting,
}: {
  profile: TasteProfile;
  onBegin: () => void;
  starting: boolean;
}) {
  const summary = summarize(profile);
  const seed = profileToSeed(profile);
  const pins = Object.entries(seed.pinned);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
      <p className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">your type leans</p>
      <h1 className="mt-4 text-[clamp(1.75rem,5vw,2.75rem)] font-medium leading-tight tracking-tight">
        {summary}
      </h1>

      <p className="mt-6 text-sm leading-relaxed text-ink-dim">
        That&rsquo;s the profile your picks describe. Generation 0 will be drawn from it — biased
        toward what you liked, but still exploring around the edges, because the whole point is to
        find something you couldn&rsquo;t have named.
      </p>

      {pins.length > 0 && (
        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            you were consistent about
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pins.map(([k, v]) => (
              <span
                key={k}
                className="rounded border border-amber/40 px-2 py-0.5 font-mono text-[11px] text-amber"
              >
                {String(v)}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onBegin}
        disabled={starting}
        className="mt-10 rounded bg-amber px-5 py-3 text-sm font-medium text-ground transition disabled:bg-panel disabled:text-ink-faint hover:enabled:brightness-110"
      >
        {starting ? 'minting generation 0…' : 'generate my fonts →'}
      </button>
      <p className="mt-3 font-mono text-[11px] text-ink-faint">
        eight fonts, about $1.60 · you&rsquo;ll add your Mixfont key next
      </p>
    </div>
  );
}
