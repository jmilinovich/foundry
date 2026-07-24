'use client';

import { useEffect, useState } from 'react';

/**
 * Load an atlas specimen as a FontFace, deduped and cached for the session.
 *
 * These are static assets under /atlas, so there's no API round-trip and no
 * key — the whole quiz runs before anyone has entered anything.
 */
const inflight = new Map<string, Promise<void>>();

export function useAtlasFont(slug: string | null) {
  const family = slug ? `atlas-${slug}` : '';
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!slug || typeof window === 'undefined' || !('FontFace' in window)) return;
    let cancelled = false;

    if (!inflight.has(slug)) {
      const face = new FontFace(family, `url(/atlas/${slug}.ttf)`);
      inflight.set(
        slug,
        face.load().then((f) => {
          document.fonts.add(f);
        }),
      );
    }
    inflight
      .get(slug)!
      .then(() => !cancelled && setLoaded(true))
      .catch(() => inflight.delete(slug));

    return () => {
      cancelled = true;
    };
  }, [slug, family]);

  return { family, loaded };
}
