import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';

import type { GlyphSetName } from './types';

/**
 * Persistence, behind one small interface with two backends.
 *
 * Locally there's no Blob token, so it's the filesystem under .data/ — fast,
 * offline, and exactly what dev has always used. Deployed on Vercel the
 * filesystem is ephemeral, so a BLOB_READ_WRITE_TOKEN switches everything to
 * Vercel Blob. Same signatures either way, so the store above doesn't care.
 *
 * A run is stored at `runs/<id>.json`; a font at `fonts/<id>.ttf` (or
 * `<id>-extended.ttf`). Run ids are UUIDs, so the pathname is the capability —
 * unguessable, no accounts.
 */

const fontName = (id: string, set: GlyphSetName) =>
  set === 'extended' ? `${id}-extended.ttf` : `${id}.ttf`;

const safeId = (id: string) => /^[a-zA-Z0-9-]+$/.test(id);

interface Backend {
  getRun(id: string): Promise<string | null>;
  putRun(id: string, json: string): Promise<void>;
  allRunIds(): Promise<string[]>;
  getFont(id: string, set: GlyphSetName): Promise<Buffer | null>;
  putFont(id: string, set: GlyphSetName, buf: Buffer): Promise<void>;
}

// --- filesystem (local dev) ------------------------------------------------

function fsBackend(): Backend {
  const DATA = path.join(process.cwd(), '.data');
  const RUNS = path.join(DATA, 'runs');
  const FONTS = path.join(DATA, 'fonts');
  const ensure = async () => {
    await fs.mkdir(RUNS, { recursive: true });
    await fs.mkdir(FONTS, { recursive: true });
  };

  return {
    async getRun(id) {
      try {
        return await fs.readFile(path.join(RUNS, `${id}.json`), 'utf8');
      } catch {
        return null;
      }
    },
    async putRun(id, json) {
      await ensure();
      // Write-then-rename so a crash mid-write can't truncate a run.
      const dest = path.join(RUNS, `${id}.json`);
      const tmp = `${dest}.${process.pid}.tmp`;
      await fs.writeFile(tmp, json);
      await fs.rename(tmp, dest);
    },
    async allRunIds() {
      await ensure();
      return (await fs.readdir(RUNS))
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''));
    },
    async getFont(id, set) {
      if (!safeId(id)) return null;
      try {
        return await fs.readFile(path.join(FONTS, fontName(id, set)));
      } catch {
        return null;
      }
    },
    async putFont(id, set, buf) {
      await ensure();
      await fs.writeFile(path.join(FONTS, fontName(id, set)), buf);
    },
  };
}

// --- Vercel Blob (production) ----------------------------------------------

function blobBackend(token: string): Backend {
  // Deterministic pathnames (no random suffix), overwrite in place.
  const putOpts = {
    access: 'public' as const,
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
  };

  const readByPath = async (pathname: string): Promise<Response | null> => {
    const { head } = await import('@vercel/blob');
    try {
      const meta = await head(pathname, { token });
      return await fetch(meta.url, { cache: 'no-store' });
    } catch {
      // BlobNotFoundError (or any read failure) reads as "not there".
      return null;
    }
  };

  return {
    async getRun(id) {
      const res = await readByPath(`runs/${id}.json`);
      return res && res.ok ? await res.text() : null;
    },
    async putRun(id, json) {
      const { put } = await import('@vercel/blob');
      await put(`runs/${id}.json`, json, { ...putOpts, contentType: 'application/json' });
    },
    async allRunIds() {
      const { list } = await import('@vercel/blob');
      const ids: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: 'runs/', token, cursor, limit: 1000 });
        for (const b of page.blobs) {
          const m = b.pathname.match(/^runs\/(.+)\.json$/);
          if (m) ids.push(m[1]);
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return ids;
    },
    async getFont(id, set) {
      if (!safeId(id)) return null;
      const res = await readByPath(`fonts/${fontName(id, set)}`);
      if (!res || !res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    },
    async putFont(id, set, buf) {
      const { put } = await import('@vercel/blob');
      await put(`fonts/${fontName(id, set)}`, buf, { ...putOpts, contentType: 'font/ttf' });
    },
  };
}

let backend: Backend | null = null;

export function storage(): Backend {
  if (!backend) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    backend = token ? blobBackend(token) : fsBackend();
  }
  return backend;
}
