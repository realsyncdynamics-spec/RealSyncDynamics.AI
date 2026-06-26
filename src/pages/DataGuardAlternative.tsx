import { Link } from 'react-router-dom';
import { ShieldCheck, Euro, Check, Code } from 'lucide-react';
import { CompetitorComparisonSection } from '../components/CompetitorComparisonSection';
import { ConsentLimitsSection } from '../components/sections/ConsentLimitsSection';
import { DATAGUARD_COMPARISON } from '../config/competitor-comparisons';
import {
  AlternativeLanding,
  Section,
  ComparisonTable,
  WarningCallout,
} from './alternative/AlternativeLanding';

export function DataGuardAlternative() {
  return (
    <AlternativeLanding
      config={{
        headerTitle: 'DataGuard-Alternative',
        Icon: ShieldCheck,
        iconGradient: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
        badgeIcon: Euro,
        badgeClass: 'border-emerald-900 bg-emerald-950/30 text-emerald-300',
        badgeText: 'Tools statt Beratung · Self-Service ab 79 €/M · Made in Germany',
        headline: (
          <>
            DataGuard-Alternative —{' '}
            <span className="text-security-400">Tools statt Beratungs-Verträge</span>
          </>
        ),
        sublineMaxWidth: 'max-w-2xl',
        subline: (
          <>
            DataGuard liefert externe Datenschutzbeauftragte und Compliance-Beratung im Abo (typisch
            4.000–12.000 €/Jahr). Wir liefern{' '}
            <strong className="text-titanium-50">
              Self-Service-Tools für die operative Umsetzung
            </strong>{' '}
            ab 79 €/Monat (Starter) — für Unternehmen, die intern bereits einen DSB haben oder selbst
            handeln wollen.
          </>
        ),
        cta: {
          heading: 'Pilot in 14 Tagen — keine Kreditkarte, kein Vertragsbinding',
          sub: 'Alle Tools, alle Tiers, 14 Tage. Falls es nicht passt: einfach laufen lassen.',
          buttons: [
            { to: '/pricing', label: 'Tarif starten', variant: 'primary' },
            { to: '/audit?source=dataguard-alt', label: 'Kostenlos starten', variant: 'secondary' },
            { to: '/dsgvo-tool-vergleich', label: 'Voller Tool-Vergleich', variant: 'ghost' },
          ],
        },
        jsonLd: {
          headline: 'DataGuard-Alternative — Tools statt Beratungs-Verträge',
          description:
            'DataGuard vs RealSyncDynamics.AI: Self-Service-Compliance-Tools ab 79 €/M statt DSB-Beratungs-Abo.',
          datePublished: '2026-05-06',
        },
      }}
    >
      <WarningCallout>
        <strong className="text-amber-100">Ehrlicher Hinweis:</strong> Wir sind kein 1:1-Ersatz für
        DataGuard. DataGuard stellt einen externen DSB. Wir liefern Tools, die ein interner DSB (oder
        ein externer Berater) effizient nutzen kann. Für Firmen ohne DSB-Ressource → DataGuard. Für
        alle anderen → wir.
      </WarningCallout>

      {/* Strategischer 9-Capability-Vergleich (PR #134) */}
      <CompetitorComparisonSection {...DATAGUARD_COMPARISON} />

      {/* Cookie Banner lösen nur einen Teil — Positionierungs-Section */}
      <ConsentLimitsSection />

      <ComparisonTable
        competitor="DataGuard"
        rows={[
          { f: 'Pricing-Modell', o: '4.000–12.000 €/Jahr (Abo)', r: '79–699 €/Monat (Self-Service)' },
          { f: 'Externer DSB stellen', o: 'yes', r: 'no' },
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
          { f: 'EU-Hosted', o: 'yes', r: 'yes' },
          { f: 'Multi-Tenant für Agenturen', o: 'partial', r: 'yes' },
          { f: 'API-Zugriff', o: 'no', r: 'yes' },
          { f: 'Beratung im Preis enthalten', o: 'yes', r: 'no' },
          { f: 'Setup-Zeit', o: '2-6 Wochen', r: 'Selbe Stunde' },
          { f: 'Made-in-Germany', o: 'yes', r: 'yes' },
        ]}
      />

      <Section title="Wann ist DataGuard die richtige Wahl">
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
            <span>Du willst „eine Person, die Verantwortung übernimmt" statt selber zu arbeiten.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Budget: 4.000+ €/Jahr ist ok, Geschwindigkeit der Umsetzung sekundär.</span>
          </li>
        </ul>
      </Section>

      <Section title="Wann ist RealSync die richtige Wahl">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du hast bereits einen internen DSB oder einen Anwalt — und brauchst Tools, mit denen
              er/sie schneller arbeiten kann.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du willst KI einsetzen und brauchst dafür AI-Act-Klassifikation, Audit-Trail, DSFA —
              Tools, die DataGuard nicht hat.
            </span>
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
            <span>Du willst Self-Service ab 79 €/M statt Berater-Tagessätze.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Du willst dein Cookie-Banner ohne Konfigurator-Hölle einbetten.</span>
          </li>
        </ul>
      </Section>

      <Section title="Beide gemeinsam — geht das">
        <p>
          Ja. Viele unserer Kunden behalten ihren externen DSB (egal ob DataGuard, ProliancePro oder
          Einzelanwalt) und nutzen RealSync als operative Tool-Schicht. Der DSB prüft die Outputs, wir
          liefern die Inputs schneller. Sprich mit deinem DSB darüber, ob er/sie unsere Tools im
          Workflow integrieren kann — die meisten freuen sich über zeitsparende Vorlagen.
        </p>
      </Section>

      <Section title="Migration / Hybrid-Setup">
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>14 Tage Pilot-Trial bei uns starten — alle Tools kostenfrei testen.</li>
          <li>
            Bestehende Verarbeitungen aus DataGuard-VVT in unseren{' '}
            <Link to="/vvt-wizard" className="text-security-400 hover:text-security-300">
              VVT-Wizard
            </Link>{' '}
            übertragen (Excel-Import möglich).
          </li>
          <li>
            Cookie-Snippet austauschen (1 Zeile) — unser{' '}
            <Link to="/cookie-consent-sdk" className="text-security-400 hover:text-security-300">
              Consent-SDK
            </Link>{' '}
            ist BfDI 2024 konform.
          </li>
          <li>
            AI Act:{' '}
            <Link to="/ai-act-klassifikator" className="text-security-400 hover:text-security-300">
              Klassifikator
            </Link>{' '}
            für jeden KI-Use-Case durchlaufen — wird DataGuard 2026 ohnehin verlangen.
          </li>
          <li>DSB behalten oder ersetzen — deine Entscheidung.</li>
        </ol>
      </Section>

      <Section title="Code-Snippet (Cookie-SDK)">
        <p>Statt DataGuards Konfigurator: 1 Zeile HTML, Banner sofort sichtbar.</p>
        <div className="p-3 bg-obsidian-950 border border-titanium-700 rounded-none flex items-start gap-3">
          <Code className="h-4 w-4 text-emerald-400 shrink-0 mt-1" />
          <code className="text-emerald-300 text-xs font-mono break-all leading-relaxed">
            {'<script src="https://RealSyncDynamicsAI.de/sdk/cookie-consent.js" data-rsd-key="YOUR_KEY"></script>'}
          </code>
        </div>
      </Section>
    </AlternativeLanding>
  );
}
