'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/app/actions';

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      onClick={() => startTransition(() => signOutAction())}
      disabled={pending}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
