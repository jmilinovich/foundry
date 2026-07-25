import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PairFinder } from '@/components/PairFinder';
import googleFonts from '@/lib/data/google-fonts.json';
import { STANCES, type Slot, type Stance } from '@/lib/genome';
import { loadAtlas } from '@/lib/atlas';
import { findPartners, type Partner } from '@/lib/pairing';
import type { GoogleFont } from '@/lib/recommend';

const GOOGLE = googleFonts as unknown as GoogleFont[];
const SLOTS: Slot[] = ['text', 'display'];
const PER_LIST = 6;

/**
 * Partners are ranked on the server, at build time, for every combination.
 *
 * The alternative is shipping both libraries to the browser and ranking there,
 * which is about 140 KB of JSON on a page whose job is to show two typefaces.
 * Three stances by two slots is six lists of six, so the whole result set is a
 * few kilobytes of props and switching between them costs nothing. It is also
 * the honest shape: the ranking is pure arithmetic over frozen data, so there
 * is no reason for it to happen at request time, let alone per visitor.
 */
export async function generateStaticParams() {
  return (await loadAtlas()).map((e) => ({ slug: e.slug }));
}

async function entryFor(slug: string) {
  return (await loadAtlas()).find((e) => e.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const entry = await entryFor((await params).slug);
  if (!entry) return { title: 'Not in the library — Foundry' };
  return {
    title: `What pairs with ${entry.name} — Foundry`,
    description: `Typefaces that sit well with ${entry.name}, from the house library and Google Fonts.`,
  };
}

export default async function PairPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const atlas = await loadAtlas();
  const entry = atlas.find((e) => e.slug === slug);
  if (!entry) notFound();

  const lists: Record<string, Partner[]> = {};
  const pools: Record<string, number> = {};

  for (const slot of SLOTS) {
    for (const { id: stance } of STANCES) {
      lists[`${slot}:${stance}`] = findPartners(entry.genome, {
        slot,
        stance: stance as Stance,
        house: atlas,
        google: GOOGLE,
        limit: PER_LIST,
        excludeSlug: slug,
      });
    }
    /**
     * How many faces were actually in the running, counted rather than claimed.
     *
     * The page said "best 6 of 350", which is the size of both libraries added
     * together and is only true of the display slot. Body copy throws out every
     * display, script and mono family and every house face too extreme to read
     * at 16px, which takes the real pool to about a hundred. Overstating it by
     * three times on the default tab is the kind of number nobody checks and
     * everybody would be annoyed to discover. The guards live in findPartners
     * and depend only on the slot, so counting through it cannot drift from
     * what was actually ranked.
     */
    pools[slot] = findPartners(entry.genome, {
      slot,
      stance: 'classic',
      house: atlas,
      google: GOOGLE,
      limit: Number.MAX_SAFE_INTEGER,
      excludeSlug: slug,
    }).length;
  }

  return (
    <PairFinder
      slug={entry.slug}
      name={entry.name}
      genome={entry.genome}
      lists={lists}
      pools={pools}
      googleCount={GOOGLE.length}
    />
  );
}
