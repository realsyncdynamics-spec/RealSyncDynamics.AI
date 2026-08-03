import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'AI App Builder — RealSyncDynamicsAI',
  description: 'App-Builder mit vorgeschalteter EU-AI-Act-/DSGVO-Governance.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body style={{ margin: 0 }}>
        <nav
          style={{
            display: 'flex',
            gap: 16,
            padding: '12px 32px',
            borderBottom: '1px solid #e2e8f0',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <Link href="/">Start</Link>
          <Link href="/builder">Builder</Link>
          <Link href="/governance">Governance</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
