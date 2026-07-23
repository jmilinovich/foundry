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

## The specimen page

Clicking a card selects it for breeding, so looking at a font properly gets its own route —
`/run/[id]/font/[fontId]`, linkable, not a modal.

Waterfall, character grid, text sizes at 18/16/14, pangram, numerals, a tabular-figure column
test, and live tracking/leading. `on paper` inverts the whole page, because a face reads
differently as ink on paper than as paper on ink.

The character grid reads the font's actual `cmap` rather than printing a hardcoded A–Z, which is
how you find out that the "72-glyph standard set" is really 77 for these, and that it carries
straight *and* curly quotes but no accents at all.

**Promote to 319** re-mints a face at the extended glyph set and keeps both cuts side by side. Note
it's a re-roll of the same prompt, not a widening of the existing outlines — the extended cut is a
sibling of the standard one, not a superset.

The **poster** is one editorial template with a single-font mode and a pair mode, exported as PNG
at 2×. Its fonts are inlined as base64 data URIs rather than loaded through the FontFace API: a
runtime FontFace never lands in `document.styleSheets`, which is exactly where html-to-image looks,
so the obvious approach exports a poster set in a fallback face and you don't find out until you
open the file.

## Pairing

A display face and a text face, hunted the same way — by selection.

Pick **pair this** on any font and generation 0 is *derived* from that font's genome rather than
sampled freely, under one of three stances:

| stance | what it does |
|---|---|
| `classic` | contrast the skeleton (category, weight, stroke contrast), harmonize the voice (width, x-height, era, mood) |
| `superfamily` | keep everything close — quiet and unified |
| `tension` | push every axis apart but the x-height |

From a locked `slab serif · light · condensed · high contrast · small x-ht · eroded`, the classic
stance produces humanist and neo-grotesque *sans* at monoline-to-low contrast, narrow, normal
x-height — it jumps the serif divide while keeping the width and voice.

Candidates for the **text slot are held inside a legible subspace**: no eroded, stencil-cut or
pixel-stepped surfaces, no hairlines or ultra-condensed widths, no extreme or reverse contrast.
Those genes are gorgeous at 96px and unreadable at 16, so allowing them just wastes generations.
The constraint applies to children and wildcards too, or it would leak away after generation 0.

Each candidate renders as a **mini article block** — headline in the locked face, paragraph in the
candidate — because that's the actual job the two fonts will do. The locked face is a dropdown you
can re-point at any font in the project mid-session; it costs nothing, since the fonts are already
on disk.

Settling on a partner produces a **Pairing page** at its own URL: the pair at several sizes, both
genotypes, the poster in pair mode, download both, and promote both to 319 glyphs.

A pairing session is an ordinary `Run` with a `pairing` block, so polling, rehosting, elites,
wildcards and breeding all apply unchanged.

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
cloned from disk rather than regenerated. Five rounds of 8 is about $7. A pairing session of 6 is
$1.20 a round. Promoting a pair to 319 glyphs is $1.00.

Mixfont fails outright maybe one generation in ten with a bare "an error occurred" — failed cards
carry a **retry** so the individual isn't simply dead with its 20 credits gone.

## Architecture

```
lib/genome.ts    the axes, prompt rendering, crossover, mutation, pairing stances, naming
lib/mixfont.ts   API client (server-only — the key never reaches the browser)
lib/store.ts     run persistence, the generation lifecycle, TTF rehosting, promotion
lib/morph.ts     outline flattening + arc-length resampling for the lineage view
lib/glyphs.ts    reads a font's real character set out of its cmap
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
