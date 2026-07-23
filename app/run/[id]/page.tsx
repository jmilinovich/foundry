import { notFound } from 'next/navigation';

import { RunView } from '@/components/RunView';
import { readRun } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await readRun(id);
  if (!run) notFound();
  return <RunView initialRun={run} />;
}
