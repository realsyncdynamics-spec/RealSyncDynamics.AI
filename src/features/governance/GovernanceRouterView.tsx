import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Share2, Copy, Check, ShieldCheck, Globe,
  AlertTriangle, ArrowRight,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';
import { getSupabaseUrl } from '../../lib/supabaseUrl';
import { EdgeFunctionAvailabilityNotice } from '../../components/landing/EdgeFunctionAvailabilityNotice';
import {
  expansionStageFromEntitlements,
  allowCloudFallback,
  modelsResponseForStage,
  quotaKeyForStage,
  EXPANSION_STAGES,
  EXPANSION_STAGE_LABELS,
  nextExpansionHint,
  ART50_DISCLOSURE_DE,
  type AiResidency,
} from '../../core/ai-gateway/governanceRouterCatalog';

/**
 * Governance Open Router — Anschlussfläche für Cursor und SDKs.
 *
 * Die Base-URL ist öffentlich (wie jede `VITE_*`-Variable). Das Geheimnis
 * ist der `rsd_gov_`-Key aus /app/keys. Stufe und Modelle folgen den
 * bestehenden Entitlements; ein Stripe-Upgrade skaliert den Katalog
 * automatisch, ohne neuen Key und ohne automatische Abbuchung.
 */

function _GovernanceRouterView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const GovernanceRouterView = withPerformanceMonitoring(
  _GovernanceRouterView,
  'GovernanceRouterView',
  { threshold: 500, maxRenders: 10 },
);

const BASE_URL = `${getSupabaseUrl()}/functions/v1/governance-router/v1`;

function Inner() {
  const { hasFeature, getLimit } = useTenant();
  const stage = expansionStageFromEntitlements({
    hasAutomations: hasFeature('ai.tool.automations'),
    aiCallsMonthly: getLimit('limit.ai_calls_monthly'),
  });
  // Die UI kennt die serverseitige Residenz nicht live — Cloud ist der
  // Default der RPC, EU-lokal sperrt der Router zusätzlich. Hier zeigen
  // wir den Katalog ohne EU-Zwang; der Hinweis verweist auf die Einstellung.
  const residency: AiResidency = 'cloud';
  const allowCloud = allowCloudFallback(stage, residency);
  const models = modelsResponseForStage(stage, allowCloud);
  const quotaKey = quotaKeyForStage(stage);
  const hint = nextExpansionHint(stage);
  const label = EXPANSION_STAGE_LABELS[stage];

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-security-600 flex items-center justify-center">
              <Share2 className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Governance Router</div>
              <div className="text-[11px] text-titanium-400 font-medium">OpenAI-kompatibel · EU-KI-VO · DSGVO</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <EdgeFunctionAvailabilityNotice
          functions={['governance-router']}
          title="Der Router ist im Repository, noch nicht in Produktion"
          detail="Nach dem nächsten Deploy beantwortet derselbe Endpunkt Cursor und SDKs. Bis dahin schlägt der Base-URL-Aufruf mit 404 fehl."
          className="rounded-none border-amber-900 bg-amber-950/40 [&_p:first-child]:text-amber-200 [&_p:last-child]:text-titanium-400"
        />

        <section className="border border-titanium-900 bg-obsidian-900 p-5">
          <h1 className="font-display text-lg font-bold text-titanium-50 mb-2">
            Sicherheitsinfrastruktur vor dem Modell
          </h1>
          <p className="text-sm text-titanium-400 leading-relaxed">
            Cursor, Agenten und interne Automationen sprechen denselben OpenAI-Eingang.
            Davor liegen Mandant, Residenz, Kontingent, Policy Decision Point und ein
            Prüfpfad ohne Prompt-Inhalt. Das ist kein Modellmarktplatz — es ist die
            Governance-Schicht des RealSyncDynamicsAI-Ökosystems.
          </p>
        </section>

        <section className="border border-titanium-900 bg-obsidian-900 p-5 space-y-4">
          <h2 className="font-display text-sm font-bold text-titanium-50 uppercase tracking-wide">Cursor</h2>
          <ol className="text-sm text-titanium-300 space-y-2 list-decimal list-inside">
            <li>Settings → Models → Override OpenAI Base URL</li>
            <li>Base URL auf den Endpunkt unten setzen</li>
            <li>API-Key: ein <span className="font-mono text-xs">rsd_gov_</span>-Schlüssel mit Quelle <span className="font-mono text-xs">api</span> unter <Link to="/app/keys" className="text-cyan-400 hover:underline">/app/keys</Link></li>
            <li>Modell: einer der auf dieser Stufe erlaubten Namen (z. B. <span className="font-mono text-xs">gpt-4o-mini</span> oder <span className="font-mono text-xs">fast-local</span>)</li>
          </ol>
          <CopyRow label="Base URL" value={BASE_URL} />
          <p className="text-[11px] text-titanium-500 font-mono break-all">{BASE_URL}</p>
        </section>

        <section className="border border-titanium-900 bg-obsidian-900 p-5 space-y-4">
          <h2 className="font-display text-sm font-bold text-titanium-50 uppercase tracking-wide">Expansionsstufe</h2>
          <p className="text-sm text-titanium-400">
            Die Stufe folgt Kundenzahl und Umsatz nur über den bestehenden Plan:
            Stripe-Upgrade ändert Entitlements, der Katalog skaliert mit. Keine
            automatische Abbuchung, kein neues Kontingent-Vokabular.
          </p>
          <ol className="grid gap-2 sm:grid-cols-5">
            {EXPANSION_STAGES.map((s) => (
              <li
                key={s}
                className={`border p-3 ${s === stage ? 'border-cyan-500 bg-obsidian-800' : 'border-titanium-900 bg-obsidian-950'}`}
              >
                <div className="font-mono text-[10px] uppercase text-titanium-500">{s}</div>
                <div className="text-xs font-semibold text-titanium-100 mt-1">{EXPANSION_STAGE_LABELS[s].title}</div>
              </li>
            ))}
          </ol>
          <div className="text-sm">
            <span className="font-semibold text-titanium-50">{label.title}.</span>{' '}
            <span className="text-titanium-400">{label.detail}</span>
          </div>
          {quotaKey && (
            <div className="text-[11px] font-mono text-titanium-500">Kontingent: {quotaKey}</div>
          )}
          {hint && (
            <div className="flex items-start gap-2 text-sm text-titanium-400">
              <ArrowRight className="h-4 w-4 mt-0.5 text-cyan-500 shrink-0" />
              <span>{hint}</span>
            </div>
          )}
        </section>

        <section className="border border-titanium-900 bg-obsidian-900 p-5 space-y-3">
          <h2 className="font-display text-sm font-bold text-titanium-50 uppercase tracking-wide">Freigeschaltete Modelle</h2>
          {stage === 'observe' ? (
            <p className="text-sm text-titanium-400">Keine Modelle — Stufe Beobachten.</p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-2">
              {models.data.map((m) => (
                <li key={m.id} className="border border-titanium-900 bg-obsidian-950 px-3 py-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-titanium-200">{m.id}</span>
                  <span className="font-mono text-[10px] text-titanium-500">{m.profile}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          <div className="border border-titanium-900 bg-obsidian-900 p-5 space-y-2">
            <div className="flex items-center gap-2 text-titanium-50 font-semibold text-sm">
              <Globe className="h-4 w-4 text-cyan-400" /> Residenz
            </div>
            <p className="text-sm text-titanium-400">
              EU-lokal unter <Link to="/settings/ai-residency" className="text-cyan-400 hover:underline">/settings/ai-residency</Link> sperrt Cloud-Profile
              unabhängig von der Stufe.
            </p>
          </div>
          <div className="border border-titanium-900 bg-obsidian-900 p-5 space-y-2">
            <div className="flex items-center gap-2 text-titanium-50 font-semibold text-sm">
              <ShieldCheck className="h-4 w-4 text-cyan-400" /> Art. 50
            </div>
            <p className="text-xs text-titanium-400 leading-relaxed">{ART50_DISCLOSURE_DE}</p>
          </div>
        </section>

        <section className="border border-titanium-900 bg-obsidian-900 p-5 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-titanium-400">
            Der öffentliche Assistent (<span className="font-mono text-xs">ai-gateway</span>) bleibt JWT-geschützt
            und mandantenlos. Diesen Router nicht mit jenem Endpunkt vertauschen.
          </p>
        </section>
      </main>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-titanium-500 w-20 shrink-0">{label}</span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          } catch {
            setCopied(false);
          }
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-titanium-800 bg-obsidian-950 text-xs font-semibold rounded-none hover:bg-obsidian-800"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Kopiert' : 'Kopieren'}
      </button>
    </div>
  );
}
