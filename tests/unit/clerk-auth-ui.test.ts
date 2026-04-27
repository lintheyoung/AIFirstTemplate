import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('Clerk auth UI', () => {
  it('wraps the app in ClerkProvider', () => {
    const layout = readProjectFile('app/layout.tsx');

    expect(layout).toContain("from '@clerk/nextjs'");
    expect(layout).toContain('ClerkProvider');
  });

  it('provides routed sign-in and sign-up pages', () => {
    const signInPath = 'app/sign-in/[[...sign-in]]/page.tsx';
    const signUpPath = 'app/sign-up/[[...sign-up]]/page.tsx';

    expect(existsSync(join(root, signInPath))).toBe(true);
    expect(existsSync(join(root, signUpPath))).toBe(true);
    expect(readProjectFile(signInPath)).toContain('SignIn');
    expect(readProjectFile(signInPath)).toContain('routing="path"');
    expect(readProjectFile(signUpPath)).toContain('SignUp');
    expect(readProjectFile(signUpPath)).toContain('routing="path"');
  });

  it('exposes signed-out and signed-in navigation from the homepage', () => {
    const page = readProjectFile('app/page.tsx');

    expect(page).toContain('SignedOut');
    expect(page).toContain('SignedIn');
    expect(page).toContain('href="/sign-in"');
    expect(page).toContain('href="/sign-up"');
    expect(page).toContain('UserButton');
  });

  it('redirects protected browser routes through local Clerk pages', () => {
    const middleware = readProjectFile('middleware.ts');

    expect(middleware).toContain('isProtectedDashboardRoute');
    expect(middleware).toContain("signInUrl: '/sign-in'");
    expect(middleware).toContain("signUpUrl: '/sign-up'");
  });

  it('keeps CI builds independent of real Clerk project secrets', () => {
    const workflow = readProjectFile('.github/workflows/ci.yml');

    expect(workflow).toContain('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    expect(workflow).toContain('pk_test_Y2xlcmsuZXhhbXBsZS5jb20k');
  });
});
