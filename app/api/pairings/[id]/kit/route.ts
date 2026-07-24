import { buildKit, gatherKitEntry } from '@/lib/kit';
import { readRun } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * The whole pair as one type kit: both TTFs (best available cut) + wired CSS +
 * README specimen + provenance notice, zipped.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = await readRun(id);
  const chosenFontId = run?.pairing?.chosenFontId;
  if (!run?.pairing || !chosenFontId) {
    return new Response('Pairing not settled', { status: 404 });
  }

  const p = run.pairing;
  // `slot` names which half the candidates filled, so the chosen font takes that
  // role and the locked font takes the other — the same mapping as the page.
  const candidateIsDisplay = p.slot === 'display';
  const [display, text] = await Promise.all([
    candidateIsDisplay
      ? gatherKitEntry(id, chosenFontId, 'display')
      : gatherKitEntry(p.lockedRunId, p.lockedFontId, 'display'),
    candidateIsDisplay
      ? gatherKitEntry(p.lockedRunId, p.lockedFontId, 'text')
      : gatherKitEntry(id, chosenFontId, 'text'),
  ]);

  if (!display || !text) return new Response('Fonts not ready', { status: 404 });

  const title = `${display.record.name} + ${text.record.name}`;
  const { zip, filename } = await buildKit(title, [display, text]);

  return new Response(new Uint8Array(zip), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${filename}"`,
      'content-length': String(zip.length),
      'cache-control': 'no-store',
    },
  });
}
