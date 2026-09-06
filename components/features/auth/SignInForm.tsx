'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ErrorState } from '@/components/features/states';
import { signIn } from '@/app/(public)/signin/actions';

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await signIn({
        email: String(formData.get('email') ?? ''),
        password: String(formData.get('password') ?? ''),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      router.push(result.redirectTo);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {error ? <ErrorState title="Could not sign you in" whatToDo={error} /> : null}

      <Field label="Email address" htmlFor="email">
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
