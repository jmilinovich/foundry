'use client';

import { useEffect, useState } from 'react';

import type { GlyphSetName } from '@/lib/types';

/**
 * Load a font as a base64 data URI and hand back an `@font-face` rule for it.
 *
 * The rest of the app uses the FontFace API, which is cleaner — but a FontFace
 * added at runtime never appears in `document.styleSheets`, and that's exactly
 * where html-to-image looks when it embeds fonts. A poster captured that way
 * exports in a fallback face and you don't notice until you open the PNG.
 *
 * Inlining the bytes into a <style> inside the captured node sidesteps it: the
 * rule is part of the serialized DOM, with nothing left to fetch.
 */
const cache = new Map<string, Promise<string>>();

function toDataUrl(url: string): Promise<string> {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`font ${res.status}`);
          return res.arrayBuffer();
        })
        .then((buf) => {
          const bytes = new Uint8Array(buf);
          let binary = '';
          // Chunked — String.fromCharCode blows the stack on a whole font.
          const CHUNK = 0x8000;
          for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
          }
          return `data:font/ttf;base64,${btoa(binary)}`;
        }),
    );
  }
  return cache.get(url)!;
}

export function useEmbeddedFace(fontId: string | null, set: GlyphSetName = 'standard') {
  const family = fontId ? `poster-${fontId}-${set}` : '';
  const [css, setCss] = useState('');

  useEffect(() => {
    if (!fontId) return;
    let cancelled = false;
    const url = `/api/fonts/${fontId}${set === 'extended' ? '?set=extended' : ''}`;
    toDataUrl(url)
      .then((dataUrl) => {
        if (cancelled) return;
        setCss(`@font-face{font-family:"${family}";src:url(${dataUrl}) format("truetype");}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fontId, set, family]);

  return { family, css, ready: css !== '' };
}
