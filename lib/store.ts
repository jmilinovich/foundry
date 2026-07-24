/**
 * Run persistence and the generation lifecycle.
 *
 * Mixfont deletes generated TTFs within 24 hours, so the moment a job succeeds
 * we pull the file down and rehost it ourselves. A run that isn't rehosted is a
 * run that silently dies overnight — the whole point of Foundry is that the
 * collection outlives the session.
 *
 * State lives in flat JSON on disk. There is no database because there doesn't
 * need to be one: a run is a few hundred KB and is only ever touched by one
 * person on one machine.
 */

import 'server-only';
import { randomUUID } from 'crypto';

import {
  breed,
  constrainForText,
  hashSeed,
  mulberry32,
  nameFor,
  pairingGeneration,
  seedGeneration,
  seedGenerationFromProfile,
  toPrompt,
  type Genome,
  type Slot,
  type Stance,
} from './genome';
import type { TasteSeed } from './taste';
import {
  CREDITS,
  generateFromText,
  getGeneration,
  MixfontError,
  type Generation,
} from './mixfont';
import { storage } from './storage';
import type { FontRecord, FontRef, GlyphSetName, Lineage, Run } from './types';

// --- per-run mutex -------------------------------------------------------
// The client polls while breeding may also be in flight. Within one process
// this serialises read-modify-write so concurrent updates don't drop each
// other. (On Blob across serverless instances it's last-write-wins — acceptable
// for a single-player tool; the client serialises breed vs. poll anyway.)

const locks = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(
    key,
    next.catch(() => {}),
  );
  return next;
}

// --- io ------------------------------------------------------------------

export async function readRun(id: string): Promise<Run | null> {
  const raw = await storage().getRun(id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Run;
  } catch {
    return null;
  }
}

async function writeRun(run: Run): Promise<void> {
  await storage().putRun(run.id, JSON.stringify(run, null, 2));
}

async function loadAllRuns(): Promise<Run[]> {
  const ids = await storage().allRunIds();
  const runs = await Promise.all(ids.map((id) => readRun(id)));
  return runs.filter((r): r is Run => r !== null);
}

export async function listRuns(): Promise<
  {
    id: string;
    seedText: string;
    generation: number;
    createdAt: string;
    ready: number;
    /** A pairing that's been settled links to its pair, not back to the hunt. */
    settledPair: boolean;
  }[]
> {
  const runs = await loadAllRuns();
  return runs
    .map((r) => ({
      id: r.id,
      seedText: r.seedText,
      generation: r.generation,
      createdAt: r.createdAt,
      ready: r.fonts.filter((f) => f.status === 'ready').length,
      settledPair: !!r.pairing?.chosenFontId,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Every ready font across every run — the pool the locked slot can point at. */
export async function listAllFonts(): Promise<FontRef[]> {
  const runs = await loadAllRuns();
  return runs.flatMap((r) =>
    r.fonts
      .filter((f) => f.status === 'ready')
      .map((f) => ({
        id: f.id,
        runId: r.id,
        name: f.name,
        generation: f.generation,
        genome: f.genome,
      })),
  );
}

/** Resolve a font that may live in a different run than the one you're viewing. */
export async function findFont(runId: string, fontId: string): Promise<FontRecord | null> {
  const run = await readRun(runId);
  return run?.fonts.find((f) => f.id === fontId) ?? null;
}

export async function readFontFile(
  fontId: string,
  set: GlyphSetName = 'standard',
): Promise<Buffer | null> {
  return storage().getFont(fontId, set);
}

// --- lifecycle -----------------------------------------------------------

function makeRecord(
  genome: Genome,
  generation: number,
  lineage: Lineage,
  parents: string[],
): FontRecord {
  const id = randomUUID();
  return {
    id,
    // Placeholder until Mixfont returns its own name — cards shouldn't be
    // nameless for the 25 seconds a generation takes.
    name: nameFor(genome, id),
    genome,
    prompt: toPrompt(genome),
    generation,
    lineage,
    parents,
    mixfontId: null,
    status: 'queued',
    progress: 0,
    survived: false,
    createdAt: new Date().toISOString(),
  };
}

/** Submit every queued individual to Mixfont, in parallel. */
async function submitQueued(run: Run, key?: string): Promise<Run> {
  const queued = run.fonts.filter((f) => f.status === 'queued');
  if (!queued.length) return run;

  await Promise.all(
    queued.map(async (f) => {
      try {
        const g = await generateFromText(f.prompt, 'standard', key);
        f.mixfontId = g.id;
        f.status = 'generating';
        f.progress = g.progress_percent ?? 0;
        run.creditsSpent += CREDITS.standard;
      } catch (err) {
        f.status = 'failed';
        f.error = err instanceof MixfontError ? err.message : String(err);
      }
    }),
  );
  return run;
}

export async function createRun(input: {
  seedText: string;
  specimenText: string;
  populationSize: number;
  mutationRate?: number;
  seed?: number;
  /** From the taste quiz — biases + pins that override the typed-seed path. */
  tasteSeed?: TasteSeed;
  /** The plain-language read of the profile, shown as the run's label. */
  tasteSummary?: string;
  /** The visitor's Mixfont key, if hosted. */
  key?: string;
}): Promise<Run> {
  const seed = input.seed ?? hashSeed((input.tasteSummary ?? input.seedText) + Date.now());
  const rng = mulberry32(seed);
  const genomes = input.tasteSeed
    ? seedGenerationFromProfile(input.tasteSeed, input.populationSize, rng)
    : seedGeneration(input.seedText, input.populationSize, rng);

  const run: Run = {
    id: randomUUID(),
    seedText: input.tasteSummary || input.seedText,
    seed,
    specimenText: input.specimenText,
    populationSize: input.populationSize,
    mutationRate: input.mutationRate ?? 0.25,
    generation: 0,
    createdAt: new Date().toISOString(),
    fonts: genomes.map((g) => makeRecord(g, 0, 'seed', [])),
    creditsSpent: 0,
  };

  await submitQueued(run, input.key);
  await writeRun(run);
  return run;
}

/**
 * Start a pairing session: lock one font, hunt for the other half.
 *
 * It's an ordinary Run with a `pairing` block, so the whole existing machine —
 * polling, rehosting, elites, wildcards, breeding — applies unchanged. Only two
 * things differ: generation 0 is derived from the locked genome under a stance
 * rather than sampled freely, and if the candidates are filling the text slot
 * they're held inside a legible subspace.
 */
export async function createPairingRun(input: {
  lockedRunId: string;
  lockedFontId: string;
  slot: Slot;
  stance: Stance;
  specimenText: string;
  populationSize: number;
  key?: string;
}): Promise<Run> {
  const locked = await findFont(input.lockedRunId, input.lockedFontId);
  if (!locked) throw new Error('Locked font not found.');
  if (locked.status !== 'ready') throw new Error('Locked font is not ready yet.');

  const seed = hashSeed(`${input.lockedFontId}:${input.stance}:${Date.now()}`);
  const rng = mulberry32(seed);
  const genomes = pairingGeneration(
    locked.genome,
    input.slot,
    input.stance,
    input.populationSize,
    rng,
  );

  const run: Run = {
    id: randomUUID(),
    seedText: `${input.stance} partner for ${locked.name}`,
    seed,
    specimenText: input.specimenText,
    populationSize: input.populationSize,
    mutationRate: 0.22,
    generation: 0,
    createdAt: new Date().toISOString(),
    fonts: genomes.map((g) => makeRecord(g, 0, 'seed', [])),
    creditsSpent: 0,
    pairing: {
      slot: input.slot,
      stance: input.stance,
      lockedFontId: input.lockedFontId,
      lockedRunId: input.lockedRunId,
    },
  };

  await submitQueued(run, input.key);
  await writeRun(run);
  return run;
}

/**
 * Resubmit a font that failed upstream.
 *
 * Mixfont does occasionally return a bare "an error occurred while generating
 * this font" — observed in the wild, roughly one in ten. Without this the
 * individual is simply dead and its 20 credits are gone, which leaves a hole in
 * a generation you can't fill.
 */
export async function retryFont(runId: string, fontId: string, key?: string): Promise<Run | null> {
  return withLock(runId, async () => {
    const run = await readRun(runId);
    if (!run) return null;

    const font = run.fonts.find((f) => f.id === fontId);
    if (!font) throw new Error('Font not found in this run.');
    if (font.status !== 'failed') return run;

    font.status = 'queued';
    font.progress = 0;
    font.mixfontId = null;
    delete font.error;

    await submitQueued(run, key);
    await writeRun(run);
    return run;
  });
}

/** Re-point the locked slot at a different font. Costs nothing — no new fonts. */
export async function swapLocked(
  runId: string,
  lockedRunId: string,
  lockedFontId: string,
): Promise<Run | null> {
  return withLock(runId, async () => {
    const run = await readRun(runId);
    if (!run?.pairing) return null;
    const locked = await findFont(lockedRunId, lockedFontId);
    if (!locked || locked.status !== 'ready') throw new Error('That font is not available.');
    run.pairing.lockedFontId = lockedFontId;
    run.pairing.lockedRunId = lockedRunId;
    await writeRun(run);
    return run;
  });
}

/** Settle on a partner. This is what turns a session into a pair. */
export async function choosePartner(runId: string, fontId: string): Promise<Run | null> {
  return withLock(runId, async () => {
    const run = await readRun(runId);
    if (!run?.pairing) return null;
    const font = run.fonts.find((f) => f.id === fontId);
    if (!font || font.status !== 'ready') throw new Error('That font is not ready.');
    run.pairing.chosenFontId = fontId;
    font.survived = true;
    await writeRun(run);
    return run;
  });
}

/**
 * Poll every in-flight job, rehost anything that finished, persist.
 *
 * Driven by the client's polling GET rather than a background worker, so it
 * behaves identically in `next dev` and on a serverless deploy — no dangling
 * work that a function freeze can kill halfway through a download.
 */
export async function syncRun(id: string, key?: string): Promise<Run | null> {
  return withLock(id, async () => {
    const run = await readRun(id);
    if (!run) return null;

    /**
     * Advance one in-flight job: poll it, and on success pull the TTF down to
     * our own disk before the 24h expiry.
     *
     * `target` is the slice of state to write progress into — the font record
     * itself for the standard cut, or its `extended` block for the promoted
     * one. Both cuts have identical lifecycles, so they share this.
     */
    const advance = async (
      mixfontId: string,
      target: { status: FontRecord['status']; progress: number; error?: string },
      onSuccess: (g: Generation) => Promise<void>,
    ) => {
      let g: Generation;
      try {
        g = await getGeneration(mixfontId, key);
      } catch (err) {
        // A transient poll failure shouldn't kill the job — leave it generating
        // and try again on the next tick. A missing/invalid key (401) is treated
        // the same: someone viewing a shared run mid-generation without a key
        // just doesn't advance it, rather than having their fonts marked failed.
        if (err instanceof MixfontError && (err.status >= 500 || err.status === 401)) return;
        target.status = 'failed';
        target.error = err instanceof MixfontError ? err.message : String(err);
        return;
      }

      target.progress = g.progress_percent ?? target.progress;

      if (g.status === 'succeeded' && g.ttf_url) {
        try {
          await onSuccess(g);
          target.status = 'ready';
          target.progress = 100;
        } catch (err) {
          target.status = 'failed';
          target.error = `Generated, but rehosting failed: ${String(err)}`;
        }
      } else if (g.status === 'failed' || g.status === 'cancelled') {
        target.status = 'failed';
        target.error = g.error ?? `Generation ${g.status}`;
      }
    };

    const rehost = async (url: string, fontId: string, set: GlyphSetName) => {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`TTF download failed: ${res.status}`);
      await storage().putFont(fontId, set, Buffer.from(await res.arrayBuffer()));
    };

    const jobs: Promise<void>[] = [];

    for (const f of run.fonts) {
      if (f.status === 'generating' && f.mixfontId) {
        jobs.push(
          advance(f.mixfontId, f, async (g) => {
            await rehost(g.ttf_url!, f.id, 'standard');
            // Mixfont's own names are good ("Ferro Nocturne Grotesk"); prefer
            // them over our placeholder once we have one.
            if (g.name && g.name !== 'Mixfont Generation') f.name = g.name;
          }),
        );
      }
      const extId = f.extended?.mixfontId;
      if (f.extended && f.extended.status === 'generating' && extId) {
        const ext = f.extended;
        jobs.push(
          advance(extId, ext, async (g) => {
            await rehost(g.ttf_url!, f.id, 'extended');
          }),
        );
      }
    }

    if (!jobs.length) return run;
    await Promise.all(jobs);

    await writeRun(run);
    return run;
  });
}

/**
 * Re-mint a font at the 319-glyph extended set.
 *
 * Sends the same prompt, so this is a re-roll rather than a widening of the
 * existing outlines — the extended cut is a sibling of the standard one, not
 * a superset of it. Worth knowing before you promote something you love.
 */
export async function promoteFont(runId: string, fontId: string, key?: string): Promise<Run | null> {
  return withLock(runId, async () => {
    const run = await readRun(runId);
    if (!run) return null;

    const font = run.fonts.find((f) => f.id === fontId);
    if (!font) throw new Error('Font not found in this run.');
    if (font.status !== 'ready') throw new Error('Font is not ready yet.');
    if (font.extended && font.extended.status !== 'failed') return run;

    try {
      const g = await generateFromText(font.prompt, 'extended', key);
      font.extended = { mixfontId: g.id, status: 'generating', progress: g.progress_percent ?? 0 };
      run.creditsSpent += CREDITS.extended;
    } catch (err) {
      font.extended = {
        mixfontId: null,
        status: 'failed',
        progress: 0,
        error: err instanceof MixfontError ? err.message : String(err),
      };
    }

    await writeRun(run);
    return run;
  });
}

/** Take the picked survivors, breed the next generation, submit it. */
export async function breedNext(
  id: string,
  survivorIds: string[],
  key?: string,
): Promise<Run | null> {
  return withLock(id, async () => {
    const run = await readRun(id);
    if (!run) return null;

    const survivors = survivorIds
      .map((sid) => run.fonts.find((f) => f.id === sid))
      .filter((f): f is FontRecord => !!f && f.status === 'ready');

    if (!survivors.length) {
      throw new Error('Pick at least one font to breed from.');
    }

    for (const s of survivors) s.survived = true;

    // Re-seed the RNG from the run seed plus the generation number, so the same
    // picks always produce the same children.
    const rng = mulberry32(hashSeed(`${run.seed}:${run.generation}:${survivorIds.join(',')}`));
    const nextGen = run.generation + 1;

    const offspring = breed(
      survivors.map((s) => s.genome),
      run.populationSize,
      rng,
      { mutationRate: run.mutationRate, elites: Math.min(1, survivors.length), wildcards: 1 },
    );

    // A pairing run hunting for a body face keeps its whole population inside
    // the legible subspace — including children and the wildcard, or the
    // constraint would leak away after generation 0.
    const constrain = run.pairing?.slot === 'text';

    const parentIds = survivors.map((s) => s.id);
    const records = offspring.map((o, i) =>
      makeRecord(
        constrain ? constrainForText(o.genome) : o.genome,
        nextGen,
        o.kind,
        // An elite is literally its parent carried forward; a wildcard has none.
        o.kind === 'elite' ? [parentIds[i]] : o.kind === 'wildcard' ? [] : parentIds,
      ),
    );

    // An elite is the same genome as its parent, so its file already exists —
    // clone it instead of paying 20 credits to regenerate an identical font.
    for (let i = 0; i < records.length; i++) {
      if (records[i].lineage !== 'elite') continue;
      const parent = survivors[i];
      const buf = await readFontFile(parent.id);
      if (buf) {
        await storage().putFont(records[i].id, 'standard', buf);
        records[i].status = 'ready';
        records[i].progress = 100;
        records[i].name = parent.name;
      }
    }

    run.fonts.push(...records);
    run.generation = nextGen;

    await submitQueued(run, key);
    await writeRun(run);
    return run;
  });
}
