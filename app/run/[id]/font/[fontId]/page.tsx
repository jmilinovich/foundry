import { notFound } from 'next/navigation';

import { FontDetail } from '@/components/FontDetail';
import { readRun } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function FontPage({
  params,
}: {
  params: Promise<{ id: string; fontId: string }>;
}) {
  const { id, fontId } = await params;
  const run = await readRun(id);
  if (!run || !run.fonts.some((f) => f.id === fontId)) notFound();
  return <FontDetail initialRun={run} fontId={fontId} />;
}
