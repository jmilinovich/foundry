/**
 * Harvest the "world" image bank for the taste quiz.
 *
 * The quiz asks "which world would you live in?" over photographs of type in
 * the wild — shopfronts, transit signage, posters, book covers, letterpress.
 * A pick is a vote on the mood and era behind the image.
 *
 * Rights are the whole problem here, so this script does not take anyone's word
 * for a licence: it reads Wikimedia Commons' own `extmetadata` and keeps only
 * files whose licence the API itself reports as public domain or CC. Every kept
 * file carries its artist, licence name and source URL into the manifest, and
 * the credit is rendered on the page. Anything the API can't vouch for is
 * dropped, not guessed at.
 *
 *   node scripts/harvest-world.mjs          # download candidates
 *   node scripts/harvest-world.mjs --dry    # list what it would take
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'public', 'world');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'FoundryTypeQuiz/1.0 (https://github.com/jmilinovich; jrmilinovich@gmail.com)';
const DRY = process.argv.includes('--dry');

/**
 * Categories worth mining, each tagged with the typographic world it represents.
 * `theme` rides into the manifest so the tagging pass has a prior, and so the
 * quiz can avoid showing two near-identical images in one duel.
 */
const SOURCES = [
  { cat: 'Neon signs', theme: 'neon', take: 26 },
  { cat: 'Ghost signs', theme: 'ghost-sign', take: 22 },
  { cat: 'Shop signs', theme: 'shopfront', take: 26 },
  { cat: 'Enamel advertising signs', theme: 'enamel', take: 20 },
  { cat: 'Letterpress printing', theme: 'letterpress', take: 18 },
  { cat: 'Travel posters', theme: 'poster', take: 22 },
  { cat: 'Vintage travel posters in Boston Public Library', theme: 'poster', take: 22 },
  { cat: 'Rail transport posters of the United States', theme: 'poster', take: 18 },
  { cat: 'Art Nouveau posters', theme: 'poster-nouveau', take: 18 },
  { cat: 'Advertising posters', theme: 'poster-ad', take: 20 },
  { cat: 'Book covers', theme: 'book-cover', take: 24 },
  { cat: 'Title pages', theme: 'title-page', take: 18 },
  { cat: 'Signage', theme: 'wayfinding', take: 20 },
  { cat: 'Airport signs', theme: 'wayfinding', take: 16 },
  { cat: 'Street name signs', theme: 'wayfinding', take: 18 },
  { cat: 'Film posters', theme: 'film', take: 20 },
  { cat: 'Typography', theme: 'specimen', take: 16 },
  { cat: 'Type specimens', theme: 'specimen', take: 16 },
  { cat: 'Lettering', theme: 'lettering', take: 18 },
  { cat: 'Hand-painted signs', theme: 'lettering', take: 18 },
  { cat: 'Shop windows', theme: 'shopfront', take: 16 },
  { cat: 'Restaurant menus', theme: 'menu', take: 14 },
  { cat: 'Gravestones with inscriptions', theme: 'inscription', take: 14 },
];

/**
 * Licence gate. We keep only what Commons itself reports as PD or CC. The
 * `NoCommercial`/`NoDerivatives` strings never appear on Commons proper, but we
 * reject them explicitly so a future source swap can't quietly widen the gate.
 */
function licenceOk(meta) {
  const short = (meta.LicenseShortName?.value ?? '').toLowerCase();
  const terms = (meta.UsageTerms?.value ?? '').toLowerCase();
  const blob = `${short} ${terms}`;
  if (/noncommercial|no derivative|fair use|non-free/.test(blob)) return false;
  return /public domain|pd-|cc0|cc by|cc-by|creative commons/.test(blob);
}

const strip = (html) =>
  (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiGet(params) {
  const qs = new URLSearchParams({ format: 'json', ...params });
  const res = await fetch(`${API}?${qs}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`commons ${res.status}`);
  return res.json();
}

/** Pull file records for one category, licence-filtered. */
async function fromCategory({ cat, theme, take }) {
  const json = await apiGet({
    action: 'query',
    generator: 'categorymembers',
    gcmtitle: `Category:${cat}`,
    gcmtype: 'file',
    gcmlimit: String(Math.min(take * 3, 200)),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size|mime',
    iiurlwidth: '1000',
  });

  const pages = Object.values(json.query?.pages ?? {});
  const kept = [];

  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const meta = ii.extmetadata ?? {};
    if (!/^image\/(jpeg|png)$/.test(ii.mime ?? '')) continue;
    if ((ii.width ?? 0) < 600) continue;
    if (!licenceOk(meta)) continue;
    if (!ii.thumburl) continue;

    const title = p.title.replace(/^File:/, '');
    kept.push({
      id: title
        .replace(/\.[a-z0-9]+$/i, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60),
      theme,
      category: cat,
      title,
      thumb: ii.thumburl,
      descriptionUrl: ii.descriptionurl,
      licence: strip(meta.LicenseShortName?.value) || 'see source',
      licenceUrl: meta.LicenseUrl?.value ?? null,
      artist: strip(meta.Artist?.value).slice(0, 120) || 'unknown',
      credit: strip(meta.Credit?.value).slice(0, 120) || null,
      date: strip(meta.DateTimeOriginal?.value).slice(0, 40) || null,
      caption: strip(meta.ImageDescription?.value).slice(0, 200) || null,
    });
    if (kept.length >= take) break;
  }
  return kept;
}

async function run() {
  await fs.mkdir(OUT, { recursive: true });

  const all = [];
  const seen = new Set();
  for (const src of SOURCES) {
    try {
      const got = await fromCategory(src);
      for (const g of got) {
        if (seen.has(g.id)) continue;
        seen.add(g.id);
        all.push(g);
      }
      console.log(`${String(got.length).padStart(3)}  ${src.cat}`);
    } catch (err) {
      console.error(`FAIL ${src.cat}: ${err.message}`);
    }
    await sleep(250);
  }

  console.log(`\n${all.length} licence-cleared candidates`);
  if (DRY) {
    const byTheme = {};
    for (const a of all) byTheme[a.theme] = (byTheme[a.theme] ?? 0) + 1;
    console.log(byTheme);
    return;
  }

  // Download in bounded parallel.
  let ok = 0;
  const queue = [...all];
  const downloaded = [];
  const worker = async () => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      const ext = /\.png$/i.test(item.thumb) ? 'png' : 'jpg';
      const file = `${item.id}.${ext}`;
      const dest = path.join(OUT, file);
      try {
        await fs.access(dest);
        downloaded.push({ ...item, file });
        ok++;
        continue;
      } catch {
        /* not yet */
      }
      // Commons rate-limits hard on bursts. Be polite: few workers, a pause
      // between requests, and exponential backoff on 429 rather than a retry
      // storm. Re-running the script fills in whatever still failed.
      let saved = false;
      for (let attempt = 0; attempt < 4 && !saved; attempt++) {
        if (attempt) await sleep(1500 * 2 ** attempt);
        try {
          const res = await fetch(item.thumb, { headers: { 'User-Agent': UA } });
          if (res.status === 429) continue;
          if (!res.ok) throw new Error(String(res.status));
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length < 8000) throw new Error('too small');
          await fs.writeFile(dest, buf);
          downloaded.push({ ...item, file });
          ok++;
          saved = true;
        } catch (err) {
          if (attempt === 3) console.error(`  skip ${item.id}: ${err.message}`);
        }
      }
      await sleep(400);
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));

  downloaded.sort((a, b) => a.id.localeCompare(b.id));
  await fs.writeFile(
    path.join(OUT, 'candidates.json'),
    JSON.stringify(downloaded, null, 1),
  );
  console.log(`downloaded ${ok} → public/world/`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
