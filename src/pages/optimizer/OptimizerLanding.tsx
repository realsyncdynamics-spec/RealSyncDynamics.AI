/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SEITE 1 — /optimizer  (Landing / Feature-Erklärung)
 * Typ: INFO. Genau ein primärer CTA → /optimizer/scan.
 */

import { Link } from 'react-router-dom';
import {
  ArrowRight, Gauge, Search, ShieldAlert, Code2, Scale, CheckCircle2, XCircle, LogIn,
} from 'lucide-react';

import { OptimizerLayout } from './OptimizerLayout';

const ANALYSES = [
  { icon: Gauge, title: 'Performance', desc: 'Ladezeit, LCP, Render-Blocker.' },
  { icon: Search, title: 'SEO', desc: 'Meta-Tags, strukturierte Daten, Indexierbarkeit.' },
  { icon: ShieldAlert, title: 'Sicherheit', desc: 'HTTPS, Header, offengelegte Endpunkte.' },
  { icon: Code2, title: 'Code-Qualität', desc: 'Veraltete Skripte, Konsolen-Fehler, Assets.' },
  { icon: Scale, title: 'DSGVO', desc: 'Tracking-ohne-Consent, Drittanbieter, Cookies.' },
];

const TIERS: { name: string; highlight?: boolean; feature: string }[] = [
  { name: 'Gratis', feature: 'Score + Kategorie-Übersicht' },
  { name: 'Bronze', feature: 'Vollständiger Bericht + Fix-Anleitung' },
  { name: 'Silber', highlight: true, feature: 'Auto-Fix für ausgewählte Befunde' },
  { name: 'Gold', feature: 'Kontinuierliches Monitoring' },
  { name: 'Platin', feature: 'Priorisierte Analyse + Reports' },
  { name: 'Diamant', feature: 'Dedizierter Umfang + SLA' },
];

const LIMITS = [
  'Keine Änderungen an Deiner Website ohne Deine ausdrückliche Freigabe.',
  'Keine Rechtsberatung — die DSGVO-Prüfung ist eine technische Vorprüfung.',
  'Nur öffentlich erreichbare Seiten; kein Login-Bereich, keine Backends.',
];

export function OptimizerLanding() {
  return (
    <OptimizerLayout
      step={1}
      pageType="info"
      metaTitle="Cloud Code Optimizer — Website-Analyse | RealSync Dynamics"
      metaDescription="Analysiere Performance, SEO, Sicherheit, Code-Qualität und DSGVO deiner Website. Erster Scan kostenlos, ohne Anmeldung."
      metaUrl="https://RealSyncDynamicsAI.de/optimizer"
    >
      <h1 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
        Cloud Code Optimizer — was kann er für dich tun?
      </h1>
      <p className="text-lg text-titanium-300 leading-relaxed mb-8 max-w-2xl">
        Der Optimizer prüft deine Website technisch durch und zeigt dir konkret, wo sie
        schneller, sicherer und rechtssicherer wird. Der erste Scan ist kostenlos und
        braucht keine Anmeldung.
      </p>

      {/* Was er analysiert */}
      <div className="grid sm:grid-cols-2 gap-3 mb-10">
        {ANALYSES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-3 bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <Icon className="h-5 w-5 text-security-400 shrink-0 mt-0.5" aria-hidden />
            <div>
              <div className="font-display font-bold text-sm text-titanium-50">{title}</div>
              <div className="text-sm text-titanium-400">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tier-Tabelle */}
      <h2 className="font-display font-bold text-titanium-100 mb-3">In welchen Paketen ist er enthalten?</h2>
      <div className="border border-titanium-900 rounded-none overflow-hidden mb-10">
        {TIERS.map((tier, idx) => (
          <div
            key={tier.name}
            className={
              'flex items-center justify-between gap-4 px-4 py-3 ' +
              (idx > 0 ? 'border-t border-titanium-900 ' : '') +
              (tier.highlight ? 'bg-security-900/20' : 'bg-obsidian-900')
            }
          >
            <span className="font-mono text-xs uppercase tracking-wider text-titanium-200 w-20 shrink-0">
              {tier.name}
            </span>
            <span className="text-sm text-titanium-300 flex-1">{tier.feature}</span>
            {tier.highlight && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-security-300">beliebt</span>
            )}
          </div>
        ))}
      </div>

      {/* Was er NICHT kann */}
      <h2 className="font-display font-bold text-titanium-100 mb-3">Was der Optimizer nicht macht</h2>
      <ul className="space-y-2 mb-10">
        {LIMITS.map((limit) => (
          <li key={limit} className="flex items-start gap-2 text-sm text-titanium-400">
            <XCircle className="h-4 w-4 text-titanium-600 shrink-0 mt-0.5" aria-hidden />
            {limit}
          </li>
        ))}
      </ul>

      {/* Primärer CTA — genau einer */}
      <div className="flex flex-col items-start gap-4">
        <Link
          to="/optimizer/scan"
          className="inline-flex items-center gap-2 bg-security-500 hover:bg-security-400 text-white font-bold px-6 py-3 rounded-none transition-colors"
        >
          Website jetzt scannen
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="flex items-center gap-1.5 text-sm text-titanium-500">
          <CheckCircle2 className="h-4 w-4 text-petrol" aria-hidden /> Kostenlos · kein Account · ca. 30 Sekunden
        </p>
      </div>

      {/* Footer-Link */}
      <div className="mt-10 pt-6 border-t border-titanium-900">
        <Link
          to="/optimizer/auth"
          className="inline-flex items-center gap-1.5 text-sm text-titanium-400 hover:text-titanium-100 transition-colors"
        >
          <LogIn className="h-4 w-4" /> Bereits Kunde? Direkt einloggen
        </Link>
      </div>
    </OptimizerLayout>
  );
}
