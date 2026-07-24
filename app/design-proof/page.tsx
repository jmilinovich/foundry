import { Fraunces, Hanken_Grotesk, Spline_Sans_Mono } from 'next/font/google';

/**
 * DESIGN PROOF — "The Specimen" direction, publishing (warm-paper) surface.
 * A throwaway route so the live app is undisturbed. Renders a real generated
 * champion font (Raven Obelisk Serif) as the hero. Not wired to data.
 */

// House faces. Fraunces = cold-start display (here, only the corner wordmark —
// it steps aside for the champion). Hanken = controls/labels. Spline Mono =
// the instrument voice (genome, waterfall labels).
const fraunces = Fraunces({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' });
const hanken = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' });
const mono = Spline_Sans_Mono({ subsets: ['latin'], weight: ['400', '500'], display: 'swap' });

const CHAMPION = 'a42c09f2-ce0c-4a92-adce-a0bfd842f065';
const SPECIMEN = 'Handgloves';

const GENOME: [string, string][] = [
  ['Category', 'slab serif'],
  ['Weight', 'light'],
  ['Width', 'condensed'],
  ['Contrast', 'high'],
  ['Terminals', 'blunt cut'],
  ['x-height', 'small'],
  ['Texture', 'eroded'],
  ['Mood', 'elegant · warm'],
];

const WATERFALL = [128, 96, 72, 54, 40, 28];

const GLYPHS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 & ? ! “ ” ( ) · —'.split(' ');

const SAMPLE =
  'A typeface earns its keep in the places nobody looks at closely — the third paragraph of a long column, at sixteen pixels, in bad light. That is where taste stops and infrastructure begins.';

export default function DesignProof() {
  return (
    <div className={`${hanken.className} proof`}>
      <style>{`
        @font-face {
          font-family: 'Champion';
          src: url('/api/fonts/${CHAMPION}') format('truetype');
          font-display: swap;
        }
        .proof {
          /* PUBLISHING surface — warm paper. (Judging surfaces get flat #faf8f4.) */
          --paper: #f2efe8;
          --ink: #1b1712;
          --dim: #5f584e;   /* AA on paper (~5.5:1) for body-level copy */
          --faint: #948b7f;  /* decorative annotation only, never body text */
          --line: #d9d4c8;
          --proof-red: #b7302a;
          background: var(--paper);
          color: var(--ink);
          min-height: 100vh;
          font-feature-settings: 'ss01';
        }
        .champion { font-family: 'Champion', 'Times New Roman', serif; }
        .fraunces { font-family: ${JSON.stringify(fraunces.style.fontFamily)}; }
        .mono { font-family: ${JSON.stringify(mono.style.fontFamily)}; }
        .lab { font-family: ${JSON.stringify(mono.style.fontFamily)}; text-transform: uppercase; letter-spacing: 0.16em; font-size: 10px; color: var(--faint); }
        .rule { border: 0; border-top: 1px solid var(--line); margin: 0; }
        .seam { border: 0; border-top: 2px solid var(--ink); margin: 0; }
        .proof a { color: inherit; text-decoration: none; }
        .wrap { max-width: 1180px; margin: 0 auto; padding: 0 40px; }
        .cols { display: grid; grid-template-columns: minmax(0,1fr) 210px; gap: 56px; }
        @media (max-width: 760px) {
          .wrap { padding: 0 20px; }
          .cols { grid-template-columns: 1fr; gap: 40px; }
        }
        .proof :focus-visible { outline: 2px solid var(--proof-red); outline-offset: 3px; }
      `}</style>

      {/* ── masthead ─────────────────────────────────────────── */}
      <header className="wrap" style={{ paddingTop: 22, paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, flexWrap: 'wrap' }}>
          <a href="#" className="fraunces" style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Foundry
          </a>
          <span className="lab" style={{ fontSize: 11 }}>GEN 1</span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 22 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>pair</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>promote to 319 · $0.50</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>↓ ttf</span>
          </div>
        </div>
        <nav style={{ marginTop: 14, display: 'flex', gap: 20 }} className="lab">
          <span style={{ color: 'var(--ink)' }}>specimen</span>
          <span>poster</span>
          <span>lineage</span>
        </nav>
      </header>
      <hr className="rule" />

      {/* ── hero: the champion font, enormous ────────────────── */}
      <section className="wrap" style={{ paddingTop: 40, paddingBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          {/* the KEPT registration mark — the only Proof Red on a publishing page */}
          <span
            aria-hidden
            style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--proof-red)', transform: 'translateY(-2px)' }}
          />
          <span className="champion" style={{ fontSize: 21 }}>Raven Obelisk Serif</span>
          <span className="lab" style={{ marginLeft: 4 }}>kept</span>
        </div>

        <div
          className="champion"
          style={{ fontSize: 'clamp(4rem, 15vw, 12.5rem)', lineHeight: 0.9, letterSpacing: '-0.01em', marginTop: 18 }}
        >
          {SPECIMEN}
        </div>
      </section>

      <div className="wrap">
        <hr className="seam" />
      </div>

      {/* ── waterfall + genome rail ──────────────────────────── */}
      <section className="wrap cols" style={{ paddingTop: 40 }}>
        <div>
          <div className="lab" style={{ marginBottom: 22 }}>Waterfall</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            {WATERFALL.map((px) => (
              <div key={px} style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
                <span className="mono" style={{ width: 30, textAlign: 'right', fontSize: 10, color: 'var(--faint)', flexShrink: 0 }}>
                  {px}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="champion" style={{ fontSize: px, lineHeight: 1.02, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {SPECIMEN}
                  </div>
                  <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.08em', color: 'var(--faint)', marginTop: 8 }}>
                    LIGHT · {px}PX · 0.000EM
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lab" style={{ margin: '52px 0 16px' }}>Text sizes</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 30 }}>
            {[18, 16, 14].map((px) => (
              <div key={px}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 8 }}>{px}PX / 1.55</div>
                <p className="champion" style={{ fontSize: px, lineHeight: 1.55, margin: 0 }}>{SAMPLE}</p>
              </div>
            ))}
          </div>

          <div className="lab" style={{ margin: '52px 0 16px' }}>Character set · 77 glyphs</div>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(52px,1fr))', borderTop: '1px solid var(--line)', borderLeft: '1px solid var(--line)' }}
          >
            {GLYPHS.flatMap((chunk, ci) =>
              chunk.split('').map((c, i) => (
                <div
                  key={`${ci}-${i}`}
                  className="champion"
                  style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}
                >
                  {c}
                </div>
              )),
            )}
          </div>
        </div>

        {/* genome as foundry technical credits */}
        <aside>
          <div className="lab" style={{ marginBottom: 16 }}>Lineage</div>
          <dl style={{ margin: 0 }}>
            {([['Generation', '1'], ['Lineage', 'child'], ['Parents', '#a1 · #c7'], ['Glyphs', '77']] as [string, string][]).map(
              ([k, v]) => (
                <Row key={k} k={k} v={v} />
              ),
            )}
          </dl>

          <div className="lab" style={{ margin: '30px 0 16px' }}>Genome</div>
          <dl style={{ margin: 0 }}>
            {GENOME.map(([k, v]) => (
              <Row key={k} k={k} v={v} />
            ))}
          </dl>
        </aside>
      </section>

      {/* ── the prompt, whispered ────────────────────────────── */}
      <footer className="wrap" style={{ marginTop: 64, paddingTop: 22, paddingBottom: 80, borderTop: '1px solid var(--line)' }}>
        <div className="lab" style={{ marginBottom: 10 }}>Prompt</div>
        <p style={{ maxWidth: 640, margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--dim)' }}>
          A condensed light slab serif with high contrast strokes, blunt cut terminals, a small
          x-height, and an eroded surface. 1990s digital in spirit, elegant and warm. Drawn for a
          children&rsquo;s picture book.
        </p>
      </footer>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <dt className="lab" style={{ letterSpacing: '0.12em' }}>{k}</dt>
      <dd className="mono" style={{ margin: 0, fontSize: 11, color: 'var(--ink)', textAlign: 'right' }}>{v}</dd>
    </div>
  );
}
