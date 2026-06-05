import React, { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X, ExternalLink, ShieldCheck, Bot, Activity,
  Clock, User, Globe, Tag, Archive, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, Layers, FileCode2, Copy, Check,
} from 'lucide-react';
import {
  type DbGovernanceEvent,
  type DbGovernanceAsset,
  type DbGovernancePolicy,
  fetchEvidenceForEvent,
  fetchEventsForAsset,
  type DbGovernanceEvidence,
} from './governanceApi';
import { archiveAsset, togglePolicy } from './resourcesApi';
import type { GovernanceRiskLevel } from './types';

export type InspectorSelection =
  | { type: 'event'; item: DbGovernanceEvent }
  | { type: 'asset'; item: DbGovernanceAsset }
  | { type: 'policy'; item: DbGovernancePolicy };

interface Props {
  selection: InspectorSelection | null;
  onClose: () => void;
  onChange: () => void;
  onSelect: (s: InspectorSelection) => void;
}

export const GovernanceInspectorPanel = memo(function GovernanceInspectorPanel({
  selection, onClose, onChange, onSelect,
}: Props) {
  const visible = selection !== null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (visible) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  return (
    <>
      {visible && (
        <div
          className="fixed inset-0 z-30 bg-obsidian-950/40"
          onClick={onClose}
          aria-hidden
          data-testid="inspector-backdrop"
        />
      )}
      <aside
        aria-label="Inspector"
        data-testid="inspector-panel"
        className={`fixed inset-y-0 right-0 z-40 w-[420px] flex flex-col bg-obsidian-900 border-l border-titanium-900 shadow-2xl transition-transform duration-200 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="h-12 flex items-center justify-between px-4 border-b border-titanium-900 shrink-0">
          <span className="text-[11px] font-mono uppercase tracking-widest text-titanium-400">
            {selection?.type === 'event'  && 'Ereignis · Inspector'}
            {selection?.type === 'asset'  && 'Asset · Inspector'}
            {selection?.type === 'policy' && 'Policy · Inspector'}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800"
            aria-label="Inspector schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {selection?.type === 'event'  && (
            <EventInspector event={selection.item} onClose={onClose} />
          )}
          {selection?.type === 'asset'  && (
            <AssetInspector asset={selection.item} onClose={onClose} onChange={onChange} onSelect={onSelect} />
          )}
          {selection?.type === 'policy' && (
            <PolicyInspector policy={selection.item} onClose={onClose} onChange={onChange} />
          )}
        </div>
      </aside>
    </>
  );
});

// ---------------------------------------------------------------------------
// Copy-to-clipboard helper
// ---------------------------------------------------------------------------

const CopyButton = memo(function CopyButton({
  value, label,
}: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={label}
      data-testid="inspector-copy-btn"
      title={label}
      className="p-1 shrink-0 text-titanium-500 hover:text-titanium-200 transition-colors"
    >
      {copied
        ? <Check className="h-3.5 w-3.5 text-emerald-400" />
        : <Copy className="h-3.5 w-3.5" />
      }
    </button>
  );
});

// ---------------------------------------------------------------------------
// Event Inspector
// ---------------------------------------------------------------------------

const EventInspector = memo(function EventInspector({
  event, onClose,
}: { event: DbGovernanceEvent; onClose: () => void }) {
  const [evidence, setEvidence] = useState<DbGovernanceEvidence[] | null>(null);
  const [payloadOpen, setPayloadOpen] = useState(false);

  useEffect(() => {
    setEvidence(null);
    fetchEvidenceForEvent(event.id)
      .then(setEvidence)
      .catch(() => setEvidence([]));
  }, [event.id]);

  return (
    <div className="p-4 space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-1.5 min-w-0">
            <h2 className="font-display font-bold text-titanium-50 text-sm leading-snug">{event.title}</h2>
            <CopyButton value={event.id} label="Ereignis-ID kopieren" />
          </div>
          <RiskBadge level={event.risk_level} />
        </div>
        {event.summary && (
          <p className="text-[13px] text-titanium-300 leading-relaxed">{event.summary}</p>
        )}
      </div>

      <MetaGrid>
        <MetaItem icon={<Tag />}      label="Typ"     value={event.event_type} mono />
        <MetaItem icon={<Activity />} label="Quelle"  value={event.event_source} mono />
        <MetaItem icon={<Clock />}    label="Zeit"    value={fmtDate(event.created_at)} mono />
        {event.vendor      && <MetaItem icon={<Globe />} label="Vendor"  value={event.vendor} />}
        {event.model_name  && <MetaItem icon={<Bot />}   label="Modell"  value={event.model_name} mono />}
        {event.actor_email && <MetaItem icon={<User />}  label="Akteur"  value={event.actor_email} />}
      </MetaGrid>

      {event.data_types.length > 0 && (
        <Section label="Datentypen">
          <div className="flex flex-wrap gap-1.5">
            {event.data_types.map((dt) => (
              <span key={dt} className="px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider border border-titanium-700 text-titanium-300">
                {dt}
              </span>
            ))}
          </div>
        </Section>
      )}

      {event.policy_action && (
        <Section label="Policy-Entscheidung">
          <PolicyActionBadge action={event.policy_action} />
        </Section>
      )}

      {event.asset_id && (
        <Section label="Asset">
          <Link
            to={`/governance/assets/${event.asset_id}`}
            onClick={onClose}
            className="flex items-center gap-1.5 text-[12px] font-mono text-amber-300 hover:text-amber-200 underline underline-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {event.asset_id}
          </Link>
        </Section>
      )}

      {evidence !== null && evidence.length > 0 && (
        <Section label={`Evidence (${evidence.length})`}>
          <ul className="space-y-1.5">
            {evidence.map((ev) => (
              <li key={ev.id} className="border border-titanium-900 p-2 text-[12px]">
                <div className="font-semibold text-titanium-100">{ev.title}</div>
                <div className="font-mono text-[10px] text-titanium-400 mt-0.5 uppercase tracking-wider">
                  {ev.evidence_type}
                  {ev.content_hash && (
                    <span className="ml-2 text-titanium-500">#{ev.content_hash.slice(0, 8)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section label="Payload">
        <button
          className="flex items-center gap-1.5 text-[11px] font-mono text-titanium-400 hover:text-titanium-200 mb-2"
          onClick={() => setPayloadOpen((v) => !v)}
          data-testid="payload-toggle"
        >
          {payloadOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {payloadOpen ? 'Ausblenden' : 'Anzeigen'}
        </button>
        {payloadOpen && (
          <pre
            data-testid="payload-json"
            className="bg-obsidian-950 border border-titanium-900 p-3 text-[11px] font-mono text-titanium-300 overflow-x-auto max-h-48 whitespace-pre-wrap break-all"
          >
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        )}
      </Section>

      <div className="pt-1 border-t border-titanium-900">
        <Link
          to={`/governance/events/${event.id}`}
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full py-2.5 border border-titanium-700 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Vollansicht öffnen
        </Link>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Asset Inspector
// ---------------------------------------------------------------------------

const AssetInspector = memo(function AssetInspector({
  asset, onClose, onChange, onSelect,
}: {
  asset: DbGovernanceAsset;
  onClose: () => void;
  onChange: () => void;
  onSelect: (s: InspectorSelection) => void;
}) {
  const [recentEvents, setRecentEvents] = useState<DbGovernanceEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const isArchived = asset.status === 'archived';

  useEffect(() => {
    setRecentEvents(null);
    fetchEventsForAsset(asset.id, 5)
      .then(setRecentEvents)
      .catch(() => setRecentEvents([]));
  }, [asset.id]);

  return (
    <div className="p-4 space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-1.5 min-w-0">
            <h2 className="font-display font-bold text-titanium-50 text-sm leading-snug">{asset.name}</h2>
            <CopyButton value={asset.id} label="Asset-ID kopieren" />
          </div>
          <RiskScoreBadge score={asset.risk_score} />
        </div>
        {asset.description && (
          <p className="text-[13px] text-titanium-300 leading-relaxed">{asset.description}</p>
        )}
      </div>

      <MetaGrid>
        <MetaItem icon={<Layers />}      label="Typ"          value={asset.asset_type} mono />
        <MetaItem icon={<ShieldCheck />} label="AI Act"       value={asset.ai_act_class} mono />
        <MetaItem icon={<Tag />}         label="Status"       value={asset.status} mono />
        <MetaItem icon={<Clock />}       label="Aktualisiert" value={fmtDate(asset.updated_at)} mono />
        {asset.vendor      && <MetaItem icon={<Globe />} label="Vendor" value={asset.vendor} />}
        {asset.owner_email && <MetaItem icon={<User />}  label="Owner"  value={asset.owner_email} />}
        {asset.system_url  && <MetaItem icon={<Globe />} label="URL"    value={asset.system_url} />}
      </MetaGrid>

      {asset.data_types.length > 0 && (
        <Section label="Datentypen">
          <div className="flex flex-wrap gap-1.5">
            {asset.data_types.map((dt) => (
              <span key={dt} className="px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider border border-titanium-700 text-titanium-300">
                {dt}
              </span>
            ))}
          </div>
        </Section>
      )}

      {recentEvents !== null && recentEvents.length > 0 && (
        <Section label={`Letzte Ereignisse (${recentEvents.length})`}>
          <ul className="space-y-1.5">
            {recentEvents.map((ev) => (
              <li key={ev.id}>
                <button
                  className="w-full text-left border border-titanium-900 p-2 hover:border-amber-500/40 transition-colors"
                  onClick={() => onSelect({ type: 'event', item: ev })}
                  data-testid="linked-event-btn"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-titanium-100 font-medium truncate">{ev.title}</span>
                    <RiskBadge level={ev.risk_level} />
                  </div>
                  <div className="font-mono text-[10px] text-titanium-500 mt-0.5">
                    {ev.event_type} · {fmtDate(ev.created_at)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="pt-1 border-t border-titanium-900 flex gap-2">
        <Link
          to={`/governance/assets/${asset.id}`}
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-titanium-700 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Details
        </Link>
        {!isArchived && (
          <button
            disabled={busy}
            aria-label="Asset archivieren"
            onClick={async () => {
              if (!confirm(`Asset "${asset.name}" archivieren?`)) return;
              setBusy(true);
              await archiveAsset(asset.id);
              setBusy(false);
              onChange();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 border border-titanium-700 hover:border-red-500 text-titanium-400 hover:text-red-300 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Archive className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Policy Inspector
// ---------------------------------------------------------------------------

const PolicyInspector = memo(function PolicyInspector({
  policy, onClose: _onClose, onChange,
}: {
  policy: DbGovernancePolicy;
  onClose: () => void;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);

  return (
    <div className="p-4 space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display font-bold text-titanium-50 text-sm leading-snug">{policy.name}</h2>
          <RiskBadge level={policy.severity} />
        </div>
        {policy.description && (
          <p className="text-[13px] text-titanium-300 leading-relaxed">{policy.description}</p>
        )}
      </div>

      <MetaGrid>
        <MetaItem icon={<FileCode2 />}   label="Typ"      value={policy.policy_type} mono />
        <MetaItem icon={<ShieldCheck />} label="Aktion"   value={policy.action} mono />
        <MetaItem icon={<Tag />}         label="Schwere"  value={policy.severity} mono />
        <MetaItem icon={<Clock />}       label="Erstellt" value={fmtDate(policy.created_at)} mono />
      </MetaGrid>

      <Section label="Status">
        <div className="flex items-center gap-3">
          <PolicyActionBadge action={policy.action} />
          <span className={`text-[12px] font-mono ${policy.enabled ? 'text-emerald-300' : 'text-titanium-500'}`}>
            {policy.enabled ? '● Aktiv' : '○ Pausiert'}
          </span>
        </div>
      </Section>

      <Section label="Bedingung">
        <button
          className="flex items-center gap-1.5 text-[11px] font-mono text-titanium-400 hover:text-titanium-200 mb-2"
          onClick={() => setConditionOpen((v) => !v)}
          data-testid="condition-toggle"
        >
          {conditionOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {conditionOpen ? 'Ausblenden' : 'Anzeigen'}
        </button>
        {conditionOpen && (
          <pre
            data-testid="condition-json"
            className="bg-obsidian-950 border border-titanium-900 p-3 text-[11px] font-mono text-titanium-300 overflow-x-auto max-h-40 whitespace-pre-wrap break-all"
          >
            {JSON.stringify(policy.condition, null, 2)}
          </pre>
        )}
      </Section>

      <div className="pt-1 border-t border-titanium-900 flex gap-2">
        <button
          disabled={busy}
          aria-label={policy.enabled ? 'Policy pausieren' : 'Policy aktivieren'}
          data-testid="policy-toggle-btn"
          onClick={async () => {
            setBusy(true);
            await togglePolicy(policy.id, !policy.enabled);
            setBusy(false);
            onChange();
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 border text-sm font-semibold transition-colors disabled:opacity-50 ${
            policy.enabled
              ? 'border-emerald-700 text-emerald-300 hover:border-red-600 hover:text-red-300'
              : 'border-titanium-700 text-titanium-400 hover:border-emerald-600 hover:text-emerald-300'
          }`}
        >
          {policy.enabled
            ? <><ToggleRight className="h-4 w-4" /> Pausieren</>
            : <><ToggleLeft className="h-4 w-4" /> Aktivieren</>
          }
        </button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const RiskBadge = memo(function RiskBadge({ level }: { level: GovernanceRiskLevel }) {
  const cls =
    level === 'critical' ? 'text-red-300 border-red-500/60 bg-red-500/10' :
    level === 'high'     ? 'text-amber-300 border-amber-500/60 bg-amber-500/10' :
    level === 'medium'   ? 'text-yellow-200 border-yellow-500/50 bg-yellow-500/10' :
    level === 'low'      ? 'text-sky-300 border-sky-500/50 bg-sky-500/10' :
                           'text-titanium-300 border-titanium-700 bg-titanium-800/30';
  return (
    <span className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${cls}`}>
      {level}
    </span>
  );
});

const RiskScoreBadge = memo(function RiskScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 80 ? 'text-red-300 border-red-500/60 bg-red-500/10' :
    score >= 60 ? 'text-amber-300 border-amber-500/60 bg-amber-500/10' :
    score >= 40 ? 'text-yellow-200 border-yellow-500/50 bg-yellow-500/10' :
                  'text-emerald-300 border-emerald-500/50 bg-emerald-500/10';
  return (
    <span className={`shrink-0 border px-1.5 py-0.5 text-[11px] font-mono font-bold ${cls}`}>
      {score}/100
    </span>
  );
});

const PolicyActionBadge = memo(function PolicyActionBadge({ action }: { action: string }) {
  const cls =
    action === 'block'            ? 'text-red-300 border-red-500/60 bg-red-500/10' :
    action === 'warn'             ? 'text-amber-300 border-amber-500/60 bg-amber-500/10' :
    action === 'require_approval' ? 'text-sky-300 border-sky-500/50 bg-sky-500/10' :
    action === 'log'              ? 'text-titanium-300 border-titanium-700 bg-titanium-800/30' :
                                    'text-emerald-300 border-emerald-500/50 bg-emerald-500/10';
  return (
    <span className={`border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${cls}`}>
      {action}
    </span>
  );
});

const MetaItem = memo(function MetaItem({
  icon, label, value, mono,
}: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-titanium-500 mb-0.5">
        <span className="h-3 w-3 shrink-0">{icon}</span>
        {label}
      </div>
      <div className={`text-[12px] text-titanium-200 truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
});

function MetaGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">{children}</div>;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-titanium-500 mb-2">{label}</div>
      {children}
    </div>
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
