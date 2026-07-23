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
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

import {
  breed,
  hashSeed,
  mulberry32,
  nameFor,
  seedGeneration,
  toPrompt,
  type Genome,
} from './genome';
import {
  CREDITS,
  generateFromText,
  getGeneration,
  MixfontError,
  type Generation,
} from './mixfont';
import type { FontRecord, GlyphSetName, Lineage, Run } from './types';

const DATA = path.join(process.cwd(), '.data');
const RUNS = path.join(DATA, 'runs');
const FONTS = path.join(DATA, 'fonts');

async function ensureDirs() {
  await fs.mkdir(RUNS, { recursive: true });
  await fs.mkdir(FONTS, { recursive: true });
}

// --- per-run mutex -------------------------------------------------------
// The client polls while breeding may also be in flight. Without this, two
// concurrent read-modify-writes will drop one of them.

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

const runPath = (id: string) => path.join(RUNS, `${id}.json`);

export async function readRun(id: string): Promise<Run | null> {
  try {
    return JSON.parse(await fs.readFile(runPath(id), 'utf8')) as Run;
  } catch {
    return null;
  }
}

async function writeRun(run: Run): Promise<void> {
  await ensureDirs();
  // Write-then-rename so a crash mid-write can't truncate a run.
  const tmp = `${runPath(run.id)}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(run, null, 2));
  await fs.rename(tmp, runPath(run.id));
}

export async function listRuns(): Promise<
  { id: string; seedText: string; generation: number; createdAt: string; ready: number }[]
> {
  await ensureDirs();
  const files = (await fs.readdir(RUNS)).filter((f) => f.endsWith('.json'));
  const runs = await Promise.all(files.map((f) => readRun(f.replace(/\.json$/, ''))));
  return runs
    .filter((r): r is Run => r !== null)
    .map((r) => ({
      id: r.id,
      seedText: r.seedText,
      generation: r.generation,
      createdAt: r.createdAt,
      ready: r.fonts.filter((f) => f.status === 'ready').length,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const fontPath = (fontId: string, set: GlyphSetName = 'standard') =>
  path.join(FONTS, set === 'extended' ? `${fontId}-extended.ttf` : `${fontId}.ttf`);

export async function readFontFile(
  fontId: string,
  set: GlyphSetName = 'standard',
): Promise<Buffer | null> {
  // Guard against traversal — fontId lands in a filesystem path.
  if (!/^[a-zA-Z0-9-]+$/.test(fontId)) return null;
  try {
    return await fs.readFile(fontPath(fontId, set));
  } catch {
    return null;
  }
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
async function submitQueued(run: Run): Promise<Run> {
  const queued = run.fonts.filter((f) => f.status === 'queued');
  if (!queued.length) return run;

  await Promise.all(
    queued.map(async (f) => {
      try {
        const g = await generateFromText(f.prompt, 'standard');
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
}): Promise<Run> {
  const seed = input.seed ?? hashSeed(input.seedText + Date.now());
  const rng = mulberry32(seed);
  const genomes = seedGeneration(input.seedText, input.populationSize, rng);

  const run: Run = {
    id: randomUUID(),
    seedText: input.seedText,
    seed,
    specimenText: input.specimenText,
    populationSize: input.populationSize,
    mutationRate: input.mutationRate ?? 0.25,
    generation: 0,
    createdAt: new Date().toISOString(),
    fonts: genomes.map((g) => makeRecord(g, 0, 'seed', [])),
    creditsSpent: 0,
  };

  await submitQueued(run);
  await writeRun(run);
  return run;
}

/**
 * Poll every in-flight job, rehost anything that finished, persist.
 *
 * Driven by the client's polling GET rather than a background worker, so it
 * behaves identically in `next dev` and on a serverless deploy — no dangling
 * work that a function freeze can kill halfway through a download.
 */
export async function syncRun(id: string): Promise<Run | null> {
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
        g = await getGeneration(mixfontId);
      } catch (err) {
        // A transient poll failure shouldn't kill the job — leave it generating
        // and try again on the next tick.
        if (err instanceof MixfontError && err.status >= 500) return;
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

    const download = async (url: string, dest: string) => {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`TTF download failed: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await ensureDirs();
      await fs.writeFile(dest, buf);
    };

    const jobs: Promise<void>[] = [];

    for (const f of run.fonts) {
      if (f.status === 'generating' && f.mixfontId) {
        jobs.push(
          advance(f.mixfontId, f, async (g) => {
            await download(g.ttf_url!, fontPath(f.id));
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
            await download(g.ttf_url!, fontPath(f.id, 'extended'));
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
export async function promoteFont(runId: string, fontId: string): Promise<Run | null> {
  return withLock(runId, async () => {
    const run = await readRun(runId);
    if (!run) return null;

    const font = run.fonts.find((f) => f.id === fontId);
    if (!font) throw new Error('Font not found in this run.');
    if (font.status !== 'ready') throw new Error('Font is not ready yet.');
    if (font.extended && font.extended.status !== 'failed') return run;

    try {
      const g = await generateFromText(font.prompt, 'extended');
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
export async function breedNext(id: string, survivorIds: string[]): Promise<Run | null> {
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

    const parentIds = survivors.map((s) => s.id);
    const records = offspring.map((o, i) =>
      makeRecord(
        o.genome,
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
        await fs.writeFile(fontPath(records[i].id), buf);
        records[i].status = 'ready';
        records[i].progress = 100;
        records[i].name = parent.name;
      }
    }

    run.fonts.push(...records);
    run.generation = nextGen;

    await submitQueued(run);
    await writeRun(run);
    return run;
  });
}
