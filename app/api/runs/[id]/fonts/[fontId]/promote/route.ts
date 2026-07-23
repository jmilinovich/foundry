import { NextResponse } from 'next/server';
import { promoteFont } from '@/lib/store';
import { MixfontError } from '@/lib/mixfont';

export const dynamic = 'force-dynamic';

/** Re-mint this font at the 319-glyph extended set (50 credits). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string; fontId: string }> }) {
  const { id, fontId } = await ctx.params;
  try {
    const run = await promoteFont(id, fontId);
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    return NextResponse.json({ run });
  } catch (err) {
    const status = err instanceof MixfontError ? err.status : 400;
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status });
  }
}
