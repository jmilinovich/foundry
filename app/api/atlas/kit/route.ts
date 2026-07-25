import JSZip from 'jszip';
import { promises as fs } from 'fs';
import path from 'path';

import { loadAtlas } from '@/lib/atlas';
import { toGenotype, toPrompt } from '@/lib/genome';
import { decodeProfile } from '@/lib/profileCode';
import { profileToVector, recommend } from '@/lib/recommend';

/**
 * The six matched house faces, free, as one zip.
 *
 * The free path used to dead-end: after the read, the only move forward was
 * "breed your own", which costs $1.60 *and* a Mixfont account the visitor does
 * not have. So a quiz that promised to name the typefaces that fit you ended by
 * naming six you could not have. These are static files that were minted once
 * and cost nothing to serve, and handing them over is what makes finishing the
 * quiz worth doing on its own.
 *
 * The profile arrives in the URL exactly as it does everywhere else, so this
 * route stores nothing and needs no key. Matching runs the same function the
 * result page ran, which is what guarantees the zip holds the six you were
 * actually shown.
 */

export const dynamic = 'force-dynamic';

const HOW_MANY = 6;

const safeName = (s: string) =>
  s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'font';

/** One house face as a kit: the TTF, a ready @font-face rule, and its genome. */
async function singleKit(slug: string) {
  const entry = (await loadAtlas()).find((e) => e.slug === slug);
  if (!entry) return new Response('no such font', { status: 404 });

  let ttf: Buffer;
  try {
    ttf = await fs.readFile(path.join(process.cwd(), 'public', 'atlas', `${slug}.ttf`));
  } catch {
    return new Response('font unavailable', { status: 503 });
  }

  const file = safeName(entry.name);
  const zip = new JSZip();
  zip.file(`${file}.ttf`, ttf);
  zip.file(
    `${file}.css`,
    [
      `@font-face {`,
      `  font-family: "${entry.name}";`,
      `  src: url("${file}.ttf") format("truetype");`,
      `  font-weight: normal;`,
      `  font-style: normal;`,
      `  font-display: swap;`,
      `}`,
      '',
    ].join('\n'),
  );
  zip.file(
    'README.txt',
    [
      entry.name.toUpperCase(),
      '',
      toGenotype(entry.genome),
      '',
      'Drawn for ' + entry.genome.useCase + '.',
      '',
      'One of the 201 faces in the Foundry house library, cut once and frozen.',
      'Yours to use. Generated through the Mixfont API and not derived from',
      'anyone else’s typeface.',
      '',
      'The prompt it was cut from:',
      '',
      toPrompt(entry.genome),
      '',
      'foundry — fonts.mili.dev',
      '',
    ].join('\n'),
  );

  const body = await zip.generateAsync({ type: 'nodebuffer' });
  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${file}.zip"`,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;

  const slug = params.get('slug');
  if (slug) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return new Response('bad slug', { status: 400 });
    return singleKit(slug);
  }

  const code = params.get('p');
  if (!code) return new Response('missing profile', { status: 400 });

  const profile = decodeProfile(code);
  if (!profile) return new Response('unreadable profile', { status: 400 });

  const atlas = await loadAtlas();
  if (atlas.length === 0) return new Response('atlas unavailable', { status: 503 });

  const matches = recommend(profileToVector(profile), atlas, HOW_MANY);
  const zip = new JSZip();
  const lines: string[] = [];

  for (const [i, m] of matches.entries()) {
    const { slug, name, genome } = m.item;
    let ttf: Buffer;
    try {
      ttf = await fs.readFile(path.join(process.cwd(), 'public', 'atlas', `${slug}.ttf`));
    } catch {
      continue; // a missing file must not fail the whole download
    }
    zip.file(`${String(i + 1).padStart(2, '0')}-${safeName(name)}.ttf`, ttf);
    lines.push(`${i + 1}. ${name}\n   ${toGenotype(genome)}`);
  }

  if (lines.length === 0) return new Response('no fonts available', { status: 503 });

  zip.file(
    'README.txt',
    [
      'SIX FACES FROM THE HOUSE LIBRARY',
      '',
      'These were cut by Foundry and frozen before you took the quiz. These six',
      'sit nearest the votes you cast, out of 201.',
      '',
      ...lines,
      '',
      'Yours to use. They were generated through the Mixfont API and are not',
      'derived from anyone else’s typeface.',
      '',
      'foundry — fonts.mili.dev',
      '',
    ].join('\n'),
  );

  const body = await zip.generateAsync({ type: 'nodebuffer' });
  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': 'attachment; filename="foundry-six.zip"',
      'cache-control': 'private, max-age=0, must-revalidate',
    },
  });
}
