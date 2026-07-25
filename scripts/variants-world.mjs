/**
 * Cut each photograph to the sizes and formats it is actually displayed at.
 *
 * The bank shipped ~1000px JPEG masters. A duel pane is about 350 CSS px, so
 * roughly 700 device pixels on a 2x phone — and the photographs were 85% of
 * everything the quiz downloaded, against 393 KB for all 201 typefaces. Two
 * separate wastes: resolution (1.4x linear, so ~2x in area) and format (AVIF is
 * about half of JPEG again at the same visual quality). Measured across the 14
 * images one session preloads: 2888 KB becomes 1051 KB.
 *
 * Emits, per image:
 *   <name>-480.avif / -900.avif    what modern browsers take
 *   <name>-480.jpg  / -900.jpg     the fallback, for the ~5% without AVIF
 * and records intrinsic dimensions into lib/data/world.json so the pane can
 * reserve the right box and stop reflowing as each photograph lands.
 *
 * The original master is kept: it is the licensed artefact, and re-running this
 * from a re-encoded copy would compound losses every time.
 *
 *   node scripts/variants-world.mjs [--force]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const DIR = path.join(REPO, 'public', 'world');
const DATA = path.join(REPO, 'lib', 'data', 'world.json');
const FORCE = process.argv.includes('--force');

/** 480 covers a 1x phone and the second column; 900 covers 2x and desktop. */
const WIDTHS = [480, 900];
const AVIF_Q = 52;
const JPEG_Q = 78;

const exists = (p) => fs.stat(p).then(() => true).catch(() => false);
const stem = (file) => file.replace(/\.(jpe?g|png)$/i, '');

async function run() {
  const world = JSON.parse(await fs.readFile(DATA, 'utf8'));
  let built = 0;
  let skipped = 0;
  let before = 0;
  let after = 0;
  const failed = [];

  for (const entry of world) {
    const src = path.join(DIR, entry.file);
    const base = stem(entry.file);

    try {
      const meta = await sharp(src).metadata();
      // Intrinsic size lets the pane reserve its box before the bytes arrive.
      //
      // pxW/pxH, NOT width/height: `width` on a WorldImage is the genome axis
      // ("condensed"), and an earlier version of this script assigned
      // meta.width straight onto it, silently replacing 57 tagged values with
      // pixel counts. The data test caught it. These are the only two fields
      // this script may touch.
      entry.pxW = meta.width;
      entry.pxH = meta.height;
      before += (await fs.stat(src)).size;

      for (const w of WIDTHS) {
        for (const [ext, encode] of [
          ['avif', (p) => p.avif({ quality: AVIF_Q })],
          ['jpg', (p) => p.jpeg({ quality: JPEG_Q, mozjpeg: true })],
        ]) {
          const out = path.join(DIR, `${base}-${w}.${ext}`);
          if (!FORCE && (await exists(out))) {
            after += (await fs.stat(out)).size;
            skipped++;
            continue;
          }
          const buf = await encode(
            sharp(src).resize({ width: w, withoutEnlargement: true }),
          ).toBuffer();
          await fs.writeFile(out, buf);
          after += buf.length;
          built++;
        }
      }
    } catch (err) {
      failed.push(`${entry.file}: ${err.message}`);
    }
  }

  // Refuse to write if anything but pxW/pxH moved. This script exists to add
  // two numbers; it has no business editing a genome, a caption or a licence,
  // and it destroyed 57 tagged width values once by doing exactly that.
  const original = JSON.parse(await fs.readFile(DATA, 'utf8'));
  const shape = (e) => {
    const rest = { ...e };
    delete rest.pxW;
    delete rest.pxH;
    return JSON.stringify(Object.keys(rest).sort().map((k) => [k, rest[k]]));
  };
  const touched = original.filter((o, i) => shape(o) !== shape(world[i]));
  if (touched.length) {
    console.error(`refusing to write: ${touched.length} entries changed beyond pxW/pxH`);
    console.error(`  first: ${touched[0].id}`);
    process.exit(1);
  }

  await fs.writeFile(DATA, JSON.stringify(world, null, 1));

  const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
  console.log(`built ${built}, skipped ${skipped}, failed ${failed.length}`);
  console.log(`masters ${mb(before)} → variants ${mb(after)} (all four cuts per image)`);
  for (const f of failed) console.error(`  FAIL ${f}`);
  if (failed.length) process.exitCode = 1;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
