'use client';

/**
 * The visitor's own Mixfont key.
 *
 * Lives only in this browser's localStorage. It's attached to API requests that
 * reach Mixfont (via `apiFetch`), where it transits our function in memory for
 * one request and is never written down server-side. Never sent anywhere else.
 */
const KEY = 'foundry.mixfont.key';

const listeners = new Set<() => void>();

export function getUserKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

export function setUserKey(key: string) {
  localStorage.setItem(KEY, key.trim());
  listeners.forEach((l) => l());
}

export function clearUserKey() {
  localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

export function onUserKeyChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Loose shape check — a real "mix_live_…"/"mix_…" key, not a validation call. */
export function looksLikeKey(k: string): boolean {
  return /^mix_[a-z0-9_]{16,}$/i.test(k.trim());
}

/**
 * fetch that attaches the key header when one is stored.
 *
 * Every client call that might reach Mixfont goes through this, so the key
 * rides along on generation, polling, breeding, promotion and retry without
 * each call site remembering to add it.
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const key = getUserKey();
  const headers = new Headers(init?.headers);
  if (key) headers.set('x-user-key', key);
  return fetch(input, { ...init, headers });
}
