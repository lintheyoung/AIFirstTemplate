import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="shell">
      <nav className="home-nav" aria-label="Account">
        <SignedOut>
          <Link className="nav-link" href="/sign-in">
            Sign in
          </Link>
          <Link className="button primary" href="/sign-up">
            Create account
          </Link>
        </SignedOut>
        <SignedIn>
          <Link className="button secondary" href="/dashboard">
            Dashboard
          </Link>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </nav>
      <section>
        <p className="eyebrow">AI First Template</p>
        <h1>Reusable SaaS backend infrastructure.</h1>
        <p className="lede">
          Auth, workspaces, API keys, files, jobs, provider dispatch, and
          dev/test/prod release discipline in one starter.
        </p>
      </section>
    </main>
  );
}
