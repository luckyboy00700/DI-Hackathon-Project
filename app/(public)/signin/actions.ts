'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  dashboardPathForAccountType,
  getSessionUser,
  signInWithPassword,
  type DashboardPath,
} from '@/lib/auth/session';
import { fail, type ActionResult } from '@/lib/errors';

const credentialsInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function signIn(
  raw: unknown,
): Promise<ActionResult<{ signedIn: true; redirectTo: DashboardPath | '/' }>> {
  const parsed = credentialsInput.safeParse(raw);
  if (!parsed.success) return fail('INVALID_INPUT', 'Enter your email and password.');

  try {
    await signInWithPassword(parsed.data.email, parsed.data.password);
    revalidatePath('/', 'layout');
    const user = await getSessionUser();
    const redirectTo: DashboardPath | '/' = user
      ? dashboardPathForAccountType(user.accountType)
      : '/';
    return { ok: true, signedIn: true, redirectTo };
  } catch {
    return fail('INVALID_INPUT', 'That email and password combination was not recognised.');
  }
}
