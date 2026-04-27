import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'AI First Template',
  description: 'Reusable SaaS backend control plane starter.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
