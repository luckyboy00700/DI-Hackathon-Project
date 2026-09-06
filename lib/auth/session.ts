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

/** Email + password sign-in. No email sending involved, so nothing to configure SMTP-wise. */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const supabase = await getServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('INVALID_CREDENTIALS');
}

export async function signOut(): Promise<void> {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
}
