import 'server-only';

/**
 * Resolve the Mixfont key for a request, and flag when there is none.
 *
 * Hosted, the only source is the visitor's `x-user-key` header. Locally,
 * MIXFONT_API_KEY stands in. `missing` is true when neither exists — the signal
 * to refuse a generate up front rather than create a run whose fonts all fail
 * 401 (and leave junk in Blob).
 */
export function resolveKey(req: Request): { key?: string; missing: boolean } {
  const key = req.headers.get('x-user-key') || undefined;
  return { key, missing: !key && !process.env.MIXFONT_API_KEY };
}
