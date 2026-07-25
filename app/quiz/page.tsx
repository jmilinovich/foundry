import Link from 'next/link';

import { Quiz } from '@/components/quiz/Quiz';
import { loadAtlas } from '@/lib/atlas';
import googleFonts from '@/lib/data/google-fonts.json';
import { loadWorld } from '@/lib/atlas';
import type { GoogleFont } from '@/lib/recommend';

export const dynamic = 'force-dynamic';

const GOOGLE = googleFonts as unknown as GoogleFont[];

export default async function QuizPage() {
  const [atlas, world] = await Promise.all([loadAtlas(), loadWorld()]);

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

  // A fresh seed per request, generated here rather than in the browser.
  //
  // The quiz needs a different twelve rounds for each visitor, but the first
  // duel is computed during the initial render so round one paints with real
  // specimens instead of an empty frame. Rolling the seed on the client would
  // therefore mean the server and the browser independently pick *different*
  // opening pairs — a hydration mismatch on the most-seen screen in the app.
  // Generating it server-side and passing it down keeps both sides in
  // agreement while still giving every visit its own run. The page is already
  // force-dynamic, so this really is per-request.
  const seed = (Math.random() * 0xffffffff) >>> 0;

  // No header here: the quiz owns its own chrome, because the duels and the
  // result are different surfaces (cool bench vs warm paper) with different
  // mastheads, and a shared one would sit on the wrong ground for half the run.
  return <Quiz atlas={atlas} world={world} google={GOOGLE} seed={seed} />;
}
