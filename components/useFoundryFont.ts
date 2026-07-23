'use client';

import { useEffect, useState } from 'react';

/**
 * Load a rehosted TTF into the document as a real FontFace.
 *
 * Deduped across every card that asks for the same id, and cached for the
 * session — going back to an earlier generation re-renders instantly instead of
 * re-fetching forty fonts.
 */
const inflight = new Map<string, Promise<void>>();

export function useFoundryFont(id: string, enabled: boolean) {
  const family = `foundry-${id}`;
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('FontFace' in window)) return;
    let cancelled = false;

    if (!inflight.has(id)) {
      const face = new FontFace(family, `url(/api/fonts/${id})`);
      inflight.set(
        id,
        face.load().then((f) => {
          document.fonts.add(f);
        }),
      );
    }

    inflight
      .get(id)!
      .then(() => !cancelled && setIsLoaded(true))
      .catch(() => {
        // A font that won't parse just stays invisible rather than breaking the grid.
        inflight.delete(id);
      });

    return () => {
      cancelled = true;
    };
  }, [id, family, enabled]);

  return { family, isLoaded };
}
