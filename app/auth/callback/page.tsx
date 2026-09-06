'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { ErrorState } from '@/components/features/states';
import { dashboardPathForAccountType } from '@/lib/dashboard-path';
import type { AccountType } from '@/lib/validation/enums';

type Outcome = { kind: 'working' } | { kind: 'error'; message: string };

/** Establishes the session from the URL hash and returns where to send the browser next. */
async function completeSignIn(hash: string): Promise<
  { ok: true; redirectTo: ReturnType<typeof dashboardPathForAccountType> } | { ok: false; message: string }
> {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) {
    return { ok: false, message: 'This sign-in link is missing or already used. Request a new one.' };
  }

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) return { ok: false, message: 'That sign-in link has expired. Request a new one.' };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Could not complete sign-in. Please try again.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .maybeSingle();

  const accountType = (profile?.account_type as AccountType | undefined) ?? 'apprentice';
  return { ok: true, redirectTo: dashboardPathForAccountType(accountType) };
}

/**
 * Where a clicked magic-link email lands. Session tokens arrive in the URL hash fragment
 * (never sent to a server), so this has to run client-side rather than as a route handler.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'working' });

  useEffect(() => {
    completeSignIn(window.location.hash).then((result) => {
      if (!result.ok) {
        setOutcome({ kind: 'error', message: result.message });
        return;
      }
      router.replace(result.redirectTo);
      router.refresh();
    });
  }, [router]);

  if (outcome.kind === 'error') {
    return (
      <>
        <h1 className="text-2xl font-semibold">Sign-in link</h1>
        <ErrorState title="Could not sign you in" whatToDo={outcome.message} />
        <a href="/signin" className="text-sm font-medium text-primary underline">
          Back to sign in
        </a>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Signing you in…</h1>
      <p className="text-base text-muted-foreground">One moment.</p>
    </>
  );
}
