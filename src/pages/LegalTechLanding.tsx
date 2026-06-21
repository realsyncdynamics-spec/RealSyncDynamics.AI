import { Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BranchenLanding, Section, UseCaseGrid } from './branchen/BranchenLanding';

export function LegalTechLanding() {
  return (
    <BranchenLanding
      config={{
        headerTitle: 'Legal-Tech-Compliance',
        Icon: Scale,
        iconGradient: 'bg-gradient-to-br from-blue-500 to-indigo-700',
        badgeClass: 'border-blue-900 bg-blue-950/30 text-blue-300',
        badgeText: 'Kanzleien · Mandantengeheimnis · § 203 StGB',
        headline: (
          <>
            KI für Anwälte — <span className="text-security-400">ohne § 203 StGB-Risiko</span>.
          </>
        ),
        subline: (
          <>
            Mandanten-Recherche mit ChatGPT. Vertrags-Analyse via Claude. Schriftsatz-Drafts mit
            Gemini. Alles legal — wenn die Compliance-Schicht stimmt.
          </>
        ),
        cta: {
          heading: 'Mandanten-Geheimnis bleibt geheim. KI-Vorteil bleibt erhalten.',
          buttons: [
            { to: '/contact-sales?source=legaltech', label: 'Founding Access starten', variant: 'primary' },
            { to: '/audit', label: 'Kanzlei-Site auditieren', variant: 'secondary' },
            { to: '/avv-generator', label: 'AVV-Template', variant: 'ghost' },
          ],
        },
        jsonLd: {
          headline: 'KI für Anwälte — DSGVO + § 203 StGB konform',
          description:
            'Mandanten-Daten in ChatGPT? Wie Kanzleien KI compliant einsetzen ohne Verschwiegenheitsbruch.',
          datePublished: '2026-05-06',
        },
      }}
    >
      <Section title="Das Problem">
        <p>Mandanten-Daten in einem ChatGPT-Prompt = Offenbarung an OpenAI L.L.C., USA. Konsequenz:</p>
        <ul className="space-y-1.5 mt-3 text-sm">
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50">§ 203 StGB</strong> — Verletzung von Privatgeheimnissen,
            bis 1 Jahr Freiheitsstrafe
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50">DSGVO Art. 32</strong> + Schrems-II — Drittlandtransfer
            ohne SCCs + IP-Anonymisierung
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50">BRAO § 43a</strong> — Verschwiegenheitspflicht-Bruch
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50">Anwaltskammer-Reklamation</strong> bis Berufsverbot
          </li>
        </ul>
      </Section>

      <Section title="Was wir liefern">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">EU-Datenresidenz erzwingbar pro Mandant</strong> —
              sensible Cases gehen via Frankfurt-Hosted Ollama, Routine-Recherche ggf. via Cloud (mit
              AVV+SCCs)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Audit-Log pro AI-Call</strong> — wer hat welchen
              Mandanten-Bezug an welche AI geschickt
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">AVV-Generator pro Mandant</strong> — anwendbar als
              Anhang im Mandatsvertrag, Sub-Auftragsverarbeiter-Liste inkl.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Auto-Pseudonymisierung</strong> — Klartext-Namen
              werden vor jedem AI-Prompt durch Aliase ersetzt, Reverse-Mapping nur intern
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Compliance-Reports als Mandanten-Asset</strong> — Du
              kannst dem Mandanten zeigen, wie seine Daten genau verarbeitet werden
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Use-Cases">
        <UseCaseGrid
          items={[
            { t: 'Mandanten-Recherche', d: 'Kontextualisierung mit GPT-4 / Claude · Auto-Pseudonymisierung pre-prompt' },
            { t: 'Vertrags-Klauseln-Analyse', d: 'Risk-Scoring via Claude · Audit-Log fürs Mandat' },
            { t: 'Schriftsatz-Draft', d: 'Erstentwurf via Claude · Final-Review human-only' },
            { t: 'Discovery-Volltextsuche', d: 'RAG-Pipeline auf eigene Document-DB, EU-local-only' },
            { t: 'Prozess-Risiko-Estimate', d: 'Historische Urteile-Analyse · keine personenbez. Daten in Prompts' },
            { t: 'Mandantenkommunikation-Templates', d: 'Standard-Briefe + Mahnungen · Mandanten-Daten redacted' },
          ]}
        />
      </Section>

      <Section title="Pricing für Kanzleien">
        <p>
          <strong className="text-titanium-50">Starter 79 €/M</strong> für Solo-Anwälte ·
          <strong className="text-titanium-50"> Growth 249 €/M</strong> für Teams (Multi-Tenant + API) ·
          <strong className="text-titanium-50"> Agency 699 €/M</strong> für mittelgroße Kanzleien (10
          Mandanten-Sites + White-Label-Reports). 14 Tage Pilot kostenlos · Mandanten-Setup AI-geführt
          in einem Schritt.
        </p>
      </Section>
    </BranchenLanding>
  );
}
