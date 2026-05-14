import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Compass, ShieldAlert, Globe, Database, Eye, AlertTriangle,
} from 'lucide-react';
import { ALL_SKILLS, type SkillDef } from '../lib/skills/registry';
import { routeSkill } from '../lib/skills/router';
import { buildPrompt } from '../lib/skills/promptBuilder';

export function SkillsPage() {
  const [query, setQuery] = useState('');
  const [testInput, setTestInput] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_SKILLS;
    return ALL_SKILLS.filter((s) =>
      s.key.includes(q) || s.label.toLowerCase().includes(q) ||
      s.triggers.some((t) => t.includes(q)),
    );
  }, [query]);

  const routeResult = useMemo(
    () => (testInput.trim() ? routeSkill(testInput) : null),
    [testInput],
  );
  const preview = useMemo(() => {
    if (!routeResult?.selectedSkill) return null;
    return buildPrompt(routeResult.selectedSkill, testInput);
  }, [routeResult, testInput]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-security-500 to-security-700 flex items-center justify-center">
            <Compass className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Skill Registry</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-10">
          <section>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-2">
              Skill Registry &amp; Router
            </h1>
            <p className="text-sm text-titanium-300 max-w-2xl">
              Uebersicht ueber die registrierten Skills. Diese Seite fuehrt keine
              Skills aus — sie zeigt nur Routing, Risiko-Klassen und die
              Prompt-Vorschau mit Guardrails.
            </p>
          </section>

          <section className="border border-titanium-900 bg-obsidian-900 p-4">
            <label className="block text-xs font-mono uppercase tracking-wider text-silver-500 mb-2">
              Router testen
            </label>
            <input
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="z.B. 'Hilf mir mit einem DSAR-Plan' oder 'CTR der letzten Kampagne berechnen'"
              className="w-full bg-obsidian-950 border border-titanium-800 text-sm text-titanium-100 px-3 py-2 rounded-none"
            />
            {routeResult && (
              <div className="mt-4 text-sm space-y-3">
                {routeResult.selectedSkill ? (
                  <>
                    <div className="text-titanium-100">
                      <span className="text-silver-500">Gewaehlt:</span>{' '}
                      <span className="font-mono">{routeResult.selectedSkill}</span>{' '}
                      <span className="text-silver-500">Konfidenz:</span>{' '}
                      <span className="font-mono">{routeResult.confidence.toFixed(2)}</span>
                    </div>
                    <div className="text-silver-400 text-xs">
                      {routeResult.reason}
                    </div>
                    {preview && (
                      <div className="border border-titanium-900 bg-obsidian-950 p-3">
                        <div className="text-[11px] uppercase tracking-wider text-silver-500 mb-2">
                          Prompt-Vorschau (keine Ausfuehrung)
                        </div>
                        <pre className="text-xs text-titanium-200 whitespace-pre-wrap font-mono">
{preview.system}
                        </pre>
                        {preview.reviewRequired && (
                          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-orange-300 border border-orange-900 bg-orange-950/30 px-2 py-0.5">
                            <AlertTriangle className="h-3 w-3" /> Review required
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-silver-500">Kein passender Skill: {routeResult.reason}</div>
                )}
              </div>
            )}
          </section>

          <section>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Skill suchen (Key, Label, Trigger)"
              className="w-full bg-obsidian-950 border border-titanium-800 text-sm text-titanium-100 px-3 py-2 rounded-none mb-4"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((s) => <SkillCard key={s.key} skill={s} />)}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function SkillCard({ skill }: { skill: SkillDef }) {
  return (
    <div className="border border-titanium-900 bg-obsidian-900 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display font-bold text-titanium-50">{skill.label}</div>
          <div className="text-[11px] font-mono text-silver-500">{skill.key}</div>
        </div>
        <RiskBadge level={skill.riskLevel} />
      </div>
      <p className="text-xs text-titanium-300">{skill.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {skill.requiresWebResearch && <Tag icon={<Globe className="h-3 w-3" />} label="Web Research" />}
        {skill.requiresUserData && <Tag icon={<Database className="h-3 w-3" />} label="User Data" />}
        {skill.riskLevel === 'high' && <Tag icon={<ShieldAlert className="h-3 w-3" />} label="High Risk" tone="danger" />}
        {skill.reviewRequired && <Tag icon={<Eye className="h-3 w-3" />} label="Review Required" tone="warn" />}
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-silver-500 mb-1">Use Cases</div>
        <ul className="text-xs text-titanium-200 list-disc list-inside space-y-0.5">
          {skill.useCases.map((u) => <li key={u}>{u}</li>)}
        </ul>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-silver-500 mb-1">Guardrails</div>
        <ul className="text-xs text-titanium-300 list-disc list-inside space-y-0.5">
          {skill.guardrails.map((g) => <li key={g}>{g}</li>)}
        </ul>
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: SkillDef['riskLevel'] }) {
  const map = {
    low:    'text-emerald-300 border-emerald-900 bg-emerald-950/30',
    medium: 'text-amber-300 border-amber-900 bg-amber-950/30',
    high:   'text-red-300 border-red-900 bg-red-950/30',
  } as const;
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider border px-1.5 py-0.5 ${map[level]}`}>
      {level}
    </span>
  );
}

function Tag({
  icon, label, tone = 'info',
}: { icon: React.ReactNode; label: string; tone?: 'info' | 'warn' | 'danger' }) {
  const toneMap = {
    info:   'text-titanium-200 border-titanium-800 bg-obsidian-950',
    warn:   'text-orange-300 border-orange-900 bg-orange-950/30',
    danger: 'text-red-300 border-red-900 bg-red-950/30',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider border px-1.5 py-0.5 ${toneMap[tone]}`}>
      {icon}{label}
    </span>
  );
}
