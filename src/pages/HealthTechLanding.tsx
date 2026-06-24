import { Stethoscope, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { BranchenLanding, Section, UseCaseGrid } from './branchen/BranchenLanding';

export function HealthTechLanding() {
  return (
    <BranchenLanding
      config={{
        headerTitle: 'HealthTech-Compliance',
        Icon: Stethoscope,
        iconGradient: 'bg-gradient-to-br from-emerald-500 to-teal-700',
        badgeClass: 'border-emerald-900 bg-emerald-950/30 text-emerald-300',
        badgeText: 'HealthTech · Patientendaten · AI Act High-Risk',
        headline: (
          <>
            KI in HealthTech — <span className="text-security-400">ohne Patientendaten-GAU</span>.
          </>
        ),
        subline: (
          <>
            Diagnose-Unterstützung, Triage-AI, Befund-Klassifikation. Ab August 2026 alles
            <strong className="text-titanium-50"> AI-Act-High-Risk</strong>. Wir liefern den
            Compliance-Layer.
          </>
        ),
        cta: {
          heading: 'In 14 Tagen AI-Act-konform — bevor August 2026 kommt.',
          sub: '87 Tage bis High-Risk-Pflicht. 14 Tage Pilot. Du hast noch Zeit — aber nur knapp.',
          buttons: [
            { to: '/contact-sales?source=healthtech', label: 'Founding Access starten', variant: 'primary' },
            { to: '/audit', label: 'Kostenloser DSGVO-Scan', variant: 'secondary' },
            { to: '/ai-act-faq', label: 'AI-Act-FAQ', variant: 'ghost' },
          ],
        },
        jsonLd: {
          headline: 'KI-Compliance für HealthTech-Startups — DSGVO + AI Act',
          description:
            'AI-Act-High-Risk ab August 2026. Wie HealthTechs Patientendaten + KI compliant verarbeiten.',
          datePublished: '2026-05-06',
        },
      }}
    >
      <Section title="Das Problem">
        <p>
          Du nutzt KI für Diagnose, Triage oder Befund-Sortierung. Datenkategorie:
          <strong className="text-titanium-50"> besonders schutzwürdige Gesundheitsdaten</strong> nach
          Art. 9 DSGVO. Plus AI Act Annex III: Healthcare-Diagnose-AI ist kategorisch
          <strong className="text-titanium-50"> High-Risk</strong> ab August 2026.
        </p>
        <p>Was die Marktrealität verlangt:</p>
        <ul className="space-y-1.5 mt-3 text-sm">
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            Konformitätsbewertung nach DSGVO Art. 35 + AI Act (Risikoklasse High-Risk)
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            Technische und organisatorische Maßnahmen vor Inbetriebnahme dokumentieren
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            Lieferanten- und Kunden-Audits (Krankenhäuser, MFA-Praxen) erfordern belastbaren Nachweis
          </li>
        </ul>
      </Section>

      <Section title="Was wir liefern">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">EU-Datenresidenz</strong> für jeden KI-Aufruf —
              Patientendaten verlassen nie Frankfurt-Hosted Ollama
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Audit-Log pro AI-Call</strong> — Modell, Tokens,
              User, Datenresidenz, Zeit. Revisionssicher
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">DSFA-Wizard</strong> für
              Patientendaten-Verarbeitung gemäß Art. 35 DSGVO
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">AI-Act-Risk-Klassifikation</strong> +
              Conformity-Assessment-Vorlage
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">AVV mit allen Auftragsverarbeitern</strong> nach
              Art. 28 — inkl. Sub-Auftragsverarbeiter-Liste
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Human-Oversight-Workflow</strong> mit
              Override-Funktion + Audit-Trail aller automatisierten Entscheidungen
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Use-Cases die wir abdecken">
        <UseCaseGrid
          items={[
            { t: 'Diagnose-Unterstützung', d: 'GPT-4 / Claude für Befund-Vorschlag mit Audit-Log + Patientendaten-Pseudonymisierung pre-prompt' },
            { t: 'Triage-AI in Notaufnahmen', d: 'Real-time-Klassifikation mit Human-Override + DSFA + EU-local Llama-Inferenz' },
            { t: 'Befund-Sortierung', d: 'Automatische Vor-Klassifikation für Pathologen — alle Daten in Frankfurt' },
            { t: 'Patient-Kommunikation (Chatbot)', d: 'Symptom-Voranalyse mit konfigurierbarem AI-Disclaimer + Audit-Log' },
            { t: 'Forschungs-Datenaufbereitung', d: 'Anonymisierung + Pseudonymisierung-Workflow mit reversibilität für Studien-Zwecke' },
            { t: 'Krankenhaus-IT-Compliance', d: 'Multi-Tenant pro Abteilung, BAIT-tauglich, ISO-27001-vorbereitend' },
          ]}
        />
      </Section>

      <Section title="Pricing für HealthTech">
        <p className="mb-4">
          Standard-Tiers ab Starter 79 €/M.{' '}
          <strong className="text-titanium-50">HealthTech-Bundle</strong> (Growth +
          Patientendaten-Zusatz) ab 249 €/M empfohlen, beinhaltet:
        </p>
        <ul className="space-y-1.5 text-sm">
          <li className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50">14 Tage Pilot kostenlos</strong>
          </li>
          <li className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            30-Min-Onboarding mit DSB-Walkthrough
          </li>
          <li className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            Custom DSFA-Template für eure Use-Cases
          </li>
          <li className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            Quartalsweise Compliance-Review-Call
          </li>
        </ul>
      </Section>
    </BranchenLanding>
  );
}
