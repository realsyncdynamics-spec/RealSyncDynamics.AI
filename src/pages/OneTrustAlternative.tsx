import { Award, Euro, Globe } from 'lucide-react';
import { CompetitorComparisonSection } from '../components/CompetitorComparisonSection';
import { ConsentLimitsSection } from '../components/sections/ConsentLimitsSection';
import { ONETRUST_COMPARISON } from '../config/competitor-comparisons';
import { AlternativeLanding, Section, ComparisonTable } from './alternative/AlternativeLanding';

export function OneTrustAlternative() {
  return (
    <AlternativeLanding
      config={{
        headerTitle: 'OneTrust-Alternative',
        Icon: Award,
        iconGradient: 'bg-gradient-to-br from-emerald-500 to-teal-700',
        badgeIcon: Euro,
        badgeClass: 'border-emerald-900 bg-emerald-950/30 text-emerald-300',
        badgeText: '12× günstiger · EU-Hosted · 14 Tage Pilot',
        headline: (
          <>
            OneTrust-Alternative aus <span className="text-security-400">Deutschland</span>
          </>
        ),
        subline: (
          <>
            OneTrust kostet ab 600 €/Monat, ist US-gehostet und kein Audit-Log über AI-Calls. Wir
            liefern die KI-spezifische Compliance-Schicht ab 79 €/M (Starter).
          </>
        ),
        cta: {
          heading: 'Vergleichstest in 30 Sekunden — kostenlos.',
          sub: 'Lass deine Site durch unseren DSGVO-Scanner laufen. Kein Account. Score + Befunde mit Paragraph-Referenzen. Vergleich danach mit OneTrust ist trivial.',
          buttons: [
            { to: '/audit', label: 'Kostenloser Site-Scan', variant: 'primary' },
            { to: '/pricing?source=onetrust-alt', label: 'Tarif starten', variant: 'secondary' },
            { to: '/dsgvo-tool-vergleich', label: 'Volles Tool-Vergleich', variant: 'ghost' },
          ],
        },
        jsonLd: {
          headline: 'OneTrust-Alternative aus Deutschland — 12× günstiger, EU-Hosted',
          description:
            'Vergleich OneTrust vs RealSyncDynamics.AI für DSGVO + AI Act + Schrems-II-Compliance.',
          datePublished: '2026-05-06',
        },
      }}
    >
      {/* Strategischer 9-Capability-Vergleich (PR #134) */}
      <CompetitorComparisonSection {...ONETRUST_COMPARISON} />

      {/* Cookie Banner lösen nur einen Teil — Positionierungs-Section */}
      <ConsentLimitsSection />

      <ComparisonTable
        competitor="OneTrust"
        rows={[
          { f: 'Pricing ab', o: '~600 €/M (Enterprise)', r: '79 €/M (Starter) · Free Audit kostenlos' },
          { f: 'Origin / Hosting', o: 'USA', r: '🇩🇪 Frankfurt' },
          { f: 'Schrems-II-tauglich (default)', o: 'partial', r: 'yes' },
          { f: 'Cookie-Consent-Banner (BfDI 2024)', o: 'yes', r: 'yes' },
          { f: 'AVV-Generator (Art. 28 Abs. 3)', o: 'yes', r: 'yes' },
          { f: 'VVT-Wizard (Art. 30)', o: 'yes', r: 'yes' },
          { f: 'DSFA-Wizard (Art. 35)', o: 'yes', r: 'yes' },
          { f: 'Audit-Log über jeden KI-Call (Provider, Token, Kosten, User)', o: 'no', r: 'yes' },
          { f: 'AI-Act-Risikoklassifikator (Annex III)', o: 'partial', r: 'yes' },
          { f: 'EU-Local-LLM (Ollama, kein Drittlandtransfer)', o: 'no', r: 'yes' },
          { f: 'BAIT/MaRisk-Doku-Export', o: 'no', r: 'yes' },
          { f: '72h-Meldepflicht-Timer (Art. 33)', o: 'partial', r: 'yes' },
          { f: 'Setup-Zeit', o: '6+ Wochen Sales-Cycle', r: '14 Tage Pilot' },
          { f: 'Kostenlose Self-Service-Tools', o: 'no', r: 'yes (8 Stück)' },
          { f: 'API-Keys per Tenant (programmatic)', o: 'partial', r: 'yes' },
          { f: 'Made-in-Germany / EU-Founded', o: 'no', r: 'yes' },
        ]}
      />

      <Section title="Warum Unternehmen wechseln">
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <Globe className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-titanium-50">Schrems-II-Sicherheit</strong>: Wir hosten in
              Frankfurt. OneTrust hostet in den USA. Schrems-II-Aktivisten bereiten Schrems-III vor —
              DPF-Adäquanzbeschluss könnte 2027 fallen.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Award className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-titanium-50">KI-Compliance-Native</strong>: OneTrust ist
              Cookie-Consent + GRC-Plattform aus 2016. Wir sind seit 2026 KI-First gebaut — Audit-Log
              pro AI-Call ist Default, nicht Add-on.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Euro className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-titanium-50">Pricing-Transparenz</strong>: OneTrust hat
              Sales-Termine und Quote-on-Request ab ~600 €/M. Wir haben Pricing online ab 79 €/M
              (Starter), Self-Serve, jederzeit kündbar.
            </div>
          </li>
        </ul>
      </Section>

      <Section title="Migration in 14 Tagen">
        <p>
          Wir haben einen <strong className="text-titanium-50">OneTrust-Importer</strong> (auf
          Anfrage): Cookie-Banner-Konfig + AVV-Bibliothek übernehmen, ohne neu konfigurieren. Plus:
          30-Min-Onboarding-Call mit Walkthrough für deinen DSB.
        </p>
      </Section>
    </AlternativeLanding>
  );
}
