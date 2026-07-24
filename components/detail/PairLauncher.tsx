'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CREDITS } from '@/lib/credits';
import { STANCES, type Slot, type Stance } from '@/lib/genome';
import { dollars } from '@/lib/types';
import { apiFetch } from '@/lib/userKey';
import { useEnsureKey } from '../KeyGateProvider';

export function PairLauncher({
  runId,
  fontId,
  fontName,
  specimenText,
  onClose,
}: {
  runId: string;
  fontId: string;
  fontName: string;
  specimenText: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const ensureKey = useEnsureKey();
  // Default: this font is the display face, so we're hunting for body copy.
  const [slot, setSlot] = useState<Slot>('text');
  const [stance, setStance] = useState<Stance>('classic');
  const [size, setSize] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function begin() {
    ensureKey(async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await apiFetch('/api/pairings', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            lockedRunId: runId,
            lockedFontId: fontId,
            slot,
            stance,
            specimenText,
            populationSize: size,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Could not start pairing');
        router.push(`/run/${data.run.id}`);
      } catch (err) {
        setError((err as Error).message);
        setBusy(false);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg border border-line bg-panel p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg">
          Find a partner for <span className="text-ink">{fontName}</span>
        </h2>

        <div className="mt-7">
          <label className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            {fontName} is the…
          </label>
          <div className="mt-2 flex gap-2">
            {(
              [
                ['text', 'display face', 'hunt for body copy to sit under it'],
                ['display', 'text face', 'hunt for a headline face to sit over it'],
              ] as [Slot, string, string][]
            ).map(([value, label, blurb]) => (
              <button
                key={value}
                onClick={() => setSlot(value)}
                className={`flex-1 rounded border px-3 py-2.5 text-left transition ${
                  slot === value ? 'border-ink bg-ink/[0.04]' : 'border-line hover:border-ink-faint'
                }`}
              >
                <div className="text-[13px]">{label}</div>
                <div className="mt-0.5 font-mono text-[10px] leading-snug text-ink-faint">
                  {blurb}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <label className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            Stance — which genes push apart
          </label>
          <div className="mt-2 space-y-1.5">
            {STANCES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStance(s.id)}
                className={`flex w-full items-baseline gap-3 rounded border px-3 py-2 text-left transition ${
                  stance === s.id ? 'border-ink bg-ink/[0.04]' : 'border-line hover:border-ink-faint'
                }`}
              >
                <span className="text-[13px]">{s.label}</span>
                <span className="font-mono text-[10px] text-ink-faint">{s.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <label className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            Candidates — {size}
          </label>
          <input
            type="range"
            min={4}
            max={10}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="mt-3 w-full"
          />
        </div>

        {slot === 'text' && (
          <p className="mt-5 font-mono text-[10px] leading-relaxed text-ink-faint">
            Text candidates are held inside a legible subspace — no eroded, stencil-cut or
            pixel-stepped surfaces, no hairlines, no extreme contrast. Those are beautiful at 96px
            and unreadable at 16.
          </p>
        )}

        <div className="mt-7 flex items-center gap-4">
          <button
            onClick={begin}
            disabled={busy}
            className="flex-1 rounded bg-accent py-2.5 text-sm font-medium text-paper transition disabled:bg-line disabled:text-ink-faint hover:enabled:brightness-110"
          >
            {busy ? 'minting candidates…' : `begin · ${dollars(size * CREDITS.standard)}`}
          </button>
          <button onClick={onClose} className="font-mono text-[11px] text-ink-faint hover:text-ink-dim">
            cancel
          </button>
        </div>

        {error && <p className="mt-3 font-mono text-[11px] text-ink-dim">{error}</p>}
      </div>
    </div>
  );
}
