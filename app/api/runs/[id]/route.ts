import { NextResponse } from 'next/server';
import { syncRun } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Polled by the client while a generation is in flight. Each call advances the
 * lifecycle: poll Mixfont, download and rehost anything that finished, persist.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // The poll advances generation, which needs the key; a viewer without one
  // still sees ready fonts, they just can't push pending jobs forward.
  const key = req.headers.get('x-user-key') || undefined;
  try {
    const run = await syncRun(id, key);
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 500 });
  }
}
