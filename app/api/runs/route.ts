import { NextResponse } from 'next/server';
import { createRun, listRuns } from '@/lib/store';
import { MixfontError } from '@/lib/mixfont';
import { resolveKey } from '@/lib/serverKey';

export const dynamic = 'force-dynamic';

/**
 * Summaries for runs the caller already knows the ids of.
 *
 * A run id IS the capability: there are no accounts, so `/run/<id>` renders the
 * population, `/api/fonts/<fontId>` serves the TTFs, and breed/retry/promote
 * carry no ownership check beyond knowing the id. Listing every run therefore
 * hands out every capability in the system, which this route used to do for any
 * request that simply omitted `?ids=`.
 *
 * Scoping is now enforced here rather than left to the client to opt into. The
 * only caller (RecentRuns) always passes the ids it holds in localStorage.
 */
export async function GET(req: Request) {
  const ids = new URL(req.url).searchParams.get('ids');
  if (ids === null) {
    return NextResponse.json({ error: 'Pass ?ids= the runs you already hold.' }, { status: 400 });
  }

  const set = new Set(ids.split(',').filter(Boolean));
  if (set.size === 0) return NextResponse.json({ runs: [] });

  const all = await listRuns();
  return NextResponse.json({ runs: all.filter((r) => set.has(r.id)) });
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
