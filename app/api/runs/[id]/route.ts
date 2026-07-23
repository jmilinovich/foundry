import { NextResponse } from 'next/server';
import { syncRun } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Polled by the client while a generation is in flight. Each call advances the
 * lifecycle: poll Mixfont, download and rehost anything that finished, persist.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const run = await syncRun(id);
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 500 });
  }
}
