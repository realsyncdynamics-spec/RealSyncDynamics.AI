import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { usePageMeta } from '../../lib/usePageMeta';
import { PublicHeader } from '../../components/brand/PublicHeader';
import { PublicFooter } from '../../components/brand/PublicFooter';

interface RelatedLink {
  to: string;
  label: string;
}

export function ContentPageLayout(props: {
  eyebrow: string;
  title: string;
  description: string;
  intro: string;
  children: ReactNode;
  related?: RelatedLink[];
}) {
  usePageMeta({ title: `${props.title} | RealSync Dynamics AI`, description: props.description });
  return (
    <div className="min-h-screen bg-[var(--brand-bg-1)] text-[var(--brand-champ-hi)] font-[family-name:var(--brand-sans)]">
      <PublicHeader
        subbar={
          <>
            <Link to="/" className="flex shrink-0 items-center gap-2 text-[var(--brand-titan)] hover:text-[var(--brand-champ)] text-sm">
              <ArrowLeft className="h-4 w-4" /> Startseite
            </Link>
            <div className="ml-auto truncate text-[11px] font-[family-name:var(--brand-mono)] uppercase tracking-[0.22em] text-[var(--brand-champ)]">
              {props.eyebrow}
            </div>
          </>
        }
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <article className="prose-content">
          <div className="text-[11px] font-[family-name:var(--brand-mono)] uppercase tracking-[0.25em] text-[var(--brand-champ)] mb-3">
            {props.eyebrow}
          </div>
          <h1 className="font-[family-name:var(--brand-serif)] font-medium text-[var(--brand-champ-hi)] text-4xl sm:text-6xl tracking-tight leading-[1.06]">
            {props.title}
          </h1>
          <p className="mt-5 text-[var(--brand-muted)] font-[family-name:var(--brand-body)] text-base sm:text-lg leading-relaxed">{props.intro}</p>
          <div className="mt-10 space-y-8 text-[var(--brand-muted)] leading-relaxed">{props.children}</div>
        </article>

        {props.related && props.related.length > 0 && (
          <section className="mt-14 border-t border-[var(--brand-line-dark)] pt-8">
            <div className="font-[family-name:var(--brand-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--brand-champ)] mb-3">
              Weiterlesen
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {props.related.map((r) => (
                <li key={r.to}>
                  <Link
                    to={r.to}
                    className="inline-flex items-center gap-2 text-sm text-[var(--brand-champ-hi)] hover:text-[var(--brand-champ)]"
                  >
                    {r.label} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12 border border-[var(--brand-line-dark)] bg-[var(--brand-bg-2)] rounded-[var(--brand-radius-lg)] shadow-[var(--brand-shadow-dark)] p-6">
          <h2 className="font-[family-name:var(--brand-serif)] font-medium text-[var(--brand-champ-hi)] text-2xl mb-2">Live ausprobieren</h2>
          <p className="text-sm text-[var(--brand-muted)] mb-4">
            Beispiel-Workspace mit Seed-Daten oder Compliance-Check für die eigene Domain.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/governance-runtime"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-[var(--brand-line-dark-strong)] bg-transparent text-[var(--brand-champ-hi)] hover:border-[var(--brand-champ)] hover:bg-[rgba(242,201,138,0.08)] rounded-[var(--brand-radius-md)] text-sm font-medium transition-colors"
            >
              Live Governance Runtime öffnen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/audit?source=content"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--brand-champ)] text-[var(--brand-bg-0)] hover:bg-[var(--brand-champ-hi)] rounded-[var(--brand-radius-md)] text-sm font-bold"
            >
              Kostenlosen Compliance-Check starten
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-[family-name:var(--brand-serif)] font-medium text-[var(--brand-champ-hi)] text-3xl mt-10 mb-3 first:mt-0">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-[family-name:var(--brand-serif)] font-semibold text-xl text-[var(--brand-champ-hi)] mt-6 mb-2">
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-[var(--brand-muted)] font-[family-name:var(--brand-body)] text-sm sm:text-base leading-relaxed">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5 marker:text-[var(--brand-champ)] text-[var(--brand-muted)] font-[family-name:var(--brand-body)] text-sm sm:text-base">{children}</ul>;
}
