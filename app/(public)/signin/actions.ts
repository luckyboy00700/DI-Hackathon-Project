'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { sendLoginCode, verifyLoginCode } from '@/lib/auth/session';
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
    return fail(toErrorCode(error));
  }
}

export async function confirmLoginCode(raw: unknown): Promise<ActionResult<{ signedIn: true }>> {
  const parsed = codeInput.safeParse(raw);
  if (!parsed.success) return fail('INVALID_INPUT', 'Enter the 6-digit code from your email.');

  try {
    await verifyLoginCode(parsed.data.email, parsed.data.token);
    revalidatePath('/', 'layout');
    return { ok: true, signedIn: true };
  } catch {
    return fail('INVALID_INPUT', 'That code was not recognised. Request a new one and try again.');
  }
}
