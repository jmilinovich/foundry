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
const FULL_TEXT =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
  " .,:;!?'\"&()[]{}/\\|-–—_+=*@#$%^~<>`";

async function newerThan(a, b) {
  try {
    const [sa, sb] = await Promise.all([fs.stat(a), fs.stat(b)]);
    return sa.mtimeMs > sb.mtimeMs;
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

    if ((await newerThan(qOut, src)) && (await newerThan(wOut, src))) {
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
  if (failed.length) process.exitCode = 1;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
