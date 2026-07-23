import { readFontFile } from '@/lib/store';

/**
 * Serves a rehosted TTF. This is the `src` behind every @font-face on the page,
 * and the target of the download button.
 *
 * `?set=extended` serves the 319-glyph cut, when one has been minted.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const params = new URL(req.url).searchParams;
  const set = params.get('set') === 'extended' ? 'extended' : 'standard';

  const buf = await readFontFile(id, set);
  if (!buf) return new Response('Not found', { status: 404 });

  const download = params.get('download');
  const headers: Record<string, string> = {
    'content-type': 'font/ttf',
    'content-length': String(buf.length),
    // Font bytes for a given id and set never change, so this is safe to pin hard.
    'cache-control': 'public, max-age=31536000, immutable',
  };
  if (download) {
    const stem = download.replace(/[^a-zA-Z0-9 _.-]/g, '');
    headers['content-disposition'] =
      `attachment; filename="${stem}${set === 'extended' ? ' Extended' : ''}.ttf"`;
  }
  return new Response(new Uint8Array(buf), { headers });
}
