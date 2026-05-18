import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export function Terms() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Nutzungsbedingungen</div>
            <div className="text-[11px] text-titanium-400 font-medium">Stand 2026-05-18</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6 text-titanium-300 text-sm leading-relaxed">
        <Section title="1. Geltungsbereich">
          <p>
            Diese Nutzungsbedingungen regeln die Nutzung der Plattform RealSyncDynamics.AI
            durch Unternehmer im Sinne von § 14 BGB.
          </p>
        </Section>

        <Section title="2. Leistungsbeschreibung">
          <p>
            RealSyncDynamics.AI stellt Werkzeuge für Compliance-Prüfpfade, Herkunftsnachweise
            und KI-gestützte Analyseprozesse bereit. Der konkrete Funktionsumfang richtet sich
            nach dem gewählten Tarif.
          </p>
        </Section>

        <Section title="3. Free-Audit und Testzugänge">
          <p>
            Der kostenlose Audit dient der unverbindlichen Erstbewertung. Ein Anspruch auf
            dauerhafte Verfügbarkeit oder identische Ergebnisse in späteren Produktionsläufen
            besteht nicht.
          </p>
        </Section>

        <Section title="4. Pflichten der Nutzer">
          <p>
            Nutzer sind verpflichtet, nur Inhalte und URLs einzureichen, für deren Verarbeitung
            sie berechtigt sind. Missbräuchliche oder rechtswidrige Nutzung ist unzulässig.
          </p>
        </Section>

        <Section title="5. Vergütung und Laufzeit">
          <p>
            Kostenpflichtige Leistungen richten sich nach der jeweils veröffentlichten
            Preisübersicht. Vertragslaufzeiten und Kündigungsfristen werden im Bestellprozess
            ausgewiesen.
          </p>
        </Section>

        <Section title="6. Haftung">
          <p>
            Die Plattform liefert technische Bewertungen und ersetzt keine individuelle
            Rechtsberatung. Für Entscheidungen auf Basis der bereitgestellten Ergebnisse bleibt
            der Nutzer verantwortlich.
          </p>
        </Section>

        <Section title="7. Schlussbestimmungen">
          <p>
            Es gilt deutsches Recht. Gerichtsstand ist, soweit gesetzlich zulässig, der Sitz des
            Anbieters.
          </p>
        </Section>

        <div className="flex flex-wrap items-center gap-4 text-xs text-titanium-400 pt-6 border-t border-titanium-900">
          <Link to="/legal/privacy" className="hover:text-titanium-200">Datenschutzerklärung</Link>
          <Link to="/legal/impressum" className="hover:text-titanium-200">Impressum</Link>
          <Link to="/legal/sub-processors" className="hover:text-titanium-200">Sub-Prozessoren</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display font-bold text-titanium-50 tracking-tight text-base mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
