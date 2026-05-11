import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

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
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link
          to="/"
          className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
          aria-label="Zur Startseite"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <nav className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-400">
          <Link to="/" className="hover:text-titanium-200">Home</Link>
          {breadcrumbs?.map((c) => (
            <span key={c.name} className="flex items-center gap-2">
              <span aria-hidden="true">›</span>
              {c.href ? (
                <Link to={c.href} className="hover:text-titanium-200">{c.name}</Link>
              ) : (
                <span className="text-titanium-200">{c.name}</span>
              )}
            </span>
          ))}
        </nav>
      </header>

      <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-6">
        <div className="max-w-3xl mx-auto text-center">
          {eyebrow && (
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-[1.05]">
            {h1}
          </h1>
        </div>
      </section>

      <div className="px-4 sm:px-6 lg:px-8 pb-4">
        <div className="max-w-3xl mx-auto p-4 bg-yellow-950/30 border border-yellow-700/40 border-l-2 border-l-yellow-500 rounded-none flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-sm text-yellow-200 leading-relaxed">{disclaimer}</p>
        </div>
      </div>

      <main>{children}</main>

      <footer className="border-t border-titanium-900 px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto text-xs text-titanium-500 flex flex-wrap items-center justify-between gap-3">
          <span>© 2026 RealSync Dynamics · Made in Germany · Hosted in EU</span>
          <div className="flex flex-wrap gap-4">
            <Link to="/audit" className="hover:text-titanium-300">Audit</Link>
            <Link to="/pricing" className="hover:text-titanium-300">Preise</Link>
            <Link to="/resources" className="hover:text-titanium-300">Ressourcen</Link>
            <Link to="/blog" className="hover:text-titanium-300">Blog</Link>
            <Link to="/legal/methodology" className="hover:text-titanium-300">Methodik</Link>
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
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
      <div className="max-w-3xl mx-auto space-y-6 text-titanium-200 leading-relaxed">
        {children}
      </div>
    </section>
  );
}
