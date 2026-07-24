/**
 * Mint the taste atlas.
 *
 * A curated set of archetype genomes, each minted once at the standard glyph
 * set and frozen into public/atlas/ as a static asset. The quiz shows pairs of
 * these; because each specimen has a *known* genome, a pick is a vote on the
 * genes behind it.
 *
 * Idempotent — re-run to fill in whatever failed. Reads MIXFONT_API_KEY from
 * the environment (load .env.local first). ~36 fonts × 20 credits = $7.20, once.
 *
 *   node --env-file=.env.local scripts/build-atlas.mjs
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'public', 'atlas');
const BASE = 'https://api.mixfont.com';
const KEY = process.env.MIXFONT_API_KEY;

if (!KEY) {
  console.error('MIXFONT_API_KEY not set. Run with: node --env-file=.env.local scripts/build-atlas.mjs');
  process.exit(1);
}

// --- prompt rendering (mirror of lib/genome.ts toPrompt) -------------------
// Replicated rather than imported so this stays a zero-dependency script; the
// atlas is frozen once, and at runtime the taste engine reads genomes, not
// these prompts, so drift can't bite.
const article = (w) => ('aeiou'.includes(w[0].toLowerCase()) ? 'an' : 'a');

function toPrompt(g) {
  const shape = [];
  if (g.width !== 'normal-width') shape.push(g.width);
  shape.push(g.weight, g.category);

  const details = [];
  details.push(g.contrast === 'monoline' ? 'monoline strokes' : `${g.contrast} strokes`);
  details.push(`${g.terminals} terminals`);
  if (g.corner !== 'crisp') details.push(`${g.corner} corners`);
  if (g.xheight !== 'normal') details.push(`${article(g.xheight)} ${g.xheight} x-height`);
  if (g.texture !== 'clean') details.push(`${article(g.texture)} ${g.texture} surface`);

  const last = details.pop();
  const detailText = details.length ? `${details.join(', ')}, and ${last}` : last;

  return (
    `A ${shape.join(' ')} with ${detailText}. ` +
    `${g.era} in spirit, ${g.mood[0]} and ${g.mood[1]}. ` +
    `Drawn for ${g.useCase}.`
  );
}

// --- the archetypes --------------------------------------------------------
// Full genomes so the manifest can carry them verbatim. Defaults fill the axes
// an archetype doesn't care about; each entry overrides the load-bearing ones.
const D = {
  width: 'normal-width',
  terminals: 'blunt cut',
  xheight: 'normal',
  corner: 'crisp',
  texture: 'clean',
  era: 'contemporary',
  useCase: 'a brand identity',
};
const A = (slug, o) => ({ slug, genome: { ...D, ...o, mood: o.mood } });

const ATLAS = [
  // sans — the monoline / low-contrast spine
  A('bauhaus-geo', { category: 'geometric sans', weight: 'regular', contrast: 'monoline', terminals: 'blunt cut', era: '1920s Bauhaus', mood: ['clinical', 'futuristic'] }),
  A('rounded-geo', { category: 'geometric sans', weight: 'bold', contrast: 'monoline', terminals: 'rounded', corner: 'rounded', mood: ['playful', 'warm'] }),
  A('swiss-neo', { category: 'neo-grotesque sans', weight: 'regular', contrast: 'very low contrast', terminals: 'blunt cut', era: '1950s Swiss', mood: ['clinical', 'utilitarian'] }),
  A('editorial-neo', { category: 'neo-grotesque sans', weight: 'medium', contrast: 'low contrast', terminals: 'sheared', mood: ['editorial', 'clinical'] }),
  A('industrial-grot', { category: 'grotesque sans', weight: 'bold', contrast: 'low contrast', terminals: 'blunt cut', era: '19th-century industrial', mood: ['industrial', 'severe'] }),
  A('humanist-warm', { category: 'humanist sans', weight: 'regular', contrast: 'low contrast', terminals: 'flared', mood: ['warm', 'literary'] }),
  A('humanist-light', { category: 'humanist sans', weight: 'light', contrast: 'very low contrast', terminals: 'tapered', mood: ['warm', 'elegant'] }),
  A('flared-editorial', { category: 'flared sans', weight: 'medium', contrast: 'low contrast', terminals: 'flared', mood: ['warm', 'editorial'] }),

  // serifs — the contrast staircase
  A('wedge-news', { category: 'wedge serif', weight: 'regular', contrast: 'moderate contrast', terminals: 'spurred', mood: ['editorial', 'industrial'] }),
  A('garalde-book', { category: 'old-style serif', weight: 'regular', contrast: 'moderate contrast', terminals: 'tapered', era: '15th-century humanist', mood: ['literary', 'warm'] }),
  A('humanist-serif', { category: 'humanist serif', weight: 'regular', contrast: 'moderate contrast', terminals: 'tapered', era: '15th-century humanist', mood: ['literary', 'elegant'] }),
  A('transitional', { category: 'transitional serif', weight: 'regular', contrast: 'high contrast', terminals: 'tapered', era: '18th-century enlightenment', mood: ['editorial', 'elegant'] }),
  A('didone-classic', { category: 'didone serif', weight: 'regular', contrast: 'extreme contrast', terminals: 'ball', era: '18th-century enlightenment', mood: ['elegant', 'editorial'] }),
  A('didone-light', { category: 'didone serif', weight: 'light', contrast: 'high contrast', terminals: 'ball', mood: ['elegant', 'severe'] }),
  A('geo-slab', { category: 'slab serif', weight: 'bold', contrast: 'monoline', terminals: 'blunt cut', era: '19th-century industrial', mood: ['industrial', 'utilitarian'] }),
  A('clarendon', { category: 'slab serif', weight: 'medium', contrast: 'low contrast', terminals: 'spurred', era: '19th-century industrial', mood: ['industrial', 'nostalgic'] }),

  // weight & width extremes
  A('heavy-grot', { category: 'grotesque sans', weight: 'black', contrast: 'low contrast', terminals: 'blunt cut', mood: ['brutalist', 'severe'] }),
  A('hairline-neo', { category: 'neo-grotesque sans', weight: 'hairline', contrast: 'monoline', terminals: 'blunt cut', mood: ['elegant', 'clinical'] }),
  A('condensed-geo', { category: 'geometric sans', weight: 'regular', contrast: 'monoline', terminals: 'blunt cut', width: 'condensed', mood: ['utilitarian', 'industrial'] }),
  A('compressed-grot', { category: 'grotesque sans', weight: 'bold', contrast: 'low contrast', terminals: 'blunt cut', width: 'ultra-condensed', mood: ['brutalist', 'industrial'] }),
  A('extended-neo', { category: 'neo-grotesque sans', weight: 'regular', contrast: 'low contrast', terminals: 'blunt cut', width: 'extended', mood: ['futuristic', 'clinical'] }),
  A('wide-rounded', { category: 'geometric sans', weight: 'medium', contrast: 'monoline', terminals: 'rounded', corner: 'rounded', width: 'wide', mood: ['playful', 'warm'] }),

  // contrast & era character
  A('reverse-contrast', { category: 'slab serif', weight: 'regular', contrast: 'reverse contrast', terminals: 'blunt cut', era: '19th-century industrial', mood: ['playful', 'nostalgic'] }),
  A('seventies-serif', { category: 'transitional serif', weight: 'bold', contrast: 'high contrast', terminals: 'ball', era: '1970s phototypesetting', mood: ['editorial', 'psychedelic'] }),
  A('nostalgic-serif', { category: 'humanist serif', weight: 'medium', contrast: 'moderate contrast', terminals: 'tapered', era: '1970s phototypesetting', mood: ['nostalgic', 'warm'] }),

  // texture / display voices
  A('stencil-slab', { category: 'slab serif', weight: 'bold', contrast: 'monoline', terminals: 'blunt cut', texture: 'stencil-cut', mood: ['industrial', 'brutalist'] }),
  A('inky-book', { category: 'old-style serif', weight: 'regular', contrast: 'moderate contrast', terminals: 'tapered', texture: 'lightly inked', era: '15th-century humanist', mood: ['literary', 'nostalgic'] }),
  A('eroded-heavy', { category: 'grotesque sans', weight: 'black', contrast: 'low contrast', terminals: 'blunt cut', texture: 'eroded', mood: ['brutalist', 'industrial'] }),
  A('pixel-geo', { category: 'geometric sans', weight: 'bold', contrast: 'monoline', terminals: 'blunt cut', texture: 'pixel-stepped', era: 'speculative near-future', mood: ['futuristic', 'mechanical'] }),
  A('engraved-didone', { category: 'didone serif', weight: 'light', contrast: 'extreme contrast', terminals: 'ball', texture: 'engraved', mood: ['elegant', 'ecclesiastical'] }),

  // extra voice spread
  A('botanical-humanist', { category: 'humanist sans', weight: 'medium', contrast: 'low contrast', terminals: 'flared', mood: ['botanical', 'warm'] }),
  A('flared-literary', { category: 'flared sans', weight: 'regular', contrast: 'low contrast', terminals: 'flared', mood: ['literary', 'elegant'] }),
  A('mechanical-wedge', { category: 'wedge serif', weight: 'medium', contrast: 'moderate contrast', terminals: 'spurred', mood: ['mechanical', 'industrial'] }),
  A('rounded-slab', { category: 'slab serif', weight: 'regular', contrast: 'monoline', terminals: 'rounded', corner: 'rounded', mood: ['playful', 'warm'] }),
  A('severe-neo', { category: 'neo-grotesque sans', weight: 'bold', contrast: 'low contrast', terminals: 'blunt cut', mood: ['severe', 'utilitarian'] }),
  A('elegant-geo', { category: 'geometric sans', weight: 'light', contrast: 'monoline', terminals: 'blunt cut', era: '1920s Bauhaus', mood: ['elegant', 'futuristic'] }),
];

// --- minting ---------------------------------------------------------------
const api = (p, init) =>
  fetch(`${BASE}${p}`, {
    ...init,
    headers: { 'x-api-key': KEY, 'content-type': 'application/json', ...(init?.headers || {}) },
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mintOne(entry) {
  const dest = path.join(OUT, `${entry.slug}.ttf`);
  try {
    await fs.access(dest);
    return { ...entry, name: entry.name, skipped: true };
  } catch {
    /* not yet minted */
  }

  const prompt = toPrompt(entry.genome);
  const start = await api('/v1/font-generations/text', {
    method: 'POST',
    body: JSON.stringify({ prompt, glyph_set: 'standard' }),
  });
  if (!start.ok) throw new Error(`${entry.slug}: submit ${start.status} ${await start.text()}`);
  const job = await start.json();

  let g = job;
  const began = Date.now();
  while (!['succeeded', 'failed', 'cancelled'].includes(g.status)) {
    if (Date.now() - began > 5 * 60_000) throw new Error(`${entry.slug}: timed out`);
    await sleep(3000);
    const poll = await api(`/v1/font-generations/${job.id}`);
    if (!poll.ok) continue;
    g = await poll.json();
  }
  if (g.status !== 'succeeded' || !g.ttf_url) throw new Error(`${entry.slug}: ${g.status}`);

  const ttf = await fetch(g.ttf_url);
  if (!ttf.ok) throw new Error(`${entry.slug}: download ${ttf.status}`);
  await fs.writeFile(dest, Buffer.from(await ttf.arrayBuffer()));

  return { slug: entry.slug, genome: entry.genome, name: g.name || entry.slug };
}

// bounded concurrency, so we're gentle on the API
async function run() {
  await fs.mkdir(OUT, { recursive: true });
  const results = [];
  const queue = [...ATLAS];
  const CONC = 6;

  const worker = async () => {
    for (;;) {
      const entry = queue.shift();
      if (!entry) return;
      try {
        const r = await mintOne(entry);
        results.push(r);
        console.log(`${r.skipped ? 'skip' : 'ok  '} ${entry.slug}${r.skipped ? '' : ` → ${r.name}`}`);
      } catch (err) {
        console.error(`FAIL ${entry.slug}: ${err.message}`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONC }, worker));

  // Merge with any existing manifest so a partial re-run doesn't drop names.
  const manifestPath = path.join(OUT, 'manifest.json');
  let existing = [];
  try {
    existing = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch {
    /* first run */
  }
  const byslug = new Map(existing.map((e) => [e.slug, e]));
  for (const r of results) {
    if (r.skipped) continue;
    byslug.set(r.slug, { slug: r.slug, genome: r.genome, name: r.name });
  }
  // Keep only entries whose TTF exists on disk.
  const final = [];
  for (const e of byslug.values()) {
    try {
      await fs.access(path.join(OUT, `${e.slug}.ttf`));
      final.push(e);
    } catch {
      /* skip missing */
    }
  }
  final.sort((a, b) => a.slug.localeCompare(b.slug));
  await fs.writeFile(manifestPath, JSON.stringify(final, null, 2));
  console.log(`\nmanifest: ${final.length}/${ATLAS.length} fonts`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
