import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Globe2, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardBody, CardHeader } from '../../enterprise-os/components/Card';
import { allEdgeFunctionsAvailable } from '../../components/landing/EdgeFunctionAvailabilityNotice';
import { getSupabase } from '../../lib/supabase';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';
import { readLeadContext } from '../audit/leadContext';
import { normalizeWebsiteSource } from '../siteos/scanHandoff';
import { createBot, updateBot } from '../bots/api';
import type { Bot } from '../bots/types';
import {
  applyOwnerEdit, approvalBlockers, deriveSecretariatDraft, draftHints, faqToLines, FIELD_LABELS,
  linesToFaq, linesToList, METHOD_LABELS,
  type DraftField, type FieldKey, type SecretariatDraft, type WebsiteDiscovery,
} from './websiteDraft';
import {
  approvalPatch, SECRETARIAT_ACTIVATION_LOCKED, draftBotArgs, readSecretariatConfig, secretariatStatus, STATUS_LABEL, updateDraftPatch,
  type SecretariatStatus,
} from './secretariatBot';

/**
 * „KI-Sekretariat aus der Website“ in „Mein Betrieb“.
 *
 * Domain → bestehender Abruf `siteos/discover` → Entwurf mit Herkunftsnachweis
 * je Feld → Inhaber prüft/ändert → als deaktivierter Bot speichern → Freigabe
 * aktiviert. Kein neues Backend, keine neue Tabelle.
 */
const DISCOVER_FUNCTIONS = ['siteos'] as const;
const TEXT_FIELDS: FieldKey[] = ['businessName', 'phone', 'email', 'address', 'openingHours'];

type Phase =
  | { kind: 'idle' }
  | { kind: 'busy'; label: string }
  | { kind: 'editing'; draft: SecretariatDraft; bot: Bot | null };

function draftFromBot(bot: Bot): SecretariatDraft | null {
  const cfg = readSecretariatConfig(bot);
  return cfg ? { version: cfg.version, sourceUrl: cfg.sourceUrl, fetchedAt: cfg.fetchedAt, fields: cfg.fields } : null;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function Provenance({ field }: { field: DraftField<unknown> }) {
  if (field.status === 'unknown') {
    return <p className="mt-1 font-mono text-[10px] text-titanium-500">Nicht erkannt: {field.reason}</p>;
  }
  const origin = field.derivedFrom ?? field.source;
  return (
    <p className="mt-1 font-mono text-[10px] text-titanium-500" title={origin.excerpt || undefined}>
      {field.source.method === 'owner-edit' ? `vom Inhaber geändert ${fmtTime(field.source.fetchedAt)} · ` : ''}
      Quelle: {hostOf(origin.url)} · {fmtTime(origin.fetchedAt)} · {METHOD_LABELS[origin.method]}
      {field.source.method !== 'owner-edit' && field.confidence === 'low' ? ' · bitte prüfen' : ''}
    </p>
  );
}

export function SecretariatCard({ tenantId, bots, onChanged }: {
  tenantId: string | null;
  bots: Bot[];
  onChanged: () => void;
}) {
  const { user } = useSupabaseAuth();
  const existing = useMemo(() => bots.find((b) => readSecretariatConfig(b) !== null) ?? null, [bots]);
  const [status, setStatus] = useState<SecretariatStatus | null>(null);
  const [domain, setDomain] = useState(() => readLeadContext()?.domain ?? '');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const available = allEdgeFunctionsAvailable(DISCOVER_FUNCTIONS);

  useEffect(() => {
    let alive = true;
    if (!existing) { setStatus(null); return; }
    void secretariatStatus(existing).then((s) => { if (alive) setStatus(s); });
    return () => { alive = false; };
  }, [existing]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setError('');
    const before = phase;
    setPhase({ kind: 'busy', label });
    try { await fn(); } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unbekannter Fehler');
      setPhase(before);
    }
  };

  const startFromWebsite = () => run('Website wird gelesen …', async () => {
    const url = normalizeWebsiteSource(domain);
    if (!url) throw new Error('Bitte eine öffentliche Website-Adresse eingeben (z. B. muster-betrieb.de).');
    if (!tenantId) throw new Error('Kein Arbeitsbereich ausgewählt.');
    const { data, error: invokeError } = await getSupabase().functions.invoke('siteos/discover', { body: { tenant_id: tenantId, url } });
    if (invokeError) throw new Error('Die Website konnte nicht gelesen werden.');
    const found = data as WebsiteDiscovery | null;
    if (!found?.source_url) throw new Error('Die Website konnte nicht gelesen werden.');
    setConfirmed(false);
    setPhase({ kind: 'editing', draft: deriveSecretariatDraft(found), bot: null });
  });

  const save = (draft: SecretariatDraft, bot: Bot | null) => run('Wird gespeichert …', async () => {
    if (!tenantId) throw new Error('Kein Arbeitsbereich ausgewählt.');
    if (bot) await updateBot(tenantId, bot.id, updateDraftPatch(bot, draft.fields));
    else await createBot(draftBotArgs(tenantId, draft));
    setPhase({ kind: 'idle' });
    onChanged();
  });

  const approve = (bot: Bot) => run('Wird freigegeben …', async () => {
    if (!tenantId) throw new Error('Kein Arbeitsbereich ausgewählt.');
    const patch = await approvalPatch(bot, { userId: user?.id, at: new Date().toISOString(), confirmed });
    await updateBot(tenantId, bot.id, patch);
    setConfirmed(false);
    onChanged();
    setPhase({ kind: 'idle' });
  });

  const header = (
    <CardHeader
      eyebrow="KI-Sekretariat"
      title="Assistent aus Ihrer Website"
      subtitle="Wir lesen Ihre öffentliche Website und schlagen die Angaben vor. Aktiv wird erst, was Sie freigeben."
    />
  );

  if (phase.kind === 'busy') {
    return (
      <Card>{header}<CardBody>
        <div className="flex items-center gap-2 text-xs text-titanium-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {phase.label}</div>
      </CardBody></Card>
    );
  }

  const errorBlock = error && (
    <div className="mb-3 flex items-start gap-2 border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-titanium-300" role="alert">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" /> <span>{error}</span>
    </div>
  );

  if (phase.kind === 'editing') {
    return (
      <Card>{header}<CardBody>
        {errorBlock}
        <DraftEditor
          draft={phase.draft}
          onChange={(draft) => setPhase({ ...phase, draft })}
          onCancel={() => setPhase({ kind: 'idle' })}
          onSave={() => save(phase.draft, phase.bot)}
          saveLabel={phase.bot ? 'Änderungen speichern' : 'Als Entwurf speichern'}
        />
      </CardBody></Card>
    );
  }

  if (existing) {
    const draft = draftFromBot(existing);
    const blockers = draft ? approvalBlockers(draft) : [];
    const needsApproval = status === 'draft' || status === 'changed' || status === 'active-unapproved';
    return (
      <Card>{header}<CardBody>
        {errorBlock}
        <div className="flex flex-wrap items-center gap-3">
          {status === 'approved'
            ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            : <AlertTriangle className="h-4 w-4 text-amber-400" />}
          <p className="min-w-0 flex-1 text-sm text-titanium-100">
            {existing.name}
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">{status ? STATUS_LABEL[status] : '…'}</span>
          </p>
          {draft && <Button variant="secondary" size="sm" onClick={() => { setConfirmed(false); setPhase({ kind: 'editing', draft, bot: existing }); }}>Angaben prüfen</Button>}
          <Link to={`/app/bots/${encodeURIComponent(existing.id)}`}><Button variant="ghost" size="sm">Im Bot-Editor öffnen</Button></Link>
        </div>
        {draft && <p className="mt-2 font-mono text-[10px] text-titanium-500">Quelle: {hostOf(draft.sourceUrl)} · gelesen {fmtTime(draft.fetchedAt)}</p>}
        {needsApproval && draft && (
          <div className="mt-4 space-y-3 border border-titanium-800 bg-obsidian-900 px-4 py-3">
            {blockers.length > 0 ? (
              <ul className="list-disc pl-4 text-xs text-amber-300">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
            ) : (
              <>
                <label className="flex items-start gap-2 text-xs text-titanium-300">
                  <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                  Ich habe die Angaben geprüft. Der Assistent darf sie gegenüber Anfragenden verwenden.
                </label>
                <Button size="sm" disabled={!confirmed} onClick={() => approve(existing)}>
                  <ShieldCheck className="h-3.5 w-3.5" /> {SECRETARIAT_ACTIVATION_LOCKED ? 'Freigeben' : 'Freigeben und aktivieren'}
                </Button>
                {SECRETARIAT_ACTIVATION_LOCKED && (
                  <p className="text-xs text-titanium-500">
                    Die Freigabe wird gespeichert. Aktiv geschaltet wird der Assistent erst, wenn die serverseitige Prüfung bereitsteht.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </CardBody></Card>
    );
  }

  return (
    <Card>{header}<CardBody>
      {errorBlock}
      {!available ? (
        <p className="text-sm text-titanium-400">Das Lesen der Website ist derzeit nicht verfügbar. Sie können einen Assistenten weiterhin <Link className="underline" to="/app/bots">manuell anlegen</Link>.</p>
      ) : (
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void startFromWebsite(); }}>
          <label className="min-w-0 flex-1 text-xs text-titanium-400">
            Ihre Website
            <input
              className="mt-1 block w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 font-mono text-sm text-titanium-100 focus:border-titanium-400 focus:outline-none"
              value={domain} maxLength={255} placeholder="muster-betrieb.de" inputMode="url" autoComplete="url"
              onChange={(e) => setDomain(e.target.value)}
            />
          </label>
          <Button type="submit" size="sm" disabled={!tenantId || !domain.trim()}><Globe2 className="h-3.5 w-3.5" /> Entwurf erstellen</Button>
        </form>
      )}
    </CardBody></Card>
  );
}

function DraftEditor({ draft, onChange, onCancel, onSave, saveLabel }: {
  draft: SecretariatDraft;
  onChange: (d: SecretariatDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  const f = draft.fields;
  const now = () => new Date().toISOString();
  const [servicesText, setServicesText] = useState(() => (f.services.status === 'known' ? f.services.value.join('\n') : ''));
  const [faqText, setFaqText] = useState(() => faqToLines(f.faq.status === 'known' ? f.faq.value : null));
  const hints = draftHints(draft);
  const blockers = approvalBlockers(draft);
  const inputCls = 'mt-1 block w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 focus:border-titanium-400 focus:outline-none';

  return (
    <div className="space-y-4">
      <p className="font-mono text-[10px] text-titanium-500">Gelesen: {draft.sourceUrl} · {fmtTime(draft.fetchedAt)}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map((key) => {
          const field = f[key] as DraftField<string>;
          return (
            <label key={key} className="block text-xs text-titanium-400">
              {FIELD_LABELS[key]}
              <input
                className={inputCls}
                defaultValue={field.status === 'known' ? field.value : ''}
                onBlur={(e) => {
                  const before = field.status === 'known' ? field.value : '';
                  if (e.target.value.trim() !== before) onChange(applyOwnerEdit(draft, key as 'phone', e.target.value, now()));
                }}
              />
              <Provenance field={field} />
            </label>
          );
        })}
      </div>
      <label className="block text-xs text-titanium-400">
        {FIELD_LABELS.services} <span className="text-titanium-500">(eine je Zeile)</span>
        <textarea className={`${inputCls} min-h-24`} value={servicesText}
          onChange={(e) => setServicesText(e.target.value)}
          onBlur={() => onChange(applyOwnerEdit(draft, 'services', linesToList(servicesText), now()))} />
        <Provenance field={f.services} />
      </label>
      <label className="block text-xs text-titanium-400">
        {FIELD_LABELS.faq} <span className="text-titanium-500">(„Frage? Antwort“ je Zeile)</span>
        <textarea className={`${inputCls} min-h-20`} value={faqText}
          onChange={(e) => setFaqText(e.target.value)}
          onBlur={() => onChange(applyOwnerEdit(draft, 'faq', linesToFaq(faqText), now()))} />
        <Provenance field={f.faq} />
      </label>
      {(hints.length > 0 || blockers.length > 0) && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs">
          {blockers.map((b) => <li key={b} className="text-amber-300">{b}</li>)}
          {hints.map((h) => <li key={h} className="text-titanium-400">{h}</li>)}
        </ul>
      )}
      <p className="text-xs text-titanium-500">Gespeichert wird ein Entwurf. Der Assistent bleibt pausiert, bis Sie ihn freigeben.</p>
      <div className="flex flex-wrap gap-3">
        <Button size="sm" onClick={onSave}>{saveLabel}</Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>Abbrechen</Button>
      </div>
    </div>
  );
}
