/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Gemeinsames Gerüst aller Optimizer-Seiten:
 *   - Header (Marke + Step-Indicator)
 *   - Kontroll-Zeile (Zurück-Ghost-Button links, Page-Type-Chip rechts)
 *   - zentrierter Content-Container
 *
 * Jede Seite reicht `step`, `pageType`, `title` und optional `backTo`
 * durch. Ohne `backTo` wird kein Zurück-Button gezeigt (Start,
 * Verify, Complete).
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Cpu } from 'lucide-react';

import { usePageMeta } from '../../lib/usePageMeta';
import { PageTypeChip, type PageType } from './components/PageTypeChip';
import { StepIndicator } from './components/StepIndicator';

interface OptimizerLayoutProps {
  step: number;
  pageType: PageType;
  /** Dokument-Titel + H-Meta. */
  metaTitle: string;
  metaDescription: string;
  metaUrl?: string;
  /** Ziel des Zurück-Buttons; weggelassen → kein Button. */
  backTo?: string;
  children: ReactNode;
}

export function OptimizerLayout({
  step,
  pageType,
  metaTitle,
  metaDescription,
  metaUrl,
  backTo,
  children,
}: OptimizerLayoutProps) {
  usePageMeta({ title: metaTitle, description: metaDescription, url: metaUrl });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      {/* Marken-Header */}
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link
          to="/"
          className="flex items-center gap-2.5"
          aria-label="Zur Startseite"
        >
          <div className="w-8 h-8 rounded-none bg-obsidian-950 border border-titanium-700 flex items-center justify-center">
            <Cpu className="h-4 w-4 text-security-400" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
              Cloud Code Optimizer
            </div>
            <div className="text-[11px] text-titanium-400 font-medium">RealSync Dynamics</div>
          </div>
        </Link>
      </header>

      <main className="px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto">
          {/* Step-Indicator */}
          <div className="mb-6">
            <StepIndicator current={step} />
          </div>

          {/* Kontroll-Zeile: Zurück + Page-Type */}
          <div className="flex items-center justify-between mb-8">
            {backTo ? (
              <Link
                to={backTo}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-none text-sm text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Zurück
              </Link>
            ) : (
              <span />
            )}
            <PageTypeChip type={pageType} />
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
