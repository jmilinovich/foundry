import Link from 'next/link';

import { Quiz } from '@/components/quiz/Quiz';
import { loadAtlas } from '@/lib/atlas';
import { loadWorld } from '@/lib/atlas';

export const dynamic = 'force-dynamic';

/**
 * A fresh seed per request.
 *
 * Deliberately behind an await rather than called inline: rolling a random
 * number in the body of a render is impure, and the lint rule that says so is
 * right even though this component is force-dynamic and only ever runs once per
 * request. Resolving it as part of the same Promise.all keeps it honest and
 * costs nothing.
 */
async function rollSeed(): Promise<number> {
  return (Math.random() * 0xffffffff) >>> 0;
}

export default async function QuizPage() {
  const [atlas, world, seed] = await Promise.all([loadAtlas(), loadWorld(), rollSeed()]);

  if (atlas.length < 4) {
    return (
      <div className="mx-auto max-w-md px-6 py-24">
        <p className="text-ink-dim">The taste atlas hasn&rsquo;t been minted yet.</p>
        <p className="mt-2 font-mono text-[12px] text-ink-faint">
          Run <code>node --env-file=.env.local scripts/build-atlas.mjs</code>.
        </p>
        <Link href="/" className="mt-4 inline-block text-ink">
          ← back
        </Link>
      </div>
    );
  }


  // No header here: the quiz owns its own chrome, because the duels and the
  // result are different surfaces (cool bench vs warm paper) with different
  // mastheads, and a shared one would sit on the wrong ground for half the run.
  return <Quiz atlas={atlas} world={world} seed={seed} />;
}
