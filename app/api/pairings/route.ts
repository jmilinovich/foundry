import { NextResponse } from 'next/server';

import { STANCES, type Slot, type Stance } from '@/lib/genome';
import { MixfontError } from '@/lib/mixfont';
import { createPairingRun } from '@/lib/store';

export const dynamic = 'force-dynamic';

const isStance = (v: unknown): v is Stance => STANCES.some((s) => s.id === v);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const lockedRunId = String(body.lockedRunId ?? '');
  const lockedFontId = String(body.lockedFontId ?? '');
  if (!lockedRunId || !lockedFontId) {
    return NextResponse.json({ error: 'Pick a font to pair with.' }, { status: 400 });
  }

  const slot: Slot = body.slot === 'display' ? 'display' : 'text';
  const stance: Stance = isStance(body.stance) ? body.stance : 'classic';
  const specimenText =
    typeof body.specimenText === 'string' && body.specimenText.trim()
      ? body.specimenText.slice(0, 120)
      : 'Handgloves';
  const populationSize = Math.max(2, Math.min(12, Number(body.populationSize) || 6));

  try {
    const run = await createPairingRun({
      lockedRunId,
      lockedFontId,
      slot,
      stance,
      specimenText,
      populationSize,
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (err) {
    const status = err instanceof MixfontError ? err.status : 400;
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status });
  }
}
