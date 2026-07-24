import Link from 'next/link';

import { HomeFunnel } from '@/components/HomeFunnel';
import { RecentRuns } from '@/components/RecentRuns';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-16 sm:py-24">
      <h1 className="text-[clamp(3rem,11vw,7rem)] font-medium leading-[0.9] tracking-[-0.045em]">
        Foundry
      </h1>
      <p className="mt-6 max-w-lg text-lg leading-snug text-ink-dim">
        Nobody can write the prompt for the font they want. Everybody can point at the one they like
        better.
      </p>
      <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-faint">
        Answer a dozen this-or-that pairs and Foundry reads your taste, then mints a population of
        real typefaces from it. Keep the ones you like; their genes cross and mutate, and the next
        generation is drawn from what survived.
      </p>

      <div className="mt-12">
        <HomeFunnel />
      </div>

      {/* Recent runs are scoped to this browser — a capability-URL model, no accounts. */}
      <RecentRuns />

      <p className="mt-24 border-t border-line pt-6 font-mono text-[11px] leading-relaxed text-ink-faint">
        Foundry generates fonts with the{' '}
        <Link href="https://www.mixfont.com" className="text-ink-dim hover:text-amber">
          Mixfont
        </Link>{' '}
        API. The taste quiz is free; generating uses your own Mixfont key, which stays in your
        browser and is never stored on our servers.
      </p>
    </div>
  );
}
