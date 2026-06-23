import { Cookie, Euro, Code } from 'lucide-react';
import { AlternativeLanding, Section, ComparisonTable } from './alternative/AlternativeLanding';

export function UsercentricsAlternative() {
  return (
    <AlternativeLanding
      config={{
        headerTitle: 'Usercentrics-Alternative',
        Icon: Cookie,
        iconGradient: 'bg-gradient-to-br from-amber-500 to-orange-600',
        badgeIcon: Euro,
        badgeClass: 'border-amber-900 bg-amber-950/30 text-amber-300',
        badgeText: '3× günstiger · KI-Compliance inklusive · 1-Zeile-Embed',
        headline: (
          <>
            Usercentrics-Alternative —{' '}
            <span className="text-security-400">deutlich mehr als Cookie-Banner</span>
          </>
        ),
        subline: (
          <>
            Usercentrics ist DACH-Marktführer für Cookie-Consent (~150 €/M). Wir bieten dasselbe ab 79
            €/M (Starter) —
            <strong className="text-titanium-50"> plus AVV, VVT, AI-Act-Tools, Audit-Log</strong>.
          </>
        ),
        cta: {
          heading: 'Test in 5 Minuten — Snippet einfügen, fertig.',
          buttons: [
            { to: '/cookie-consent-sdk', label: 'SDK-Snippet ansehen', variant: 'primary' },
            { to: '/pricing?source=usercentrics-alt', label: 'Tarif starten', variant: 'secondary' },
            { to: '/dsgvo-tool-vergleich', label: 'Volles Tool-Vergleich', variant: 'ghost' },
          ],
        },
        jsonLd: {
          headline: 'Usercentrics-Alternative — mehr als Cookie-Banner',
          description:
            'Usercentrics vs RealSyncDynamics.AI: gleiche Consent-Features ab 79 €/M plus AVV, VVT, AI-Act-Tools.',
          datePublished: '2026-05-06',
        },
      }}
    >
      <ComparisonTable
        competitor="Usercentrics"
        rows={[
          { f: 'Pricing ab', o: '~150 €/M', r: '79 €/M (Starter) · ab Free Audit kostenlos' },
          { f: 'Cookie-Consent-Banner BfDI 2024', o: 'yes', r: 'yes' },
          { f: 'i18n DE/EN', o: 'yes', r: 'yes' },
          { f: '3 gleichberechtigte Buttons (kein Dark-Pattern)', o: 'yes', r: 'yes' },
          { f: 'Embedbar via 1-Zeile-Script', o: 'partial', r: 'yes' },
          { f: 'Consent-Audit-Log + Export', o: 'partial', r: 'yes' },
          { f: 'AVV-Generator', o: 'no', r: 'yes' },
          { f: 'VVT-Wizard (Art. 30)', o: 'no', r: 'yes' },
          { f: 'DSFA-Wizard (Art. 35)', o: 'no', r: 'yes' },
          { f: 'AI-Act-Risikoklassifikator', o: 'no', r: 'yes' },
          { f: 'AI-Audit-Log (pro KI-Call)', o: 'no', r: 'yes' },
          { f: 'EU-Hosted', o: 'yes', r: 'yes' },
          { f: '72h-Meldepflicht-Timer', o: 'no', r: 'yes' },
          { f: 'Bußgeld-Rechner', o: 'no', r: 'yes' },
          { f: 'Setup-Zeit', o: '1-2 Wochen', r: 'Selbe Stunde (Snippet einbetten)' },
          { f: 'Kostenlose Self-Service-Tools', o: 'no', r: 'yes (8 Stück)' },
          { f: 'Made-in-Germany', o: 'yes', r: 'yes' },
        ]}
      />

      <Section title="Warum wechseln">
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <Code className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-titanium-50">1-Zeile-Embed statt Konfigurator-Hölle</strong>:
              <code className="ml-2 px-2 py-0.5 bg-obsidian-950 border border-titanium-700 text-emerald-300 text-[11px] font-mono">
                {'<script src="…/sdk/cookie-consent.js" data-rsd-key="…">'}
              </code>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Euro className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-titanium-50">3× günstiger</strong> bei gleichen Features. Plus 8
              weitere Compliance-Tools inklusive ab 79 €/M (Starter).
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Cookie className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-titanium-50">KI-Compliance ist Default</strong>. Usercentrics ist
              Cookie-only. Wenn du KI nutzt, brauchst du beides — wir haben beides.
            </div>
          </li>
        </ul>
      </Section>

      <Section title="Migration in unter einer Stunde">
        <p>
          Usercentrics-Snippet entfernen, RealSync-Snippet einfügen. Fertig. Bestehende Consent-Cookies
          bleiben erhalten (kein Re-Prompt-Spam für deine User). Optional: Custom-Theme via
          CSS-Override.
        </p>
      </Section>
    </AlternativeLanding>
  );
}
