import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AtlasSpecimen } from '@/components/AtlasSpecimen';
import { loadAtlas } from '@/lib/atlas';
import { toGenotype, toPrompt } from '@/lib/genome';

/**
 * The house library is frozen, so every one of these pages is known at build
 * time. Generating them statically means a specimen sheet costs a CDN hit
 * rather than a function invocation, and each one is indexable on its own.
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
    title: `${entry.name} — Foundry`,
    description: toGenotype(entry.genome),
    openGraph: {
      title: entry.name,
      description: toGenotype(entry.genome),
    },
  };
}

export default async function AtlasFontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = await entryFor(slug);
  if (!entry) notFound();

  return (
    <AtlasSpecimen
      slug={entry.slug}
      name={entry.name}
      genome={entry.genome}
      prompt={toPrompt(entry.genome)}
    />
  );
}
