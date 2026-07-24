'use client';

import { useEffect, useState } from 'react';

import { PANGRAM, SAMPLE_PARAGRAPH, supportedChars } from '@/lib/glyphs';
import type { GlyphSetName } from '@/lib/types';

const WATERFALL = [128, 96, 72, 54, 40, 30, 22, 16];
const TEXT_SIZES = [18, 16, 14];

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line/70 py-10">
      <h2 className="mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        {label}
      </h2>
      {children}
    </section>
  );
}

export function SpecimenSheet({
  fontId,
  family,
  text,
  tracking,
  leading,
  glyphSet,
  weightLabel,
  genome,
}: {
  fontId: string;
  family: string;
  text: string;
  tracking: number;
  leading: number;
  glyphSet: GlyphSetName;
  /** For the waterfall's weight·px·tracking grammar. */
  weightLabel: string;
  /** Foundry technical credits: label/value pairs. */
  genome: [string, string][];
}) {
  const [chars, setChars] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const url = `/api/fonts/${fontId}${glyphSet === 'extended' ? '?set=extended' : ''}`;
    supportedChars(url)
      .then((cs) => !cancelled && setChars(cs))
      .catch(() => !cancelled && setChars([]));
    return () => {
      cancelled = true;
    };
  }, [fontId, glyphSet]);

  const face = { fontFamily: `"${family}", serif`, letterSpacing: `${tracking}em` };
  // Follows the container's theme variables, which paper mode overrides.
  const rule = 'var(--line)';

  return (
    <div>
      {/* Hero — the string as large as the column allows. */}
      <div
        className="break-words py-6 leading-[0.92]"
        style={{ ...face, fontSize: 'clamp(3rem, 13vw, 11rem)' }}
      >
        {text}
      </div>

      {/* Genome as foundry technical credits. */}
      <Section label="Genome">
        <dl className="grid max-w-2xl grid-cols-2 gap-x-12 sm:grid-cols-3">
          {genome.map(([k, v]) => (
            <div
              key={k}
              className="flex items-baseline justify-between border-b border-line py-1.5"
            >
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                {k}
              </dt>
              <dd className="font-mono text-[11px] text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section label="Waterfall">
        <div className="space-y-5">
          {WATERFALL.map((size) => (
            <div key={size} className="flex items-baseline gap-6">
              <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-ink-faint">
                {size}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate leading-[1.1]" style={{ ...face, fontSize: `${size}px` }}>
                  {text}
                </div>
                {/* the Klim label grammar — tracking value live-linked to the slider */}
                <div className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-faint">
                  {weightLabel} · {size}PX · {tracking.toFixed(3)}EM
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label={chars.length ? `Character set — ${chars.length} glyphs` : 'Character set'}>
        {chars.length ? (
          <div
            className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))]"
            // Borders on the cells rather than a container background, so a
            // partly-filled last row doesn't leave a slab of grid behind it.
            style={{ borderTop: `1px solid ${rule}`, borderLeft: `1px solid ${rule}` }}
          >
            {chars.map((c, i) => (
              <div
                key={`${c}-${i}`}
                className="flex aspect-square items-center justify-center"
                style={{ borderRight: `1px solid ${rule}`, borderBottom: `1px solid ${rule}` }}
                title={`U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`}
              >
                <span style={{ ...face, fontSize: '26px' }}>{c}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-mono text-[11px] text-ink-faint">reading the font&rsquo;s cmap…</p>
        )}
      </Section>

      <Section label="Text sizes">
        <div className="grid gap-10 lg:grid-cols-3">
          {TEXT_SIZES.map((size) => (
            <div key={size}>
              <div className="mb-3 font-mono text-[10px] tabular-nums text-ink-faint">
                {size}px / {leading}
              </div>
              <p style={{ ...face, fontSize: `${size}px`, lineHeight: leading }}>
                {SAMPLE_PARAGRAPH}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Pangram">
        <div className="space-y-5">
          <div style={{ ...face, fontSize: '44px', lineHeight: 1.15 }}>{PANGRAM}</div>
          <div style={{ ...face, fontSize: '44px', lineHeight: 1.15 }}>
            {PANGRAM.toUpperCase()}
          </div>
        </div>
      </Section>

      <Section label="Numerals & punctuation">
        <div className="space-y-6">
          <div style={{ ...face, fontSize: '64px' }}>0123456789</div>
          <div style={{ ...face, fontSize: '40px', lineHeight: 1.4 }}>
            . , : ; ! ? &ldquo; &rdquo; &lsquo; &rsquo; ( ) [ ] &#123; &#125; / \ &amp; @ # $ % *
            + &minus; = &lt; &gt;
          </div>
          {/* Tabular figures decide whether a face can hold a table or a dashboard. */}
          <div className="max-w-md">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
              in columns
            </div>
            {[
              ['Revenue', '1,284,300'],
              ['Cost of sales', '911,076'],
              ['Gross profit', '373,224'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-line/60 py-1.5">
                <span style={{ ...face, fontSize: '17px' }}>{k}</span>
                <span className="tabular-nums" style={{ ...face, fontSize: '17px' }}>
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}
