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
  }

  return (
    <PairFinder
      slug={entry.slug}
      name={entry.name}
      genome={entry.genome}
      lists={lists}
    />
  );
}
