import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import '../../styles/brand-classical-public.css';

/**
 * Shared chrome for the SEO money pages: top bar, breadcrumb, visible
 * disclaimer band, content, footer. Keeps the four landing pages
 * consistent without forcing a real layout component refactor.
 */

interface Crumb {
  name: string;
  href?: string;
}

interface Props {
  eyebrow?: string;
  h1: string;
  breadcrumbs?: Crumb[];
  disclaimer?: string;
  children: ReactNode;
}

export function SeoPageShell({
  eyebrow,
  h1,
  breadcrumbs,
  disclaimer = 'Diese Seite ist eine technische Orientierung und ersetzt keine individuelle Rechtsberatung und keine vollständige technische Prüfung.',
  children,
}: Props) {
  return (
    <div className="rs-classical-page rs-classical-seo min-h-screen bg-[var(--brand-bg-1)] text-[var(--brand-champ-hi)] font-[family-name:var(--brand-sans)]">
      <header className="rs-classical-seo-nav h-14 border-b border-[var(--brand-line-dark)] bg-[var(--brand-bg-0)] flex items-center px-4">
        <Link
          to="/"
          className="p-1.5 rounded-[var(--brand-radius-md)] hover:bg-[rgba(242,201,138,0.08)] text-[var(--brand-titan)] hover:text-[var(--brand-champ)] mr-3"
          aria-label="Zur Startseite"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <nav className="flex items-center gap-2 min-w-0 flex-wrap text-[11px] font-[family-name:var(--brand-mono)] uppercase tracking-[0.18em] text-[var(--brand-titan)]">
          <Link to="/" className="hover:text-[var(--brand-champ)]">Home</Link>
          {breadcrumbs?.map((c) => (
            <span key={c.name} className="flex items-center gap-2">
              <span aria-hidden="true">›</span>
              {c.href ? (
                <Link to={c.href} className="hover:text-[var(--brand-champ)]">{c.name}</Link>
              ) : (
                <span className="text-[var(--brand-champ-hi)]">{c.name}</span>
              )}
            </span>
          ))}
        </nav>
      </header>

      <section className="rs-classical-seo-head px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-6">
        <div className="max-w-3xl mx-auto text-center">
          {eyebrow && (
            <div className="rs-classical-eyebrow text-[11px] font-[family-name:var(--brand-mono)] uppercase tracking-[0.25em] text-[var(--brand-champ)] mb-3">
              {eyebrow}
            </div>
          )}
          <h1 className="rs-classical-title mx-auto font-[family-name:var(--brand-serif)] font-medium text-[var(--brand-champ-hi)] text-4xl sm:text-6xl tracking-tight leading-[1.06]">
            {h1}
          </h1>
        </div>
      </section>

      <div className="px-4 sm:px-6 lg:px-8 pb-4">
        <div className="rs-classical-seo-disclaimer max-w-3xl mx-auto p-4 bg-[rgba(242,201,138,0.06)] border border-[var(--brand-line-dark)] border-l-2 border-l-[var(--brand-champ)] rounded-[var(--brand-radius-md)] flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-[var(--brand-champ)] mt-0.5 shrink-0" />
          <p className="text-sm text-[var(--brand-champ-hi)] leading-relaxed">{disclaimer}</p>
        </div>
      </div>

      <main>{children}</main>

      <footer className="rs-classical-seo-footer border-t border-[var(--brand-line-dark)] bg-[var(--brand-bg-0)] px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto text-xs text-[var(--brand-titan)] flex flex-wrap items-center justify-between gap-3">
          <span>© 2026 RealSync Dynamics · Made in Germany · Hosted in EU</span>
          <div className="flex flex-wrap gap-4">
            <Link to="/audit" className="hover:text-[var(--brand-champ)]">Audit</Link>
            <Link to="/pricing" className="hover:text-[var(--brand-champ)]">Preise</Link>
            <Link to="/resources" className="hover:text-[var(--brand-champ)]">Ressourcen</Link>
            <Link to="/blog" className="hover:text-[var(--brand-champ)]">Blog</Link>
            <Link to="/legal/methodology" className="hover:text-[var(--brand-champ)]">Methodik</Link>
            <Link to="/legal/privacy" className="hover:text-[var(--brand-champ)]">Datenschutz</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface ProseSectionProps {
  children: ReactNode;
}

export function ProseSection({ children }: ProseSectionProps) {
  return (
    <section className="px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <div className="rs-classical-prose max-w-3xl mx-auto space-y-6 text-[var(--brand-muted)] font-[family-name:var(--brand-body)] leading-relaxed">
        {children}
      </div>
    </section>
  );
}
