/**
 * Re-mint the faces whose width came out wrong, and keep the better one.
 *
 * The atlas was generated with a prompt that asked for width as a bare
 * adjective. Measured afterwards, the wide half of the axis had inverted:
 * "ultra-extended" produced 2.41em of "Handgloves" against 4.80em for
 * normal-width, so the library skewed condensed. lib/genome.ts now states width
 * as a sentence, which measured 8.90em for the same request.
 *
 * This re-mints only the faces more than 25% from the target for their gene,
 * measures the result, and replaces the original ONLY if the new one is closer.
 * A generation is noisy and the model can hand back something worse; keeping the
 * better of the two makes the spend strictly an improvement rather than a bet.
 *
 * Genomes are never touched — the same genes are asked for, in better words. A
 * replaced font keeps its slug, so every reference to it stays valid.
 *
 *   node --env-file=.env.local scripts/remint-width.mjs [--dry] [--limit N]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import opentype from 'opentype.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ATLAS = path.join(HERE, '..', 'public', 'atlas');
const MANIFEST = path.join(ATLAS, 'manifest.json');
const BASE = 'https://api.mixfont.com';
const KEY = process.env.MIXFONT_API_KEY;
const WORD = 'Handgloves';

const DRY = process.argv.includes('--dry');
const limitFlag = process.argv.indexOf('--limit');
const LIMIT = limitFlag > -1 ? Number(process.argv[limitFlag + 1]) : Infinity;

if (!KEY && !DRY) {
  console.error('MIXFONT_API_KEY not set. node --env-file=.env.local scripts/remint-width.mjs');
  process.exit(1);
}

/** Measured in scripts/experiment-width.mjs, sets 2 and 3. */
const TARGET = {
  'ultra-condensed': 1.6,
  condensed: 2.4,
  narrow: 3.4,
  'normal-width': 4.6,
  wide: 5.4,
  extended: 6.7,
  'ultra-extended': 8.9,
};

/** Anything further than this from its target is worth 20 credits. */
const TOLERANCE = 0.25;

// --- prompt rendering: identical to lib/genome.ts, pinned by test/genome.test.ts
const article = (w) => ('aeiou'.includes(w[0].toLowerCase()) ? 'an' : 'a');

const WIDTH_ADJECTIVE = {
  'ultra-condensed': 'ultra-condensed',
  condensed: 'condensed',
  narrow: 'slightly condensed',
};

const WIDTH_SENTENCE = {
  'normal-width':
    'The letterforms sit at classic proportions, neither condensed nor extended.',
  wide: 'The letterforms are drawn wide, with open counters and generous spacing.',
  extended:
    'The letterforms are drawn very wide: each character is clearly wider than it is tall, ' +
    'with broad counters.',
  'ultra-extended':
    'The letterforms are extremely wide: every character is far wider than it is tall, ' +
    'with generous counters and open spacing.',
};

function toPrompt(g) {
  const shape = [];
  const widthWord = WIDTH_ADJECTIVE[g.width];
  if (widthWord) shape.push(widthWord);
  shape.push(g.weight, g.category);

  const details = [];
  details.push(g.contrast === 'monoline' ? 'monoline strokes' : `${g.contrast} strokes`);
  details.push(`${g.terminals} terminals`);
  if (g.corner !== 'crisp') details.push(`${g.corner} corners`);
  if (g.xheight !== 'normal') details.push(`${article(g.xheight)} ${g.xheight} x-height`);
  if (g.texture !== 'clean') details.push(`${article(g.texture)} ${g.texture} surface`);

  const last = details.pop();
  const detailText = details.length ? `${details.join(', ')}, and ${last}` : last;
  const widthSentence = WIDTH_SENTENCE[g.width];

  return (
    `${article(shape[0]).toUpperCase().slice(0, 1)}${article(shape[0]).slice(1)} ` +
    `${shape.join(' ')} with ${detailText}. ` +
    `${g.era} in spirit, ${g.mood[0]} and ${g.mood[1]}. ` +
    `Drawn for ${g.useCase}.` +
    (widthSentence ? ` ${widthSentence}` : '')
  );
}

const api = (p, init) =>
  fetch(`${BASE}${p}`, {
    ...init,
    headers: { 'x-api-key': KEY, 'content-type': 'application/json', ...(init?.headers || {}) },
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measureBuffer(buf) {
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  let adv = 0;
  for (const ch of WORD) adv += font.charToGlyph(ch).advanceWidth ?? 0;
  return Math.round((adv / font.unitsPerEm) * 100) / 100;
}

async function mint(prompt) {
  const start = await api('/v1/font-generations/text', {
    method: 'POST',
    body: JSON.stringify({ prompt, glyph_set: 'standard' }),
  });
  if (!start.ok) throw new Error(`submit ${start.status}`);
  const job = await start.json();

  let g = job;
  const began = Date.now();
  while (!['succeeded', 'failed', 'cancelled'].includes(g.status)) {
    if (Date.now() - began > 5 * 60_000) throw new Error('timed out');
    await sleep(3000);
    const poll = await api(`/v1/font-generations/${job.id}`);
    if (!poll.ok) continue;
    g = await poll.json();
  }
  if (g.status !== 'succeeded' || !g.ttf_url) throw new Error(String(g.status));
  const res = await fetch(g.ttf_url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  return { buf: Buffer.from(await res.arrayBuffer()), name: g.name };
}

async function run() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  const err = (e) => Math.abs(e.w - TARGET[e.genome.width]) / TARGET[e.genome.width];

  const candidates = manifest
    .filter((e) => e.w && TARGET[e.genome.width] && err(e) > TOLERANCE)
    .sort((a, b) => err(b) - err(a))
    .slice(0, LIMIT);

  console.log(`${candidates.length} faces are more than ${TOLERANCE * 100}% off their target`);
  console.log(`worst case $${(candidates.length * 0.2).toFixed(2)}\n`);
  if (DRY) {
    for (const e of candidates.slice(0, 12)) {
      console.log(
        `  ${e.slug.padEnd(18)} ${e.genome.width.padEnd(16)} ${e.w}em → want ${TARGET[e.genome.width]}em`,
      );
    }
    return;
  }

  let improved = 0;
  let kept = 0;
  const failed = [];
  const queue = [...candidates];

  const worker = async () => {
    for (;;) {
      const entry = queue.shift();
      if (!entry) return;
      const target = TARGET[entry.genome.width];
      try {
        const { buf, name } = await mint(toPrompt(entry.genome));
        const w = await measureBuffer(buf);
        const better = Math.abs(w - target) < Math.abs(entry.w - target);

        if (better) {
          await fs.writeFile(path.join(ATLAS, `${entry.slug}.ttf`), buf);
          console.log(
            `  ✓ ${entry.slug.padEnd(18)} ${String(entry.w).padStart(5)} → ${String(w).padStart(5)}em  (want ${target})  ${name}`,
          );
          entry.w = w;
          entry.name = name;
          improved++;
        } else {
          console.log(
            `  · ${entry.slug.padEnd(18)} ${String(entry.w).padStart(5)} kept, new was ${w}em`,
          );
          kept++;
        }
      } catch (e) {
        failed.push(`${entry.slug}: ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\nreplaced ${improved}, kept original ${kept}, failed ${failed.length}`);
  console.log(`spent ~$${((improved + kept + failed.length) * 0.2).toFixed(2)}`);
  for (const f of failed) console.error(`  FAIL ${f}`);
  console.log('\nnow: node scripts/subset-atlas.mjs && node scripts/measure-atlas.mjs');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
