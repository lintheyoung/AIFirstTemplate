import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'AI First Template',
  description: 'Reusable SaaS backend control plane starter.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
