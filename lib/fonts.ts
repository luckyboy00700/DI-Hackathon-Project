import { Fraunces } from 'next/font/google';

/** Display face for the wordmark only — body copy stays on --font-sans (globals.css). */
export const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['600', '900'],
  style: ['italic'],
  variable: '--font-display',
  display: 'swap',
});
