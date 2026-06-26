import { Link } from 'react-router-dom';
import { ShieldCheck, Euro, Check } from 'lucide-react';
import {
  AlternativeLanding,
  Section,
  ComparisonTable,
  WarningCallout,
} from './alternative/AlternativeLanding';

export function ProlianceAlternative() {
  return (
    <AlternativeLanding
      config={{
        headerTitle: 'Proliance-Alternative',
        Icon: ShieldCheck,
        iconGradient: 'bg-gradient-to-br from-emerald-500 to-teal-700',
        badgeIcon: Euro,
        badgeClass: 'border-emerald-900 bg-emerald-950/30 text-emerald-300',
        badgeText: 'Tools-Stack statt DSB-Beratung · ab 79 €/M · Made in Germany',
        headline: (
          <>
            Proliance-Alternative —{' '}
            <span className="text-security-400">die operative Tool-Schicht</span>
          </>
        ),
        sublineMaxWidth: 'max-w-2xl',
        subline: (
          <>
            Proliance (München) ist ein bekannter externer DSB-Anbieter mit Beratungs-Schwerpunkt
            (typisch 4.000–15.000 €/Jahr). Wir liefern{' '}
            <strong className="text-titanium-50">
              Self-Service-Tools für die operative DSGVO-Umsetzung
            </strong>{' '}
            — komplementär zum DSB oder als günstigere Alternative für Firmen mit interner
            Compliance-Ressource.
          </>
        ),
        cta: {
          heading: 'Self-Service statt Beratungs-Pakete',
          buttons: [
            { to: '/pricing', label: 'Tarif starten', variant: 'primary' },
            { to: '/audit?source=proliance-alt', label: 'Kostenlos starten', variant: 'secondary' },
            { to: '/dsgvo-tool-vergleich', label: 'Voller Tool-Vergleich', variant: 'ghost' },
          ],
        },
        jsonLd: {
          headline: 'Proliance-Alternative — die operative Tool-Schicht',
          description:
            'Proliance vs RealSyncDynamics.AI: Self-Service-DSGVO-Tools ab 79 €/M, komplementär oder als Alternative zum DSB-Abo.',
          datePublished: '2026-05-06',
        },
      }}
    >
      <WarningCallout>
        <strong className="text-amber-100">Ehrlicher Hinweis:</strong> Proliance bietet einen externen
        DSB. Wir nicht. Wenn die externe DSB-Funktion das Hauptbedürfnis ist → Proliance. Wenn du Tools
        für deinen internen DSB / Anwalt brauchst oder einfach selber arbeiten willst → wir.
      </WarningCallout>

      <ComparisonTable
        competitor="Proliance"
        rows={[
          { f: 'Pricing-Modell', o: '4.000–15.000 €/Jahr (DSB-Vertrag)', r: '79–699 €/M (Self-Service)' },
          { f: 'Externer DSB stellen', o: 'yes', r: 'no' },
          { f: 'Beratung im Preis enthalten', o: 'yes', r: 'no' },
          { f: 'AVV-Generator (Self-Service)', o: 'partial', r: 'yes' },
          { f: 'VVT-Wizard (Art. 30)', o: 'partial', r: 'yes' },
          { f: 'DSFA-Wizard (Art. 35)', o: 'partial', r: 'yes' },
          { f: 'TOM-Generator (Art. 32)', o: 'partial', r: 'yes' },
          { f: 'AI-Act-Risikoklassifikator', o: 'no', r: 'yes' },
          { f: 'AI-Audit-Log (pro KI-Call)', o: 'no', r: 'yes' },
          { f: 'Cookie-Consent-SDK (BfDI 2024)', o: 'no', r: 'yes' },
          { f: '72h-Meldepflicht-Timer', o: 'no', r: 'yes' },
          { f: 'Bußgeld-Rechner', o: 'no', r: 'yes' },
          { f: 'Audit-Tool (Website-Scan)', o: 'no', r: 'yes' },
          { f: 'Multi-Tenant für Agenturen', o: 'partial', r: 'yes' },
          { f: 'API-Zugriff', o: 'no', r: 'yes' },
          { f: 'EU-Hosted', o: 'yes', r: 'yes' },
          { f: 'Setup-Zeit', o: '2-6 Wochen', r: 'Selbe Stunde' },
          { f: 'Made-in-Germany', o: 'yes', r: 'yes' },
        ]}
      />

      <Section title="Wann Proliance die richtige Wahl ist">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du brauchst einen externen DSB (gesetzliche Pflicht ab 20 Personen mit personenbezogener
              Datenverarbeitung).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du willst persönliche Beratung mit definierten Ansprechpartnern und Reporting im
              Quartalsrhythmus.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Du brauchst Schulungen, Audits vor Ort, dokumentierte Prüfberichte.</span>
          </li>
        </ul>
      </Section>

      <Section title="Wann RealSync die richtige Wahl ist">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du hast bereits einen internen DSB oder einen Compliance-Officer und brauchst Tools statt
              zusätzlicher Beratung.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Du nutzt KI und brauchst zusätzlich AI-Act-Klassifikator + AI-Audit-Log.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du betreibst eine Agentur und willst Compliance-Workflows für mehrere Mandanten managen
              (Multi-Tenant).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Du willst Setup in der gleichen Stunde, nicht in 2-6 Wochen.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Dein Pricing-Spielraum liegt unter 4.000 €/Jahr.</span>
          </li>
        </ul>
      </Section>

      <Section title="Hybrid-Setup mit Proliance (üblich)">
        <p>
          Zahlreiche Kunden behalten ihren Proliance-DSB und nutzen RealSync als operative
          Tool-Schicht. Der DSB validiert die Outputs (AVV, VVT-Einträge, DSFA-Drafts), wir liefern die
          Inputs schneller und dokumentiert. Frag deinen DSB, ob er unsere Vorlagen in seinen Workflow
          integrieren kann — die meisten freuen sich über Zeitersparnis.
        </p>
      </Section>

      <Section title="Migration / Erstkonfiguration">
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>14 Tage Pilot bei uns starten — alle Tools kostenfrei, keine Kreditkarte.</li>
          <li>
            Bestehende VVT-Einträge aus Proliance-Excel oder PDF in unseren{' '}
            <Link to="/vvt-wizard" className="text-security-400 hover:text-security-300">
              VVT-Wizard
            </Link>{' '}
            übertragen.
          </li>
          <li>
            AVV-Vorlagen für deine Sub-Processors (Stripe, Supabase, Mailtrap, …) im{' '}
            <Link to="/avv-generator" className="text-security-400 hover:text-security-300">
              AVV-Generator
            </Link>{' '}
            generieren.
          </li>
          <li>
            AI Act:{' '}
            <Link to="/ai-act-klassifikator" className="text-security-400 hover:text-security-300">
              Klassifikator
            </Link>{' '}
            für jeden KI-Use-Case durchlaufen — Nachweispflicht ab 2026.
          </li>
          <li>DSB behalten oder ersetzen — deine Entscheidung.</li>
        </ol>
      </Section>
    </AlternativeLanding>
  );
}
