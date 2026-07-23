import { NextResponse } from 'next/server';
import { createRun, listRuns } from '@/lib/store';
import { MixfontError } from '@/lib/mixfont';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ runs: await listRuns() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const seedText = typeof body.seedText === 'string' ? body.seedText.slice(0, 400) : '';
  const specimenText =
    typeof body.specimenText === 'string' && body.specimenText.trim()
      ? body.specimenText.slice(0, 120)
      : 'Handgloves';
  // Cap the population: 12 individuals is 240 credits ($2.40) per generation.
  const populationSize = Math.max(2, Math.min(12, Number(body.populationSize) || 8));
  const mutationRate = Math.max(0, Math.min(1, Number(body.mutationRate) || 0.25));

  try {
    const run = await createRun({ seedText, specimenText, populationSize, mutationRate });
    return NextResponse.json({ run }, { status: 201 });
  } catch (err) {
    const status = err instanceof MixfontError ? err.status : 500;
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status });
  }
}
