import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { usePageMeta } from '../../lib/usePageMeta';

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
  usePageMeta({ title: `${props.title} | RealSyncDynamics.AI`, description: props.description });
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-titanium-300 hover:text-titanium-100 text-sm">
          <ArrowLeft className="h-4 w-4" /> Startseite
        </Link>
        <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-titanium-100">
          {props.eyebrow}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <article className="prose-content">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            {props.eyebrow}
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            {props.title}
          </h1>
          <p className="mt-5 text-silver-300 text-base sm:text-lg leading-relaxed">{props.intro}</p>
          <div className="mt-10 space-y-8 text-silver-200 leading-relaxed">{props.children}</div>
        </article>

        {props.related && props.related.length > 0 && (
          <section className="mt-14 border-t border-silver-700/30 pt-8">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-100 mb-3">
              Weiterlesen
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {props.related.map((r) => (
                <li key={r.to}>
                  <Link
                    to={r.to}
                    className="inline-flex items-center gap-2 text-sm text-silver-300 hover:text-amber-300"
                  >
                    {r.label} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12 border border-titanium-100/20 bg-titanium-100/5 p-6">
          <h2 className="font-display font-bold text-xl text-titanium-50 mb-2">Live ausprobieren</h2>
          <p className="text-sm text-silver-300 mb-4">
            Beispiel-Workspace mit Seed-Daten oder Compliance-Check für die eigene Domain.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/governance-runtime"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-titanium-100/30 hover:border-amber-400 text-titanium-100 hover:text-amber-300 text-sm font-medium transition-colors"
            >
              Live Governance Runtime öffnen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/audit?source=content"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 surface-gold text-sm font-bold rounded-none"
            >
              Kostenlosen Compliance-Check starten
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display font-bold text-2xl text-titanium-50 mt-10 mb-3 first:mt-0">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-display font-semibold text-lg text-titanium-50 mt-6 mb-2">
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-silver-300 text-sm sm:text-base leading-relaxed">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5 text-silver-300 text-sm sm:text-base">{children}</ul>;
}
