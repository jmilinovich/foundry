/**
 * Turn scraped attribution into a line worth printing.
 *
 * `credit.artist` is whatever Wikimedia had in its Author field, and Wikimedia
 * has everything: "Unknown author Unknown author" (the template rendered twice),
 * "Self Scanned", "AS", "User:Piotrus". The quiz prints that string, uppercased,
 * under a photograph on the judging surface — so a real credit line has been
 * reading as raw scraper output.
 *
 * The rule, in order:
 *   1. A usable human or institutional name is kept, tidied.
 *   2. A wiki username keeps the handle but drops the namespace.
 *   3. Anything that is not a name at all becomes "Wikimedia Commons", which is
 *      true, checkable, and is what an editor would print.
 *
 * The licence is never touched — that half must stay exactly as harvested.
 *
 *   node scripts/clean-credits.mjs [--dry]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, '..', 'lib', 'data', 'world.json');
const DRY = process.argv.includes('--dry');

/** Strings that carry no attribution at all. */
const NOT_A_NAME =
  /^(unknown|unknown author|anonymous|anon|self[- ]?scanned|scan|own work|see source|no author|n\/?a|\?+)$/i;

export function cleanArtist(raw) {
  let s = String(raw ?? '').trim();

  // "Unknown author Unknown author" — the template rendered twice.
  s = s.replace(/\b(unknown author)(\s+\1)+\b/gi, '$1');
  // Editorial prefixes Commons leaves in the field.
  s = s.replace(/^(photo(graph)?( by)?|foto:?|fotograf|scan(ned)? by|artist:|author:|by)\s+/i, '');
  // Language-wiki prefixes: "nl:Jan Pietersz", "en:Some One".
  s = s.replace(/^[a-z]{2,3}:/i, '');
  s = s.replace(/\s+/g, ' ').trim();

  // A wiki handle is a real, checkable attribution — keep it, drop the namespace.
  const handle = s.match(/^user:(.+)$/i);
  if (handle) s = handle[1].trim();

  // Trailing self-promotion and stray punctuation: "Mike Peel ( www… )." The
  // credit names the person; it is not their homepage.
  s = s.replace(/\s*\([^)]*(www\.|https?:|\.net|\.com|\.org)[^)]*\)\s*/gi, ' ');
  s = s.replace(/[.,;:\s]+$/, '').trim();

  if (!s || NOT_A_NAME.test(s)) return 'Wikimedia Commons';
  // Bare initials attribute nobody.
  if (s.replace(/[^A-Za-z]/g, '').length <= 2) return 'Wikimedia Commons';
  // Long enough to be a sentence rather than a name: keep the first clause.
  if (s.length > 60) s = s.split(/[,;(]/)[0].trim().slice(0, 60);
  return s;
}

async function run() {
  const world = JSON.parse(await fs.readFile(FILE, 'utf8'));
  const changed = [];

  for (const w of world) {
    const before = w.credit.artist;
    const after = cleanArtist(before);
    if (after !== before) changed.push(`${before}  →  ${after}`);
    w.credit.artist = after;
  }

  console.log(`${changed.length} of ${world.length} credits rewritten`);
  for (const c of changed) console.log(`  ${c}`);
  if (DRY) return;

  await fs.writeFile(FILE, JSON.stringify(world, null, 1));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
