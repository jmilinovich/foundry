import type { Metadata } from 'next';
import Link from 'next/link';

import { Result } from '@/components/quiz/Result';
import { loadAtlas } from '@/lib/atlas';
import googleFonts from '@/lib/data/google-fonts.json';
import { decodeProfile } from '@/lib/profileCode';
import { composeRead, readToParagraph } from '@/lib/read';
import type { GoogleFont } from '@/lib/recommend';
import { profileToSeed } from '@/lib/taste';

/**
 * A shared type profile.
 *
 * The whole profile travels in the URL, so this page needs no database, no
 * session and no key — it decodes the code, runs the same deterministic read
 * and the same matcher the quiz ran, and renders the identical result. A link
 * sent today renders the same verdict in a year.
 */

const GOOGLE = googleFonts as unknown as GoogleFont[];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const profile = decodeProfile(code);
  if (!profile) return { title: 'Foundry — that link didn’t decode' };

  const read = composeRead(profile, Object.keys(profileToSeed(profile).pinned).length);
  return {
    title: 'A type profile — Foundry',
    description: readToParagraph(read).slice(0, 200),
    openGraph: {
      title: 'A type profile',
      description: read.opener,
    },
  };
}

export default async function TypePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const profile = decodeProfile(code);

  if (!profile) {
    return (
      <div className="surface-publish mx-auto flex min-h-full max-w-md flex-1 flex-col justify-center px-6 py-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          unreadable
        </p>
        <h1 className="mt-4 font-display text-[1.7rem] leading-tight">
          That link didn&rsquo;t decode.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-dim">
          A profile lives entirely inside its own URL, so a truncated link has nothing left to
          read. The quiz takes about ninety seconds.
        </p>
        <Link
          href="/quiz"
          className="mt-6 inline-block border border-line px-4 py-2 font-mono text-[12px] text-ink-dim transition hover:border-ink hover:text-ink"
        >
          take it →
        </Link>
      </div>
    );
  }

  const atlas = await loadAtlas();
  return <Result profile={profile} atlas={atlas} google={GOOGLE} shared />;
}
