import { Briefcase, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BranchenLanding, Section, UseCaseGrid } from './branchen/BranchenLanding';

export function FinTechLanding() {
  return (
    <BranchenLanding
      config={{
        headerTitle: 'FinTech-Compliance',
        Icon: Briefcase,
        iconGradient: 'bg-gradient-to-br from-amber-500 to-orange-700',
        badgeClass: 'border-amber-900 bg-amber-950/30 text-amber-300',
        badgeText: 'FinTech · BAIT · MaRisk · DORA · BaFin-ready',
        headline: (
          <>
            KI für FinTechs — <span className="text-security-400">BaFin-tauglich</span> in 14 Tagen
          </>
        ),
        subline: (
          <>
            Bonitätsprüfung mit GPT, Fraud-Detection mit Claude, AML-Dokumentation mit Gemini. BAIT AT
            4.5 + MaRisk AT 7.2 + DORA + AI Act = stapelt sich bis Q1 2027 auf.
          </>
        ),
        cta: {
          heading: 'BaFin-ready bis Ende 2026 — wir machen es in 14 Tagen.',
          buttons: [
            { to: '/contact-sales?source=fintech', label: 'Founding Access starten', variant: 'primary' },
            { to: '/bait-marisk-compliance-guide', label: 'BAIT-Guide', variant: 'secondary' },
            { to: '/audit', label: 'Site-Scan', variant: 'ghost' },
          ],
        },
        jsonLd: {
          headline: 'KI für FinTechs — BAIT · MaRisk · DORA · AI Act konform',
          description:
            'Bonitätsprüfung, Fraud-Detection, AML mit KI — BaFin-tauglich mit Audit-Log, AVV und Human-Oversight.',
          datePublished: '2026-05-06',
        },
      }}
    >
      <Section title="Stack der regulatorischen Pflichten">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50">BAIT AT 4.5</strong> — KI-Anbieter sind „sonstiger
            Fremdbezug von IT-Dienstleistungen". Risikoanalyse + AVV + laufende Überwachung Pflicht.
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50">MaRisk AT 7.2</strong> — IT-Risiken aus KI-Modellen:
            Modell-Risikomanagement, Daten-Lineage, Logging.
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50">AI Act ab 8/2026</strong> — Bonitätsprüfung +
            Kreditscoring = High-Risk → Conformity Assessment + Tech-Doku + Human Oversight.
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50">DORA seit 1/2025</strong> — Register kritischer
            ICT-Drittanbieter, quartalsweise Stresstests.
          </li>
        </ul>
      </Section>

      <Section title="Was wir liefern">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Audit-Log pro AI-Call</strong> — Provider,
              Modell-Version, Tokens, Kosten, Datenresidenz, User. Direkt für BaFin-Sonderprüfungen
              exportierbar (CSV + signed PDF).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">AVV-Generator BAIT-tauglich</strong> — vertragliche
              Mindestinhalte gemäß BAIT AT 4.5 + Sub-Auftragsverarbeiter-Liste + Audit-Rechte gegenüber
              Provider.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Multi-Provider-Routing mit Fallback</strong> —
              Anthropic-Ausfall → automatischer Fallback auf Google oder Self-Hosted-Ollama. Kein
              Single-Point-of-Failure.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Provider-Health-Monitoring</strong> mit Alert wenn
              Anbieter Datenpanne meldet.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Human-Oversight-Workflow</strong> mit Override +
              Audit-Trail für High-Risk-Entscheidungen.
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Use-Cases">
        <UseCaseGrid
          items={[
            { t: 'Bonitätsprüfung mit AI', d: 'Scoring-Modell mit Audit-Log + Erklärbarkeit-Layer + Human-Override' },
            { t: 'Fraud-Detection', d: 'Real-time-Klassifikation mit signiertem PDF-Trail für jeden Alert' },
            { t: 'AML / Anti-Money-Laundering', d: 'Pattern-Erkennung mit Aufsichts-tauglicher Doku' },
            { t: 'Kunden-Email-Klassifikation', d: 'Routing in Service-Queues, redacted vor AI-Aufruf' },
            { t: 'Compliance-Doku-Automation', d: 'Auto-generierte Reports für interne Audits + BaFin' },
            { t: 'Vertrags-Klauseln-Review', d: 'Kreditverträge / B2B-Verträge mit Risk-Scoring' },
          ]}
        />
      </Section>
    </BranchenLanding>
  );
}
