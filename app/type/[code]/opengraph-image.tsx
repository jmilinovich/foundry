import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { loadAtlas } from '@/lib/atlas';
import { decodeProfile } from '@/lib/profileCode';
import { composeRead } from '@/lib/read';
import { profileToVector, recommend } from '@/lib/recommend';
import { profileToSeed } from '@/lib/taste';

/**
 * The share card.
 *
 * A link to a type profile should preview as a *specimen*, not as a logo — so
 * the card is set in the typeface that profile matched to, pulled off disk at
 * request time. That is the whole argument of the site in one image: this is
 * what your taste looks like as letters.
 *
 * Satori can't read woff2, so this uses the untouched TTF rather than the
 * subsets the quiz loads.
 */

export const alt = 'A type profile from Foundry';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PAPER = '#f2efe8';
const INK = '#1b1712';
const FAINT = '#948b7f';

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const profile = decodeProfile(code);

  const atlas = await loadAtlas();
  let championSlug: string | null = null;
  let championName = 'Foundry';
  let opener = 'Nobody can write the prompt for the font they want.';

  if (profile) {
    const pinned = Object.keys(profileToSeed(profile).pinned).length;
    opener = composeRead(profile, pinned).opener;
    const best = recommend(profileToVector(profile), atlas, 1)[0];
    if (best) {
      championSlug = best.item.slug;
      championName = best.item.name;
    }
  }

  const toArrayBuffer = (b: Buffer) =>
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

  // The champion sets the specimen line only. If its outlines won't load we
  // still render — a card with no type is worse than a card in the fallback.
  let championData: ArrayBuffer | null = null;
  if (championSlug) {
    try {
      championData = toArrayBuffer(
        await readFile(join(process.cwd(), 'public', 'atlas', `${championSlug}.ttf`)),
      );
    } catch {
      championData = null;
    }
  }

  // Labels and the read are set in the house text face, not the champion.
  // DESIGN.md reserves the generated font for specimens, and the reason bites
  // hardest here: the genome deliberately produces hairline and stencil-cut
  // faces, and a share card is read at thumbnail size in someone's inbox.
  let textData: ArrayBuffer | null = null;
  try {
    textData = toArrayBuffer(await readFile(join(process.cwd(), 'assets', 'og-text.ttf')));
  } catch {
    textData = null;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PAPER,
          color: INK,
          padding: '64px 72px',
          fontFamily: textData ? 'Text' : 'Champion',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: FAINT }}>
          <span style={{ letterSpacing: '0.16em', textTransform: 'uppercase' }}>Foundry</span>
          <span style={{ letterSpacing: '0.16em', textTransform: 'uppercase' }}>a type profile</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 128,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              fontFamily: championData ? 'Champion' : 'serif',
            }}
          >
            Handgloves
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: FAINT, marginTop: 18 }}>
            {championName}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 30,
            lineHeight: 1.35,
            maxWidth: 980,
            borderTop: `2px solid ${INK}`,
            paddingTop: 26,
          }}
        >
          {opener.length > 165 ? `${opener.slice(0, 162)}…` : opener}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        ...(textData
          ? [{ name: 'Text' as const, data: textData, style: 'normal' as const, weight: 400 as const }]
          : []),
        ...(championData
          ? [{ name: 'Champion' as const, data: championData, style: 'normal' as const, weight: 400 as const }]
          : []),
      ],
    },
  );
}
