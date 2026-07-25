'use client';

import Link from 'next/link';

import type { AtlasEntry } from '@/lib/taste';
import { useAtlasFont } from './quiz/useAtlasFont';

/**
 * The foundry showing its own type, above the fold.
 *
 * DESIGN.md names one job: "in a visitor's first ten seconds the generated
 * typefaces are the hero and the argument." The home page was the single screen
 * where that was not true — a wordmark, a promise, a grey paragraph and a
 * button, and not one generated letterform. A stranger had to take "we generate
 * real typefaces" on faith and commit to twelve rounds before seeing evidence.
 *
 * These are the quiz subsets, ~2 KB each, so four of them cost about the same
 * as a small icon. The faces are picked per request on the server, so a reload
 * shows different ones — which is itself the argument that there are a lot.
 */

const SPECIMEN = 'Handgloves';

function Line({ entry }: { entry: AtlasEntry }) {
  const { family, loaded } = useAtlasFont(entry.slug);
  return (
    // The name sits under the specimen on a phone and beside it from sm up.
    // Sharing the line meant the two competed for ~320px and the specimen lost:
    // it truncated to "Hand…", which is not a face anyone can judge.
    <div className="flex flex-col gap-x-4 border-t border-line py-3 sm:flex-row sm:items-baseline sm:justify-between">
      <span
        className="specimen block leading-[1.1]"
        data-loaded={loaded}
        // Sized off this face's own measured width, so a wide slab and a narrow
        // grotesque both fit the line rather than one of them overflowing.
        style={{
          fontFamily: `"${family}", Georgia, serif`,
          fontSize: `clamp(1.4rem, calc((min(100vw, 1100px) - 72px) / ${entry.w ?? 6.4}), 3.4rem)`,
        }}
      >
        {SPECIMEN}
      </span>
      <span className="mt-1 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint sm:mt-0">
        {entry.name}
      </span>
    </div>
  );
}

export function SpecimenBand({ faces }: { faces: AtlasEntry[] }) {
  if (faces.length === 0) return null;
  return (
    <div className="mt-10 max-w-2xl">
      {faces.map((f) => (
        <Line key={f.slug} entry={f} />
      ))}
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          four of 201
        </span>
        <Link
          href="/collection"
          className="font-mono text-[11px] text-ink-dim transition hover:text-ink"
        >
          the whole library →
        </Link>
      </div>
    </div>
  );
}
