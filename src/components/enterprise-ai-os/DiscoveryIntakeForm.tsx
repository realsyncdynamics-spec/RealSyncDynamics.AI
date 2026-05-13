import { useState } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const DATA_CATEGORY_OPTIONS = [
  { value: 'personal_data', label: 'Personenbezogene Daten' },
  { value: 'customer_data', label: 'Kundendaten' },
  { value: 'employee_data', label: 'Mitarbeiterdaten' },
  { value: 'health_data', label: 'Gesundheitsdaten' },
  { value: 'payroll_data', label: 'Gehaltsdaten' },
  { value: 'biometric_data', label: 'Biometrische Daten' },
  { value: 'financial_data', label: 'Finanzdaten' },
  { value: 'sensitive_data', label: 'Sensible Daten (sonstige)' },
  { value: 'public_data', label: 'Öffentliche Daten' },
];

export function DiscoveryIntakeForm({
  onSuccess,
}: {
  onSuccess?: (registryId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ registryId: string; riskLevel: string } | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  function toggleCategory(value: string) {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!SUPABASE_URL) {
      setError('Supabase ist nicht konfiguriert.');
      return;
    }

    const form = new FormData(event.currentTarget);
    const payload = {
      systemName: String(form.get('systemName') || ''),
      provider: String(form.get('provider') || ''),
      model: String(form.get('model') || '') || undefined,
      usageContext: String(form.get('usageContext') || '') || undefined,
      department: String(form.get('department') || '') || undefined,
      dataCategories: selectedCategories,
      externalUsage: form.get('externalUsage') === 'on',
      containsPersonalData: form.get('containsPersonalData') === 'on',
      containsSensitiveData: form.get('containsSensitiveData') === 'on',
      comment: String(form.get('comment') || '') || undefined,
      actor: 'self-assessment',
    };

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/enterprise-ai-os-discovery-intake`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const registryId = body.registry?.id as string;
      const riskLevel = (body.runs?.risk?.riskLevel as string) ?? 'unknown';
      setSuccessInfo({ registryId, riskLevel });
      onSuccess?.(registryId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (successInfo) {
    return (
      <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-100">
        <h3 className="font-semibold text-emerald-300">KI-System gemeldet</h3>
        <p className="mt-3 text-sm">
          Eintrag <code className="text-emerald-200">{successInfo.registryId}</code> wurde
          angelegt. Risk Classification Agent hat es als{' '}
          <strong>{successInfo.riskLevel}</strong> eingestuft. Status: ungenehmigt — Human Review
          erforderlich.
        </p>
        <button
          type="button"
          onClick={() => setSuccessInfo(null)}
          className="mt-4 rounded-xl bg-[#d4af37] px-4 py-2 text-xs font-semibold text-black"
        >
          Weiteres System melden
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="systemName" label="Systemname *" placeholder="z. B. ChatGPT Enterprise" required />
        <Field name="provider" label="Anbieter *" placeholder="z. B. OpenAI" required />
        <Field name="model" label="Modell" placeholder="z. B. gpt-4.1" />
        <Field name="department" label="Abteilung" placeholder="z. B. Sales" />
      </div>

      <TextArea
        name="usageContext"
        label="Nutzungskontext"
        placeholder="Wofür wird das System verwendet? (z. B. Kundenanalyse, Codegenerierung)"
      />

      <div>
        <label className="text-sm text-zinc-300">Datenkategorien</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {DATA_CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleCategory(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs ${
                selectedCategories.includes(opt.value)
                  ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#d4af37]'
                  : 'border-white/10 bg-white/[0.04] text-zinc-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Checkbox name="externalUsage" label="Wird extern verwendet?" />
        <Checkbox name="containsPersonalData" label="Personenbezogene Daten?" />
        <Checkbox name="containsSensitiveData" label="Sensible Daten?" />
      </div>

      <TextArea name="comment" label="Kommentar" placeholder="Zusatzinformation (optional)" />

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-[#d4af37] px-6 py-3 text-sm font-semibold text-black disabled:opacity-60"
      >
        {loading ? 'Sende …' : 'KI-System melden'}
      </button>

      <p className="text-[11px] text-zinc-500">
        Hinweis: Meldung erzeugt einen ungeprüften Registry-Eintrag. Risk Classification + Policy
        Enforcement Agents werden automatisch ausgeführt; das System bleibt ungenehmigt bis zur
        Human Review.
      </p>
    </form>
  );
}

function Field({
  name, label, placeholder, required,
}: { name: string; label: string; placeholder: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="text-sm text-zinc-300">{label}</label>
      <input
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]"
      />
    </div>
  );
}

function TextArea({
  name, label, placeholder,
}: { name: string; label: string; placeholder: string }) {
  return (
    <div>
      <label htmlFor={name} className="text-sm text-zinc-300">{label}</label>
      <textarea
        id={name}
        name={name}
        placeholder={placeholder}
        rows={3}
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]"
      />
    </div>
  );
}

function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200">
      <input type="checkbox" name={name} className="h-4 w-4 accent-[#d4af37]" />
      {label}
    </label>
  );
}
