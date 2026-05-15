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
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Navbar />

      <main className="pt-20">
        <header className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-7xl mx-auto">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
              {eyebrow}
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold tracking-tight text-titanium-50 max-w-3xl">
              {title}
            </h1>
            {sub && (
              <p className="mt-4 text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
                {sub}
              </p>
            )}
          </div>
        </header>

        {children}

        <section className="bg-obsidian-900 border-t border-titanium-900 px-4 sm:px-6 py-16 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
              Activate the runtime.
            </h2>
            <p className="text-titanium-400 text-sm sm:text-base leading-relaxed mb-6">
              URL eingeben. Die Runtime scannt, klassifiziert, monitort. Kein Onboarding-Call.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/audit?source=page-footer-activate"
                className="inline-flex items-center gap-2 px-5 py-3 bg-cyan-400 text-obsidian-950 font-semibold text-sm tracking-tight hover:bg-cyan-300 transition-colors"
              >
                {CTA.runScan}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/command-center"
                className="inline-flex items-center gap-2 px-5 py-3 border border-cyan-400/40 bg-transparent text-cyan-200 font-semibold text-sm tracking-tight hover:bg-cyan-400/10 transition-colors"
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
