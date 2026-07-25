import type { Metadata } from 'next';
import Link from 'next/link';

import { CollectionView } from '@/components/CollectionView';
import { loadAtlas } from '@/lib/atlas';

/**
 * The house library.
 *
 * 201 typefaces existed, each with a name, a full-alphabet woff2, a
 * downloadable TTF and a complete genome — and the only way to see any of them
 * was to be shown two at random during a quiz. A foundry that cannot show you
 * its own catalogue is not really presenting itself as one, and the product had
 * nothing to come back for.
 *
 * A publishing surface: warm paper, hairline rules, every name set in its own
 * face. See DESIGN.md.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'The house library — Foundry',
  description:
    'All 201 typefaces Foundry has cut, frozen the day they were drawn. Every one has a full specimen sheet and downloads as a TTF.',
};

export default async function CollectionPage() {
  const atlas = await loadAtlas();

  if (atlas.length === 0) {
    return (
      <div className="surface-publish mx-auto max-w-md px-5 py-24 sm:px-6">
        <p className="text-ink-dim">The library hasn&rsquo;t been minted yet.</p>
        <Link href="/" className="mt-4 inline-block text-ink">
          ← back
        </Link>
      </div>
    );
  }

  return <CollectionView atlas={atlas} />;
}
