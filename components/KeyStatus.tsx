'use client';

import { useEffect, useState } from 'react';

import { clearUserKey, getUserKey, onUserKeyChange } from '@/lib/userKey';

/** A quiet indicator of whether a key is stored, with a way to forget it. */
export function KeyStatus() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const sync = () => setHasKey(!!getUserKey());
    sync();
    return onUserKeyChange(sync);
  }, []);

  if (hasKey === null) return null;

  return (
    <span className="inline-flex items-center gap-2">
      {hasKey ? (
        <>
          <span className="text-ink-dim">Mixfont key stored in this browser</span>
          <button
            onClick={() => clearUserKey()}
            className="text-ink-faint underline decoration-dotted transition hover:text-red-400"
          >
            forget
          </button>
        </>
      ) : (
        <span className="text-ink-faint">no key stored — you&rsquo;ll add one when you generate</span>
      )}
    </span>
  );
}
