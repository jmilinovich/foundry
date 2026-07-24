import Link from 'next/link';

import { Quiz } from '@/components/quiz/Quiz';
import { loadAtlas } from '@/lib/atlas';

export const dynamic = 'force-dynamic';

export default async function QuizPage() {
  const atlas = await loadAtlas();

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

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-3.5">
          <Link href="/" className="font-mono text-[11px] tracking-widest text-ink-dim hover:text-ink">
            ← FOUNDRY
          </Link>
          <span className="font-mono text-[11px] text-ink-faint">find your type</span>
        </div>
      </header>
      <Quiz atlas={atlas} />
    </div>
  );
}
