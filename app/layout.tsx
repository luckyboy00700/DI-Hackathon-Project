import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Amanah Apprenticeship Board',
  description: 'Paid apprenticeships with verified trade and creative-studio mentors.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded-(--radius-control) focus:bg-primary focus:p-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <main id="main" className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
          {children}
        </main>
      </body>
    </html>
  );
}
