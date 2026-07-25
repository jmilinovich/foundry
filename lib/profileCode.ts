/**
 * Profiles as URLs.
 *
 * A result worth sharing needs an address, and Foundry has no accounts and no
 * database — the whole trust story is that nothing about you is stored server
 * side. So the link *is* the data: the profile packs into a few dozen bytes of
 * base64url and unpacks on the far end into the identical profile, which then
 * runs through the same deterministic read and the same matcher.
 *
 * That buys two things worth more than a prettier five-character URL:
 * the link never expires, and it never 404s because a row was evicted.
 *
 * Fidelity is the hard requirement. If a shared link renders a different verdict
 * than the person saw, the feature is worse than not existing, so every vote
 * weight is stored exactly rather than approximately. Votes only ever arrive in
 * units of 0.25 (a specimen ride-along), 0.4 (a world ride-along) and 1.0 (a
 * decisive pick), so a 1/20 quantum represents all of them without loss.
 */

import { CATEGORY, CONTRAST, ERA, MOOD, TERMINALS, WEIGHT, WIDTH } from './genome';
import { emptyProfile, QUIZ_AXES, type QuizAxis, type TasteProfile } from './taste';

const VERSION = 2;
/** Vote weights are exact multiples of 1/20; see the note above. */
const Q = 20;

/**
 * Two trailing checksum bytes.
 *
 * Without them a *truncated* code still decodes: the unpacker reads past the
 * end, gets undefined, skips those entries and returns a profile that is
 * partial but entirely plausible. That is the worst possible failure for a
 * share link — a chat client clips the URL and the recipient is shown a
 * confident verdict that isn't the one you sent, with nothing to indicate it.
 * A checksum turns that silent corruption into the honest "didn't decode" page.
 */
function checksum(bytes: number[] | Uint8Array): [number, number] {
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return [(h >>> 8) & 0xff, h & 0xff];
}

const AXIS_VALUES: Record<QuizAxis, readonly string[]> = {
  category: CATEGORY,
  weight: WEIGHT,
  width: WIDTH,
  contrast: CONTRAST,
  terminals: TERMINALS,
};

const b64url = {
  encode(bytes: Uint8Array): string {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(s: string): Uint8Array {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    if (typeof atob === 'function') {
      const bin = atob(pad);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(pad, 'base64'));
  },
};

/** Pack one tally as [count, (index, weight)…], dropping anything unrecognised. */
function packTally(out: number[], tally: Record<string, number>, values: readonly string[]) {
  const entries = Object.entries(tally ?? {})
    .map(([v, w]) => [values.indexOf(v), Math.min(255, Math.round(w * Q))] as const)
    .filter(([i, w]) => i >= 0 && w > 0);
  out.push(entries.length);
  for (const [i, w] of entries) out.push(i, w);
}

function unpackTally(
  bytes: Uint8Array,
  cursor: { i: number },
  values: readonly string[],
): Record<string, number> {
  const tally: Record<string, number> = {};
  const n = bytes[cursor.i++] ?? 0;
  for (let k = 0; k < n; k++) {
    const idx = bytes[cursor.i++];
    const w = bytes[cursor.i++];
    const name = values[idx];
    if (name !== undefined) tally[name] = w / Q;
  }
  return tally;
}

export function encodeProfile(profile: TasteProfile): string {
  const out: number[] = [VERSION, Math.min(255, profile.round)];

  for (const ax of QUIZ_AXES) packTally(out, profile.axis[ax], AXIS_VALUES[ax]);
  for (const ax of QUIZ_AXES) packTally(out, profile.decisive[ax], AXIS_VALUES[ax]);
  packTally(out, profile.eras, ERA);
  packTally(out, profile.moods, MOOD);
  for (const ax of QUIZ_AXES) out.push(Math.min(255, profile.seen[ax] ?? 0));

  out.push(...checksum(out));
  return b64url.encode(Uint8Array.from(out));
}

/**
 * Rebuild a profile from a code. Returns null on anything malformed rather than
 * throwing, so a mangled link renders a friendly page instead of a 500.
 *
 * `shown` and `worldShown` are deliberately not encoded: they exist only to stop
 * a live quiz repeating itself, and a shared link never continues the quiz.
 */
export function decodeProfile(code: string): TasteProfile | null {
  try {
    const bytes = b64url.decode(code);
    if (bytes.length < 5 || bytes[0] !== VERSION) return null;

    // Verify before trusting a single field.
    const payload = bytes.subarray(0, bytes.length - 2);
    const [c1, c2] = checksum(payload);
    if (bytes[bytes.length - 2] !== c1 || bytes[bytes.length - 1] !== c2) return null;

    const cursor = { i: 1 };
    const profile = emptyProfile();
    profile.round = bytes[cursor.i++];

    for (const ax of QUIZ_AXES) profile.axis[ax] = unpackTally(bytes, cursor, AXIS_VALUES[ax]);
    for (const ax of QUIZ_AXES) profile.decisive[ax] = unpackTally(bytes, cursor, AXIS_VALUES[ax]);
    profile.eras = unpackTally(bytes, cursor, ERA);
    profile.moods = unpackTally(bytes, cursor, MOOD);
    for (const ax of QUIZ_AXES) profile.seen[ax] = bytes[cursor.i++] ?? 0;

    // The payload must have been consumed exactly — no short read, no trailing
    // bytes. Together with the checksum this makes a mangled link fail loudly.
    if (cursor.i !== payload.length) return null;
    return profile;
  } catch {
    return null;
  }
}

/**
 * A short, stable id for a profile — used to seed which phrasing the read picks,
 * so the same taste always gets the same words. FNV-1a over the canonical code.
 */
export function profileSeed(profile: TasteProfile): number {
  const s = encodeProfile(profile);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
