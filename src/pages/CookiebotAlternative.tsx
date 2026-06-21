import { Cookie, Globe, Check, Code } from 'lucide-react';
import { CompetitorComparisonSection } from '../components/CompetitorComparisonSection';
import { ConsentLimitsSection } from '../components/sections/ConsentLimitsSection';
import { COOKIEBOT_COMPARISON } from '../config/competitor-comparisons';
import {
  AlternativeLanding,
  Section,
  ComparisonTable,
  WarningCallout,
} from './alternative/AlternativeLanding';

export function CookiebotAlternative() {
  return (
    <AlternativeLanding
      config={{
        headerTitle: 'Cookiebot-Alternative',
        Icon: Cookie,
        iconGradient: 'bg-gradient-to-br from-amber-500 to-orange-600',
        badgeIcon: Globe,
        badgeClass: 'border-amber-900 bg-amber-950/30 text-amber-300',
        badgeText: 'Schrems-II-fest · EU-Hosted · DACH-Pricing',
        headline: (
          <>
            Cookiebot-Alternative —{' '}
            <span className="text-security-400">EU-souverän statt US-Cloud</span>
          </>
        ),
        sublineMaxWidth: 'max-w-2xl',
        subline: (
          <>
            Cookiebot (Cybot A/S, gehört zu Usercentrics) ist beliebt — wurde aber 2022 vom VG
            Wiesbaden wegen US-Datentransfer (Akamai-CDN){' '}
            <strong className="text-titanium-50">untersagt</strong>. Wir liefern dasselbe — EU-hosted,
            ohne US-CDN, ab 79 €/Monat (Starter).
          </>
        ),
        cta: {
          heading: 'EU-Hosting als Default. 79 €/M (Starter) statt 110 €/M.',
          buttons: [
            { to: '/cookie-consent-sdk', label: 'SDK-Snippet ansehen', variant: 'primary' },
            { to: '/pricing?source=cookiebot-alt', label: 'Tarif starten', variant: 'secondary' },
            { to: '/dsgvo-tool-vergleich', label: 'Voller Tool-Vergleich', variant: 'ghost' },
          ],
        },
        jsonLd: {
          headline: 'Cookiebot-Alternative — EU-souverän statt US-Cloud',
          description:
            'Cookiebot vs RealSyncDynamics.AI: EU-Hosting als Default, DACH-Pricing, AI-Act-Tools + Audit-Log.',
          datePublished: '2026-05-06',
        },
      }}
    >
      <WarningCallout>
        <strong className="text-amber-100">Wichtig zur Schrems-II-Lage:</strong> Das
        VG-Wiesbaden-Urteil (6 L 738/21.WI) wurde im OVG-Verfahren später eingeschränkt. Cookiebot hat
        zwischenzeitlich EU-Hosting-Optionen ergänzt. Der Punkt: Du musst bei Cookiebot aktiv darauf
        achten, EU-only zu konfigurieren — bei uns ist EU-Hosting Default ohne Wahl.
      </WarningCallout>

      {/* Strategischer 9-Capability-Vergleich (PR #134) */}
      <CompetitorComparisonSection {...COOKIEBOT_COMPARISON} />

      {/* Cookie Banner lösen nur einen Teil — Positionierungs-Section */}
      <ConsentLimitsSection />

      <div className="text-center pt-4">
        <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-silver-400 mb-3">
          Detail-Vergleich · Feature-Matrix
        </div>
        <h2 className="font-display font-bold text-titanium-50 text-2xl sm:text-3xl tracking-tight leading-tight">
          17 konkrete Features im Direktvergleich
        </h2>
      </div>

      <ComparisonTable
        competitor="Cookiebot"
        rows={[
          { f: 'Pricing ab', o: '~110 €/M (Premium)', r: '79 €/M (Starter) · Free Audit kostenlos' },
          { f: 'EU-Hosting Default', o: 'partial', r: 'yes' },
          { f: 'BfDI 2024 konform', o: 'yes', r: 'yes' },
          { f: 'Auto-Cookie-Scan (Crawler)', o: 'yes', r: 'partial' },
          { f: 'i18n (40+ Sprachen)', o: 'yes', r: 'partial' },
          { f: '3 gleichberechtigte Buttons', o: 'yes', r: 'yes' },
          { f: '1-Zeile-Embed', o: 'yes', r: 'yes' },
          { f: 'Consent-Audit-Log + Export', o: 'yes', r: 'yes' },
          { f: 'Google Consent Mode v2', o: 'yes', r: 'yes' },
          { f: 'IAB TCF v2.2', o: 'yes', r: 'partial' },
          { f: 'AVV-Generator', o: 'no', r: 'yes' },
          { f: 'VVT-Wizard (Art. 30)', o: 'no', r: 'yes' },
          { f: 'AI-Act-Klassifikator', o: 'no', r: 'yes' },
          { f: 'AI-Audit-Log (pro KI-Call)', o: 'no', r: 'yes' },
          { f: '72h-Meldepflicht-Timer', o: 'no', r: 'yes' },
          { f: 'Bußgeld-Rechner', o: 'no', r: 'yes' },
          { f: 'Made-in-Germany', o: 'no (DK)', r: 'yes' },
        ]}
      />

      <Section title="Wann Cookiebot die richtige Wahl ist">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du brauchst <strong className="text-titanium-50">automatischen Cookie-Crawler</strong>{' '}
              mit Wartung über Web-Backend.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du brauchst <strong className="text-titanium-50">vollständigen IAB TCF v2.2</strong> für
              AdTech-Stack.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du brauchst <strong className="text-titanium-50">40+ Sprachen out-of-the-box</strong>{' '}
              (international).
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Wann RealSync die richtige Wahl ist">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du willst{' '}
              <strong className="text-titanium-50">EU-Hosting ohne Konfigurations-Aufwand</strong> —
              bei uns Default, nicht Option.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Du willst <strong className="text-titanium-50">DACH-Pricing</strong> (49 € statt 110
              €/M).
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
              Du willst <strong className="text-titanium-50">eine Plattform</strong> für AVV, VVT,
              Cookie und KI — statt 3 Anbietern.
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Migration in unter einer Stunde">
        <p>
          Cookiebot-Snippet entfernen, RealSync-Snippet einfügen. Bestehende Consent-Cookies bleiben
          kompatibel.
        </p>
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
