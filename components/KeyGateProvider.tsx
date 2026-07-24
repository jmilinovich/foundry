'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

import { getUserKey } from '@/lib/userKey';
import { KeyGate } from './KeyGate';

/**
 * Wraps the app so any generate action can gate on a key without each call site
 * owning a modal. `ensureKey(fn)` runs `fn` now if a key is stored, otherwise
 * opens the gate once and runs `fn` after the key is saved.
 */
const Ctx = createContext<(fn: () => void) => void>(() => {});

export function useEnsureKey() {
  return useContext(Ctx);
}

export function KeyGateProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const ensureKey = useCallback((fn: () => void) => {
    if (getUserKey()) {
      fn();
      return;
    }
    pending.current = fn;
    setOpen(true);
  }, []);

  return (
    <Ctx.Provider value={ensureKey}>
      {children}
      {open && (
        <KeyGate
          onReady={() => {
            setOpen(false);
            const fn = pending.current;
            pending.current = null;
            fn?.();
          }}
          onClose={() => {
            pending.current = null;
            setOpen(false);
          }}
        />
      )}
    </Ctx.Provider>
  );
}
