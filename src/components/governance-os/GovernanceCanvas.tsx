import React from 'react';

interface GovernanceCanvasProps {
  children: React.ReactNode;
}

// Haupt-Arbeitsfläche: scrollbare Content-Region für alle Governance-Module.
// .ws-embed neutralisiert innere min-h-screen und doppelte Header (index.css).
export function GovernanceCanvas({ children }: GovernanceCanvasProps) {
  return (
    <main className="flex-1 overflow-y-auto bg-obsidian-950">
      <div className="ws-embed">{children}</div>
    </main>
  );
}
