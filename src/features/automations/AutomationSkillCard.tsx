import { Link } from 'react-router-dom';
import { ListChecks, PackageCheck } from 'lucide-react';
import {
  AUTOMATION_SKILL_CATEGORIES,
  AUTOMATION_SKILL_STATUS_LABEL,
  type AutomationSkill,
  type AutomationSkillStatus,
} from '../../content/automationSkills';

const STATUS_CLS: Record<AutomationSkillStatus, string> = {
  available: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  beta: 'bg-sky-500/15 text-sky-200 border-sky-500/40',
  planned: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
};

const PLAN_LABEL: Record<AutomationSkill['planRequired'], string> = {
  free: 'Free',
  starter: 'Starter',
  growth: 'Growth',
  agency: 'Agency',
  scale: 'Scale',
  enterprise: 'Enterprise',
};

export function AutomationSkillStatusBadge({ status }: { status: AutomationSkillStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${STATUS_CLS[status]}`}>
      {AUTOMATION_SKILL_STATUS_LABEL[status]}
    </span>
  );
}

export function AutomationSkillCard({ skill }: { skill: AutomationSkill }) {
  return (
    <article id={skill.id} className="border border-titanium-800 bg-obsidian-900">
      <header className="flex items-start justify-between gap-3 border-b border-titanium-800 p-4">
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold tracking-tight text-titanium-50">
            {skill.title}
          </h3>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
            {AUTOMATION_SKILL_CATEGORIES[skill.category]} · Plan: {PLAN_LABEL[skill.planRequired]}
          </p>
        </div>
        <AutomationSkillStatusBadge status={skill.status} />
      </header>

      <div className="space-y-1 p-4 text-sm leading-relaxed text-titanium-200">
        <p>{skill.shortDescription}</p>
        <p className="text-titanium-400">{skill.problem}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-titanium-800 p-4 md:grid-cols-2">
        <Section icon={<ListChecks className="h-3.5 w-3.5" />} title="Workflow">
          <Tags items={skill.workflow} />
        </Section>
        <Section icon={<PackageCheck className="h-3.5 w-3.5" />} title="Output">
          <Tags items={skill.output} />
        </Section>
      </div>

      <footer className="flex items-center justify-end border-t border-titanium-800 p-3">
        <Link
          to={skill.cta.href}
          className="border border-security-500 bg-security-500 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-white hover:bg-security-600"
        >
          {skill.cta.label}
        </Link>
      </footer>
    </article>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        {icon} {title}
      </h4>
      {children}
    </div>
  );
}

function Tags({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-[11px] text-titanium-500">—</p>;
  return (
    <ul className="flex flex-wrap gap-1">
      {items.map((it) => (
        <li key={it} className="border border-titanium-800 bg-obsidian-950 px-1.5 py-0.5 font-mono text-[11px] text-titanium-300">
          {it}
        </li>
      ))}
    </ul>
  );
}
