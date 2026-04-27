import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="auth-shell">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
      />
    </main>
  );
}
