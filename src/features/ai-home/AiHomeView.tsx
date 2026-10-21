import { Link } from 'react-router-dom';
import { Bot, Globe, LayoutDashboard, ShieldCheck, Workflow } from 'lucide-react';
import { AiCommandComposer } from './AiCommandComposer';

/**
 * AI-first workspace entry. Reuses the existing authenticated shell and its
 * governance-agent assistant. No direct gateway calls or unapproved tool runs.
 * Sending a prompt only opens and pre-fills the existing assistant.
 */
export function AiHomeView() {

  return (
    <main className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-center px-5 py-12 text-titanium-100" data-testid="ai-os-home">
      <div className="mb-4 flex items-center gap-2 text-sm text-titanium-400">
        <ShieldCheck className="h-5 w-5 text-[var(--color-rs-primary)]" aria-hidden="true" />
        <span>RealSync AI OS</span>
      </div>
      <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Was möchtest du heute erledigen?</h1>
      <p className="mt-4 max-w-xl text-center text-sm text-titanium-400">
        Starte mit einer Frage oder öffne eine Anwendung. Dein Assistent steht dir auch in den Modulen zur Verfügung.
      </p>
      <AiCommandComposer />

      <nav aria-label="Schnellzugriff" className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { to: '/app/websites', label: 'Websites', icon: Globe },
          { to: '/app/agents', label: 'Agenten', icon: Bot },
          { to: '/app/workflows', label: 'Workflows', icon: Workflow },
          { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ].map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center justify-center gap-2 rounded-lg border border-titanium-800 bg-obsidian-900 px-3 py-3 text-sm text-titanium-200 hover:border-titanium-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00B8D4]">
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </Link>
        ))}
      </nav>
      <p className="mt-6 max-w-xl text-center text-xs text-titanium-500">
        Nachrichten werden erst im Assistenten gesendet. Aktionen mit Außenwirkung erfordern eine separate Freigabe.
      </p>
    </main>
  );
}
