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
import { PublicHeader } from '../../components/brand/PublicHeader';
import { PublicFooter } from '../../components/brand/PublicFooter';
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
    <div className="min-h-screen bg-[var(--brand-bg-1)] text-[var(--brand-champ-hi)] font-[family-name:var(--brand-sans)]">
      {/* Marken-Header */}
      <PublicHeader
        brand={
          <span className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-[var(--brand-radius-md)] bg-[var(--brand-bg-1)] border border-[var(--brand-line-dark-strong)] flex items-center justify-center">
              <Cpu className="h-4 w-4 text-[var(--brand-champ)]" />
            </span>
            <span className="leading-tight">
              <span className="block font-[family-name:var(--brand-serif)] font-semibold text-base tracking-tight text-[var(--brand-champ-hi)]">
                Cloud Code Optimizer
              </span>
              <span className="block font-[family-name:var(--brand-sans)] text-[11px] text-[var(--brand-titan)] font-medium">RealSync Dynamics</span>
            </span>
          </span>
        }
      />

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
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--brand-radius-md)] text-sm text-[var(--brand-titan)] hover:text-[var(--brand-champ)] hover:bg-[rgba(242,201,138,0.08)] transition-colors"
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
      <PublicFooter />
    </div>
  );
}
