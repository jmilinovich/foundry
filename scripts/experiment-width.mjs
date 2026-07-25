/**
 * Find a prompt phrasing that actually produces wide letterforms.
 *
 * Measured across the 201-font atlas, the narrow half of the width axis works
 * cleanly — ultra-condensed 1.49em, condensed 1.82em, narrow 1.99em — while the
 * wide half does not move: "wide" and "extended" both land around 4.7em, the
 * same as asking for nothing, and "ultra-extended" at light weights collapses to
 * 1.68em, narrower than "condensed". Half the axis is therefore decorative, and
 * a library sampled evenly across it comes out condensed.
 *
 * This holds every other gene constant and varies only how width is expressed,
 * then measures the rendered result. Two samples per phrasing, because a single
 * generation is noisy.
 *
 *   node --env-file=.env.local scripts/experiment-width.mjs [--samples 2]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import opentype from 'opentype.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', '.data', 'experiments');
const BASE = 'https://api.mixfont.com';
const KEY = process.env.MIXFONT_API_KEY;
const WORD = 'Handgloves';

if (!KEY) {
  console.error('MIXFONT_API_KEY not set. node --env-file=.env.local scripts/experiment-width.mjs');
  process.exit(1);
}

const samplesFlag = process.argv.indexOf('--samples');
const SAMPLES = samplesFlag > -1 ? Number(process.argv[samplesFlag + 1]) : 2;

/**
 * Everything except the width phrasing is fixed, and deliberately neutral: a
 * grotesque sans at regular weight is the case most likely to succeed, so a
 * phrasing that fails here fails everywhere.
 */
const TAIL =
  'regular grotesque sans with low contrast strokes, and blunt cut terminals. ' +
  'contemporary in spirit, utilitarian and industrial. Drawn for a transit wayfinding system.';

/**
 * Candidate phrasings, by experiment set.
 *
 * SET 1 established the mechanism: as a bare adjective, "ultra-extended" does not
 * merely fail, it inverts — 2.29em, narrower than a normal face — and fixing the
 * article makes it worse (1.89em). Given its own sentence the same request lands
 * at 9.20em. Width needs to be a statement, not a modifier.
 *
 * SET 2 checks the thing that actually matters: that the whole axis comes out
 * monotonic, and that the wide phrasing survives a category the model is bad at
 * (didone was the worst performer at the wide end, 1.89em).
 */
const TAIL_DIDONE =
  'regular didone serif with extreme contrast strokes, and ball terminals. ' +
  '18th-century enlightenment in spirit, elegant and editorial. Drawn for a fashion house.';

const WIDE = {
  wide:
    'The letterforms are drawn wide, with open counters and generous spacing.',
  extended:
    'The letterforms are drawn very wide: each character is clearly wider than it is tall, ' +
    'with broad counters.',
  'ultra-extended':
    'The letterforms are extremely wide: every character is far wider than it is tall, ' +
    'with generous counters and open spacing.',
};

const SETS = {
  1: [
    { id: 'current', prompt: `A ultra-extended ${TAIL}` },
    { id: 'article-fixed', prompt: `An ultra-extended ${TAIL}` },
    { id: 'very-wide', prompt: `A very wide ${TAIL}` },
    { id: 'expanded', prompt: `An expanded ${TAIL}` },
    { id: 'own-sentence', prompt: `A ${TAIL} ${WIDE['ultra-extended']}` },
    {
      id: 'wider-than-tall',
      prompt:
        `A ${TAIL} ` +
        'Every letter is drawn much wider than it is tall, with broad round counters ' +
        'and wide side bearings, in the manner of a wide poster gothic.',
    },
  ],
  2: [
    { id: '1-ultra-condensed', prompt: `An ultra-condensed ${TAIL}` },
    { id: '2-condensed', prompt: `A condensed ${TAIL}` },
    { id: '3-narrow', prompt: `A narrow ${TAIL}` },
    { id: '4-normal', prompt: `A ${TAIL}` },
    { id: '5-wide', prompt: `A ${TAIL} ${WIDE.wide}` },
    { id: '6-extended', prompt: `A ${TAIL} ${WIDE.extended}` },
    { id: '7-ultra-extended', prompt: `A ${TAIL} ${WIDE['ultra-extended']}` },
    { id: 'didone-ultra-ext', prompt: `A ${TAIL_DIDONE} ${WIDE['ultra-extended']}` },
  ],
  3: [
    { id: 'a-normal-bare', prompt: `A ${TAIL}` },
    {
      id: 'b-normal-stated',
      prompt:
        `A ${TAIL} ` +
        'The letterforms sit at classic proportions, neither condensed nor extended.',
    },
    {
      id: 'c-normal-roman',
      prompt:
        `A ${TAIL} ` +
        'The letterforms are drawn at normal roman proportions, as wide as they are tall, ' +
        'with even spacing.',
    },
    { id: 'd-narrow-slightly', prompt: `A slightly condensed ${TAIL}` },
    {
      id: 'e-narrow-stated',
      prompt:
        `A ${TAIL} ` +
        'The letterforms are a little narrower than normal, without being condensed.',
    },
  ],
};

const setFlag = process.argv.indexOf('--set');
const SET = setFlag > -1 ? process.argv[setFlag + 1] : '1';
const VARIANTS = SETS[SET];
if (!VARIANTS) { console.error('unknown set'); process.exit(1); }

const api = (p, init) =>
  fetch(`${BASE}${p}`, {
    ...init,
    headers: { 'x-api-key': KEY, 'content-type': 'application/json', ...(init?.headers || {}) },
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mint(prompt, dest) {
  try {
    await fs.access(dest);
    return { skipped: true };
  } catch {
    /* not minted yet */
  }
  const start = await api('/v1/font-generations/text', {
    method: 'POST',
    body: JSON.stringify({ prompt, glyph_set: 'standard' }),
  });
  if (!start.ok) throw new Error(`submit ${start.status} ${await start.text()}`);
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
  const ttf = await fetch(g.ttf_url);
  await fs.writeFile(dest, Buffer.from(await ttf.arrayBuffer()));
  return { name: g.name };
}

async function measure(file) {
  const buf = await fs.readFile(file);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  let adv = 0;
  for (const ch of WORD) adv += font.charToGlyph(ch).advanceWidth ?? 0;
  return adv / font.unitsPerEm;
}

async function run() {
  await fs.mkdir(OUT, { recursive: true });
  const jobs = [];
  for (const v of VARIANTS) for (let i = 0; i < SAMPLES; i++) jobs.push({ v, i });

  console.log(`${VARIANTS.length} phrasings x ${SAMPLES} samples = ${jobs.length} fonts`);
  console.log(`worst case $${(jobs.length * 0.2).toFixed(2)} — already-minted samples are reused\n`);

  const results = new Map(VARIANTS.map((v) => [v.id, []]));
  const queue = [...jobs];
  const worker = async () => {
    for (;;) {
      const job = queue.shift();
      if (!job) return;
      const dest = path.join(OUT, `s${SET}-${job.v.id}-${job.i}.ttf`);
      try {
        await mint(job.v.prompt, dest);
        results.get(job.v.id).push(await measure(dest));
      } catch (err) {
        console.error(`  FAIL ${job.v.id}#${job.i}: ${err.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));

  console.log('phrasing         samples          median   vs control');
  const control =
    (results.get(VARIANTS[0].id) ?? []).sort((a, b) => a - b)[
      Math.floor((results.get(VARIANTS[0].id)?.length ?? 1) / 2)
    ] ?? 0;
  const rows = [];
  for (const v of VARIANTS) {
    const xs = results.get(v.id).sort((a, b) => a - b);
    if (!xs.length) continue;
    const med = xs[Math.floor(xs.length / 2)];
    rows.push({ id: v.id, med, xs });
    const delta = control ? `${med >= control ? '+' : ''}${(med - control).toFixed(2)}em` : '';
    console.log(
      `  ${v.id.padEnd(16)}${xs.map((x) => x.toFixed(2)).join(' ').padEnd(16)} ${med.toFixed(2)}em   ${delta}`,
    );
  }
  rows.sort((a, b) => b.med - a.med);
  console.log(`\nwidest phrasing: ${rows[0]?.id} at ${rows[0]?.med.toFixed(2)}em`);
  console.log('reference: a normal-width grotesque is about 5.2em');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
