'use server';

import { redirect } from 'next/navigation';
import { signOut } from '@/lib/auth/session';

/** Ends the session and returns to the landing page, which re-renders signed out. */
export async function signOutAction(): Promise<void> {
  await signOut();
  redirect('/');
}
