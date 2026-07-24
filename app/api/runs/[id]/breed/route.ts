import { NextResponse } from 'next/server';
import { breedNext } from '@/lib/store';
import { MixfontError } from '@/lib/mixfont';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const survivorIds: string[] = Array.isArray(body.survivorIds) ? body.survivorIds : [];
  const key = req.headers.get('x-user-key') || undefined;

  try {
    const run = await breedNext(id, survivorIds, key);
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    return NextResponse.json({ run });
  } catch (err) {
    const status = err instanceof MixfontError ? err.status : 400;
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status });
  }
}
