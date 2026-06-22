import { Building2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BranchenLanding, Section, UseCaseGrid } from './branchen/BranchenLanding';

export function PublicSectorLanding() {
  return (
    <BranchenLanding
      config={{
        headerTitle: 'Behörden & Verwaltung',
        Icon: Building2,
        iconGradient: 'bg-gradient-to-br from-purple-500 to-indigo-700',
        badgeClass: 'border-purple-900 bg-purple-950/30 text-purple-300',
        badgeText: 'Behörden · OZG · BFSG/BITV · AI Act High-Risk',
        headline: (
          <>
            KI in der öffentlichen Verwaltung — <span className="text-security-400">EU-souverän</span>.
          </>
        ),
        subline: (
          <>
            Bürger-Service-Chatbots, Antragsbearbeitung, Aktenklassifikation. AI Act stuft Behörden-KI
            als <strong className="text-titanium-50"> High-Risk</strong> ein. EU-Datensouveränität ist
            nicht-verhandelbar.
          </>
        ),
        cta: {
          heading: 'EU-Datensouveränität ist Default. Nicht Premium-Feature.',
          buttons: [
            { to: '/contact-sales?source=public-sector', label: 'Founding Access starten', variant: 'primary' },
            { to: '/legal/compliance-matrix', label: 'Provider-Vergleich', variant: 'secondary' },
          ],
        },
        jsonLd: {
          headline: 'KI in der öffentlichen Verwaltung — EU-souverän + AI Act konform',
          description:
            'Behörden-KI ist High-Risk und braucht durchgehende EU-Datenresidenz. Audit-Trail, DSFA, On-Premise-Option.',
          datePublished: '2026-05-06',
        },
      }}
    >
      <Section title="Warum US-Cloud nicht geht">
        <p>
          BfDI 2024 + Konferenz der unabhängigen Datenschutzaufsichtsbehörden (DSK): Behörden-KI muss{' '}
          <strong className="text-titanium-50">durchgehend EU-Datenresidenz</strong> haben.
          Drittlandtransfer an OpenAI/Anthropic/Google = grundsätzlich unzulässig.
        </p>
        <ul className="space-y-1.5 mt-3 text-sm">
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            Schrems-II + DPF-Adäquanzbeschluss reichen für Behörden-Daten nicht (höhere Schutzwirkung
            gefordert)
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            AI Act Annex III: Behörden-Entscheidungen mit KI = High-Risk → Conformity Assessment
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            OZG + BFSG/BITV 2.0: Barrierefreiheit + Auditierbarkeit + Nachvollziehbarkeit aller
            Entscheidungen
          </li>
        </ul>
      </Section>

      <Section title="Was wir liefern">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">EU-souveräner Stack</strong>: Frankfurt-Hosted Ollama
              (Llama / Mistral) — keine US-Cloud, keine Drittland-Berührung
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Audit-Trail aller automatisierten Entscheidungen</strong>{' '}
              mit Human-Override-Pflicht-Workflow
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">DSFA-Wizard für Behörden-Use-Cases</strong> (Art. 35
              DSGVO + Konsultation der Datenschutzaufsicht falls erforderlich)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Conformity-Assessment-Vorlage</strong> für
              AI-Act-High-Risk-Klassifikation
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">On-Premise-Variante</strong> (Docker-Compose +
              Lizenz) für Behörden mit reiner Inhouse-Anforderung
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">BFSG/BITV-konforme UI</strong> — barrierefrei, html
              lang attr, screenreader-tested
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Use-Cases">
        <UseCaseGrid
          items={[
            { t: 'Bürger-Service-Chatbot', d: 'Antrags-Voranalyse mit Auto-Disclaimer + Eskalation zu Sachbearbeiter' },
            { t: 'Antragsbearbeitung', d: 'Vollständigkeits-Check + Vor-Klassifikation, Final-Entscheidung human' },
            { t: 'Aktenklassifikation', d: 'Auto-Sortierung nach Sachgebieten + Aufbewahrungsfristen' },
            { t: 'Übersetzung in Leichte Sprache', d: 'Bescheide barrierefrei aufbereiten · BFSG-konform' },
            { t: 'OZG-Workflows', d: 'Online-Anträge mit Form-Validation + Pre-Filling via KI' },
            { t: 'Wissensmanagement intern', d: 'RAG auf Verwaltungs-Vorschriften, Mitarbeiter-Q&A' },
          ]}
        />
      </Section>

      <Section title="Beschaffungs-tauglich">
        <p>
          Pricing nach EVB-IT- oder vergleichbarem Behörden-Vertrag möglich. Enterprise-Tier auf
          Anfrage mit SLA, On-Premise, Custom-Onboarding, Schulungen.{' '}
          <strong className="text-titanium-50">ISO 27001 / SOC 2 Type 1 in Vorbereitung</strong> für
          2027.
        </p>
      </Section>
    </BranchenLanding>
  );
}
