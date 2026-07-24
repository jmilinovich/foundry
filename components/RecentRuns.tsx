'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { forgetRun, listLocalRuns, type LocalRun } from '@/lib/localRuns';

type Summary = {
  id: string;
  seedText: string;
  generation: number;
  ready: number;
  settledPair: boolean;
};

export function RecentRuns() {
  const [local, setLocal] = useState<LocalRun[]>([]);
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});

  useEffect(() => {
    const runs = listLocalRuns();
    setLocal(runs);
    if (!runs.length) return;
    fetch(`/api/runs?ids=${runs.map((r) => r.id).join(',')}`)
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, Summary> = {};
        for (const s of d.runs ?? []) map[s.id] = s;
        setSummaries(map);
      })
      .catch(() => {});
  }, []);

  if (!local.length) return null;

  return (
    <section className="mt-20 border-t border-line pt-8">
      <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">Your runs</h2>
      <ul className="mt-4 divide-y divide-line">
        {local.map((r) => {
          const s = summaries[r.id];
          // A run the server no longer has (Blob expiry, other machine) is shown
          // as a dangling entry you can clear rather than a broken link.
          const missing = summaries && Object.keys(summaries).length > 0 && !s;
          return (
            <li key={r.id} className="flex items-baseline gap-4 py-3">
              <Link
                href={s?.settledPair ? `/pairing/${r.id}` : `/run/${r.id}`}
                className="flex flex-1 items-baseline gap-4 truncate transition hover:text-ink"
              >
                <span className="flex-1 truncate text-sm">{s?.seedText || r.label}</span>
                <span className="font-mono text-[11px] text-ink-faint">
                  {missing
                    ? 'expired'
                    : s
                      ? s.settledPair
                        ? 'pair ✓'
                        : `gen ${s.generation} · ${s.ready} fonts`
                      : '…'}
                </span>
              </Link>
              <button
                onClick={() => {
                  forgetRun(r.id);
                  setLocal((xs) => xs.filter((x) => x.id !== r.id));
                }}
                className="font-mono text-[11px] text-ink-faint opacity-60 transition hover:text-red-400 hover:opacity-100"
                title="Forget this run"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
