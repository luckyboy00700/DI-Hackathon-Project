'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  dashboardPathForAccountType,
  getSessionUser,
  sendLoginCode,
  verifyLoginCode,
  type DashboardPath,
} from '@/lib/auth/session';
import { fail, toErrorCode, type ActionResult } from '@/lib/errors';

const emailInput = z.object({ email: z.string().email() });
const codeInput = z.object({
  email: z.string().email(),
  token: z.string().min(6).max(10),
});

/** Email OTP: no password stored, nothing to reset, and friendlier on a phone. */
export async function requestLoginCode(raw: unknown): Promise<ActionResult<{ sent: true }>> {
  const parsed = emailInput.safeParse(raw);
  if (!parsed.success) return fail('INVALID_INPUT', 'Enter a valid email address.');

  try {
    await sendLoginCode(parsed.data.email);
    return { ok: true, sent: true };
  } catch (error) {
    // TODO(debug): detail is temporarily surfaced to the user while diagnosing the hosted
    // Supabase project's OTP send failure. Drop the detail arg once that's resolved.
    return fail(toErrorCode(error), error instanceof Error ? error.message : String(error));
  }
}

export async function confirmLoginCode(
  raw: unknown,
): Promise<ActionResult<{ signedIn: true; redirectTo: DashboardPath | '/' }>> {
  const parsed = codeInput.safeParse(raw);
  if (!parsed.success) return fail('INVALID_INPUT', 'Enter the 6-digit code from your email.');

  try {
    await verifyLoginCode(parsed.data.email, parsed.data.token);
    revalidatePath('/', 'layout');
    const user = await getSessionUser();
    const redirectTo: DashboardPath | '/' = user
      ? dashboardPathForAccountType(user.accountType)
      : '/';
    return { ok: true, signedIn: true, redirectTo };
  } catch {
    return fail('INVALID_INPUT', 'That code was not recognised. Request a new one and try again.');
  }
}
