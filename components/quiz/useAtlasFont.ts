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
const failed = new Set<string>();

export const atlasFamily = (slug: string) => `atlas-${slug}`;

function load(slug: string): Promise<void> {
  const existing = registry.get(slug);
  if (existing) return existing;

  const face = new FontFace(atlasFamily(slug), `url(/atlas/q/${slug}.woff2) format("woff2")`);
  const p = face
    .load()
    .then((f) => {
      document.fonts.add(f);
      failed.delete(slug);
      done.add(slug);
    })
    .catch(() => {
      // A face that won't load must not leave an unanswerable duel on screen.
      // The specimen stays hidden until its font arrives, so "hidden forever"
      // is a blank pane the person is being asked to judge. Record the failure
      // so the pane reveals itself in the fallback instead — DESIGN.md: the
      // fallback is revealed, never invisible forever. Forget the promise so a
      // later round retries the fetch.
      registry.delete(slug);
      failed.add(slug);
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
  const [settled, setSettled] = useState<string | null>(() =>
    slug && (done.has(slug) || failed.has(slug)) ? slug : null,
  );

  useEffect(() => {
    if (!slug || typeof window === 'undefined' || !('FontFace' in window)) return;
    let cancelled = false;
    void load(slug).then(() => {
      if (!cancelled) setSettled(slug);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const isSettled = !!slug && settled === slug;
  return {
    family,
    /** Show the specimen: either the real face arrived, or it never will. */
    loaded: isSettled,
    /** True when we're showing the fallback because the face wouldn't load. */
    fallback: isSettled && !!slug && failed.has(slug),
  };
}

/**
 * Warm the photographs the same way the specimens are warmed.
 *
 * The type rounds are instant because every face is fetched up front, but a
 * world round waited on a cold request for two full-size photographs — and the
 * first world round is round 2. The heaviest pair in the bank is about a
 * megabyte, so on a phone that is a visibly empty pane at the exact moment the
 * quiz is trying to feel effortless.
 *
 * Only a handful are needed (four world rounds, two images each), so this warms
 * a bounded slice rather than all 66, two at a time, after the fonts are away.
 */
export function useWorldPreload(files: string[], count = 14) {
  useEffect(() => {
    if (typeof window === 'undefined' || files.length === 0) return;
    let cancelled = false;
    const queue = files.slice(0, count);
    let cursor = 0;

    const worker = () => {
      if (cancelled || cursor >= queue.length) return;
      const img = new Image();
      img.onload = img.onerror = worker;
      img.src = `/world/${queue[cursor++]}`;
    };
    // Behind the font sweep: a specimen you are about to judge outranks a
    // photograph you will not see for another round.
    const id = window.setTimeout(() => {
      worker();
      worker();
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length, count]);
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
