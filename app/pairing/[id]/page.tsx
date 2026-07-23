import { notFound, redirect } from 'next/navigation';

import { PairingView } from '@/components/PairingView';
import { findFont, readRun } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function PairingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await readRun(id);
  if (!run?.pairing) notFound();

  const { pairing } = run;
  // Not settled yet — the session is still the right place to be.
  if (!pairing.chosenFontId) redirect(`/run/${id}`);

  const [locked, chosen] = await Promise.all([
    findFont(pairing.lockedRunId, pairing.lockedFontId),
    findFont(id, pairing.chosenFontId),
  ]);
  if (!locked || !chosen) notFound();

  // `slot` names which half the *candidates* filled, so the chosen font takes
  // that role and the locked font takes the other.
  const candidateIsDisplay = pairing.slot === 'display';

  return (
    <PairingView
      runId={id}
      pairing={pairing}
      display={candidateIsDisplay ? chosen : locked}
      text={candidateIsDisplay ? locked : chosen}
      displayRunId={candidateIsDisplay ? id : pairing.lockedRunId}
      textRunId={candidateIsDisplay ? pairing.lockedRunId : id}
      specimenText={run.specimenText}
    />
  );
}
