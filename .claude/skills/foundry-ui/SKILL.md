---
name: foundry-ui
description: Foundry's committed visual direction — "The Specimen". Load this BEFORE building or restyling any Foundry screen, component, or route, or when a change touches typography, color, spacing, motion, or layout. It points you at DESIGN.md and the real component vocabulary so you build from the direction instead of defaulting to shadcn/Geist/amber. Invoke on /foundry-ui, "style this", "new screen/page", "make this look right", or any surface work in ~/src/fonts.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# foundry-ui — build from the direction, not the default

Foundry's look is **decided and written down**. Your job is to build *from* it, not to
re-derive it. Before touching any surface:

1. **Read `DESIGN.md`** (repo root) — the full direction with the reason behind every value.
2. **Read `design-tokens.json`** (repo root) — the five-group token schema. Use these values;
   don't invent new ones.

If a change would contradict either, stop and flag it — don't quietly drift. To *change* the
direction, run `/mili:ui tune "<nudge>"`, which rewrites both artifacts.

## The direction in one screen

**The Specimen** — Foundry is an editorial type foundry, not a dark dashboard. The generated
type is the hero; the controls are annotation.

## Load-bearing rules (the ones that break the design if ignored)

- **Two grounds, by surface — never a toggle.**
  - *Judging* surfaces (quiz, population): flat cool near-white `--bench #faf8f4`. The font is the
    only variable; nothing warm or loud competes.
  - *Publishing* surfaces (font detail, collection, home, about, pairing): warm paper `--paper #f2efe8`.
  - Assign via a structural `surface` prop, not a user switch.
- **Type roles:** Fraunces (display, used with restraint — it steps aside for the champion),
  Hanken Grotesk (controls/labels/body), Spline Sans Mono (instrument voice: genome, `weight · px ·
  tracking` labels). **Geist Sans and Geist Mono are banned as brand/UI faces** — they're literally
  Vercel's typefaces, the original "generic" tell.
- **The champion generated font sets specimen text and the single detail-page H1 ONLY.** Never nav,
  controls, labels, or the breed button — it changes every action and pays CLS. Gate on
  `document.fonts.ready`; use server-computed `size-adjust` at mint.
- **Proof Red `#b7302a` is reserved to exactly two verbs: Breed and Keep.** 1px ring or a solid
  dot, **never a glow**. Everything else demotes to `--muted → --ink` on hover: weight, not color.
  No second accent — errors are typography-only.
- **Hairline rules (1px) are the structural motif**, not filled cards or shadows. Exactly one 2px
  rule exists: the specimen-hero/metadata seam.
- **Cull stays fast.** Full-bleed ENORMOUS type is the detail page only; the population is a
  comparison grid with `1–9` keyboard picking intact.

## Component vocabulary (build with these, named for what the user controls)

Specimen · Bench card · Duel pane · Waterfall row (`weight · px · tracking`) · Genome rail
(small-caps labels / tabular mono values / hairline rows) · Verb button (the only Proof Red) ·
Lineage stage · Masthead. See `DESIGN.md §Component vocabulary`.

## Anti-patterns (the audit blocks these — see `DESIGN.md`)

Geist as a brand face · amber or any decorative accent · glows / `shadow-lg` · `KEPT/CHILD/WILDCARD`
as colored pills (use mono captions `· seed`, `→ child`, `✳ wildcard`; only `kept` gets Proof Red) ·
orphan colors like `sky-300` · full-bleed type in the cull grid · lorem/pangram default specimen
copy · champion font in chrome · a warm ground on a judging surface.

## Reference implementation

`/design-proof` (`app/design-proof/page.tsx`) is the built proof of the publishing/specimen
surface — real fonts, real generated champion. Read it for the concrete treatment of the hero,
waterfall grammar, genome rail, and Proof Red discipline before restyling the real detail page.

## Audit

Run `/mili:ui check` to score the current UI against the tells. A tell only counts when it's
un-argued; if `DESIGN.md` names the choice with a subject-rooted reason, it passes.
