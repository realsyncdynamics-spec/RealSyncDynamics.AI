import { Link } from 'react-router-dom';
import { Wrench, GitPullRequest, Zap, ArrowRight } from 'lucide-react';
import { ModuleStatusBadge } from './ModuleStatusBadge';

export function RemediationPlaceholder() {
  return (
    <div className="min-h-screen bg-obsidian-950 p-6 sm:p-8">
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-obsidian-800 border border-titanium-800 flex items-center justify-center">
            <Wrench className="h-5 w-5 text-titanium-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-display font-bold text-titanium-50 text-lg">Remediation Engine</h1>
              <ModuleStatusBadge status="roadmap" />
            </div>
            <p className="text-xs text-titanium-500">Auto-Fixes, Pull Requests und Maßnahmen-Tracking</p>
          </div>
        </div>

        <p className="text-sm text-titanium-300 mb-8 leading-relaxed">
          Die Remediation Engine automatisiert Compliance-Maßnahmen: von automatischen
          Code-Fixes über GitHub Pull Requests bis zu geführten Maßnahmen-Workflows.
          Verfügbar im Enterprise Plan.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-titanium-900 mb-8">
          {[
            { icon: Zap, title: 'Auto-Fix', desc: 'Automatische Korrekturen für bekannte Findings' },
            { icon: GitPullRequest, title: 'GitHub PRs', desc: 'Pull Requests direkt aus Findings erstellen' },
            { icon: Wrench, title: 'Maßnahmen', desc: 'Geführte Maßnahmen-Workflows mit Nachverfolgung' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-obsidian-900 p-4">
              <Icon className="h-5 w-5 text-titanium-600 mb-2" />
              <div className="text-sm font-semibold text-titanium-200 mb-1">{title}</div>
              <div className="text-xs text-titanium-500">{desc}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/pricing"
            className="flex items-center gap-2 px-4 py-2 bg-obsidian-800 border border-titanium-700 text-sm text-titanium-200 hover:border-titanium-500 hover:text-titanium-50 transition-colors"
          >
            Enterprise Plan ansehen <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
