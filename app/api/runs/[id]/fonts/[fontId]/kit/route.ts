import { buildKit, gatherKitEntry } from '@/lib/kit';

export const dynamic = 'force-dynamic';

/** A single font as a kit: its TTF (best cut) + CSS + README + notice, zipped. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; fontId: string }> }) {
  const { id, fontId } = await ctx.params;
  const entry = await gatherKitEntry(id, fontId, 'font');
  if (!entry) return new Response('Font not ready', { status: 404 });

  const { zip, filename } = await buildKit(entry.record.name, [entry]);
  return new Response(new Uint8Array(zip), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${filename}"`,
      'content-length': String(zip.length),
      'cache-control': 'no-store',
    },
  });
}
