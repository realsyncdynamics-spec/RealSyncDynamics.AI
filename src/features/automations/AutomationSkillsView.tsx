import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Workflow } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  AUTOMATION_SKILLS,
  AUTOMATION_SKILL_CATEGORIES,
  AUTOMATION_SKILL_STATUS_LABEL,
  type AutomationSkillCategory,
  type AutomationSkillStatus,
} from '../../content/automationSkills';
import { AutomationSkillCard } from './AutomationSkillCard';

/**
 * /app/automations — Self-Service-Modul "Automatisierungs-Skills".
 *
 * Phase 1: zeigt das fest definierte Skill-Set (AUTOMATION_SKILLS) und
 * verlinkt jeden Skill auf eine bereits vorhandene Route. Es werden noch
 * keine echten automation_runs ausgefuehrt (siehe docs/product/automation-skills.md).
 */
export function AutomationSkillsView() {
  return <AuthGate>{() => <AutomationSkillsInner />}</AuthGate>;
}

function AutomationSkillsInner() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('skill');

  const [category, setCategory] = useState<AutomationSkillCategory | 'all'>('all');
  const [status, setStatus] = useState<AutomationSkillStatus | 'all'>('all');

  const skills = AUTOMATION_SKILLS;

  const filtered = useMemo(() => {
    return skills.filter((s) => {
      if (category !== 'all' && s.category !== category) return false;
      if (status !== 'all' && s.status !== status) return false;
      return true;
    });
  }, [skills, category, status]);

  const counts = useMemo(() => ({
    total: skills.length,
    available: skills.filter((s) => s.status === 'available').length,
    beta: skills.filter((s) => s.status === 'beta').length,
    planned: skills.filter((s) => s.status === 'planned').length,
  }), [skills]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-600">
              <Workflow className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">
                Automatisierungs-Skills
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                Wählen · Aktivieren · Nutzen
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm text-titanium-50">
                Automatisierungs-Skills sind vordefinierte Workflows, die Sie direkt aktivieren können —
                keine Beratung, kein individuelles Setup.
              </p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                phase 1 · verlinkt auf bestehende Tools · echte Runs folgen in Phase 2
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Skills insgesamt" value={counts.total} />
          <Stat label="Verfügbar" value={counts.available} tone="emerald" />
          <Stat label="Beta" value={counts.beta} tone="sky" />
          <Stat label="Geplant" value={counts.planned} tone="amber" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterButton active={category === 'all'} onClick={() => setCategory('all')}>Alle</FilterButton>
          {Object.entries(AUTOMATION_SKILL_CATEGORIES).map(([key, label]) => (
            <FilterButton
              key={key}
              active={category === key}
              onClick={() => setCategory(key as AutomationSkillCategory)}
            >
              {label}
            </FilterButton>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterButton active={status === 'all'} onClick={() => setStatus('all')}>Alle Status</FilterButton>
          {Object.entries(AUTOMATION_SKILL_STATUS_LABEL).map(([key, label]) => (
            <FilterButton
              key={key}
              active={status === key}
              onClick={() => setStatus(key as AutomationSkillStatus)}
            >
              {label}
            </FilterButton>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="border border-titanium-800 bg-obsidian-900 p-6 text-center text-sm text-titanium-400">
              Keine Skills in dieser Ansicht.
            </p>
          ) : (
            filtered.map((skill) => (
              <div
                key={skill.id}
                className={highlightId === skill.id ? 'ring-1 ring-ai-cyan-500/60' : undefined}
              >
                <AutomationSkillCard skill={skill} />
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'sky' | 'emerald' }) {
  const toneCls =
    tone === 'amber' ? 'text-amber-300' :
    tone === 'sky' ? 'text-sky-300' :
    tone === 'emerald' ? 'text-emerald-300' :
    'text-titanium-50';
  return (
    <div className="border border-titanium-800 bg-obsidian-900 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold tracking-tight ${toneCls}`}>{value}</p>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${
        active
          ? 'border-ai-cyan-500/60 bg-ai-cyan-900/20 text-ai-cyan-100'
          : 'border-titanium-800 bg-obsidian-900 text-titanium-300 hover:border-titanium-600 hover:text-titanium-100'
      }`}
    >
      {children}
    </button>
  );
}
