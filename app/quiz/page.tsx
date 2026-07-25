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

  // No header here: the quiz owns its own chrome, because the duels and the
  // result are different surfaces (cool bench vs warm paper) with different
  // mastheads, and a shared one would sit on the wrong ground for half the run.
  return <Quiz atlas={atlas} world={world} google={GOOGLE} />;
}
