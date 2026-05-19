import type { ReactNode } from 'react';

export interface RuntimeShellProps {
  header:    ReactNode;
  sidebar?:  ReactNode;
  children:  ReactNode;
  /** Wenn true, wird der Scanline-Overlay-Effekt auf dem Hauptbereich gezeigt. */
  scanline?: boolean;
}

export function RuntimeShell({ header, sidebar, children, scanline = false }: RuntimeShellProps) {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      {header}
      <div className={`mx-auto flex max-w-7xl ${sidebar ? 'gap-0' : ''}`}>
        {sidebar ? (
          <div className="hidden w-56 shrink-0 lg:block">{sidebar}</div>
        ) : null}
        <main
          className={`min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 rt-grid-bg ${scanline ? 'rt-scanline' : ''}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
