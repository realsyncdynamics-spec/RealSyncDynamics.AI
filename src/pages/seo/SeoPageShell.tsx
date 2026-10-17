import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { PublicHeader } from '../../components/brand/PublicHeader';
import { PublicFooter } from '../../components/brand/PublicFooter';

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
    <div className="min-h-screen bg-[var(--brand-bg-1)] text-[var(--brand-champ-hi)] font-[family-name:var(--brand-sans)]">
      <PublicHeader
        subbar={
          <>
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
          </>
        }
      />

      <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-6">
        <div className="max-w-3xl mx-auto text-center">
          {eyebrow && (
            <div className="text-[11px] font-[family-name:var(--brand-mono)] uppercase tracking-[0.25em] text-[var(--brand-champ)] mb-3">
              {eyebrow}
            </div>
          )}
          <h1 className="font-[family-name:var(--brand-serif)] font-medium text-[var(--brand-champ-hi)] text-4xl sm:text-6xl tracking-tight leading-[1.06]">
            {h1}
          </h1>
        </div>
      </section>

      <div className="px-4 sm:px-6 lg:px-8 pb-4">
        <div className="max-w-3xl mx-auto p-4 bg-[rgba(242,201,138,0.06)] border border-[var(--brand-line-dark)] border-l-2 border-l-[var(--brand-champ)] rounded-[var(--brand-radius-md)] flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-[var(--brand-champ)] mt-0.5 shrink-0" />
          <p className="text-sm text-[var(--brand-champ-hi)] leading-relaxed">{disclaimer}</p>
        </div>
      </div>

      <main>{children}</main>

      <PublicFooter
        linkColumns={[
          {
            title: 'Weiterführend',
            links: [
              { label: 'Audit', to: '/audit' },
              { label: 'Preise', to: '/pricing' },
              { label: 'Ressourcen', to: '/resources' },
              { label: 'Blog', to: '/blog' },
              { label: 'Methodik', to: '/legal/methodology' },
              { label: 'Datenschutz', to: '/legal/privacy' },
            ],
          },
        ]}
      />
    </div>
  );
}

interface ProseSectionProps {
  children: ReactNode;
}

export function ProseSection({ children }: ProseSectionProps) {
  return (
    <section className="px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <div className="max-w-3xl mx-auto space-y-6 text-[var(--brand-muted)] font-[family-name:var(--brand-body)] leading-relaxed">
        {children}
      </div>
    </section>
  );
}
