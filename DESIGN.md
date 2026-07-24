# Foundry — Design Direction: **The Specimen**

> A foundry's website is itself a specimen. Foundry generates real typefaces, so the
> interface should look like a place a typeface could come from — not like the dashboard it
> currently resembles. The type is the hero; the controls are annotation.

This document is the source of truth for how Foundry looks and why. Every value below carries
its **reason** — the reason is what the slop audit (`/mili:ui check`) enforces. Tokens live in
`design-tokens.json`; keep the two in sync.

Decided via `/mili:ui` on 2026-07-24 (recon + category research + a four-discipline panel).
Direction chosen over "The Instrument" (disciplined dark) and "The Broadsheet" (front-page).

---

## The one job

**Let the type sell it.** In a visitor's first ten seconds the generated typefaces are the hero
and the argument — big, live specimens, chrome receding. Audience: **designers who read
specimens for a living** (the harshest judges, and the people who'd actually use the output).

The three rejection triggers, which the whole system is built to avoid:
1. **Looks like a generic dark AI tool** (Linear/Vercel dark + one accent). This was the closest
   risk in the old build — see "The Vercel tell" below.
2. **The fonts aren't the hero** (small, fighting the chrome).
3. **Reads amateur** — doesn't earn the word "foundry."

## The sacrifice

Foundry is willing to be **bad at looking like software.** No dashboard familiarity, no
spreadsheet-density grid, no instrument panel with every control legible at once. It commits to
specimen scale and the reading rhythm of print. "Precious / hard to use" was *not* a rejection
trigger, so we spend that budget on **scale and quiet — never on fussiness.** The pick / breed /
download loop stays instant.

---

## Two surfaces, opposite needs (the load-bearing rule)

Foundry has two kinds of screen with **opposite** requirements. This split is structural —
hard-coded per surface, **never a user toggle.** (The old build had an opt-in "on paper / on ink"
button scoped to one tab; it is deleted, not extended — an uncommitted toggle is how the system
drifts into "two products stitched together.")

- **Judging surfaces** — the taste quiz and the population you pick from. The font must be the
  **only variable in the frame**, so the ground is a **flat, cool near-white (`--bench` `#faf8f4`)**
  with no warmth and no personality to compete. *Reason:* a loud or warm ground biases a taste
  comparison, and the genome deliberately produces `hairline`/`monoline` faces that vanish on warm
  cream — fatal on the exact screen where you judge them blind. Cool flat white keeps thin strokes
  legible while receding.
- **Publishing surfaces** — a champion's specimen/detail page, the collection, the home masthead.
  Here editorial goes warm and rich: **warm paper (`--paper` `#f2efe8`)**. *Reason:* this is where
  "made by people who love type" lives; a foundry catalogue is warm paper, never white-on-black.

The seam between them is a quiet warmth shift (both grounds are light), so it needs no staged
transition — but the assignment is a `surface` prop, enforced, not eyeballed per screen.

---

## The Vercel tell (what actually made it look generic)

The old build read "generic dark AI tool" for one concrete reason: **it was set in Geist Sans and
Geist Mono, which *are* Vercel's brand typefaces.** Near-black + one accent is the Geist look
almost line-for-line. So:

- **Geist Sans and Geist Mono are banned as brand/UI faces.** (Mono micro-labels themselves are an
  *escape* move — v0 and Midjourney use them — so we keep a mono voice, just not Geist's.)
- **Amber `#ff8a3d` is gone.** It was sprayed across ~15 interactive states, which is *why* it read
  weak — an accent diluted across everything is decoration, not a signal.

---

## Typography

Three house faces, all free/OFL — plus the star, which is generated.

| role | face | why |
|---|---|---|
| **display** | **Fraunces** (variable, ink-traps, opsz) | Cold-start masthead + section display, used with restraint. It has real opinion (not Inter/Geist) and is *built to be superseded* — it steps aside for the champion on any populated page. On a font's own page it appears only as the "Foundry" corner mark. |
| **text / UI** | **Hanken Grotesk** | Controls, labels, buttons, paragraphs. A warm grotesque that isn't Inter and isn't Söhne (the one-tier-up-the-snob-ladder reflex of every design-forward SaaS). |
| **mono** | **Spline Sans Mono** | The instrument voice: genome credits, the `weight · px · tracking` waterfall labels, run metadata. This is where a monospace legitimately earns its place — as annotation, not as decorative amber. |
| **champion** | **the user's current generated font** | The signature. Sets the specimen words and the detail-page hero. The UI is a living specimen. |

**The champion-font rule (hard):** the generated champion sets **specimen text and the single
detail-page H1 only** — gated on `document.fonts.ready`, with `size-adjust` / `ascent-override` /
`descent-override` computed **server-side at mint time** (pull `hhea`/`OS2` off the `opentype.js`
parse already running in `lib/morph.ts`). It **never** sets nav, controls, labels, or the breed
button. *Reason:* the champion changes on every breed/promote/pair action, so wiring it into
persistent chrome pays CLS on every core-loop action and risks an eroded/stencil face making the
breed button illegible ("a busted `g` is why I can't find the button"). Fallback face is a
metrics-matched serif, revealed after ~600ms, never invisible forever.

**Scale:** display sizes are set tight (−0.01 to −0.02em). The detail-page hero is `clamp(4rem,
15vw, 12.5rem)`. **ENORMOUS/full-bleed type is reserved for the single-font detail page only** —
the population stays a comparison grid (see Layout). Mono labels: 10–11px, uppercase, 0.12–0.16em
tracking, `--faint`.

---

## Color

Named by **intent**, never `primary`/`secondary`. One accent, load-bearing, reserved to one verb.

- `--ink` `#1b1712` — warm near-black. Reads as ink on both grounds.
- `--paper` `#f2efe8` — warm publishing ground. *A foundry catalogue is warm paper.*
- `--bench` `#faf8f4` — flat cool judging ground. *No warmth: the font is the only variable.*
- `--line` `#d9d4c8` — hairline rules (1px). The structural motif is the rule, not the box.
- `--muted` `#5f584e` / `--faint` `#948b7f` — dim and fainter ink for metadata and labels.
- `--accent` **`#b7302a` Proof Red** — press-registration / correction-pencil red from the
  galley-proof world. *Reason:* on paper it reads as an ink stamp, not a UI alert, and sits clear
  of error-red so it's never confused for a validation state. **Reserved to exactly two jobs: the
  Breed action and the Keep state.** Rendered as a 1px ring or a solid dot — **never a glow**
  (glows read as gamer-UI; hairlines read as editorial). Everything that used to go amber on hover
  (pair, promote, download links) drops to `--muted → --ink` on hover: weight, not color.
- `--signal` `#8a8378 ` — warm graphite for the in-flight / minting instrument state (progress,
  "generating"). *Reason:* keeps the accent pure — progress must not borrow the Breed red.

**Error/failure is typography-only** — an ink treatment plus the retry affordance, no second red.
*Reason:* protects the one-accent rule; a red error state would read as a second accent.

---

## Space & density

- **Judging surfaces stay comparison-dense and fast.** The population is a grid (not a full-bleed
  stack): specimens larger and quieter than the old build, but `1–9` keyboard picking and
  at-a-glance comparison intact. *Reason:* two panelists independently flagged that forcing the
  full specimen on all eight candidates turns a five-second gut call into ninety seconds — the cull
  must stay fast.
- **Publishing surfaces are spacious** — generous vertical rhythm, the reading cadence of a printed
  catalogue.
- **Rules:** 1px everywhere, except **one 2px rule** reserved for the seam between the specimen
  hero and its metadata. A heavier line is allowed to mean something in exactly one place.

## Motion

Budget: **micro-states in the loop, one orchestrated moment.**

- Loop: hover, the pick tick, quiet 150–250ms fades. Nothing that slows a five-second decision.
- The **one orchestrated moment is the lineage morph** (parent→child point-cloud animation).
  It must be fixed for perf: batch the ~2,600 per-frame `fillRect` calls into a `Path2D`, move
  parse/flatten/resample to a Worker, and **pause the `rAF` off-screen** (it currently loops
  forever, even idle on a background tab).
- Compositor-only transforms (translate/opacity/clip-path). No viewport-wide `filter`/`box-shadow`.
- `prefers-reduced-motion` respected; the morph degrades to a crossfade.

---

## Component vocabulary

Named for what the person controls, not how it's built.

- **Specimen** — a font shown big in a real word. The atom; always the champion or a candidate.
- **Bench card** — one candidate in the cull grid (judging surface, cool ground).
- **Duel pane** — a this-or-that quiz card.
- **Waterfall row** — a size in the ramp, labelled `weight · px · tracking`, tracking live-linked
  to the tester slider.
- **Genome rail** — the technical credits: small-caps labels, tabular mono values, hairline rows.
- **Verb button** — Breed / Keep. The *only* place Proof Red appears.
- **Lineage stage** — the morph.
- **Masthead** — the Fraunces "Foundry" wordmark; on a populated page it's a quiet corner mark.

## Anti-patterns (project-specific tells the audit blocks)

- Geist Sans / Geist Mono as brand or UI faces — the Vercel tell.
- Amber (or any accent) used as decorative chrome instead of the one reserved verb.
- Filled cards with `shadow-lg` or a colored glow — use hairline rules; glows read as gamer-UI.
- `KEPT` / `CHILD` / `WILDCARD` as colored pill badges — demote to mono captions
  (`· seed`, `→ child`, `✳ wildcard`); only `kept` gets Proof Red, because it *is* the Keep verb's
  residue.
- `sky-300` or any orphan color with no reason to exist — deleted.
- Full-bleed ENORMOUS type in the cull grid — reserved for the detail page.
- Lorem / pangram / UN-Declaration default specimen text on publishing surfaces — use authored,
  themed copy (or the user's own quiz words).
- The champion font in nav, controls, labels, or the breed button — specimens and the detail hero
  only.
- A warm ground on a judging surface — judging is flat cool `--bench`.
