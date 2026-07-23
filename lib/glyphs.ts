import { loadFont } from './morph';

/**
 * The characters a font actually encodes, read from its `cmap`.
 *
 * Worth doing properly rather than printing a hardcoded A–Z: the standard cut
 * is "72 glyphs" but which 72 varies, and the whole point of the character grid
 * is to show you what you really have before you commit to a face.
 */
export async function supportedChars(url: string): Promise<string[]> {
  const font = await loadFont(url);
  const map = (font.tables?.cmap as { glyphIndexMap?: Record<string, number> })?.glyphIndexMap;
  if (!map) return [];

  return Object.keys(map)
    .map(Number)
    .filter((cp) => cp > 32 && cp < 0x2e80 && Number.isFinite(cp))
    .sort((a, b) => a - b)
    .map((cp) => String.fromCodePoint(cp));
}

/** Sample copy for the text-size settings. Original, so it can ship anywhere. */
export const SAMPLE_PARAGRAPH =
  'A typeface earns its keep in the places nobody looks at closely. Not the masthead, ' +
  'where any competent drawing will pass, but the third paragraph of a long column, at ' +
  'sixteen pixels, on a screen held at arm’s length in bad light. That is where the ' +
  'width of the counters and the depth of the descenders stop being taste and start being ' +
  'infrastructure — and where a face that looked spectacular as a single word can quietly ' +
  'fall apart.';

export const PANGRAM = 'Pack my box with five dozen liquor jugs';
