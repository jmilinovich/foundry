import { NextResponse } from 'next/server';

import { choosePartner, swapLocked } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Mutate a pairing session without spending anything:
 *   { action: 'swap',   lockedRunId, lockedFontId }  re-point the locked slot
 *   { action: 'choose', fontId }                     settle on a partner
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  try {
    if (body.action === 'swap') {
      const run = await swapLocked(id, String(body.lockedRunId), String(body.lockedFontId));
      if (!run) return NextResponse.json({ error: 'Pairing run not found' }, { status: 404 });
      return NextResponse.json({ run });
    }

    if (body.action === 'choose') {
      const run = await choosePartner(id, String(body.fontId));
      if (!run) return NextResponse.json({ error: 'Pairing run not found' }, { status: 404 });
      return NextResponse.json({ run });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 400 });
  }
}
