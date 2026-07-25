'use client';

import { useEffect, useState } from 'react';

/**
 * Atlas specimens as real FontFaces, preloaded whole.
 *
 * The quiz used to fetch a 64 KB TTF per card as the card mounted, which is
 * exactly why specimens flashed in a fallback serif before snapping into place.
 * Two changes kill that for good:
 *
 *   1. The quiz loads a *subset* — the specimen word only, woff2 — so a face
 *      costs about 2 KB instead of 64 KB and the whole 200-font atlas is under
 *      half a megabyte. See scripts/subset-atlas.mjs.
 *   2. Everything is fetched up front, in the background, from the moment the
 *      quiz mounts. By the second round every font a duel could possibly need
 *      is already in document.fonts.
 *
 * A duel still renders only once both its faces report loaded, so "no flash" is
 * a guarantee rather than a race the preloader usually wins. After round one
 * that gate is never visible.
 */

const registry = new Map<string, Promise<void>>();
const done = new Set<string>();

export const atlasFamily = (slug: string) => `atlas-${slug}`;

function load(slug: string): Promise<void> {
  const existing = registry.get(slug);
  if (existing) return existing;

  const face = new FontFace(atlasFamily(slug), `url(/atlas/q/${slug}.woff2) format("woff2")`);
  const p = face
    .load()
    .then((f) => {
      document.fonts.add(f);
      done.add(slug);
    })
    .catch(() => {
      // A face that won't parse must not wedge the quiz: forget it so a later
      // round can retry, and let the caller fall back to its placeholder.
      registry.delete(slug);
    });

  registry.set(slug, p);
  return p;
}

/**
 * Warm the entire atlas in the background.
 *
 * Bounded concurrency because 200 simultaneous requests is worse than 8 at a
 * time on a phone — the browser queues them anyway, and the first duel's fonts
 * end up stuck behind 190 it doesn't need yet. `priority` slugs jump the queue.
 */
export function useAtlasPreload(slugs: string[], priority: string[] = []) {
  const [ready, setReady] = useState(() => done.size);

  useEffect(() => {
    if (typeof window === 'undefined' || !('FontFace' in window)) return;
    let cancelled = false;

    const queue = [...new Set([...priority, ...slugs])].filter((s) => !done.has(s));
    let cursor = 0;

    const worker = async () => {
      while (cursor < queue.length && !cancelled) {
        const slug = queue[cursor++];
        await load(slug);
        if (!cancelled) setReady(done.size);
      }
    };
    void Promise.all(Array.from({ length: 8 }, worker));

    return () => {
      cancelled = true;
    };
    // Intentionally keyed on length only: the slug list is a stable manifest,
    // and re-running this on every render would restart the whole sweep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugs.length]);

  return { ready, total: slugs.length, allReady: ready >= slugs.length };
}

/**
 * One specimen, for a card that must not render until it's genuinely there.
 *
 * The state tracks *which* slug is loaded rather than a bare boolean. That
 * matters: with a boolean, moving to the next duel would keep reporting
 * `loaded: true` from the previous font until the new one resolved, and the new
 * specimen would paint for a frame in the old face — the exact flash this hook
 * exists to prevent. Comparing slugs makes the answer correct on the render
 * where the slug changes, with no state written during the effect.
 */
export function useAtlasFont(slug: string | null) {
  const family = slug ? atlasFamily(slug) : '';
  const [loadedSlug, setLoadedSlug] = useState<string | null>(() =>
    slug && done.has(slug) ? slug : null,
  );

  useEffect(() => {
    if (!slug || typeof window === 'undefined' || !('FontFace' in window)) return;
    let cancelled = false;
    void load(slug).then(() => {
      if (!cancelled && done.has(slug)) setLoadedSlug(slug);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { family, loaded: !!slug && loadedSlug === slug };
}

/**
 * The full-alphabet cut, for the results page — a recommendation sets its own
 * name and a specimen line, which the quiz subset has no glyphs for.
 */
const fullRegistry = new Map<string, Promise<void>>();
const fullDone = new Set<string>();

export const atlasFullFamily = (slug: string) => `atlasfull-${slug}`;

export function useAtlasFullFont(slug: string | null) {
  const family = slug ? atlasFullFamily(slug) : '';
  const [loadedSlug, setLoadedSlug] = useState<string | null>(() =>
    slug && fullDone.has(slug) ? slug : null,
  );

  useEffect(() => {
    if (!slug || typeof window === 'undefined' || !('FontFace' in window)) return;
    let cancelled = false;

    if (!fullRegistry.has(slug)) {
      const face = new FontFace(atlasFullFamily(slug), `url(/atlas/w/${slug}.woff2) format("woff2")`);
      fullRegistry.set(
        slug,
        face
          .load()
          .then((f) => {
            document.fonts.add(f);
            fullDone.add(slug);
          })
          .catch(() => {
            fullRegistry.delete(slug);
          }),
      );
    }
    void fullRegistry.get(slug)!.then(() => {
      if (!cancelled && fullDone.has(slug)) setLoadedSlug(slug);
    });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { family, loaded: !!slug && loadedSlug === slug };
}
