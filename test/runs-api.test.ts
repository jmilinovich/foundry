import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/runs/route';

/**
 * A run id IS the capability.
 *
 * There are no accounts. Knowing an id is enough to render someone's
 * population at /run/<id>, download their TTFs, and POST breed, retry and
 * promote against their run. So listing every run hands out every capability in
 * the system, which this route did for any request that simply left off the
 * `ids` parameter — `curl https://fonts.mili.dev/api/runs` returned the lot.
 *
 * Scoping has to be enforced by the route rather than opted into by the client.
 */
describe('GET /api/runs never enumerates the system', () => {
  const call = (qs: string) => GET(new Request(`http://localhost/api/runs${qs}`));

  it('refuses a request that asks for everything', async () => {
    const res = await call('');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.runs).toBeUndefined();
  });

  it('returns nothing for an empty id list rather than everything', async () => {
    const res = await call('?ids=');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ runs: [] });
  });

  it('never returns a run that was not asked for', async () => {
    const res = await call('?ids=not-a-real-run,also-not-real');
    expect(res.status).toBe(200);
    const { runs } = await res.json();
    expect(runs).toEqual([]);
  });

  it('only ever returns ids from the requested set', async () => {
    // Whatever happens to be on this machine, the response is a subset of the
    // request. This is the property that matters and it holds with no fixtures.
    const asked = ['a', 'b', 'c'];
    const { runs } = await (await call(`?ids=${asked.join(',')}`)).json();
    for (const r of runs) expect(asked).toContain(r.id);
  });
});
