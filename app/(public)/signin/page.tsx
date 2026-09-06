import { SignInForm } from '@/components/features/auth/SignInForm';

export const metadata = { title: 'Sign in — Amanah' };

export default function SignInPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-base text-muted-foreground">Enter your email and password.</p>
      <SignInForm />
    </>
  );
}
