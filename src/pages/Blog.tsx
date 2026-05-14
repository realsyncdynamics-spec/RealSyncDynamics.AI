import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, FileText } from 'lucide-react';
import { usePageMeta } from '../lib/usePageMeta';

/**
 * /blog — minimal placeholder index.
 *
 * Five honest themed cards mapped to topics where the platform has
 * actual technical knowledge to share. Each card is currently a stub —
 * see TODO markers; published posts will replace these one by one.
 *
 * Why a stub instead of generated filler:
 *   - We do not publish AI-written compliance content without expert review.
 *   - Empty categories are honest; fake article counts are not.
 */

interface Topic {
  slug: string;
  title: string;
  blurb: string;
}

// TODO(blog): replace each placeholder topic with a published post once
// editorial review by a DSGVO/AI-Act specialist is complete.
const TOPICS: Topic[] = [
  {
    slug: 'continuous-compliance',
    title: 'Continuous Compliance',
    blurb:
      'Warum jährliche DSGVO-Gutachten an der Realität moderner Websites vorbeigehen — und was kontinuierliches Monitoring konkret leistet.',
  },
  {
    slug: 'pre-consent-tracking',
    title: 'Pre-Consent Tracking',
    blurb:
      'Wie Tracker vor der Einwilligung feuern, warum das TTDSG §25 verletzt und welche Heuristik echte Verstöße zuverlässig erkennt.',
  },
  {
    slug: 'ai-act-readiness',
    title: 'AI-Act Readiness',
    blurb:
      'Risiko-Klassen, Annex-III-Anwendungsfälle und Conformity-Assessments — ein nüchterner Leitfaden für Tech-Teams ohne Marketing-Lyrik.',
  },
  {
    slug: 'consent-monitoring',
    title: 'Consent Monitoring',
    blurb:
      'Cookie-Banner sind nur ein Bruchteil. Welche Datenflüsse sich nach Consent wirklich messen lassen und wo Drift entsteht.',
  },
  {
    slug: 'drittanbieter-skripte',
    title: 'Drittanbieter-Skripte',
    blurb:
      'CDN, Tag-Manager, A/B-Tests, Analytics-SDKs — ein systematischer Blick auf Third-Party-Risiken und wie man sie inventarisiert.',
  },
];

export function Blog() {
  usePageMeta({
    title: 'RealSyncDynamics.AI Blog — DSGVO, TTDSG & AI Act Monitoring',
    description:
      'Praxisnahe Beiträge zu Continuous Compliance, Pre-Consent Tracking, AI Act Readiness und technischer Datenschutzprüfung.',
    url: 'https://RealSyncDynamicsAI.de/blog',
  });

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
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-titanium-500 to-titanium-700 flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-titanium-50" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Blog</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              Themen
            </div>
            <h1 className="font-display font-bold text-3xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-2xl mx-auto">
              Technische Notizen zu DSGVO, TTDSG und EU AI Act
            </h1>
            <p className="mt-4 text-sm text-silver-400 max-w-2xl mx-auto leading-relaxed">
              Wir publizieren nur, was technisch belastbar ist. Kategorien sind angelegt — Artikel erscheinen, sobald Fach-Review abgeschlossen ist.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {TOPICS.map((t) => (
              <div
                key={t.slug}
                className="p-5 sm:p-6 bg-obsidian-900/60 border border-silver-700/30 rounded-none flex gap-4"
              >
                <FileText className="h-5 w-5 text-gold-400 shrink-0 mt-1" strokeWidth={1.5} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-display font-bold text-titanium-50 text-base">{t.title}</div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] border border-silver-500 text-silver-300 px-2 py-0.5 rounded-none">
                      In Vorbereitung
                    </span>
                  </div>
                  <p className="text-sm text-silver-300 leading-relaxed">{t.blurb}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-xs text-titanium-500">
            Vorschläge für Themen? <Link to="/contact-sales?source=blog" className="text-titanium-300 hover:text-titanium-100 underline-offset-4 hover:underline">Frag unseren AI Agent.</Link>
          </p>
        </div>
      </main>

      <footer className="border-t border-titanium-900 px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto text-xs text-titanium-500 flex flex-wrap items-center justify-between gap-3">
          <span>© 2026 RealSync Dynamics · Made in Germany · Hosted in EU</span>
          <Link to="/legal/methodology" className="hover:text-titanium-300">Methodik 2026.05.0</Link>
        </div>
      </footer>
    </div>
  );
}
