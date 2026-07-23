# Foundry

Evolve a typeface by selection instead of by prompting.

Nobody can write the prompt for the font they want. Everybody can point at the one they like
better. So the interface is a selection loop: each round mints a population of real typefaces,
you keep the ones you like, and the next generation is bred from what survived.

Built on the [Mixfont API](https://www.mixfont.com/docs), which returns a genuine TTF — outlines,
`cmap`, kerning — for 20 credits ($0.20) in about 25 seconds.

---

## The idea

A font here is a **genome**, not a prompt string. Ten mostly-ordinal axes describe it, and the
genome renders *into* a Mixfont prompt:

| axis | example values |
|---|---|
| `category` | geometric sans → grotesque → humanist serif → didone → slab serif |
| `weight` | hairline → regular → black → ultra-heavy |
| `width` | ultra-condensed → normal → ultra-extended |
| `contrast` | monoline → moderate → extreme → reverse |
| `terminals` | blunt cut → sheared → flared → rounded → ball |
| `xheight`, `corner`, `texture`, `era`, `mood`, `useCase` | … |

Modelling it this way buys three things a freeform prompt can't:

- **Real inheritance.** Uniform per-gene crossover from the survivors.
- **Meaningful mutation.** Ordinal genes step ±1 along their own axis, so a geometric sans can
  become a neo-grotesque but won't become a didone in one step. Successive generations feel like
  refinement rather than a fresh roll of the dice.
- **A readable genotype.** Every card shows its genes, so you can see *why* a font looks like it
  does — and the lineage view diffs a child against its parent gene by gene.

Each generation carries one **elite** forward unchanged (so a round can never go backwards) and
seeds one **wildcard** from the whole space (so the population can't collapse onto a single look by
generation three).

The seed box is read literally, with no model in the loop: type `condensed brutalist slab serif`
and those genes are pinned across generation 0 while everything else explores. Type nothing and
the whole space is open.

## The lineage morph

Click **⟲ lineage** on any child to watch it emerge from its parent.

True outline interpolation between two unrelated typefaces is a research problem — the contours
don't correspond, the point counts differ, and the topology can differ outright (a single-storey
`a` against a double-storey one). Faking it tears.

So this doesn't interpolate outlines. It samples each glyph's outline into an even point cloud by
arc length and interpolates *that*: correspondence is glyph-to-glyph and index-to-index, which is
well-defined no matter how different the two letterforms are. Crisp fills at each end, a swarm in
between.

## Run it

```sh
npm install
cp .env.example .env.local     # then add your Mixfont key
npm run dev
```

Get a key and credits at [mixfont.com/console/keys](https://www.mixfont.com/console/keys).

**Cost.** A generation of 8 is $1.60; every generation after that is $1.40, because the elite is
cloned from disk rather than regenerated. Five rounds of 8 is about $7.

## Architecture

```
lib/genome.ts    the axes, prompt rendering, crossover, mutation, naming
lib/mixfont.ts   API client (server-only — the key never reaches the browser)
lib/store.ts     run persistence, the generation lifecycle, TTF rehosting
lib/morph.ts     outline flattening + arc-length resampling for the lineage view
```

Two decisions worth knowing about:

**Everything is rehosted immediately.** Mixfont deletes generated TTFs within 24 hours, so the
moment a job succeeds the file is downloaded to `.data/fonts/` and served from `/api/fonts/[id]`.
A run that isn't rehosted dies overnight, and the whole point is that the collection outlives the
session.

**The lifecycle is driven by the client's polling `GET`,** not a background worker — poll Mixfont,
download what finished, persist, return. That behaves identically in `next dev` and on a
serverless deploy, with no dangling work for a function freeze to kill halfway through a download.

State is flat JSON in `.data/` (gitignored). There's no database because a run is a few hundred KB
and is only ever touched by one person on one machine.
