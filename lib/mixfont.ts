/**
 * Mixfont API client. Server-side only — the key never reaches the browser.
 *
 * Docs: https://www.mixfont.com/docs
 *   POST /v1/font-generations/text   { prompt, glyph_set }
 *   POST /v1/font-generations/image  { image_url, glyph_set }
 *   GET  /v1/font-generations/{id}
 *   POST /v1/api/lens                { image_url, top_k }
 */

import 'server-only';

export { CREDITS } from './credits';

const BASE = 'https://api.mixfont.com';

export type GlyphSet = 'standard' | 'extended';

export type GenerationStatus =
  | 'preparing'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'cancelled'
  | 'failed';

export type Generation = {
  id: string;
  name: string;
  ttf_url: string | null;
  status: GenerationStatus;
  input_type: 'text' | 'image';
  glyph_set: GlyphSet;
  progress_percent: number;
  poll_url?: string;
  error?: string;
  created_at: string;
};

export type FontMatch = {
  name: string;
  score: number;
  fonts: { full_name: string; style: string; weight: number; url: string }[];
};

export type LensResult = {
  word: string | null;
  word_box: { left: number; top: number; width: number; height: number };
  input_image: { width: number; height: number; image_url: string };
  font_matches: FontMatch[];
  requestId: string;
};

export const TERMINAL: GenerationStatus[] = ['succeeded', 'failed', 'cancelled'];
export const isTerminal = (s: GenerationStatus) => TERMINAL.includes(s);

export class MixfontError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'MixfontError';
  }
}

/**
 * The Mixfont key for a call.
 *
 * Hosted, this is the visitor's own key, passed in per-request — it lives in
 * their browser, transits our function in memory only, and is never persisted.
 * Locally, an explicit key is absent and we fall back to MIXFONT_API_KEY so dev
 * against a personal key keeps working.
 */
function apiKey(explicit?: string): string {
  const key = explicit || process.env.MIXFONT_API_KEY;
  if (!key) {
    throw new MixfontError('No Mixfont API key. Add your key to generate fonts.', 401);
  }
  return key;
}

async function call<T>(path: string, key: string | undefined, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'x-api-key': apiKey(key),
      'content-type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const detail =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : res.statusText;
    // 401/402 are the ones a user hits in normal operation — surface them plainly.
    const message =
      res.status === 402
        ? 'Out of Mixfont credits. Top up at mixfont.com/console.'
        : res.status === 401
          ? 'Mixfont rejected the key. Check it at mixfont.com/console.'
          : `Mixfont ${res.status}: ${detail}`;
    throw new MixfontError(message, res.status, body);
  }
  return body as T;
}

export function generateFromText(prompt: string, glyphSet: GlyphSet = 'standard', key?: string) {
  return call<Generation>('/v1/font-generations/text', key, {
    method: 'POST',
    body: JSON.stringify({ prompt, glyph_set: glyphSet }),
  });
}

export function generateFromImage(imageUrl: string, glyphSet: GlyphSet = 'standard', key?: string) {
  return call<Generation>('/v1/font-generations/image', key, {
    method: 'POST',
    body: JSON.stringify({ image_url: imageUrl, glyph_set: glyphSet }),
  });
}

export function getGeneration(id: string, key?: string) {
  return call<Generation>(`/v1/font-generations/${id}`, key);
}

export function recognise(imageUrl: string, topK = 3, key?: string) {
  return call<LensResult>('/v1/api/lens', key, {
    method: 'POST',
    body: JSON.stringify({ image_url: imageUrl, top_k: topK }),
  });
}

/**
 * Poll a job to a terminal state.
 *
 * Standard glyph sets land in ~25s, extended in 2-3 min, so we start tight and
 * back off. The docs are explicit that you must bound this yourself — there is
 * no server-side timeout that will rescue a stuck job.
 */
export async function waitForGeneration(
  id: string,
  opts: { timeoutMs?: number; onProgress?: (g: Generation) => void } = {},
  key?: string,
): Promise<Generation> {
  const timeout = opts.timeoutMs ?? 5 * 60_000;
  const started = Date.now();
  let delay = 2_000;

  for (;;) {
    const g = await getGeneration(id, key);
    opts.onProgress?.(g);
    if (isTerminal(g.status)) return g;
    if (Date.now() - started > timeout) {
      throw new MixfontError(`Generation ${id} timed out after ${Math.round(timeout / 1000)}s`, 504);
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.35, 8_000);
  }
}
