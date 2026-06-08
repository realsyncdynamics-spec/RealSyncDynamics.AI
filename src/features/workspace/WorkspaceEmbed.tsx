// WorkspaceEmbed — rendert eine bestehende Voll-Seiten-View INNERHALB der
// WorkspaceShell, ohne die View selbst umzuschreiben (P2).
//
// Problem: die Governance-/Settings-Views rendern jeweils ihren eigenen
// `min-h-screen`-Container + eigene `<header class="h-14 …">` Topbar (+ eigenen
// AuthGate). In der Shell ergäbe das doppelte Header + doppeltes Scrolling.
//
// Lösung ohne View-Rewrite: wir kapseln die View in `<div class="ws-embed">`.
// Die Regeln in index.css (siehe `.ws-embed`) neutralisieren den inneren
// min-h-screen-Höhenzwang und blenden die innere `h-14`-Header-Leiste aus.
// Die Views bringen ihren AuthGate selbst mit → kein doppelter Gate.
import React from 'react';
import { WorkspaceShell } from './WorkspaceShell';
import { DemoReadOnlyWrapper } from '../../components/DemoReadOnlyWrapper';

export function WorkspaceEmbed({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <WorkspaceShell title={title}>
      <DemoReadOnlyWrapper section={title}>
        <div className="ws-embed">{children}</div>
      </DemoReadOnlyWrapper>
    </WorkspaceShell>
  );
}
