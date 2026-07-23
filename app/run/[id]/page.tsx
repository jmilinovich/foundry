import { notFound } from 'next/navigation';

import { RunView } from '@/components/RunView';
import { listAllFonts, readRun } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await readRun(id);
  if (!run) notFound();

  // Only a pairing session needs the catalog — it's what the locked-slot
  // picker points at, and it means swapping never costs a generation.
  const catalog = run.pairing ? await listAllFonts() : [];

  return <RunView initialRun={run} catalog={catalog} />;
}
