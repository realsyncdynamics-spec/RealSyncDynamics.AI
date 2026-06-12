import React from 'react';
import { Link } from 'react-router-dom';
import { Download, ArrowUpRight, Globe2, Bot } from 'lucide-react';
import { Button } from '../components/Button';
import { Card, CardHeader, CardBody, CardFooter } from '../components/Card';
import { ScoreGauge } from '../components/ScoreGauge';
import { RiskCard } from '../components/RiskCard';
import { Timeline } from '../components/Timeline';
import { StatusBadge } from '../components/Badge';
import {
  SCORES,
  WEBSITES,
  RISKS,
  MONITORING_EVENTS,
  AI_USE_CASES,
  AGENTS,
  ORG,
} from '../mock/data';

export function AppHomePage() {
  const topRisks = RISKS.filter((r) => r.level !== 'passed').slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
            Executive Dashboard
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-titanium-50 sm:text-3xl">
            Willkommen zurück, {ORG.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-titanium-400">
            Governance-Status über {WEBSITES.length} Websites · letzter vollständiger Scan vor 2 Std.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Download className="mr-2 h-3.5 w-3.5" /> Report exportieren
          </Button>
          <Button variant="primary" size="sm">Neuen Scan starten</Button>
        </div>
      </div>

      {/* Score row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="flex flex-col items-center justify-center gap-3 py-6">
          <ScoreGauge score={SCORES.overall} label="Gesamt-Score" />
        </Card>
        <Card className="flex flex-col items-center justify-center gap-3 py-6">
          <ScoreGauge score={SCORES.dsgvo} label="DSGVO" />
        </Card>
        <Card className="flex flex-col items-center justify-center gap-3 py-6">
          <ScoreGauge score={SCORES.aiAct} label="EU AI Act" />
        </Card>
        <Card className="flex flex-col items-center justify-center gap-3 py-6">
          <ScoreGauge score={SCORES.monitoring} label="Monitoring" />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Risks */}
        <Card className="lg:col-span-2">
          <CardHeader
            eyebrow="Risk Intelligence"
            title="Aktuelle Top-Risiken"
            subtitle="Automatisch erkannt über alle Assets hinweg"
            action={
              <Link to="/os/app/risks" className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-security-400 hover:text-security-300">
                Alle ansehen <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
          />
          <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {topRisks.map((risk) => (
              <RiskCard key={risk.id} risk={risk} />
            ))}
          </CardBody>
        </Card>

        {/* Monitoring timeline */}
        <Card>
          <CardHeader
            eyebrow="Live"
            title="Monitoring-Verlauf"
            subtitle="Letzte Ereignisse"
            action={
              <Link to="/os/app/monitoring" className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-security-400 hover:text-security-300">
                Timeline <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
          />
          <CardBody>
            <Timeline events={MONITORING_EVENTS.slice(0, 4)} />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Website overview */}
        <Card className="lg:col-span-2">
          <CardHeader
            eyebrow="Asset Overview"
            title="Websites"
            subtitle={`${WEBSITES.length} überwachte Domains`}
            action={
              <Link to="/os/app/websites" className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-security-400 hover:text-security-300">
                Alle Websites <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="divide-y divide-titanium-800">
            {WEBSITES.map((site) => (
              <div key={site.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-titanium-800 bg-obsidian-900 text-titanium-400">
                    <Globe2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-titanium-100">{site.domain}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                      {site.pages} Seiten · {site.trackers} Tracker · {site.lastScan}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm font-bold tabular text-titanium-100">{site.score}</span>
                  <StatusBadge level={site.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Agents */}
        <Card>
          <CardHeader eyebrow="AI Agent Sidebar" title="Aktive Agenten" subtitle="Autonome Governance-Prozesse" />
          <CardBody className="space-y-3">
            {AGENTS.map((agent) => (
              <div key={agent.id} className="flex items-start gap-3 border border-titanium-800 bg-obsidian-900/60 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-security-500/30 bg-security-500/10 text-security-400">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-titanium-100">{agent.name}</p>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-wider ${
                        agent.status === 'Aktiv' ? 'text-risk-passed' : 'text-titanium-500'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-titanium-400">{agent.role}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-titanium-600">
                    Letzter Lauf: {agent.lastRun}
                  </p>
                </div>
              </div>
            ))}
          </CardBody>
          <CardFooter>
            <Link to="/os/app/agents" className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-security-400 hover:text-security-300">
              Agent-Verwaltung <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* AI Use Case Registry */}
      <Card>
        <CardHeader
          eyebrow="EU AI Act"
          title="AI Use Case Registry"
          subtitle="Erfasste KI-Systeme nach Risikoklasse"
          action={
            <Link to="/os/app/ai-usecases" className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-security-400 hover:text-security-300">
              Registry öffnen <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        />
        <div className="grid grid-cols-1 divide-titanium-800 sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
          {AI_USE_CASES.map((uc) => (
            <div key={uc.id} className="border-t border-titanium-800 p-4 first:border-t-0 sm:border-t-0">
              <div className="mb-2 flex items-center justify-between">
                <StatusBadge level={uc.status} />
                <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{uc.riskClass}</span>
              </div>
              <p className="text-sm font-medium text-titanium-100">{uc.name}</p>
              <p className="mt-1 text-xs text-titanium-400">{uc.purpose}</p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-titanium-600">{uc.owner}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
