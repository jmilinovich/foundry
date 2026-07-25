# assets

Build-time assets that are **not** served to browsers.

- `og-text.ttf` — Hanken Grotesk Regular (SIL Open Font License 1.1), subset to Latin
  text and punctuation. Used only by `app/type/[code]/opengraph-image.tsx`, where Satori
  needs real outline data and cannot read the `.woff2` that `next/font` produces.

  It sets the labels and the read on the share card so the *champion* font is reserved
  for the specimen line, per the champion-font rule in `DESIGN.md`. Without it every word
  on the card would be set in the matched face, and a hairline or stencil-cut champion
  renders the paragraph unreadable at thumbnail size.

  Source: https://fonts.google.com/specimen/Hanken+Grotesk
