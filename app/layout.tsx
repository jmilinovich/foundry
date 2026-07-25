import type { Metadata, Viewport } from 'next';
import { Fraunces, Hanken_Grotesk, Spline_Sans_Mono } from 'next/font/google';
import './globals.css';
import { KeyGateProvider } from '@/components/KeyGateProvider';

// The Specimen · see DESIGN.md. Fraunces = display (cold-start masthead, used
// with restraint — the champion font supersedes it). Hanken = controls/body.
// Spline Mono = the instrument voice. Geist is banned (it's Vercel's brand face).
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});
const hanken = Hanken_Grotesk({
  variable: '--font-hanken',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});
const splineMono = Spline_Sans_Mono({
  variable: '--font-spline-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

/**
 * The browser chrome should match the page it is framing.
 *
 * Without a themeColor the address bar sits at the UA default against a warm
 * paper ground, which reads as a seam across the top of every screen on a
 * phone. `maximumScale` is deliberately absent: capping zoom locks out anyone
 * who needs to enlarge the type, which on a typography site would be a
 * particular kind of rude.
 */
export const viewport: Viewport = {
  themeColor: '#f2efe8',
  colorScheme: 'light',
};

export const metadata: Metadata = {
  title: 'Foundry — evolve a typeface',
  description:
    'Nobody can write the prompt for the font they want. Everybody can point at the one they like better.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${hanken.variable} ${splineMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col surface-publish">
        <KeyGateProvider>{children}</KeyGateProvider>
      </body>
    </html>
  );
}
