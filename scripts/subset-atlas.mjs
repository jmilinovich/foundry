/**
 * Subset the atlas for the quiz.
 *
 * The quiz used to fetch a whole 64 KB TTF per card, on demand, as the card
 * mounted — which is exactly why specimens flashed unstyled before settling.
 * You cannot preload your way out of that at 200 fonts: 200 × 64 KB is 13 MB.
 *
 * But a duel only ever renders one word. Subset each face to the glyphs in that
 * word and compress to woff2 and a specimen costs ~2.3 KB, so the *entire*
 * atlas is ~460 KB — small enough to load up front, before the first duel, and
 * never think about again. No flash is then a guarantee rather than a race.
 *
 * Three artefacts per font:
 *   public/atlas/q/<slug>.woff2   quiz subset, specimen word only  (~2 KB)
 *   public/atlas/w/<slug>.woff2   full alphabet, for results/detail (~16 KB)
 *   public/atlas/<slug>.ttf       untouched original, for download
 *
 *   node scripts/subset-atlas.mjs
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import subsetFont from 'subset-font';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ATLAS = path.join(HERE, '..', 'public', 'atlas');

/**
 * The quiz specimen word. MUST stay in sync with SPECIMEN in
 * components/quiz/Quiz.tsx — a character in the markup that isn't in this
 * string renders as .notdef. `npm test` asserts the two agree.
 */
export const QUIZ_TEXT = 'Handgloves';

/** Everything the results page, name plates and detail views can need. */
// The curly quotes are here because every specimen sentence in the app uses
// them — "arm’s length" in the sample paragraph is a U+2019, not an ASCII
// apostrophe. Without them the pairing preview set one character of its body
// copy in Georgia, inside a page whose entire job is to show you a typeface.
// All 201 house TTFs carry these in their cmap, so nothing falls back.
const FULL_TEXT =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
  " .,:;!?'\"&()[]{}/\\|-–—_+=*@#$%^~<>`" +
  '‘’“”';

async function newerThan(a, b) {
  try {
    const [sa, sb] = await Promise.all([fs.stat(a), fs.stat(b)]);
    return sa.mtimeMs > sb.mtimeMs;
  } catch {
    return false;
  }
}

/**
 * The charsets are part of the output, so they have to be part of the staleness
 * check. Comparing mtimes alone means editing QUIZ_TEXT rebuilds nothing: the
 * script reports "skipped 201" and every subset still carries the old glyphs, so
 * the new specimen word renders as .notdef with no error anywhere. The stamp
 * records what the subsets on disk were actually cut for.
 */
const STAMP = path.join(ATLAS, '.subset-stamp');
const charsetKey = () => `${QUIZ_TEXT} ${FULL_TEXT}`;

async function stampIsCurrent() {
  try {
    return (await fs.readFile(STAMP, 'utf8')) === charsetKey();
  } catch {
    return false;
  }
}

async function run() {
  const qDir = path.join(ATLAS, 'q');
  const wDir = path.join(ATLAS, 'w');
  await fs.mkdir(qDir, { recursive: true });
  await fs.mkdir(wDir, { recursive: true });

  const files = (await fs.readdir(ATLAS)).filter((f) => f.endsWith('.ttf'));
  const charsetsUnchanged = await stampIsCurrent();
  if (!charsetsUnchanged) console.log('charset changed — rebuilding every subset');
  let built = 0;
  let skipped = 0;
  let qBytes = 0;
  let wBytes = 0;
  const failed = [];

  for (const file of files) {
    const slug = file.replace(/\.ttf$/, '');
    const src = path.join(ATLAS, file);
    const qOut = path.join(qDir, `${slug}.woff2`);
    const wOut = path.join(wDir, `${slug}.woff2`);

    if (charsetsUnchanged && (await newerThan(qOut, src)) && (await newerThan(wOut, src))) {
      qBytes += (await fs.stat(qOut)).size;
      wBytes += (await fs.stat(wOut)).size;
      skipped++;
      continue;
    }

    try {
      const buf = await fs.readFile(src);
      const q = await subsetFont(buf, QUIZ_TEXT, { targetFormat: 'woff2' });
      const w = await subsetFont(buf, FULL_TEXT, { targetFormat: 'woff2' });
      await fs.writeFile(qOut, q);
      await fs.writeFile(wOut, w);
      qBytes += q.length;
      wBytes += w.length;
      built++;
    } catch (err) {
      failed.push(`${slug}: ${err.message}`);
    }
  }

  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  console.log(`built ${built}, skipped ${skipped}, failed ${failed.length}`);
  console.log(`quiz set:    ${kb(qBytes)} across ${built + skipped} fonts (preloaded whole)`);
  console.log(`full set:    ${kb(wBytes)} (fetched on demand)`);
  for (const f of failed) console.error(`  FAIL ${f}`);

  if (failed.length) {
    // Don't stamp a partial build as current, or the next run skips the very
    // fonts that failed and the quiz serves a 404 for them.
    process.exitCode = 1;
    return;
  }
  await fs.writeFile(STAMP, charsetKey());
}

// Only subset when invoked directly. measure-atlas.mjs imports QUIZ_TEXT from
// here so the two can never disagree about the specimen word, and importing a
// module should not rebuild 201 fonts as a side effect.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
