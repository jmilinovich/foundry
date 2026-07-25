/**
 * Record how wide each face sets the specimen word.
 *
 * Both panes of a duel must share one point size — width is an axis being
 * judged, so scaling each face to fit its own pane would erase the difference
 * the round is asking about. But sizing every duel for the widest face in the
 * *whole* atlas wastes most of the pane: "Handgloves" is 6.37em in slab-14 and
 * 1.21em in neo-14, so a duel of two narrow faces was rendering at a fifth of
 * the size it could.
 *
 * Measuring each face lets the quiz size a duel off the wider of the two it is
 * actually showing. The comparison is preserved exactly — both panes still
 * share a size — and a pair of condensed faces now fills the bench.
 *
 * Writes `w` (em width of the specimen word) onto every manifest entry.
 *
 *   node scripts/measure-atlas.mjs
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import opentype from 'opentype.js';

import { QUIZ_TEXT } from './subset-atlas.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ATLAS = path.join(HERE, '..', 'public', 'atlas');
const MANIFEST = path.join(ATLAS, 'manifest.json');

async function run() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  let measured = 0;
  const failed = [];

  for (const entry of manifest) {
    try {
      const buf = await fs.readFile(path.join(ATLAS, `${entry.slug}.ttf`));
      const font = opentype.parse(
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      );
      let advance = 0;
      for (const ch of QUIZ_TEXT) advance += font.charToGlyph(ch).advanceWidth ?? 0;
      // Two decimals is plenty: it feeds a font-size divisor, not a layout.
      entry.w = Math.round((advance / font.unitsPerEm) * 100) / 100;
      measured++;
    } catch (err) {
      failed.push(`${entry.slug}: ${err.message}`);
    }
  }

  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2));

  const widths = manifest.map((e) => e.w).filter(Boolean).sort((a, b) => a - b);
  console.log(`measured ${measured} of ${manifest.length}`);
  console.log(
    `  "${QUIZ_TEXT}" spans ${widths[0]}em to ${widths[widths.length - 1]}em, median ${
      widths[Math.floor(widths.length / 2)]
    }em`,
  );
  for (const f of failed) console.error(`  FAIL ${f}`);
  if (failed.length) process.exitCode = 1;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
