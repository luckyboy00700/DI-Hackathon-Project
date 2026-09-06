import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';
import { fraunces } from '@/lib/fonts';
import { getSessionUser } from '@/lib/auth/session';
import { Logo } from '@/components/ui/logo';
import { SignOutButton } from '@/components/features/auth/SignOutButton';

export const metadata: Metadata = {
  title: 'Amanah Apprenticeship Board',
  description: 'Paid apprenticeships with verified trade and creative-studio mentors.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  return (
    <html lang="en" className={fraunces.variable}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded-(--radius-control) focus:bg-primary focus:p-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
          <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="self-start">
              <Logo size="sm" />
            </Link>
            {user ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Signed in as{' '}
                  <span className="font-medium text-foreground">{user.displayName}</span>
                </p>
                <SignOutButton />
              </div>
            ) : (
              <Link href="/signin" className="text-sm font-medium text-primary underline">
                Sign in
              </Link>
            )}
          </header>
          <main id="main" className="flex flex-col gap-4">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
