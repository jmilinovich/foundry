import { NextResponse } from 'next/server';

import { MixfontError } from '@/lib/mixfont';
import { resolveKey } from '@/lib/serverKey';
import { retryFont } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Resubmit a font that failed upstream. Costs another 20 credits. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string; fontId: string }> }) {
  const { id, fontId } = await ctx.params;
  const { key, missing } = resolveKey(req);
  if (missing) {
    return NextResponse.json({ error: 'Add your Mixfont key to generate.' }, { status: 401 });
  }
  try {
    const run = await retryFont(id, fontId, key);
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    return NextResponse.json({ run });
  } catch (err) {
    const status = err instanceof MixfontError ? err.status : 400;
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status });
  }
}
