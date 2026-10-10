import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Navbar } from './Navbar';
import { CTA } from '../content/runtimeVocab';

// PageShell — every product surface (/runtime, /ai-act, /docs, /evidence)
// gets the same skeleton: nav, eyebrow + title hero, sections slot, footer
// activation strip. Keeps the visual system consistent across the platform.

export function PageShell({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--brand-bg-1)] text-[var(--brand-champ-hi)] font-[family-name:var(--brand-sans)]">
      <Navbar />

      <main className="pt-20">
        <header className="border-b border-[var(--brand-line-dark)] bg-[var(--brand-bg-0)] px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-7xl mx-auto">
            <div className="text-[11px] font-[family-name:var(--brand-mono)] uppercase tracking-[0.18em] text-[var(--brand-champ)] mb-3">
              {eyebrow}
            </div>
            <h1 className="text-4xl sm:text-6xl font-[family-name:var(--brand-serif)] font-medium text-[var(--brand-champ-hi)] leading-[1.06] tracking-tight max-w-3xl">
              {title}
            </h1>
            {sub && (
              <p className="mt-4 text-[var(--brand-muted)] font-[family-name:var(--brand-body)] text-base sm:text-lg leading-relaxed max-w-2xl">
                {sub}
              </p>
            )}
          </div>
        </header>

        {children}

        <section className="bg-[var(--brand-bg-2)] border-t border-[var(--brand-line-dark)] px-4 sm:px-6 py-16 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-[family-name:var(--brand-serif)] font-medium text-[var(--brand-champ-hi)] tracking-tight mb-3">
              Activate the runtime.
            </h2>
            <p className="text-[var(--brand-muted)] text-sm sm:text-base leading-relaxed mb-6">
              URL eingeben. Die Runtime scannt, klassifiziert, monitort. Kein Onboarding-Call.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/audit?source=page-footer-activate"
                className="inline-flex items-center gap-2 px-5 py-3 bg-[var(--brand-champ)] text-[var(--brand-bg-0)] hover:bg-[var(--brand-champ-hi)] rounded-[var(--brand-radius-md)] font-semibold text-sm tracking-tight transition-colors"
              >
                {CTA.startFree}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/command-center"
                className="inline-flex items-center gap-2 px-5 py-3 border border-[var(--brand-line-dark-strong)] bg-transparent text-[var(--brand-champ-hi)] hover:border-[var(--brand-champ)] hover:bg-[rgba(242,201,138,0.08)] rounded-[var(--brand-radius-md)] font-semibold text-sm tracking-tight transition-colors"
              >
                Command Center öffnen
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
