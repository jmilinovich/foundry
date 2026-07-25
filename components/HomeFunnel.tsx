'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiFetch } from '@/lib/userKey';
import { useEnsureKey } from './KeyGateProvider';

const SUGGESTIONS = [
  'condensed brutalist slab serif',
  'warm humanist sans, large x-height',
  'high contrast didone, elegant',
  'monoline geometric sans, playful',
];

/**
 * The front door. The quiz is the primary path; the typed seed is a collapsed
 * escape hatch for people who already know what they want.
 */
export function HomeFunnel() {
  const router = useRouter();
  const ensureKey = useEnsureKey();
  const [typed, setTyped] = useState(false);
  const [seedText, setSeedText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function beginTyped() {
    ensureKey(async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await apiFetch('/api/runs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ seedText, specimenText: 'Handgloves', populationSize: 8 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Could not start');
        router.push(`/run/${data.run.id}`);
      } catch (err) {
        setError((err as Error).message);
        setBusy(false);
      }
    });
  }

  return (
    <div className="max-w-xl">
      {/* Not Proof Red. DESIGN.md reserves the accent for Breed and Keep, and
          the quiz is now free and ends in a result of its own — the Breed verb
          lives on that result screen. Two reds in one flow would make neither
          mean anything. This is still the primary path, so it carries weight
          instead: a 2px ink rule, the one heavier line the system allows. */}
      <Link
        href="/quiz"
        className="group flex items-center justify-between border-2 border-ink px-6 py-5 transition hover:bg-ink hover:text-paper"
      >
        <span>
          <span className="block text-lg font-medium">Have your taste read</span>
          <span className="block text-[13px] text-ink-dim transition group-hover:text-paper/80">
            twelve pairs, about two minutes, no key and no charge
          </span>
        </span>
        <span className="text-2xl transition group-hover:translate-x-1">→</span>
      </Link>

      {!typed ? (
        <button
          onClick={() => setTyped(true)}
          className="mt-4 font-mono text-[12px] text-ink-faint transition hover:text-ink"
        >
          or name it yourself, if you can →
        </button>
      ) : (
        <div className="mt-5 rounded-lg border border-line bg-panel p-5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            Describe it — named genes are pinned, the rest explore
          </label>
          <input
            autoFocus
            value={seedText}
            onChange={(e) => setSeedText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && beginTyped()}
            placeholder="leave empty to search the whole space"
            className="mt-2 w-full rounded border border-line bg-ground px-3 py-2.5 text-[15px] text-ink outline-none transition focus:border-ink"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSeedText(s)}
                className="rounded border border-line px-2 py-1 font-mono text-[10.5px] text-ink-faint transition hover:border-ink-faint hover:text-ink-dim"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={beginTyped}
              disabled={busy}
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition disabled:bg-line disabled:text-ink-faint hover:enabled:brightness-110"
            >
              {busy ? 'minting…' : 'generate · $1.60'}
            </button>
            <button
              onClick={() => setTyped(false)}
              className="font-mono text-[11px] text-ink-faint hover:text-ink-dim"
            >
              back to the quiz
            </button>
          </div>
          {error && <p className="mt-3 font-mono text-[11px] text-ink-dim">{error}</p>}
        </div>
      )}
    </div>
  );
}
