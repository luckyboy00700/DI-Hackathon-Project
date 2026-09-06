'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ErrorState } from '@/components/features/states';
import { confirmLoginCode, requestLoginCode } from '@/app/(public)/signin/actions';

type Stage = { name: 'email' } | { name: 'code'; email: string };

export function SignInForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ name: 'email' });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function askForCode(formData: FormData) {
    const email = String(formData.get('email') ?? '');
    startTransition(async () => {
      const result = await requestLoginCode({ email });
      if (!result.ok) {
        // TODO(debug): appending detail temporarily while diagnosing hosted OTP send failures.
        setError(result.detail ? `${result.message} (${result.detail})` : result.message);
        return;
      }
      setError(null);
      setStage({ name: 'code', email });
    });
  }

  function submitCode(formData: FormData) {
    if (stage.name !== 'code') return;
    startTransition(async () => {
      const result = await confirmLoginCode({
        email: stage.email,
        token: String(formData.get('token') ?? ''),
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
    <div className="flex flex-col gap-4">
      {error ? <ErrorState title="Could not sign you in" whatToDo={error} /> : null}
      {stage.name === 'email' ? (
        <EmailStage onSubmit={askForCode} pending={pending} />
      ) : (
        <CodeStage email={stage.email} onSubmit={submitCode} pending={pending} />
      )}
    </div>
  );
}

function EmailStage({
  onSubmit,
  pending,
}: {
  onSubmit: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <Field
        label="Email address"
        htmlFor="email"
        hint="We send a 6-digit code. There is no password to remember."
      >
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send me a code'}
      </Button>
    </form>
  );
}

function CodeStage({
  email,
  onSubmit,
  pending,
}: {
  email: string;
  onSubmit: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <Field
        label="6-digit code"
        htmlFor="token"
        hint={`Sent to ${email}. If your email shows a link instead of a code, click that link.`}
      >
        <Input
          id="token"
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          minLength={6}
          maxLength={10}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? 'Checking…' : 'Sign in'}
      </Button>
    </form>
  );
}
