// Modul-Hub — die operative Capability-Übersicht des Governance OS (/app/modules).
//
// ## Rolle (Entscheidung des Eigentümers, 2026-08-30)
//
// Diese Seite ist die **Navigations- und Zustandsschicht**, nicht der Laden:
//   Was habe ich? · Was ist verfügbar? · Wo geht es hinein?
// Die kommerzielle Wahrheit — Preise, Plan-Zuordnung, Kaufentscheidung —
// liegt ausschließlich in `/app/marketplace`. Der Hub nennt deshalb keine
// Beträge, trägt keinen Kauf-Knopf und verspricht keine Aktivierung, die er
// nicht einlösen kann; gesperrte Capabilities nennen den Grund und führen
// über **einen** kontrollierten Übergang dorthin, wo entschieden wird.
// Hintergrund: `docs/product/modular-product-experience.md` §8.
//
// ## Warum Entitlement-Keys und nicht `plan.modules`
//
// Der Hub beantwortet eine Autorisierungsfrage („darf ich hier hinein?").
// Maßgeblich dafür ist allein der Entitlement-Key — `plan.modules` trägt laut
// `shared/pricing.ts` die Feature-Listen der Preisseite und ist ausdrücklich
// kein Freischaltungs-Vokabular. Die erste Fassung dieser Seite fragte über
// `canAccessModule()` gegen `plan.modules` und lag damit messbar falsch:
// im Free Audit erschien „Policies · Öffnen", obwohl `policy.packs` erst ab
// Starter gilt (Messung 2026-08-30, `test/governance/modules-hub.test.ts`).
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { planByKey, planGrants, type EntitlementKey } from '@/shared/pricing';
import { cheapestPlanForKeys } from '../market/moduleCatalog';
import { useEntitlements } from '../../core/billing/useEntitlements';

function icon(name: string): Icons.LucideIcon {
  return (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Circle;
}

/** Eine Capability des Arbeitsbereichs, wie der Hub sie führt. */
export interface HubEntry {
  id: string;
  label: string;
  icon: string;
  route: string;
  description: string;
  /**
   * Entitlement-Keys, die diese Capability voraussetzt. **Alle** müssen
   * getragen sein. Eine leere Liste heißt: für jeden Arbeitsbereich offen —
   * nicht „egal", sondern eine bewusste Aussage.
   */
  requires: EntitlementKey[];
  /** Beschriftung der Aktion, wenn die Capability offen ist. */
  openLabel: 'Öffnen' | 'Verwalten';
}

export interface HubSection {
  id: string;
  label: string;
  entries: HubEntry[];
}

export const HUB_SECTIONS: HubSection[] = [
  {
    id: 'ai-automation',
    label: 'AI & Automation',
    entries: [
      {
        id: 'website-chatbot',
        label: 'Website Chatbot',
        icon: 'MessageSquare',
        route: '/app/bots',
        description: 'Chat auf der eigenen Website — antwortet nur aus dem Unternehmenskontext, jede Antwort im Prüfpfad.',
        requires: ['bots.chat'],
        openLabel: 'Öffnen',
      },
      {
        id: 'telefon-agent',
        label: 'Telefon-Agent',
        icon: 'Phone',
        route: '/app/agents/susi',
        description: 'Sprachkanal mit Speech-to-Text, Text-to-Speech und Übergabe an Menschen.',
        requires: ['bots.voice'],
        openLabel: 'Öffnen',
      },
      {
        id: 'whatsapp-bot',
        label: 'WhatsApp Bot',
        icon: 'MessageCircle',
        route: '/app/bots',
        description: 'WhatsApp-Business-Kanal mit identischem Governance-Protokoll.',
        requires: ['bots.whatsapp'],
        openLabel: 'Öffnen',
      },
      {
        id: 'agent-runtime',
        label: 'Agent Runtime',
        icon: 'Cpu',
        route: '/app/ai-systems/agents',
        description: 'Autonome Agenten mit Identity, Policy, Runtime und Observability.',
        // Kontingent-Key als Zugangsfrage: Wer keine Läufe hat, kann die
        // Runtime nicht benutzen. `limit.agent_runs_monthly` wäre der
        // genauere Name, trägt aber eine Lücke (Growth fehlt) — siehe
        // Befund in docs/product/modular-product-experience.md §8.
        requires: ['limit.automation_runs_monthly'],
        openLabel: 'Öffnen',
      },
    ],
  },
  {
    id: 'website',
    label: 'Website',
    entries: [
      {
        id: 'landingpage-builder',
        label: 'Landingpage Builder',
        icon: 'LayoutTemplate',
        route: '/app/siteos',
        description: 'SiteOS: Prompt → geprüfter Blueprint → Publish Gate.',
        requires: [],
        openLabel: 'Öffnen',
      },
      {
        id: 'websites-domains',
        label: 'Websites & Domains',
        icon: 'Globe',
        route: '/app/websites',
        description: 'Domains, Scans und Findings je Website.',
        requires: ['website.scan'],
        openLabel: 'Verwalten',
      },
    ],
  },
  {
    id: 'governance',
    label: 'Governance',
    entries: [
      {
        id: 'risk',
        label: 'Risk',
        icon: 'AlertTriangle',
        route: '/app/risks',
        description: 'Zentrales Risikoregister mit Bewertung, Eigentümern und Maßnahmen.',
        requires: ['governance.risk_register'],
        openLabel: 'Öffnen',
      },
      {
        id: 'monitoring',
        label: 'Monitoring',
        icon: 'Activity',
        route: '/app/monitoring',
        description: 'Kontinuierliche Runtime-Überwachung von Assets, Kontrollen und SLOs.',
        requires: ['monitoring.monthly'],
        openLabel: 'Öffnen',
      },
      {
        id: 'evidence',
        label: 'Evidence',
        icon: 'FileCheck2',
        route: '/app/evidence',
        description: 'Manipulationssicherer Nachweisspeicher mit Hash-Chain und Prüfpfad.',
        requires: ['evidence.basic_vault'],
        openLabel: 'Öffnen',
      },
      {
        id: 'policies',
        label: 'Policies',
        icon: 'Scale',
        route: '/app/policy-packs',
        description: 'Policy Packs: DSGVO, EU AI Act und branchenspezifische Rahmenwerke.',
        requires: ['policy.packs'],
        openLabel: 'Öffnen',
      },
    ],
  },
];

/** Trägt der Plan alle Keys dieser Capability? */
export function isEntryOpen(planId: string | null | undefined, entry: HubEntry): boolean {
  if (entry.requires.length === 0) return true;
  return entry.requires.every((key) => planGrants(planId, key));
}

/**
 * Grund, warum eine Capability gesperrt ist — in der Sprache des Kunden.
 *
 * Kein Preis und kein Kauf-Knopf: Der Hub sagt, *warum* zu ist und *wo*
 * entschieden wird. Nennt kein wählbarer Plan die Capability, führt der Weg
 * über den Vertrieb — dieselbe Regel wie im Marketplace.
 */
export function lockReason(entry: HubEntry): string {
  const plan = cheapestPlanForKeys(entry.requires);
  const label = plan ? planByKey(plan)?.name ?? null : null;
  return label ? `Enthalten ab ${label}` : 'Auf Anfrage';
}

function EntryRow({ entry, planId, loading }: { entry: HubEntry; planId: string; loading: boolean }) {
  const Icon = icon(entry.icon);
  const offen = isEntryOpen(planId, entry);

  return (
    <div className="flex items-center gap-4 border border-titanium-900 bg-obsidian-900 px-4 py-3 transition-colors hover:border-titanium-800">
      <Icon className={`h-4 w-4 shrink-0 ${offen ? 'text-cyan-400' : 'text-titanium-700'}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${offen ? 'text-titanium-100' : 'text-titanium-400'}`}>
            {entry.label}
          </span>
          {!offen && !loading && (
            <span className="border border-titanium-800 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-titanium-600">
              {lockReason(entry)}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-titanium-500">{entry.description}</p>
      </div>
      {loading ? (
        <span className="px-3 py-1.5 font-mono text-[10px] text-titanium-700">…</span>
      ) : offen ? (
        <Link
          to={entry.route}
          className="shrink-0 border border-titanium-700 px-3 py-1.5 text-xs font-medium text-titanium-100 transition-colors hover:border-cyan-400 hover:text-cyan-400"
        >
          {entry.openLabel}
        </Link>
      ) : (
        <Link
          to="/app/marketplace"
          className="shrink-0 border border-titanium-800 px-3 py-1.5 text-xs font-medium text-titanium-400 transition-colors hover:border-titanium-600 hover:text-titanium-200"
        >
          Im Marketplace
        </Link>
      )}
    </div>
  );
}

/**
 * Operative Übersicht des Arbeitsbereichs: was ist offen (→ Öffnen), was
 * nicht (→ Grund plus Übergang in den Marketplace). Der Zustand kommt aus
 * dem Autorisierungs-Vokabular, damit die Seite dasselbe sagt wie die
 * Laufzeit — und dasselbe wie der Marketplace.
 */
export function ModulesHubView() {
  const { tier, loading } = useEntitlements();
  const planName = planByKey(tier)?.name ?? 'Free Audit';

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-600">
            Governance OS
          </p>
          <h1 className="text-xl font-bold text-titanium-50">Module</h1>
        </div>
        <span className="font-mono text-xs text-titanium-400">
          Plan: <span className="text-titanium-100">{loading ? '…' : planName}</span>
        </span>
      </div>

      {HUB_SECTIONS.map((section) => (
        <section key={section.id} aria-label={section.label}>
          <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-600">
            {section.label}
          </h2>
          <div className="space-y-1.5">
            {section.entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} planId={tier} loading={loading} />
            ))}
          </div>
        </section>
      ))}

      <p className="border-t border-titanium-900 pt-4 text-xs text-titanium-600">
        Diese Übersicht zeigt den Zustand Ihres Arbeitsbereichs. Was zusätzlich
        buchbar ist — mit Preis und Plan-Zuordnung — steht im{' '}
        <Link to="/app/marketplace" className="text-titanium-400 underline underline-offset-2 hover:text-cyan-400">
          Marketplace
        </Link>
        .
      </p>
    </div>
  );
}
