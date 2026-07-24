import Link from 'next/link';

import { REPO_URL, SiteFooter } from '@/components/SiteFooter';

export const metadata = {
  title: 'About — Foundry',
  description: 'What Foundry is, why it works this way, and how it handles your key.',
};

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-12 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
      {children}
    </h2>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16 sm:py-24">
      <Link href="/" className="font-mono text-[11px] tracking-widest text-ink-dim hover:text-amber">
        ← FOUNDRY
      </Link>

      <h1 className="mt-8 text-[clamp(2rem,6vw,3.25rem)] font-medium leading-tight tracking-tight">
        A type foundry you steer by taste, not by prompt.
      </h1>

      <p className="mt-6 text-lg leading-snug text-ink-dim">
        Foundry generates real, downloadable typefaces and lets you evolve them by choosing the ones
        you like — the way you&rsquo;d actually pick a font, not by describing one in words.
      </p>

      <H>Why it works this way</H>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-dim">
        <p>
          Most font tools ask you to write a prompt. But almost nobody can name the font they want —
          the vocabulary is specialist, and taste is easier to recognize than to describe. What
          everyone can do is look at two specimens and point at the better one.
        </p>
        <p>
          So the front door is a short this-or-that quiz. Each pair is a real font with a known set
          of underlying traits, so your picks add up to a profile: a lean toward, say, warm,
          low-contrast, humanist letterforms. That profile seeds a first generation of eight
          typefaces — biased toward what you liked, but still exploring the edges, because the point
          is to find something you couldn&rsquo;t have named.
        </p>
        <p>
          From there it&rsquo;s selective breeding. Keep the fonts you like; their traits cross and
          mutate a step at a time, and the next generation is drawn from what survived. A few rounds
          in, you land somewhere specific and yours. Pick a winner and Foundry can hunt for a
          companion text or display face to pair with it, the same way.
        </p>
      </div>

      <H>Your key, your data</H>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-dim">
        <p>
          Foundry has no accounts and no user database. The taste quiz runs entirely in your browser
          with nothing sent anywhere.
        </p>
        <p>
          Generating fonts uses the{' '}
          <a href="https://www.mixfont.com" target="_blank" rel="noreferrer" className="text-amber hover:underline">
            Mixfont
          </a>{' '}
          API, which needs a key. You bring your own. It&rsquo;s stored only in your browser&rsquo;s
          local storage and sent with each generate request; it is never written to a database or a
          log on our side, and you can clear it in one click. (Mixfont&rsquo;s API can&rsquo;t be
          called straight from a browser, so the request passes through a serverless function — in
          memory, for that one call, and then it&rsquo;s gone.)
        </p>
        <p>
          The fonts you generate are yours. Mixfont deletes its copies within a day, so Foundry
          re-hosts each one so your collection outlives the session. A run lives at an unguessable
          URL — that link is the only key to it, and the list of your runs is kept in your browser,
          not on a server that knows who you are.
        </p>
        <p>
          You don&rsquo;t have to take any of that on faith. Foundry is open source — the code that
          handles your key is a few short files you can read.{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-amber hover:underline">
            Read it on GitHub ↗
          </a>
        </p>
      </div>

      <div className="mt-14">
        <Link
          href="/quiz"
          className="inline-flex items-center gap-2 rounded-lg bg-amber px-5 py-3 text-sm font-medium text-ground transition hover:brightness-110"
        >
          Find your type →
        </Link>
      </div>

      <SiteFooter />
    </div>
  );
}
