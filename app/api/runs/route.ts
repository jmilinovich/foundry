import { NextResponse } from 'next/server';
import { createRun, listRuns } from '@/lib/store';
import { MixfontError } from '@/lib/mixfont';
import { resolveKey } from '@/lib/serverKey';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ids = new URL(req.url).searchParams.get('ids');
  const all = await listRuns();
  // The home page passes the ids it holds in localStorage; scope to those so a
  // capability-URL run is never listed for a browser that didn't create it.
  if (ids !== null) {
    const set = new Set(ids.split(',').filter(Boolean));
    return NextResponse.json({ runs: all.filter((r) => set.has(r.id)) });
  }
  return NextResponse.json({ runs: all });
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

  // The quiz posts a pre-computed seed; trust its shape loosely and let the
  // sampler fall back to uniform on anything malformed.
  const tasteSeed =
    body.tasteSeed && typeof body.tasteSeed === 'object'
      ? {
          weights: body.tasteSeed.weights ?? {},
          pinned: body.tasteSeed.pinned ?? {},
          moods: Array.isArray(body.tasteSeed.moods) ? body.tasteSeed.moods : ['editorial', 'warm'],
        }
      : undefined;
  const tasteSummary = typeof body.tasteSummary === 'string' ? body.tasteSummary.slice(0, 120) : undefined;

  const { key, missing } = resolveKey(req);
  if (missing) {
    return NextResponse.json({ error: 'Add your Mixfont key to generate.' }, { status: 401 });
  }

  try {
    const run = await createRun({
      seedText,
      specimenText,
      populationSize,
      mutationRate,
      tasteSeed,
      tasteSummary,
      key,
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (err) {
    const status = err instanceof MixfontError ? err.status : 500;
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status });
  }
}
