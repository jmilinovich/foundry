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

// Width is asked for differently at each end of the axis, and the reason is
// measured rather than stylistic — see the long note on WIDTH_ADJECTIVE in
// lib/genome.ts. Kept byte-identical to that file; test/genome.test.ts asserts
// the two renderers agree, because this script deliberately replicates rather
// than imports and replication is how they drift.
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

// --- coverage expansion ----------------------------------------------------
// The 36 archetypes above are hand-picked *voices*; they read well as duel
// specimens but they leave most of the genome space empty. Once the quiz
// recommends "fonts from the Foundry that match you", empty space becomes a bad
// match: a profile that lands on ultra-condensed didone has nothing near it.
//
// So we fill the space deterministically. Each category gets a stratified sweep
// of weight/width, with the remaining axes drawn from a *per-category* pool of
// typographically coherent values — a didone is never monoline, a geometric
// sans never gets ball terminals. Co-prime strides walk each axis so the combos
// don't correlate. No RNG: the same script always yields the same 165 genomes,
// which is what makes a partial re-run safe to resume.

const AXES = {
  weight: ['hairline', 'extralight', 'light', 'regular', 'medium', 'semibold', 'bold', 'black', 'ultra-heavy'],
  width: ['ultra-condensed', 'condensed', 'narrow', 'normal-width', 'wide', 'extended', 'ultra-extended'],
  xheight: ['small', 'modest', 'normal', 'large', 'very large'],
  useCase: [
    'a wellness app identity', 'a financial dashboard', 'an independent record label',
    'a literary journal', 'a sports broadcast package', 'a science museum',
    'a coffee packaging line', 'a film title sequence', 'a transit wayfinding system',
    'an architecture studio', 'a fashion house', "a children's picture book",
    'a legal document set', 'a synthesizer front panel',
  ],
};

// Mirror of lib/genome.ts, for `--dry` validation only. If these drift, the
// dry run is what tells you — the mint itself would happily send nonsense.
const VALID = {
  category: [
    'geometric sans', 'neo-grotesque sans', 'grotesque sans', 'humanist sans', 'flared sans',
    'wedge serif', 'humanist serif', 'transitional serif', 'old-style serif', 'didone serif',
    'slab serif',
  ],
  weight: AXES.weight,
  width: AXES.width,
  contrast: [
    'monoline', 'very low contrast', 'low contrast', 'moderate contrast', 'high contrast',
    'extreme contrast', 'reverse contrast',
  ],
  terminals: ['blunt cut', 'angled', 'sheared', 'spurred', 'flared', 'tapered', 'rounded', 'ball'],
  xheight: AXES.xheight,
  corner: ['razor-sharp', 'crisp', 'softened', 'rounded', 'pillowy'],
  texture: [
    'clean', 'lightly inked', 'slightly rough', 'engraved', 'brush-drawn', 'eroded',
    'stencil-cut', 'pixel-stepped',
  ],
  era: [
    '15th-century humanist', '18th-century enlightenment', '19th-century industrial',
    '1920s Bauhaus', '1950s Swiss', '1970s phototypesetting', '1990s digital', 'contemporary',
    'speculative near-future',
  ],
  mood: [
    'editorial', 'brutalist', 'warm', 'clinical', 'nostalgic', 'futuristic', 'literary',
    'industrial', 'playful', 'severe', 'elegant', 'utilitarian', 'psychedelic', 'ecclesiastical',
    'botanical', 'mechanical',
  ],
  // 'a brand identity' is a legacy value: the original 36 were minted with it
  // before USE_CASE was narrowed in lib/genome.ts. Their TTFs exist and their
  // prompts really did say it, so we accept it here rather than rewrite history
  // — and the taste distance treats unknown axis values as "no signal".
  useCase: [...AXES.useCase, 'a brand identity'],
};

// What each category is *allowed* to be. Order matters only for the stride.
const PROFILE = {
  'geometric sans': {
    abbr: 'geo',
    contrast: ['monoline', 'very low contrast', 'low contrast'],
    terminals: ['blunt cut', 'angled', 'rounded'],
    era: ['1920s Bauhaus', '1950s Swiss', '1990s digital', 'contemporary', 'speculative near-future'],
    corner: ['razor-sharp', 'crisp', 'softened', 'rounded'],
    texture: ['pixel-stepped', 'slightly rough', 'stencil-cut'],
    mood: ['futuristic', 'clinical', 'playful', 'utilitarian', 'elegant', 'mechanical'],
  },
  'neo-grotesque sans': {
    abbr: 'neo',
    contrast: ['monoline', 'very low contrast', 'low contrast'],
    terminals: ['blunt cut', 'angled', 'sheared'],
    era: ['1950s Swiss', '1970s phototypesetting', '1990s digital', 'contemporary'],
    corner: ['razor-sharp', 'crisp', 'softened'],
    texture: ['slightly rough', 'eroded', 'stencil-cut'],
    mood: ['clinical', 'utilitarian', 'severe', 'editorial', 'industrial', 'futuristic'],
  },
  'grotesque sans': {
    abbr: 'grot',
    contrast: ['very low contrast', 'low contrast', 'moderate contrast'],
    terminals: ['blunt cut', 'angled', 'spurred'],
    era: ['19th-century industrial', '1950s Swiss', '1990s digital', 'contemporary'],
    corner: ['crisp', 'softened', 'razor-sharp'],
    texture: ['eroded', 'slightly rough', 'lightly inked'],
    mood: ['industrial', 'brutalist', 'severe', 'utilitarian', 'editorial', 'nostalgic'],
  },
  'humanist sans': {
    abbr: 'humsans',
    contrast: ['very low contrast', 'low contrast', 'moderate contrast'],
    terminals: ['tapered', 'flared', 'angled', 'sheared'],
    era: ['15th-century humanist', '1970s phototypesetting', 'contemporary'],
    corner: ['crisp', 'softened', 'rounded'],
    texture: ['lightly inked', 'brush-drawn', 'slightly rough'],
    mood: ['warm', 'literary', 'botanical', 'elegant', 'editorial'],
  },
  'flared sans': {
    abbr: 'flared',
    contrast: ['low contrast', 'moderate contrast', 'very low contrast'],
    terminals: ['flared', 'tapered'],
    era: ['15th-century humanist', '1970s phototypesetting', 'contemporary'],
    corner: ['crisp', 'softened'],
    texture: ['engraved', 'lightly inked', 'brush-drawn'],
    mood: ['warm', 'literary', 'elegant', 'ecclesiastical', 'editorial'],
  },
  'wedge serif': {
    abbr: 'wedge',
    contrast: ['low contrast', 'moderate contrast', 'high contrast'],
    terminals: ['spurred', 'angled', 'sheared'],
    era: ['19th-century industrial', '1950s Swiss', 'contemporary'],
    corner: ['razor-sharp', 'crisp'],
    texture: ['engraved', 'slightly rough', 'lightly inked'],
    mood: ['editorial', 'industrial', 'mechanical', 'severe', 'literary'],
  },
  'humanist serif': {
    abbr: 'humserif',
    contrast: ['low contrast', 'moderate contrast', 'high contrast'],
    terminals: ['tapered', 'flared', 'spurred'],
    era: ['15th-century humanist', '18th-century enlightenment', 'contemporary'],
    corner: ['crisp', 'softened'],
    texture: ['lightly inked', 'engraved', 'brush-drawn'],
    mood: ['literary', 'warm', 'elegant', 'ecclesiastical', 'editorial'],
  },
  'transitional serif': {
    abbr: 'trans',
    contrast: ['moderate contrast', 'high contrast'],
    terminals: ['tapered', 'ball', 'spurred'],
    era: ['18th-century enlightenment', '1970s phototypesetting', 'contemporary'],
    corner: ['razor-sharp', 'crisp'],
    texture: ['engraved', 'lightly inked', 'slightly rough'],
    mood: ['editorial', 'elegant', 'literary', 'severe'],
  },
  'old-style serif': {
    abbr: 'oldstyle',
    contrast: ['low contrast', 'moderate contrast'],
    terminals: ['tapered', 'flared', 'spurred'],
    era: ['15th-century humanist', '18th-century enlightenment'],
    corner: ['crisp', 'softened'],
    texture: ['lightly inked', 'engraved', 'eroded'],
    mood: ['literary', 'warm', 'nostalgic', 'ecclesiastical'],
  },
  'didone serif': {
    abbr: 'didone',
    contrast: ['high contrast', 'extreme contrast'],
    terminals: ['ball', 'blunt cut', 'sheared'],
    era: ['18th-century enlightenment', '1970s phototypesetting', 'contemporary'],
    corner: ['razor-sharp', 'crisp'],
    texture: ['engraved', 'lightly inked', 'slightly rough'],
    mood: ['elegant', 'editorial', 'severe', 'ecclesiastical', 'nostalgic'],
  },
  'slab serif': {
    abbr: 'slab',
    contrast: ['monoline', 'very low contrast', 'low contrast', 'reverse contrast'],
    terminals: ['blunt cut', 'spurred', 'rounded', 'angled'],
    era: ['19th-century industrial', '1970s phototypesetting', 'contemporary'],
    corner: ['razor-sharp', 'crisp', 'rounded'],
    texture: ['stencil-cut', 'eroded', 'slightly rough'],
    mood: ['industrial', 'utilitarian', 'nostalgic', 'playful', 'brutalist', 'mechanical'],
  },
};

const PER_CATEGORY = 15;

let catIndex = 0;
for (const [category, p] of Object.entries(PROFILE)) {
  // Offset each category's walk so two categories don't march in lockstep.
  const o = catIndex * 3;
  for (let i = 0; i < PER_CATEGORY; i++) {
    const at = (arr, step, extra = 0) => arr[(o + extra + i * step) % arr.length];
    const mood0 = at(p.mood, 1);
    let mood1 = at(p.mood, 3, 2);
    if (mood1 === mood0) mood1 = p.mood[(p.mood.indexOf(mood0) + 1) % p.mood.length];

    ATLAS.push({
      slug: `${p.abbr}-${String(i + 1).padStart(2, '0')}`,
      genome: {
        category,
        weight: at(AXES.weight, 4),
        width: at(AXES.width, 3),
        contrast: at(p.contrast, 1),
        terminals: at(p.terminals, 1, 1),
        xheight: at(AXES.xheight, 2),
        corner: at(p.corner, 1, 1),
        // Keep most of the library clean — texture is a voice, not a default.
        texture: i % 5 === 4 ? at(p.texture, 1) : 'clean',
        era: at(p.era, 1),
        useCase: at(AXES.useCase, 5),
        mood: [mood0, mood1],
      },
    });
  }
  catIndex++;
}

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
  // `--dry` prints what *would* be minted and validates the genomes. Worth
  // running before any expansion — every mint is 20 credits, and a typo'd gene
  // value silently produces a worse prompt rather than an error.
  if (process.argv.includes('--dry')) {
    const seen = new Set();
    let dupes = 0;
    let toMint = 0;
    for (const e of ATLAS) {
      if (seen.has(e.slug)) {
        console.error(`DUPLICATE SLUG: ${e.slug}`);
        dupes++;
      }
      seen.add(e.slug);
      for (const [axis, values] of Object.entries(VALID)) {
        const v = axis === 'mood' ? e.genome.mood : [e.genome[axis]];
        for (const one of v) {
          if (!values.includes(one)) console.error(`BAD ${axis}=${one} on ${e.slug}`);
        }
      }
      if (e.genome.mood[0] === e.genome.mood[1]) console.error(`MOOD REPEAT on ${e.slug}`);
      try {
        await fs.access(path.join(OUT, `${e.slug}.ttf`));
      } catch {
        toMint++;
      }
    }
    console.log(`\n${ATLAS.length} genomes, ${dupes} duplicate slugs`);
    console.log(`${toMint} to mint → ${toMint * 20} credits ≈ $${(toMint * 0.2).toFixed(2)}`);
    console.log(`\nsample prompt:\n  ${toPrompt(ATLAS[ATLAS.length - 1].genome)}`);
    return;
  }

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
