import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="auth-shell">
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
      />
    </main>
  );
}
