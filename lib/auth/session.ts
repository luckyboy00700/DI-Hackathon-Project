import { headers } from 'next/headers';
import { getServerClient } from '@/lib/db/client';
import type { AccountType } from '@/lib/validation/enums';

export { dashboardPathForAccountType, type DashboardPath } from '@/lib/dashboard-path';

export type SessionUser = {
  id: string;
  accountType: AccountType;
  displayName: string;
};

/** Returns the signed-in user's profile, or null when there is no session. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, account_type, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id as string,
    accountType: data.account_type as AccountType,
    displayName: data.display_name as string,
  };
}

/** Same as getSessionUser but throws — for Server Actions that must have an actor. */
export async function requireSessionUser(expected?: AccountType): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error('NOT_AUTHENTICATED');
  if (expected && user.accountType !== expected) throw new Error('NOT_AUTHORIZED');
  return user;
}

/**
 * Email OTP sign-in: no password to store, no reset flow to build. emailRedirectTo matters even
 * though the local dev template only shows a 6-digit code — a hosted project without custom SMTP
 * cannot have its template edited, so its email shows a clickable link instead, and that link
 * needs somewhere in this app to land (/auth/callback).
 */
export async function sendLoginCode(email: string): Promise<void> {
  const supabase = await getServerClient();
  const headerList = await headers();
  const origin = `${headerList.get('x-forwarded-proto') ?? 'http'}://${headerList.get('host')}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) throw new Error('OTP_SEND_FAILED');
}

export async function verifyLoginCode(email: string, token: string): Promise<void> {
  const supabase = await getServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw new Error('OTP_INVALID');
}

export async function signOut(): Promise<void> {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
}
