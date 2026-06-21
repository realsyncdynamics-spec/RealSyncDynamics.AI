import { Calculator, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BranchenLanding, Section, UseCaseGrid } from './branchen/BranchenLanding';

export function SteuerberaterLanding() {
  return (
    <BranchenLanding
      config={{
        headerTitle: 'Steuerberater & WP',
        Icon: Calculator,
        iconGradient: 'bg-gradient-to-br from-blue-600 to-indigo-800',
        badgeClass: 'border-blue-900 bg-blue-950/30 text-blue-300',
        badgeText: '§ 203 StGB · BStBK · IDW · DATEV-fähig',
        headline: (
          <>
            KI in der Steuer­kanzlei — <span className="text-security-400">§ 203 StGB-fest</span>
          </>
        ),
        subline: (
          <>
            Mandatsdaten dürfen weder per ChatGPT-Web noch via US-Cloud-Default verarbeitet werden. Wir
            liefern den EU-souveränen KI-Stack, mit dem deine Kanzlei BStBK-konform automatisiert.
          </>
        ),
        cta: {
          heading: 'KI-Effizienz ohne § 203-Risiko',
          buttons: [
            { to: '/contact-sales?source=steuerberater', label: 'Founding Access starten', variant: 'primary' },
            { to: '/avv-generator?source=steuerberater', label: 'AVV-Vorlage erstellen', variant: 'secondary' },
            { to: '/legal-tech', label: 'Auch für Anwälte?', variant: 'ghost' },
          ],
        },
        footerLinks: [
          { to: '/impressum', label: 'Impressum' },
          { to: '/legal/privacy', label: 'Datenschutz' },
        ],
        jsonLd: {
          headline: 'KI in der Steuerkanzlei — § 203 StGB + BStBK konform',
          description:
            'Mandatsdaten + KI ohne § 203-Risiko: EU-souveräner Stack, Audit-Trail, Steuerberater-spezifischer AVV.',
          datePublished: '2026-05-06',
        },
      }}
    >
      <Section title="Regulatorische Lage">
        <ul className="space-y-1.5 text-sm">
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50 mr-1">§ 203 StGB:</strong> Verletzung von
            Privatgeheimnissen — Drittlandtransfer von Mandatsdaten ohne expliziten Schutz strafbar
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50 mr-1">StBerG:</strong> Berufsrechtliche
            Verschwiegenheitspflicht ist absolut, keine konkludente Zustimmung des Mandanten
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50 mr-1">BStBK-Hinweise 2024:</strong> KI-Tools im
            Mandatskontext brauchen Auftragsverarbeitungsvertrag (AVV), Audit-Trail, EU-Datenresidenz
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50 mr-1">AO § 30:</strong> Steuergeheimnis bei Bearbeitung
            steuerlicher Mandate — auch gegenüber Dritten/Software-Anbietern
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50 mr-1">DSGVO:</strong> Mandatsdaten als personenbezogen —
            Art. 9 ggf. einschlägig bei Privatpatienten-/Sozial-Daten
          </li>
        </ul>
      </Section>

      <Section title="Was wir liefern">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">EU-souveräner KI-Stack</strong> mit
              Frankfurt-Hosting + Ollama-Self-Hosting (Llama / Mistral lokal) — kein
              US-Cloud-Default-Pfad
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Mandanten-Wahl-Mechanismus</strong> — KI-Aufrufe
              können pro Mandant aktiviert/deaktiviert werden, dokumentiert
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Audit-Trail pro KI-Aufruf</strong> — welcher User,
              welcher Mandant, welches Modell, welche Daten, wann
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">AVV-Vorlage Steuerberater-spezifisch</strong> — mit §
              203-StGB-/StBerG-Hinweisen, BStBK-konformer Wording
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">DATEV-Export</strong> für Buchhaltungsdaten geplant
              Q2/2027
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Multi-Mandant-Workspace</strong> — Trennung pro
              Mandant, Rollen-Modell, Onboarding-Workflow
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">DSFA-Vorlagen Steuer-Use-Cases</strong> +
              72h-Meldepflicht-Timer mit Aufsichtsbehörden je Bundesland
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Use-Cases">
        <UseCaseGrid
          items={[
            { t: 'Belegverarbeitung', d: 'OCR + Kategorisierung lokal · keine Cloud-Übertragung von Belegen' },
            { t: 'Steuer-Erklärungs-Vorbereitung', d: 'Anlagen-Voranalyse · finale Prüfung Steuerberater' },
            { t: 'Mandanten-Korrespondenz', d: 'Antworts-Vorschläge mit § 203-Hinweis · finale Versendung manuell' },
            { t: 'Steuer-Recht-Recherche (RAG)', d: 'BMF-Schreiben + Rechtsprechung lokal indexiert · Quellen-Zitierung Pflicht' },
            { t: 'Stundenerfassung', d: 'Auto-Vorschläge basierend auf Aktivität · DSGVO-konform' },
            { t: 'Geldwäsche-Indikatoren', d: 'GwG-Auffälligkeits-Score mit Begründung · Final-Entscheidung Berater' },
          ]}
        />
      </Section>

      <Section title="Berufsrechts­konforme Pricing-Struktur">
        <p>
          Für Steuerkanzleien bieten wir einen <strong className="text-titanium-50">Kanzlei-Tier</strong>{' '}
          mit individuellem AVV-Anhang (BStBK/§-203-konform), Mandanten-Trennungs-Workspace,
          Audit-Trail-Export und optionalem On-Premise-Modus. Pricing nach Anzahl
          Mandate-buchhaltungen — Anfrage über den Kanzlei-Kontakt.
        </p>
      </Section>
    </BranchenLanding>
  );
}
