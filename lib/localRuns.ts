'use client';

/**
 * The list of runs *this browser* has created.
 *
 * There are no accounts — a run is a capability URL. So "your runs" can't come
 * from the server without leaking everyone's; it's kept here, in localStorage,
 * and the home page asks the server only for summaries of these specific ids.
 */
const KEY = 'foundry.runs.v1';

export type LocalRun = { id: string; label: string; at: number; kind: 'run' | 'pair' };

function read(): LocalRun[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

function write(runs: LocalRun[]) {
  localStorage.setItem(KEY, JSON.stringify(runs.slice(0, 60)));
}

export function rememberRun(id: string, label: string, kind: LocalRun['kind'] = 'run') {
  const runs = read().filter((r) => r.id !== id);
  runs.unshift({ id, label, at: Date.now(), kind });
  write(runs);
}

export function listLocalRuns(): LocalRun[] {
  return read().sort((a, b) => b.at - a.at);
}

export function forgetRun(id: string) {
  write(read().filter((r) => r.id !== id));
}
