import { HomeFunnel } from '@/components/HomeFunnel';
import { RecentRuns } from '@/components/RecentRuns';
import { SiteFooter } from '@/components/SiteFooter';
import { SpecimenBand } from '@/components/SpecimenBand';
import { loadAtlas } from '@/lib/atlas';
import type { AtlasEntry } from '@/lib/taste';

export const dynamic = 'force-dynamic';

/**
 * Four faces, drawn from across the library rather than at random.
 *
 * A random four can easily be four grotesques, which would argue the opposite
 * of the point. Taking one from each quarter of the manifest guarantees the
 * band shows range — and since the manifest is sorted by slug, that quarters
 * the categories too. Rotates per request, so a reload proves there are more.
 */
async function pickFaces(count = 4): Promise<AtlasEntry[]> {
  const atlas = await loadAtlas();
  if (atlas.length === 0) return [];
  const band = Math.floor(atlas.length / count);
  return Array.from({ length: count }, (_, i) => {
    const start = i * band;
    return atlas[start + Math.floor(Math.random() * Math.min(band, atlas.length - start))];
  }).filter(Boolean);
}

export default async function Home() {
  const faces = await pickFaces();

  return (
    <div className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-16 sm:px-6 sm:py-24">
      {/* The cold-start masthead — Fraunces carries the identity until a champion
          font exists to supersede it. */}
      <h1
        className="font-[family-name:var(--font-display)] text-[clamp(3rem,11vw,7rem)] font-medium leading-[0.9] tracking-[-0.03em]"
      >
        Foundry
      </h1>
      <p className="mt-6 max-w-lg text-lg leading-snug text-ink-dim">
        Nobody can write the prompt for the font they want. Everybody can point at the one they like
        better.
      </p>
      {/* One line, not four. The explainer used to spend seventy words on the
          machinery — breeding, generations, survival — before anyone was
          allowed to want it. That belongs on /about; this is the payoff. */}
      <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-dim">
        Point at enough of them and Foundry reads your taste back to you, then names twelve
        typefaces that fit it, all free to download.
      </p>

      {/* The evidence, before the ask. */}
      <SpecimenBand faces={faces} />

      <div className="mt-12">
        <HomeFunnel />
      </div>

      {/* Recent runs are scoped to this browser — a capability-URL model, no accounts. */}
      <RecentRuns />

      <SiteFooter />
    </div>
  );
}
