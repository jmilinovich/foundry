import { readFontFile } from '@/lib/store';

/**
 * Serves a rehosted TTF. This is the `src` behind every @font-face on the page,
 * and the target of the download button.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const buf = await readFontFile(id);
  if (!buf) return new Response('Not found', { status: 404 });

  const download = new URL(req.url).searchParams.get('download');
  const headers: Record<string, string> = {
    'content-type': 'font/ttf',
    'content-length': String(buf.length),
    // Font bytes for a given id never change, so this is safe to pin hard.
    'cache-control': 'public, max-age=31536000, immutable',
  };
  if (download) {
    headers['content-disposition'] =
      `attachment; filename="${download.replace(/[^a-zA-Z0-9 _.-]/g, '')}.ttf"`;
  }
  return new Response(new Uint8Array(buf), { headers });
}
