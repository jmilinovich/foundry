/**
 * Assemble and validate the two authored libraries.
 *
 * Both are *authored* artifacts, not derived ones — a person (or an authoring
 * pass) decided that Playfair Display is a didone and that a geometric-and-cool
 * profile gets told about Bauhaus preliminary exercises. They live in the repo
 * as data so production never runs a model to produce either.
 *
 * This script merges the authoring output into lib/data/ and, more importantly,
 * *validates* it. A missing opener key or a bad gene value would not crash the
 * app — the read would quietly fall back and the recommendation would quietly
 * skip an axis — so the failure has to be caught here, loudly, at build time.
 *
 *   node scripts/build-libraries.mjs [--src <dir>]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const DATA = path.join(REPO, 'lib', 'data');

const srcFlag = process.argv.indexOf('--src');
const SRC = srcFlag > -1 ? process.argv[srcFlag + 1] : REPO;

const AXES = {
  category: ['geometric sans', 'neo-grotesque sans', 'grotesque sans', 'humanist sans',
    'flared sans', 'wedge serif', 'humanist serif', 'transitional serif', 'old-style serif',
    'didone serif', 'slab serif'],
  weight: ['hairline', 'extralight', 'light', 'regular', 'medium', 'semibold', 'bold', 'black',
    'ultra-heavy'],
  width: ['ultra-condensed', 'condensed', 'narrow', 'normal-width', 'wide', 'extended',
    'ultra-extended'],
  contrast: ['monoline', 'very low contrast', 'low contrast', 'moderate contrast',
    'high contrast', 'extreme contrast', 'reverse contrast'],
  terminals: ['blunt cut', 'angled', 'sheared', 'spurred', 'flared', 'tapered', 'rounded', 'ball'],
  xheight: ['small', 'modest', 'normal', 'large', 'very large'],
  corner: ['razor-sharp', 'crisp', 'softened', 'rounded', 'pillowy'],
  texture: ['clean', 'lightly inked', 'slightly rough', 'engraved', 'brush-drawn', 'eroded',
    'stencil-cut', 'pixel-stepped'],
  era: ['15th-century humanist', '18th-century enlightenment', '19th-century industrial',
    '1920s Bauhaus', '1950s Swiss', '1970s phototypesetting', '1990s digital', 'contemporary',
    'speculative near-future'],
  mood: ['editorial', 'brutalist', 'warm', 'clinical', 'nostalgic', 'futuristic', 'literary',
    'industrial', 'playful', 'severe', 'elegant', 'utilitarian', 'psychedelic', 'ecclesiastical',
    'botanical', 'mechanical'],
};

const FAMILIES = ['geometric', 'neogrotesque', 'grotesque', 'humanist-sans', 'flared', 'wedge',
  'humanist-serif', 'transitional', 'oldstyle', 'didone', 'slab'];
const CLUSTERS = ['cool', 'warm', 'loud', 'refined', 'forward'];
const TENSIONS = ['serif-brutal', 'sans-literary', 'heavy-fine', 'light-loud', 'wide-severe',
  'narrow-warm', 'soft-cold', 'hard-warm', 'old-future', 'split-category', 'extreme-taste',
  'middle-taste', 'no-tension'];
const DECISIVENESS = ['decisive', 'leaning', 'open'];
/** Axes the read composer looks up clauses for. */
const CLAUSE_AXES = ['weight', 'width', 'contrast', 'terminals', 'xheight', 'mood', 'era'];

const problems = [];
const warn = [];
const fail = (m) => problems.push(m);

const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
const exists = async (p) => !!(await fs.stat(p).catch(() => null));

// ---------------------------------------------------------------------------
// Google Fonts
// ---------------------------------------------------------------------------
async function buildGoogle() {
  const merged = [];
  const seen = new Set();
  for (let i = 0; i < 5; i++) {
    const p = path.join(SRC, `gf-tags-${i}.json`);
    if (!(await exists(p))) {
      fail(`missing ${p}`);
      continue;
    }
    for (const entry of await readJson(p)) {
      if (seen.has(entry.family)) {
        warn.push(`duplicate family dropped: ${entry.family}`);
        continue;
      }
      seen.add(entry.family);
      merged.push(entry);
    }
  }

  // Join Google's own classification back in as `kind`.
  //
  // The genome describes what a face *looks* like, which is the right basis for
  // matching but the wrong basis for recommending: a ballpoint script and a
  // geometric sans can both be monoline, light and round, so Caveat scores as a
  // near-neighbour of Futura and lands in a list where nobody wants it. `kind`
  // separates "how it's drawn" from "what it's for", and the recommender uses
  // it to keep specialist faces from crowding out usable ones.
  const KIND = { 'Handwriting': 'script', 'Display': 'display', 'Monospace': 'mono' };
  const shortlistPath = path.join(SRC, 'gf-shortlist.json');
  if (await exists(shortlistPath)) {
    const byFamily = new Map((await readJson(shortlistPath)).map((s) => [s.family, s]));
    for (const e of merged) {
      const meta = byFamily.get(e.family);
      if (!meta) {
        warn.push(`${e.family}: not in the source catalogue — cannot classify`);
        e.kind = e.mono ? 'mono' : 'text';
        continue;
      }
      e.kind = KIND[meta.category] ?? (e.mono ? 'mono' : 'text');
      e.popularity = meta.popularity;
    }
  } else {
    warn.push('gf-shortlist.json missing — every family defaults to kind "text"');
    for (const e of merged) e.kind ??= e.mono ? 'mono' : 'text';
  }

  for (const e of merged) {
    if (!e.family) fail(`entry with no family`);
    const g = e.genome ?? {};
    for (const [axis, values] of Object.entries(AXES)) {
      if (axis === 'mood') {
        if (!Array.isArray(g.mood) || g.mood.length !== 2) fail(`${e.family}: mood must be 2 values`);
        else {
          for (const m of g.mood) if (!values.includes(m)) fail(`${e.family}: bad mood "${m}"`);
          if (g.mood[0] === g.mood[1]) fail(`${e.family}: duplicate mood`);
        }
        continue;
      }
      if (!values.includes(g[axis])) fail(`${e.family}: bad ${axis} "${g[axis]}"`);
    }
    if (!Array.isArray(e.staticWeights) || !e.staticWeights.length) {
      fail(`${e.family}: no staticWeights`);
    }
    if (!e.why || e.why.length < 12) fail(`${e.family}: missing or trivial "why"`);
    if (/\b(elegant|timeless|versatile|perfect|stunning|beautiful|modern)\b/i.test(e.why ?? '')) {
      fail(`${e.family}: marketing word in "why": ${e.why}`);
    }
  }

  // A flat category distribution means somebody defaulted rather than judged.
  const cats = {};
  for (const e of merged) cats[e.genome?.category] = (cats[e.genome?.category] ?? 0) + 1;
  const top = Math.max(...Object.values(cats));
  if (top > merged.length * 0.4) {
    fail(`category "${Object.entries(cats).find(([, v]) => v === top)?.[0]}" is ${top}/${merged.length} — too flat`);
  }

  await fs.writeFile(path.join(DATA, 'google-fonts.json'), JSON.stringify(merged, null, 1));
  console.log(`google-fonts.json: ${merged.length} families, ${Object.keys(cats).length} categories`);
  return merged;
}

// ---------------------------------------------------------------------------
// The read bank
// ---------------------------------------------------------------------------
async function buildRead() {
  const openersPath = path.join(SRC, 'read-openers.json');
  const tensionsPath = path.join(SRC, 'read-tensions.json');
  const clausesPath = path.join(SRC, 'read-clauses.json');
  for (const p of [openersPath, tensionsPath, clausesPath]) {
    if (!(await exists(p))) {
      fail(`missing ${p}`);
      return null;
    }
  }

  const openers = await readJson(openersPath);
  const tensionsFile = await readJson(tensionsPath);
  const clauses = await readJson(clausesPath);

  for (const f of FAMILIES) {
    for (const c of CLUSTERS) {
      const k = `${f}:${c}`;
      if (!Array.isArray(openers[k]) || openers[k].length < 1) fail(`openers missing "${k}"`);
    }
  }
  for (const t of TENSIONS) {
    if (!Array.isArray(tensionsFile.tensions?.[t]) || !tensionsFile.tensions[t].length) {
      fail(`tensions missing "${t}"`);
    }
  }
  for (const d of DECISIVENESS) {
    if (!Array.isArray(tensionsFile.closers?.[d]) || !tensionsFile.closers[d].length) {
      fail(`closers missing "${d}"`);
    }
  }
  for (const axis of CLAUSE_AXES) {
    const bank = clauses[axis];
    if (!bank) {
      fail(`clauses missing axis "${axis}"`);
      continue;
    }
    for (const v of AXES[axis]) {
      const c = bank[v];
      if (!c?.label) fail(`clauses.${axis} missing "${v}"`);
    }
  }

  // The banned register tells, checked across every authored line.
  const BANNED = /\b(leverage|testament|journey|elevate|curated|timeless|unapologetic|stunning|seamless|delve|tapestry|resonate|crafted)\b/i;
  const lines = [
    ...Object.values(openers).flat(),
    ...Object.values(tensionsFile.tensions ?? {}).flat(),
    ...Object.values(tensionsFile.closers ?? {}).flat(),
  ];
  for (const line of lines) {
    if (typeof line === 'string' && BANNED.test(line)) fail(`banned word: "${line.slice(0, 70)}…"`);
  }
  const emdash = lines.filter((l) => typeof l === 'string' && /—/.test(l));
  if (emdash.length > lines.length * 0.12) {
    warn.push(`${emdash.length}/${lines.length} lines use an em-dash — that's the AI tell`);
  }

  const bank = {
    openers,
    tensions: tensionsFile.tensions,
    closers: tensionsFile.closers,
    clauses,
  };
  await fs.writeFile(path.join(DATA, 'read-bank.json'), JSON.stringify(bank, null, 1));
  console.log(
    `read-bank.json: ${Object.keys(openers).length} opener keys, ${lines.length} authored lines`,
  );
  return bank;
}

// ---------------------------------------------------------------------------
// World images (produced by the tagging pass; validated here)
// ---------------------------------------------------------------------------
async function checkWorld() {
  const p = path.join(DATA, 'world.json');
  if (!(await exists(p))) {
    warn.push('lib/data/world.json not present yet — the quiz falls back to specimen rounds');
    return [];
  }
  const world = await readJson(p);
  for (const w of world) {
    if (!w.file) fail(`world entry ${w.id}: no file`);
    else if (!(await exists(path.join(REPO, 'public', 'world', w.file)))) {
      fail(`world entry ${w.id}: file missing on disk (${w.file})`);
    }
    if (!Array.isArray(w.mood) || w.mood.length !== 2) fail(`world ${w.id}: mood must be 2`);
    else for (const m of w.mood) if (!AXES.mood.includes(m)) fail(`world ${w.id}: bad mood "${m}"`);
    if (!AXES.era.includes(w.era)) fail(`world ${w.id}: bad era "${w.era}"`);
    for (const axis of ['category', 'weight', 'width', 'contrast']) {
      if (w[axis] !== undefined && !AXES[axis].includes(w[axis])) {
        fail(`world ${w.id}: bad ${axis} "${w[axis]}"`);
      }
    }
    if (!w.credit?.source) fail(`world ${w.id}: no credit source — cannot verify licence`);
    if (/noncommercial|no derivative/i.test(w.credit?.licence ?? '')) {
      fail(`world ${w.id}: licence forbids commercial use (${w.credit.licence})`);
    }
    if (!w.caption || w.caption.length > 60) fail(`world ${w.id}: caption missing or too long`);
  }
  console.log(`world.json: ${world.length} images`);
  return world;
}

async function run() {
  await fs.mkdir(DATA, { recursive: true });
  await buildGoogle();
  await buildRead();
  await checkWorld();

  for (const w of warn) console.warn(`  warn: ${w}`);
  if (problems.length) {
    console.error(`\n${problems.length} PROBLEMS:`);
    for (const p of problems.slice(0, 40)) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log('\nlibraries valid');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
