/**
 * Additive Kachelansicht innerhalb des bestehenden Governance Workspace.
 * Verwendet ausschließlich bestehende Routen/Modi und die bestehenden Gates.
 */
import { Link } from 'react-router-dom';
import {
  Bot, Blocks, FileCheck2, FileText, Image, Languages, MessageSquare,
  Mic, Presentation, ScanSearch, ShieldCheck, Table2, Video,
  type LucideIcon,
} from 'lucide-react';
import {
  isWorkspaceToolRunnable, workspaceToolsFor,
  type WorkspaceToolDefinition, type WorkspaceToolId,
} from './workspaceToolCatalog';

const ICONS: Record<WorkspaceToolId, LucideIcon> = {
  chat: MessageSquare,
  documents: FileText,
  slides: Presentation,
  tables: Table2,
  image: Image,
  video: Video,
  translation: Languages,
  agents: Bot,
  'app-builder': Blocks,
  voice: Mic,
  governance: ShieldCheck,
  evidence: FileCheck2,
  audit: ScanSearch,
};

// Vorlagen füllen ausschließlich das vorhandene Eingabefeld, sie senden nie automatisch.
const SUGGESTIONS = [
  {
    id: 'governance-check', title: 'Governance-Check vorbereiten', mode: 'chat',
    prompt: 'Analysiere die belegte KI-Governance-Lage dieses Mandanten. Nenne die drei wichtigsten nächsten Prüfschritte und kennzeichne fehlende Nachweise ausdrücklich als offen.',
    detail: 'Mit vorhandenen Nachweisen arbeiten – keine erfundenen Kennzahlen.',
  },
  {
    id: 'app-idee', title: 'App-Idee strukturieren', mode: 'build',
    prompt: 'Entwirf eine schlanke interne Unternehmens-App mit Rollen, zentralem Dashboard und nachvollziehbaren Freigaben. Beginne mit Anforderungen und einer prüfbaren Vorschau.',
    detail: 'Auftrag für den bestehenden App-Builder vorbereiten.',
  },
] as const;

const BADGE: Record<WorkspaceToolDefinition['state'], string> = {
  implementiert: 'Code vorhanden',
  zu_pruefen: 'Prüfung offen',
  geplant: 'Geplant',
};

export function WorkspaceToolGrid({
  onChat,
  onBuild,
  onPrompt,
}: {
  onChat: () => void;
  onBuild: () => void;
  onPrompt: (mode: 'chat' | 'build', prompt: string) => void;
}) {
  return (
    <div className="space-y-7" data-testid="workspace-tools">
      <ToolSection
        title="Direktzugriff: Voice-Bot & Governance OS"
        description="Beide vorhandenen RealSync-Produktbereiche direkt öffnen – ohne zweite Plattform oder neue Backend-Pfade."
        group="direktzugriff"
        featured
        onChat={onChat}
        onBuild={onBuild}
      />
      <section aria-label="Vorschläge" data-testid="workspace-suggestions">
        <h2 className="text-base font-semibold text-titanium-100">Vorschläge</h2>
        <p className="mt-1 mb-3 text-xs text-titanium-400">Vorlagen füllen nur die vorhandene Eingabe – erst Sie entscheiden, ob gesendet wird.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => onPrompt(suggestion.mode, suggestion.prompt)}
              className="border border-titanium-700 bg-obsidian-900 p-4 text-left hover:border-security-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-security-400"
              data-testid={`workspace-suggestion-${suggestion.id}`}
            >
              <span className="block text-sm font-semibold text-titanium-100">{suggestion.title}</span>
              <span className="mt-1 block text-xs text-titanium-400">{suggestion.detail}</span>
            </button>
          ))}
        </div>
      </section>
      <ToolSection title="KI-Werkzeuge" description="Ein Einstieg für Arbeiten mit KI. Nicht freigegebene Generatoren sind bewusst gesperrt." group="ki-werkzeuge" onChat={onChat} onBuild={onBuild} />
      <ToolSection title="Bestehende RealSync-Module" description="Direkte Verknüpfungen zum vorhandenen Governance-Browser statt paralleler Oberflächen." group="realsync-module" onChat={onChat} onBuild={onBuild} />
    </div>
  );
}

function ToolSection({
  title, description, group, featured = false, onChat, onBuild,
}: {
  title: string;
  description: string;
  group: 'direktzugriff' | 'ki-werkzeuge' | 'realsync-module';
  featured?: boolean;
  onChat: () => void;
  onBuild: () => void;
}) {
  return (
    <section aria-label={title}>
      <h2 className="text-base font-semibold text-titanium-100">{title}</h2>
      <p className="mt-1 mb-3 text-xs text-titanium-400">{description}</p>
      <div className={featured ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : 'grid grid-cols-2 gap-3 sm:grid-cols-4'}>
        {workspaceToolsFor(group).map((tool) => (
          <ToolTile key={tool.id} tool={tool} onChat={onChat} onBuild={onBuild} />
        ))}
      </div>
    </section>
  );
}

function ToolTile({
  tool, onChat, onBuild,
}: {
  tool: WorkspaceToolDefinition;
  onChat: () => void;
  onBuild: () => void;
}) {
  const Icon = ICONS[tool.id];
  const enabled = isWorkspaceToolRunnable(tool);
  const cardClass = [
    'flex min-h-36 flex-col items-start gap-2 border p-3 text-left',
    enabled
      ? 'border-titanium-700 bg-obsidian-900 hover:border-security-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-security-400'
      : 'border-titanium-800 bg-obsidian-900/50 opacity-70',
  ].join(' ');
  const body = (
    <>
      <span className="flex h-8 w-8 items-center justify-center border border-titanium-700 text-security-400" aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold text-titanium-100">{tool.label}</span>
      <span className="text-xs leading-4 text-titanium-400">{tool.description}</span>
      <span className="mt-auto font-mono text-[10px] text-titanium-500">{BADGE[tool.state]}</span>
    </>
  );

  if (enabled && tool.action === 'route' && tool.href) {
    return <Link className={cardClass} to={tool.href} data-testid={`workspace-tool-${tool.id}`}>{body}</Link>;
  }
  if (enabled && (tool.action === 'chat' || tool.action === 'build')) {
    return (
      <button
        type="button"
        className={cardClass}
        onClick={tool.action === 'chat' ? onChat : onBuild}
        data-testid={`workspace-tool-${tool.id}`}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={cardClass} aria-disabled="true" data-testid={`workspace-tool-${tool.id}`}>
      {body}
    </div>
  );
}
