import { notFound } from 'next/navigation';

import { RunView } from '@/components/RunView';
import { findFont, listAllFonts, readRun } from '@/lib/store';
import type { FontRef } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await readRun(id);
  if (!run) notFound();

  // Only a pairing session needs the catalog — it's what the locked-slot
  // picker points at, and it means swapping never costs a generation.
  const catalog = run.pairing ? await listAllFonts() : [];

  /**
   * The locked face is resolved here rather than looked up inside the catalog.
   *
   * The catalog is every font in every stored run, so a house font locked from
   * /collection/<slug> is not in it and never can be — findFont is the only
   * thing that knows how to resolve one. RunView used to search the catalog by
   * id alone, which meant a paired house font silently rendered as no pair at
   * all, after the visitor had paid for the generation.
   */
  let locked: FontRef | null = null;
  if (run.pairing) {
    const rec = await findFont(run.pairing.lockedRunId, run.pairing.lockedFontId);
    if (rec) {
      locked = {
        id: rec.id,
        runId: run.pairing.lockedRunId,
        name: rec.name,
        generation: rec.generation,
        genome: rec.genome,
      };
    }
  }

  return <RunView initialRun={run} catalog={catalog} locked={locked} />;
}
