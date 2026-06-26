import { Cookie, Globe, Check, Code } from 'lucide-react';
import { AlternativeLanding, Section, ComparisonTable } from './alternative/AlternativeLanding';

export function BorlabsAlternative() {
  return (
    <AlternativeLanding
      config={{
        headerTitle: 'Borlabs-Alternative',
        Icon: Cookie,
        iconGradient: 'bg-gradient-to-br from-amber-500 to-orange-600',
        badgeIcon: Globe,
        badgeClass: 'border-amber-900 bg-amber-950/30 text-amber-300',
        badgeText: 'Über WordPress hinaus · 1-Zeile-Embed · KI-Compliance inklusive',
        headline: (
          <>
            Borlabs-Alternative —{' '}
            <span className="text-security-400">für alle Stacks, nicht nur WordPress</span>
          </>
        ),
        sublineMaxWidth: 'max-w-2xl',
        subline: (
          <>
            Borlabs Cookie ist der DACH-Standard für WordPress (~99 €/Jahr). Wir liefern dasselbe für{' '}
            <strong className="text-titanium-50">jeden Stack</strong> (React, Vue, Next, Astro,
            statische Sites) plus AVV, VVT, AI-Act-Tools — ab 79 €/Monat (Starter), Free Audit
            kostenlos.
          </>
        ),
        cta: {
          heading: 'Snippet kopieren, einfügen, fertig',
          buttons: [
            { to: '/cookie-consent-sdk', label: 'SDK-Snippet ansehen', variant: 'primary' },
            { to: '/pricing?source=borlabs-alt', label: 'Tarif starten', variant: 'secondary' },
            { to: '/dsgvo-tool-vergleich', label: 'Voller Tool-Vergleich', variant: 'ghost' },
          ],
        },
        jsonLd: {
          headline: 'Borlabs-Alternative — für alle Stacks, nicht nur WordPress',
          description:
            'Borlabs vs RealSyncDynamics.AI: Cookie-Consent für jeden Stack plus AVV, VVT, AI-Act-Tools ab 79 €/M.',
          datePublished: '2026-05-06',
        },
      }}
    >
      <ComparisonTable
        competitor="Borlabs"
        rows={[
          { f: 'Pricing', o: '99 €/Jahr (Single-Site)', r: '79 €/M (Starter) · Free Audit kostenlos' },
          { f: 'Plattform-Support', o: 'WordPress only', r: 'Jeder Stack (React, Vue, Next, Astro, statisch, PHP, …)' },
          { f: 'BfDI 2024 konform (3 gleichberechtigte Buttons)', o: 'yes', r: 'yes' },
          { f: '1-Zeile-Embed (Snippet)', o: 'no', r: 'yes' },
          { f: 'Service-Blocker (YouTube, Maps, …)', o: 'yes', r: 'partial' },
          { f: 'Consent-Audit-Log + Export', o: 'partial', r: 'yes' },
          { f: 'i18n DE/EN', o: 'yes', r: 'yes' },
          { f: 'AVV-Generator', o: 'no', r: 'yes' },
          { f: 'VVT-Wizard (Art. 30)', o: 'no', r: 'yes' },
          { f: 'DSFA-Wizard (Art. 35)', o: 'no', r: 'yes' },
          { f: 'AI-Act-Klassifikator', o: 'no', r: 'yes' },
          { f: 'AI-Audit-Log (pro KI-Call)', o: 'no', r: 'yes' },
          { f: '72h-Meldepflicht-Timer', o: 'no', r: 'yes' },
          { f: 'Bußgeld-Rechner', o: 'no', r: 'yes' },
          { f: 'Multi-Tenant für Agenturen', o: 'no', r: 'yes' },
          { f: 'EU-Hosted', o: 'yes', r: 'yes' },
          { f: 'Made-in-Germany', o: 'yes', r: 'yes' },
        ]}
      />

      <Section title="Wann Borlabs die richtige Wahl ist">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du betreibst <strong className="text-titanium-50">ausschließlich WordPress</strong> und
              willst ein WP-Plugin im Admin-Backend.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du brauchst Service-Blocker für YouTube/Maps/Vimeo mit Wartung über das WP-Backend.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du brauchst <em>nur</em> Cookie-Consent — keine weiteren DSGVO-Tools.
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Wann RealSync die richtige Wahl ist">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du betreibst <strong className="text-titanium-50">eine moderne Web-App</strong> (React,
              Vue, Next, Astro, Svelte) — Borlabs bringt nichts.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du betreibst <strong className="text-titanium-50">mehrere Sites</strong> (Multi-Tenant
              Agentur-Setup) — Borlabs lizensiert pro Site.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du nutzt <strong className="text-titanium-50">KI</strong> und brauchst zusätzlich
              AI-Act-Klassifikator + Audit-Log.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du willst <strong className="text-titanium-50">eine Plattform für alles</strong> (AVV,
              VVT, DSFA, Bußgeld-Rechner) statt 5 Tools von 5 Anbietern.
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Migration in unter einer Stunde">
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Borlabs-Plugin deaktivieren (oder bei Non-WP: bestehendes Snippet entfernen).</li>
          <li>Unser Snippet einfügen — auch in WordPress per Header-Footer-Plugin oder im Theme-Header.</li>
          <li>Service-Blocker manuell mappen (Liste an Drittanbietern aus Borlabs-Config 1:1 übertragbar).</li>
          <li>Optional: Custom-Theme via CSS-Override anpassen.</li>
        </ol>
        <div className="p-3 bg-obsidian-950 border border-titanium-700 rounded-none flex items-start gap-3 mt-4">
          <Code className="h-4 w-4 text-emerald-400 shrink-0 mt-1" />
          <code className="text-emerald-300 text-xs font-mono break-all leading-relaxed">
            {'<script src="https://RealSyncDynamicsAI.de/sdk/cookie-consent.js" data-rsd-key="YOUR_KEY"></script>'}
          </code>
        </div>
      </Section>
    </AlternativeLanding>
  );
}
