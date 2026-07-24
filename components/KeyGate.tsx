'use client';

import { useState } from 'react';

import { looksLikeKey, setUserKey } from '@/lib/userKey';

/**
 * The one place we ask for a key — at the generate boundary, never on arrival.
 * Rendered when a generate action fires without a key stored.
 */
export function KeyGate({ onReady, onClose }: { onReady: () => void; onClose: () => void }) {
  const [value, setValue] = useState('');
  const ok = looksLikeKey(value);

  function save() {
    if (!ok) return;
    setUserKey(value);
    onReady();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-line bg-panel p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg">Add your Mixfont key</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-dim">
          Generating fonts uses the{' '}
          <a href="https://www.mixfont.com/console/keys" target="_blank" rel="noreferrer" className="text-ink hover:underline">
            Mixfont API
          </a>
          . Bring your own key — it&rsquo;s stored only in this browser and sent with each generate
          request; we never save it on our servers.
        </p>

        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="mix_live_…"
          spellCheck={false}
          className="mt-5 w-full rounded border border-line bg-ground px-3 py-2.5 font-mono text-[13px] text-ink outline-none transition focus:border-ink"
        />

        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={save}
            disabled={!ok}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition disabled:bg-line disabled:text-ink-faint hover:enabled:brightness-110"
          >
            save & continue
          </button>
          <button onClick={onClose} className="font-mono text-[11px] text-ink-faint hover:text-ink-dim">
            cancel
          </button>
          {value && !ok && (
            <span className="font-mono text-[10.5px] text-ink-faint">
              keys start with <code>mix_</code>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
