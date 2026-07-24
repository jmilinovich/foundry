import type { Metadata } from 'next';
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
