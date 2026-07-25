/**
 * Prune and compress the world image bank.
 *
 * The harvester pulls a few hundred candidates at full width; the tagging pass
 * keeps about a fifth of them. This deletes everything the final bank doesn't
 * reference and re-encodes what's left for the size it's actually displayed at
 * — a duel pane is roughly 520px wide, so a 2000px master is 20x the pixels
 * nobody sees, and the quiz has to load two of them per round.
 *
 * Idempotent: already-optimised files are left alone.
 *
 *   node scripts/optimize-world.mjs [--dry]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const DIR = path.join(REPO, 'public', 'world');
const DRY = process.argv.includes('--dry');

/** Displayed at ~520px wide; 1100 covers retina with room to crop. */
const MAX_WIDTH = 1100;
const QUALITY = 78;
/** Anything already under this is left alone. */
const LEAVE_ALONE = 140 * 1024;

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

async function run() {
  const world = JSON.parse(await fs.readFile(path.join(REPO, 'lib', 'data', 'world.json'), 'utf8'));
  const keep = new Set(world.map((w) => w.file));

  const present = (await fs.readdir(DIR)).filter((f) => /\.(jpe?g|png)$/i.test(f));
  const orphans = present.filter((f) => !keep.has(f));

  // Every referenced file must exist, or the quiz renders a broken image.
  const missing = [...keep].filter((f) => !present.includes(f));
  if (missing.length) {
    console.error(`${missing.length} referenced files are missing:`);
    for (const m of missing.slice(0, 10)) console.error(`  ✗ ${m}`);
    process.exit(1);
  }

  let before = 0;
  let after = 0;
  for (const f of keep) before += (await fs.stat(path.join(DIR, f))).size;
  let orphanBytes = 0;
  for (const f of orphans) orphanBytes += (await fs.stat(path.join(DIR, f))).size;

  console.log(`keeping ${keep.size} (${mb(before)}), deleting ${orphans.length} (${mb(orphanBytes)})`);
  if (DRY) return;

  for (const f of orphans) await fs.unlink(path.join(DIR, f));
  // candidates.json is harvest provenance, not a runtime asset — it lists 200+
  // images we didn't ship. lib/data/world.json carries the credits that matter.
  await fs.rm(path.join(DIR, 'candidates.json'), { force: true });

  let touched = 0;
  let renames = 0;
  for (const f of keep) {
    const p = path.join(DIR, f);
    const stat = await fs.stat(p);
    if (stat.size <= LEAVE_ALONE) {
      after += stat.size;
      continue;
    }
    const buf = await sharp(p)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toBuffer();

    // Never make a file bigger than it was.
    if (buf.length >= stat.size) {
      after += stat.size;
      continue;
    }

    // The buffer is JPEG now, so a .png name would be a lie — and a CDN that
    // sets Content-Type from the extension would serve image/png for JPEG
    // bytes. Rename on re-encode and carry the new name into the manifest.
    if (/\.png$/i.test(f)) {
      const renamed = f.replace(/\.png$/i, '.jpg');
      await fs.writeFile(path.join(DIR, renamed), buf);
      await fs.unlink(p);
      for (const w of world) if (w.file === f) w.file = renamed;
      renames++;
    } else {
      await fs.writeFile(p, buf);
    }
    after += buf.length;
    touched++;
  }

  if (renames) {
    await fs.writeFile(
      path.join(REPO, 'lib', 'data', 'world.json'),
      JSON.stringify(world, null, 1),
    );
  }

  console.log(`recompressed ${touched}, renamed ${renames} · ${mb(before)} → ${mb(after)}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
