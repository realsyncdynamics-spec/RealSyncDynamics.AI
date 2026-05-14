import { useEffect, useState } from 'react';
import { Plus, Check, Bell, CalendarClock, AlertTriangle, Settings2 } from 'lucide-react';
import { FinanceShell, useFinanceTenant } from './FinanceShell';
import { Loader } from './FinanceDashboard';
import { Modal } from './TaxDocumentsView';
import {
  listReminders, createReminder, dismissReminder, listTaxYears,
  generateDeadlinesForYear, updateTaxYearProfile,
} from './api';
import {
  REMINDER_TYPE_LABELS,
  type TaxYear, type TaxReminder, type TaxReminderType,
  type UstCadence, type LegalForm,
} from './types';
import { urgencyOf, URGENCY_LABEL, type ReminderUrgency } from './deadlineCatalog';

export function TaxRemindersView() {
  return (
    <FinanceShell title="Erinnerungen" subtitle="Review-Termine · Fristen">
      <Inner />
    </FinanceShell>
  );
}

function Inner() {
  const { activeTenantId } = useFinanceTenant();
  const [years, setYears] = useState<TaxYear[]>([]);
  const [reminders, setReminders] = useState<TaxReminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [planningYearId, setPlanningYearId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reload = () => {
    if (!activeTenantId) return;
    setError(null);
    Promise.all([listTaxYears(activeTenantId), listReminders(activeTenantId)])
      .then(([y, r]) => { setYears(y); setReminders(r); })
      .catch((err: Error) => setError(err.message));
  };
  useEffect(reload, [activeTenantId]);

  if (!activeTenantId) return <p className="text-sm text-titanium-400">Tenant fehlt.</p>;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (reminders === null) return <Loader />;

  const yearMap = new Map(years.map((y) => [y.id, y]));

  async function dismiss(id: string) {
    if (!activeTenantId) return;
    try {
      await dismissReminder(activeTenantId, id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  }

  const open = reminders.filter((r) => r.status === 'open');
  const past = reminders.filter((r) => r.status !== 'open');
  const overdueCount = open.filter((r) => urgencyOf(r.due_at) === 'overdue').length;
  const dueSoonCount = open.filter((r) => urgencyOf(r.due_at) === 'due_soon').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-titanium-400">{open.length} offen · {past.length} erledigt</span>
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 text-red-300">
              <AlertTriangle className="h-3 w-3" /> {overdueCount} überfällig
            </span>
          )}
          {dueSoonCount > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-300">
              <CalendarClock className="h-3 w-3" /> {dueSoonCount} in Kürze
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlanningYearId(years[0]?.id ?? null)}
            disabled={years.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-cyan-700 text-cyan-300 hover:bg-cyan-950/40 text-sm font-semibold rounded-none disabled:opacity-50"
          >
            <Settings2 className="h-4 w-4" /> Standard-Fristen
          </button>
          <button
            onClick={() => setCreating(true)}
            disabled={years.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Neue Erinnerung
          </button>
        </div>
      </div>

      {info && (
        <p className="text-xs text-emerald-300 bg-emerald-950/20 border border-emerald-900 p-2 rounded-none">
          {info}
        </p>
      )}

      <section>
        <h3 className="font-display font-bold text-sm text-titanium-50 mb-2 flex items-center gap-2">
          <Bell className="h-4 w-4 text-emerald-400" /> Offen
        </h3>
        {open.length === 0 ? (
          <p className="text-sm text-titanium-400 bg-obsidian-900 border border-titanium-900 p-4">
            Keine offenen Erinnerungen.
          </p>
        ) : (
          <ul className="divide-y divide-titanium-900 bg-obsidian-900 border border-titanium-900">
            {open.map((r) => {
              const due = new Date(r.due_at);
              const urgency = urgencyOf(r.due_at);
              return (
                <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-titanium-100">{r.title}</span>
                      <UrgencyBadge urgency={urgency} />
                    </div>
                    <div className="text-[11px] text-titanium-500 font-mono">
                      {REMINDER_TYPE_LABELS[r.reminder_type]} · fällig {due.toLocaleDateString('de-DE')}
                      {yearMap.get(r.tax_year_id) && ` · ${yearMap.get(r.tax_year_id)?.year}`}
                    </div>
                  </div>
                  <button
                    onClick={() => dismiss(r.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-titanium-300 hover:text-titanium-100 border border-titanium-800 hover:border-titanium-700 shrink-0"
                  >
                    <Check className="h-3 w-3" /> Erledigt
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h3 className="font-display font-bold text-sm text-titanium-50 mb-2">Erledigt / Verworfen</h3>
          <ul className="divide-y divide-titanium-900 bg-obsidian-900 border border-titanium-900">
            {past.map((r) => (
              <li key={r.id} className="px-4 py-2 flex items-center justify-between gap-3 text-titanium-500">
                <div className="min-w-0">
                  <div className="line-through truncate">{r.title}</div>
                  <div className="text-[11px] font-mono">{r.status} · {new Date(r.due_at).toLocaleDateString('de-DE')}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {creating && (
        <CreateReminderModal
          tenantId={activeTenantId}
          years={years}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}

      {planningYearId && (
        <PlanDeadlinesModal
          tenantId={activeTenantId}
          year={years.find((y) => y.id === planningYearId)!}
          onClose={() => setPlanningYearId(null)}
          onGenerated={(summary) => {
            setPlanningYearId(null);
            setInfo(summary);
            reload();
            setTimeout(() => setInfo(null), 8000);
          }}
        />
      )}
    </div>
  );
}

function UrgencyBadge({ urgency }: { urgency: ReminderUrgency }) {
  const tone =
    urgency === 'overdue'  ? 'bg-red-950/40 border-red-800 text-red-300'
    : urgency === 'due_soon' ? 'bg-amber-950/40 border-amber-800 text-amber-300'
    : 'border-titanium-800 text-titanium-400';
  return (
    <span className={`text-[10px] uppercase tracking-wider border px-1.5 py-0.5 ${tone}`}>
      {URGENCY_LABEL[urgency]}
    </span>
  );
}

function PlanDeadlinesModal({
  tenantId, year, onClose, onGenerated,
}: {
  tenantId: string;
  year: TaxYear;
  onClose: () => void;
  onGenerated: (summary: string) => void;
}) {
  const [ustCadence, setUstCadence] = useState<UstCadence>(year.ust_cadence);
  const [hasAdvisor, setHasAdvisor] = useState(year.has_tax_advisor);
  const [legalForm, setLegalForm] = useState<LegalForm>(year.legal_form);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setSubmitting(true); setError(null);
    try {
      await updateTaxYearProfile(tenantId, year.id, {
        ust_cadence: ustCadence,
        has_tax_advisor: hasAdvisor,
        legal_form: legalForm,
      });
      const updated: TaxYear = { ...year, ust_cadence: ustCadence, has_tax_advisor: hasAdvisor, legal_form: legalForm };
      const { inserted, skipped, total } = await generateDeadlinesForYear(tenantId, updated);
      onGenerated(`${inserted} neue Fristen generiert (${skipped} bereits vorhanden, ${total} Katalog-Einträge).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generierung fehlgeschlagen');
      setSubmitting(false);
    }
  }

  const input = 'w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm rounded-none focus:border-emerald-500 outline-none';

  return (
    <Modal title={`Standard-Fristen ${year.year} planen`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-titanium-400 leading-relaxed">
          Wähle das Filing-Profil für {year.year}. Die Fristen werden aus einem
          deterministischen Katalog (USt-Voranmeldungen, Jahreserklärungen,
          ggf. Lohnsteueranmeldungen + Jahresabschluss) generiert.
          Bereits vorhandene Einträge mit gleichem Catalog-Key werden übersprungen.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Rechtsform</span>
            <select value={legalForm} onChange={(e) => setLegalForm(e.target.value as LegalForm)} className={input}>
              <option value="einzelunternehmer">Einzelunternehmer</option>
              <option value="gbr">GbR</option>
              <option value="ug">UG (haftungsbeschränkt)</option>
              <option value="gmbh">GmbH</option>
              <option value="ag">AG</option>
              <option value="other">Sonstige</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">USt-Voranmeldung</span>
            <select value={ustCadence} onChange={(e) => setUstCadence(e.target.value as UstCadence)} className={input}>
              <option value="monthly">Monatlich</option>
              <option value="quarterly">Vierteljährlich</option>
              <option value="none">Keine (Kleinunternehmer § 19)</option>
            </select>
          </label>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-titanium-300">
          <input type="checkbox" checked={hasAdvisor} onChange={(e) => setHasAdvisor(e.target.checked)} />
          Steuerberater betreut Jahreserklärung (verlängerte Frist bis Ende Februar des übernächsten Jahres)
        </label>
        <p className="text-[11px] text-titanium-500 leading-relaxed">
          Hinweis: Wir berücksichtigen Wochenend-/Feiertags-Verschiebung (§ 108 AO) nicht automatisch.
          Bitte verifiziere kritische Fristen mit deinem Steuerberater.
        </p>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-titanium-300 hover:text-titanium-100">Abbrechen</button>
          <button
            type="button"
            onClick={run}
            disabled={submitting}
            className="px-3 py-1.5 bg-cyan-500 text-obsidian-950 text-xs font-semibold rounded-none hover:bg-cyan-400 disabled:opacity-50"
          >
            {submitting ? 'Generiere …' : 'Fristen generieren'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateReminderModal({
  tenantId, years, onClose, onCreated,
}: {
  tenantId: string;
  years: TaxYear[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const todayPlus7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [taxYearId, setTaxYearId] = useState(years[0]?.id ?? '');
  const [reminderType, setReminderType] = useState<TaxReminderType>('monthly_review');
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState(todayPlus7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await createReminder(tenantId, {
        tax_year_id: taxYearId,
        reminder_type: reminderType,
        title: title.trim(),
        due_at: new Date(dueAt).toISOString(),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen');
      setSubmitting(false);
    }
  }

  const input = 'w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm rounded-none focus:border-emerald-500 outline-none';

  return (
    <Modal title="Neue Erinnerung" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Jahr</span>
            <select required value={taxYearId} onChange={(e) => setTaxYearId(e.target.value)} className={input}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}
            </select>
          </label>
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Typ</span>
            <select value={reminderType} onChange={(e) => setReminderType(e.target.value as TaxReminderType)} className={input}>
              <option value="monthly_review">Monats-Review</option>
              <option value="quarterly_review">Quartals-Review</option>
              <option value="year_end">Jahresabschluss-Vorbereitung</option>
              <option value="export_ready">Exportpaket bereit</option>
            </select>
          </label>
        </div>
        <label className="block text-xs">
          <span className="block text-titanium-400 mb-1">Titel</span>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className={input} placeholder="z.B. Q1-Belege durchsehen" />
        </label>
        <label className="block text-xs">
          <span className="block text-titanium-400 mb-1">Fällig am</span>
          <input type="date" required value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={input} />
        </label>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-titanium-300 hover:text-titanium-100">Abbrechen</button>
          <button
            type="submit"
            disabled={submitting || !taxYearId || !title}
            className="px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-xs font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50"
          >
            {submitting ? 'Speichere…' : 'Anlegen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
