import Link from 'next/link';

import { NewRun } from '@/components/NewRun';
import { listRuns } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const runs = await listRuns();

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
        Each round mints a population of real typefaces. Keep the ones you like; their genes cross,
        mutate a step along each axis, and the next generation is drawn from what survived. Five
        rounds gets you somewhere you could not have described up front.
      </p>

      <div className="mt-14">
        <NewRun />
      </div>

      {runs.length > 0 && (
        <section className="mt-24 border-t border-line pt-8">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
            Earlier runs
          </h2>
          <ul className="mt-4 divide-y divide-line">
            {runs.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/run/${r.id}`}
                  className="flex items-baseline gap-4 py-3 transition hover:text-amber"
                >
                  <span className="flex-1 truncate text-sm">{r.seedText || 'open search'}</span>
                  <span className="font-mono text-[11px] text-ink-faint">
                    gen {r.generation} · {r.ready} fonts
                  </span>
                  <span className="hidden font-mono text-[11px] text-ink-faint sm:inline">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
