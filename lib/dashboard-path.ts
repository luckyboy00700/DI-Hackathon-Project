import type { AccountType } from '@/lib/validation/enums';

export type DashboardPath = '/dashboard' | '/dashboard/business' | '/dashboard/masjid';

/** Where each role lands after signing in, and the persistent "Dashboard" link points to. */
export function dashboardPathForAccountType(accountType: AccountType): DashboardPath {
  if (accountType === 'business') return '/dashboard/business';
  if (accountType === 'organization') return '/dashboard/masjid';
  return '/dashboard';
}
