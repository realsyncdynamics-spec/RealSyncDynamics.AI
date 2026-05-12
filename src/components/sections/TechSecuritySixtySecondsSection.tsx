import { Braces, DatabaseZap, Eye, LockKeyhole } from 'lucide-react';

const items = [
  {
    icon: LockKeyhole,
    title: 'EU-Hosting',
    text:
      'Scans und Datenhaltung sind für EU-Datenresidenz ausgelegt und vermeiden unnötige Datenabflüsse.',
  },
  {
    icon: Eye,
    title: 'Headless-Browser-Engine',
    text:
      'Realistische JavaScript-fähige Scans mit moderner Browser-Technologie – inklusive Tag Manager, dynamischen Inhalten und Consent-Flows.',
  },
  {
    icon: DatabaseZap,
    title: 'Revisionssicherer Audit-Log',
    text:
      'Jeder Scan, jede Setup-Änderung und jede generierte Empfehlung wird mit Zeitstempel als nachvollziehbarer Audit-Trail erfasst.',
  },
  {
    icon: Braces,
    title: 'Strikte Trennung',
    text:
      'RealSync analysiert browser-sichtbares Verhalten und Governance-Telemetrie – nicht Ihre internen Datenbanken oder privaten CRM-Systeme.',
  },
];

export function TechSecuritySixtySecondsSection() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Technik & Sicherheit
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            Technische Compliance-Engine statt Formularsammlung.
          </h2>
          <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed">
            RealSyncDynamics.AI ist von Anfang an als technische Compliance-Engine gebaut:
            browsernah, revisionsfähig und mit klaren Systemgrenzen.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="bg-obsidian-900/60 border border-silver-700/30 p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 flex items-center justify-center border border-titanium-100/30 bg-titanium-100/5 text-titanium-100 shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-xl text-titanium-50">{item.title}</h3>
                    <p className="mt-2 text-sm text-silver-300 leading-relaxed">{item.text}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
