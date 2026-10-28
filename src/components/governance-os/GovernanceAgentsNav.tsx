import { Link, useLocation } from 'react-router-dom';
import { Bot, MessageSquare } from 'lucide-react';
import { AGENT_CATALOG, agentAnchor } from '../../features/governance/agents/agentCatalog';
import { STATUS_LABEL, type ImplementationStatus } from '../../product/implementation-status';
import { useLang } from '../../i18n/useLang';

/**
 * Agenten-Register in der Seitenleistengruppe „Agenten".
 *
 * Quelle ist `AGENT_CATALOG` — dasselbe Register wie /app/ai-systems/agents.
 * Der Reifegrad je Eintrag kommt aus dem Katalog (AGENT_MESH bzw.
 * implementation-status.ts); die Seitenleiste stuft nichts hoch und zeigt
 * keine Laufzahlen, die es nicht gibt.
 *
 * Jeder Eintrag springt per Anker auf seine Karte im Register
 * (`#agent-<id>`). Auf- und Zuklappen übernimmt die Gruppe.
 */

export const AGENT_REGISTRY_ROUTE = '/app/ai-systems/agents';

/** Anzahl der Register-Einträge — für den Gruppenzähler. */
export const AGENT_REGISTER_COUNT = AGENT_CATALOG.length;

/** Steht die aktuelle Adresse auf einer Register-Karte? Dann gehört sie zur Gruppe „Agenten". */
export function isAgentRegisterTarget(pathname: string, hash: string): boolean {
  return pathname === AGENT_REGISTRY_ROUTE && hash.startsWith('#agent-');
}

const DOT_CLASS: Record<ImplementationStatus, string> = {
  live: 'rs-side__dot--live',
  preview: 'rs-side__dot--preview',
  'coming-soon': 'rs-side__dot--soon',
};

export function GovernanceAgentsNav() {
  const { pathname, hash } = useLocation();
  const { t } = useLang();
  const onRegistry = pathname === AGENT_REGISTRY_ROUTE;

  return (
    <>
      <p className="rs-side__sublabel" data-testid="side-agent-register">
        {t('shellAgentRegister')}
      </p>
      {AGENT_CATALOG.map((agent) => {
        const Icon = agent.kind === 'bot' ? MessageSquare : Bot;
        const anchor = agentAnchor(agent.id);
        const active = onRegistry && hash === `#${anchor}`;
        const status = STATUS_LABEL[agent.maturity];
        return (
          <Link
            key={agent.id}
            to={`${AGENT_REGISTRY_ROUTE}#${anchor}`}
            aria-current={active ? 'location' : undefined}
            title={`${agent.name} · ${status}`}
            className="rs-side__item rs-side__item--small"
            data-testid={`side-agent-${agent.id}`}
            data-maturity={agent.maturity}
          >
            <Icon className="rs-side__icon" aria-hidden="true" />
            <span className="rs-side__text">{agent.name}</span>
            <span className={`rs-side__dot ${DOT_CLASS[agent.maturity]}`} aria-hidden="true" />
            <span className="sr-only">{status}</span>
          </Link>
        );
      })}
    </>
  );
}
