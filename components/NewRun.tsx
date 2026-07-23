'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CREDITS } from '@/lib/credits';
import { dollars } from '@/lib/types';

const SUGGESTIONS = [
  'condensed brutalist slab serif',
  'warm humanist sans, large x-height',
  'high contrast didone, elegant',
  'eroded stencil-cut display',
  'monoline geometric sans, playful',
];

export function NewRun() {
  const router = useRouter();
  const [seedText, setSeedText] = useState('');
  const [specimenText, setSpecimenText] = useState('Handgloves');
  const [populationSize, setPopulationSize] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seedText, specimenText, populationSize }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not start the run');
      router.push(`/run/${data.run.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <label className="block font-mono text-[11px] uppercase tracking-widest text-ink-faint">
        Seed — any genes you name are held fixed, the rest explore
      </label>
      <input
        value={seedText}
        onChange={(e) => setSeedText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !busy && begin()}
        placeholder="leave empty to search the whole space"
        className="mt-2 w-full rounded border border-line bg-panel px-4 py-3 text-lg text-ink outline-none transition focus:border-amber"
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

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <label className="block font-mono text-[11px] uppercase tracking-widest text-ink-faint">
            Specimen string
          </label>
          <input
            value={specimenText}
            onChange={(e) => setSpecimenText(e.target.value)}
            className="mt-2 w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink outline-none transition focus:border-amber"
          />
          <p className="mt-1.5 font-mono text-[10px] text-ink-faint">
            judge on real content, not an alphabet
          </p>
        </div>

        <div>
          <label className="block font-mono text-[11px] uppercase tracking-widest text-ink-faint">
            Population — {populationSize}
          </label>
          <input
            type="range"
            min={4}
            max={12}
            value={populationSize}
            onChange={(e) => setPopulationSize(Number(e.target.value))}
            className="mt-4 w-full"
          />
          <p className="mt-1.5 font-mono text-[10px] text-ink-faint">
            {dollars(populationSize * CREDITS.standard)} for generation 0
          </p>
        </div>
      </div>

      <button
        onClick={begin}
        disabled={busy}
        className="mt-8 w-full rounded bg-amber py-3 text-sm font-medium text-ground transition disabled:bg-panel disabled:text-ink-faint hover:enabled:brightness-110"
      >
        {busy ? 'minting generation 0…' : 'begin'}
      </button>

      {error && <p className="mt-3 font-mono text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
