import JSZip from 'jszip';
import { promises as fs } from 'fs';
import path from 'path';

import { loadAtlas } from '@/lib/atlas';
import { toGenotype } from '@/lib/genome';
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

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('p');
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
