import Link from 'next/link';

import { KeyStatus } from './KeyStatus';

// The public GitHub repo. Kept here so the footer link and the About page agree.
export const REPO_URL = 'https://github.com/jmilinovich/foundry';

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line pt-6 font-mono text-[11px] leading-relaxed text-ink-faint">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link href="/about" className="text-ink-dim hover:text-ink">
          about
        </Link>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-ink-dim hover:text-ink">
          source ↗
        </a>
        <a
          href="https://www.mixfont.com"
          target="_blank"
          rel="noreferrer"
          className="text-ink-dim hover:text-ink"
        >
          mixfont ↗
        </a>
      </div>
      <p className="mt-3 max-w-2xl">
        The taste quiz is free. Generating uses your own Mixfont key, which stays in your browser
        and is never stored on our servers. No accounts.
      </p>
      <p className="mt-2">
        <KeyStatus />
      </p>
    </footer>
  );
}
