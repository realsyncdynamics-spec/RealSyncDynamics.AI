import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileCheck2, Globe2, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardBody, CardHeader } from '../../enterprise-os/components/Card';
import { allEdgeFunctionsAvailable } from '../../components/landing/EdgeFunctionAvailabilityNotice';
import { normalizeWebsiteSource } from '../siteos/scanHandoff';
import { discoverWebsite, errorMessage } from '../siteos/siteOsApi';
import {
  approveDraft, buildReceptionistDraft, currentApproval, DRAFT_STATUS_LABEL, FIELD_KEYS, FIELD_LABEL,
  LIST_FIELDS, type ApprovalState, type DraftField, type FieldKey, type FieldSource, type OpenPoint,
  type OwnerInput,
} from './receptionistDraft';

/** Dieselbe Function wie der Website-Check im Transformations-Ablauf (`siteos/discover`). */
const DISCOVER_FUNCTIONS = ['siteos'] as const;

const SOURCE_LABEL: Record<FieldSource, string> = {
  website: 'Aus Website',
  inhaber: 'Vom Inhaber',
  vorschlag: 'Vorschlag',
  fehlt: 'Fehlt',
};

const SOURCE_CLASS: Record<FieldSource, string> = {
  website: 'border-titanium-600 text-titanium-200',
  inhaber: 'border-emerald-400 text-emerald-300',
  vorschlag: 'border-titanium-700 text-titanium-400',
  fehlt: 'border-amber-500/60 text-amber-300',
};

const SEVERITY_LABEL: Record<OpenPoint['severity'], string> = {
  pflicht: 'Pflicht',
  pruefen: 'Prüfen',
  empfohlen: 'Empfohlen',
};

/**
 * „KI-Sekretariat aus der Website“ in „Mein Betrieb“.
 *
 * Website-Check → Entwurf → Prüfung → Freigabe durch den Inhaber. Der Entwurf
 * und die Freigabe leben nur im Speicher dieser Ansicht: Es wird nichts
 * gespeichert und kein Assistent geändert oder aktiviert. Der Aufrufer bindet
 * die Karte per `key` an den aktiven Mandanten, damit ein Wechsel alles verwirft.
 */
export function ReceptionistDraftCard({ tenantId }: { tenantId: string }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [discovery, setDiscovery] = useState<unknown>(null);
  const [owner, setOwner] = useState<OwnerInput>({});
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [editText, setEditText] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [approval, setApproval] = useState<ApprovalState>({ status: 'entwurf' });
  const [approvalErrors, setApprovalErrors] = useState<string[]>([]);

  const draft = useMemo(() => (started ? buildReceptionistDraft(discovery, owner) : null), [started, discovery, owner]);
  const effective = draft ? currentApproval(approval, draft) : approval;

  const reset = (next: unknown) => {
    setDiscovery(next);
    setOwner({});
    setEditing(null);
    setReviewed(false);
    setApproval({ status: 'entwurf' });
    setApprovalErrors([]);
    setStarted(true);
  };

  const readWebsite = async () => {
    const clean = normalizeWebsiteSource(url);
    if (!clean) { setError('Bitte eine öffentliche Website-Adresse eingeben, z. B. https://ihr-betrieb.de'); return; }
    if (!allEdgeFunctionsAvailable(DISCOVER_FUNCTIONS)) {
      setError('Der Website-Check ist derzeit nicht verfügbar. Sie können die Angaben selbst eintragen.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await discoverWebsite({ tenant_id: tenantId, url: clean });
    setBusy(false);
    if (result.kind !== 'ok') { setError(errorMessage(result)); return; }
    reset(result.data);
  };

  const startEdit = (key: FieldKey, f: DraftField) => {
    setEditing(key);
    setEditText(f.values.join(LIST_FIELDS.includes(key) ? '\n' : ' '));
  };

  const saveEdit = () => {
    if (!editing) return;
    const key: FieldKey = editing;
    const text = editText;
    setOwner((o) => {
      const next: OwnerInput = { ...o };
      next[key] = text;
      return next;
    });
    setEditing(null);
    // Jede Änderung braucht eine neue Prüfung und Freigabe.
    setReviewed(false);
    setApproval({ status: 'entwurf' });
    setApprovalErrors([]);
  };

  const approve = () => {
    if (!draft) return;
    const result = approveDraft(draft, { reviewed, now: new Date() });
    if (result.ok) { setApproval(result.state); setApprovalErrors([]); }
    else setApprovalErrors(result.reasons);
  };

  const blockers = draft ? draft.openPoints.filter((p) => p.severity === 'pflicht') : [];

  return (
    <Card data-testid="receptionist-draft">
      <CardHeader
        eyebrow="KI-Sekretariat"
        title="Empfangsassistent aus Ihrer Website"
        subtitle="Wir lesen öffentliche Angaben Ihrer Startseite und erstellen daraus einen Entwurf. Sie prüfen und geben frei."
      />
      <CardBody className="space-y-4">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); void readWebsite(); }}
        >
          <label htmlFor="receptionist-url" className="sr-only">Website-Adresse</label>
          <input
            id="receptionist-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://ihr-betrieb.de"
            className="min-w-0 flex-1 border border-titanium-700 bg-obsidian-900 px-3 py-2 font-mono text-xs text-titanium-100 placeholder:text-titanium-600 focus:border-titanium-400 focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe2 className="h-3.5 w-3.5" />}
            Website auslesen
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => reset(null)}>
            Selbst eintragen
          </Button>
        </form>

        {error && (
          <div className="flex items-start gap-2 border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-titanium-300" role="alert">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>{error}</span>
          </div>
        )}

        {draft && (
          <>
            <div className="flex flex-wrap items-center gap-3 border border-titanium-800 bg-obsidian-900 px-3 py-2">
              {effective.status === 'freigegeben' ? (
                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300" data-testid="draft-status">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Vom Inhaber freigegeben – noch nicht gespeichert
                </p>
              ) : (
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300" data-testid="draft-status">
                  {DRAFT_STATUS_LABEL}
                </p>
              )}
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                {draft.provenance.sourceUrl
                  ? <>Quelle {draft.provenance.sourceUrl}{draft.provenance.fetchedAt && <> · gelesen {new Date(draft.provenance.fetchedAt).toLocaleString('de-DE')}</>}</>
                  : 'Ohne Website begonnen'}
              </p>
            </div>

            <dl className="divide-y divide-titanium-800 border border-titanium-800">
              {FIELD_KEYS.map((key) => {
                const f = draft.fields[key];
                return (
                  <div key={key} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[11rem_1fr_auto] sm:items-start">
                    <dt className="text-xs text-titanium-400">{FIELD_LABEL[key]}</dt>
                    <dd className="min-w-0 space-y-1">
                      {editing === key ? (
                        <div className="space-y-2">
                          <textarea
                            aria-label={`${FIELD_LABEL[key]} bearbeiten`}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={LIST_FIELDS.includes(key) ? 4 : 3}
                            className="w-full border border-titanium-700 bg-obsidian-900 px-2 py-1.5 text-xs text-titanium-100 focus:border-titanium-400 focus:outline-none"
                          />
                          {LIST_FIELDS.includes(key) && <p className="text-[11px] text-titanium-500">Ein Eintrag je Zeile. Leer lassen, um die Angabe zu entfernen.</p>}
                          <div className="flex gap-2">
                            <Button type="button" size="sm" onClick={saveEdit}>Übernehmen</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>Abbrechen</Button>
                          </div>
                        </div>
                      ) : f.values.length ? (
                        <ul className="space-y-0.5 text-sm text-titanium-100">
                          {f.values.map((v) => <li key={v} className="break-words">{v}</li>)}
                        </ul>
                      ) : (
                        <p className="text-sm text-titanium-500">Keine Angabe</p>
                      )}
                      <p className="flex flex-wrap items-center gap-2">
                        <span className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${SOURCE_CLASS[f.source]}`}>
                          {SOURCE_LABEL[f.source]}
                        </span>
                        {f.needsReview && <span className="font-mono text-[9px] uppercase tracking-wider text-amber-300">unsicher</span>}
                        {f.evidence && <span className="text-[11px] text-titanium-500">{f.evidence}</span>}
                      </p>
                    </dd>
                    {editing !== key && (
                      <div>
                        <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(key, f)}>Bearbeiten</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </dl>

            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">Nimmt in jedem Gespräch auf</p>
              <p className="text-xs text-titanium-300">{draft.intake.join(' · ')}</p>
            </div>

            {draft.openPoints.length > 0 && (
              <div data-testid="open-points">
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">Offene Punkte</p>
                <ul className="space-y-1">
                  {draft.openPoints.map((p) => (
                    <li key={`${p.field ?? 'entwurf'}-${p.severity}-${p.text}`} className="flex gap-2 text-xs text-titanium-300">
                      <span className={`w-20 shrink-0 font-mono text-[9px] uppercase tracking-wider ${p.severity === 'pflicht' ? 'text-amber-300' : 'text-titanium-500'}`}>
                        {SEVERITY_LABEL[p.severity]}
                      </span>
                      <span>{p.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {draft.discarded.length > 0 && (
              <div>
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">Hinweise</p>
                <ul className="space-y-0.5 text-xs text-titanium-400">
                  {draft.discarded.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </div>
            )}

            <div className="space-y-2 border-t border-titanium-800 pt-3">
              {effective.status === 'freigegeben' ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="min-w-0 flex-1 text-xs text-titanium-300">
                    Freigegeben am {new Date(effective.approvedAt).toLocaleString('de-DE')}. Der Stand gilt nur in
                    dieser Ansicht: Er wird nicht gespeichert, und Ihr Assistent bleibt unverändert.
                  </p>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setApproval({ status: 'entwurf' })}>
                    <RotateCcw className="h-3.5 w-3.5" /> Freigabe zurücknehmen
                  </Button>
                </div>
              ) : (
                <>
                  <label className="flex items-start gap-2 text-xs text-titanium-300">
                    <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="mt-0.5" />
                    Ich habe alle Angaben geprüft.
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" size="sm" onClick={approve} disabled={blockers.length > 0 || !reviewed}>
                      <FileCheck2 className="h-3.5 w-3.5" /> Entwurf freigeben
                    </Button>
                    {blockers.length > 0 && (
                      <span className="text-[11px] text-amber-300">Freigabe erst, wenn alle Pflichtpunkte erledigt sind.</span>
                    )}
                  </div>
                  {approvalErrors.length > 0 && (
                    <ul className="text-[11px] text-amber-300" role="alert">
                      {approvalErrors.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  )}
                </>
              )}
              <p className="text-[11px] text-titanium-500">
                Nichts wird gespeichert oder aktiviert. Die Übernahme in Ihren Assistenten folgt in einem eigenen Schritt.
              </p>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
