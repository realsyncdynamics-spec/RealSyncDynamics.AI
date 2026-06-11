import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ArrowRight, Check } from 'lucide-react';

/**
 * Methodology-Walkthrough-Booking-Flow.
 *
 * Inline-Lead-Capture mit Time-Slot-Präferenz. Submit triggert nur
 * /contact-sales-Edge-Function (existing) mit zusätzlichem Kontext —
 * keine externe Buchungs-Plattform-Abhängigkeit (Calendly/Cal.com können
 * später ergänzt werden, ohne dass der Flow bricht).
 *
 * Gedacht für /legal/methodology, /security, /grenzen — überall wo der
 * Nutzer einen 30-Min-Walkthrough mit Methodik-Detail anfragen kann.
 */
type Slot = 'this_week' | 'next_week' | 'in_2_weeks' | 'flexible';

const SLOT_LABEL: Record<Slot, string> = {
  this_week: 'Diese Woche',
  next_week: 'Nächste Woche',
  in_2_weeks: 'In 2 Wochen',
  flexible: 'Flexibel — Vorschlag erbeten',
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function MethodologyBooking({ source = 'methodology' }: { source?: string }) {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [slot, setSlot] = useState<Slot>('flexible');
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !company) return;
    setStatus('submitting');
    setErrorMsg('');

    try {
      // Use existing sales-lead Edge Function. If Supabase env not configured,
      // fall back to mailto so the form is never a dead end.
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        const subject = encodeURIComponent(`Methodik-Walkthrough — ${company}`);
        const body = encodeURIComponent(
          `Email: ${email}\nFirma: ${company}\nZeit-Slot: ${SLOT_LABEL[slot]}\nThema: ${topic || '—'}\nQuelle: ${source}`,
        );
        window.location.href = `mailto:support@realsyncdynamicsai.de?subject=${subject}&body=${body}`;
        setStatus('success');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/sales-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email,
          company,
          source,
          intent: 'methodology_walkthrough',
          time_slot: slot,
          topic: topic || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Unbekannter Fehler');
    }
  }

  if (status === 'success') {
    return (
      <div className="p-6 bg-obsidian-900 border border-emerald-700 rounded-none">
        <div className="flex items-start gap-3">
          <Check className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display font-bold text-titanium-50 text-base mb-1">
              Anfrage erhalten — unser AI Agent übernimmt
            </h3>
            <p className="text-sm text-titanium-300 leading-relaxed">
              Unser AI Agent schlägt sofort einen passenden Terminslot im Zeitfenster
              ({SLOT_LABEL[slot]}) vor. 30-Min-Walkthrough via Video-Call, EU-DSGVO-konform.
              Fallback-Kanal:{' '}
              <a className="text-security-400" href="mailto:support@realsyncdynamicsai.de">
                support@realsyncdynamicsai.de
              </a>.
            </p>
            {topic && (
              <p className="text-xs text-titanium-500 mt-2">
                Notiertes Thema: <em>„{topic}"</em>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="p-6 bg-obsidian-900 border border-security-700 rounded-none space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-security-400" />
        <h3 className="font-display font-bold text-titanium-50 text-lg">Methodik-Walkthrough buchen</h3>
      </div>
      <p className="text-sm text-titanium-300 leading-relaxed">
        30-Min-Walkthrough geführt durch unseren AI Agent. Methodik (Datenquellen,
        Confidence-Mapping, Update-Prozess) wird auf deinen Use-Case zugeschnitten.
        Kostenlos, keine Kaufverpflichtung.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-titanium-400 font-bold uppercase tracking-wider">E-Mail *</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vorname.name@firma.de"
            className="mt-1 w-full bg-obsidian-950 border border-titanium-700 text-titanium-100 px-3 py-2 text-sm rounded-none focus:border-security-500 outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs text-titanium-400 font-bold uppercase tracking-wider">Firma *</span>
          <input
            type="text"
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Firmenname"
            className="mt-1 w-full bg-obsidian-950 border border-titanium-700 text-titanium-100 px-3 py-2 text-sm rounded-none focus:border-security-500 outline-none"
          />
        </label>
      </div>

      <div>
        <span className="text-xs text-titanium-400 font-bold uppercase tracking-wider">Zeit-Slot</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
          {(Object.keys(SLOT_LABEL) as Slot[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSlot(s)}
              className={`px-3 py-2 text-xs font-bold border rounded-none ${
                slot === s
                  ? 'border-security-500 bg-security-950 text-security-200'
                  : 'border-titanium-800 bg-obsidian-950 text-titanium-400 hover:border-titanium-600'
              }`}
            >
              {SLOT_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-xs text-titanium-400 font-bold uppercase tracking-wider">Thema (optional)</span>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="z. B. AI-Act-Klassifikation für HR-Tool, Drittland-TIA, …"
          className="mt-1 w-full bg-obsidian-950 border border-titanium-700 text-titanium-100 px-3 py-2 text-sm rounded-none focus:border-security-500 outline-none"
        />
      </label>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <button
          type="submit"
          disabled={status === 'submitting' || !email || !company}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 disabled:bg-titanium-800 disabled:text-titanium-600 disabled:cursor-not-allowed text-white text-sm font-bold rounded-none"
        >
          {status === 'submitting' ? 'Sende …' : 'Termin anfragen'} <ArrowRight className="h-4 w-4" />
        </button>
        <Link to="/contact-sales?source=methodology-fallback" className="text-xs text-titanium-500 hover:text-titanium-300 underline">
          Lieber per Kontakt-Formular?
        </Link>
      </div>

      {status === 'error' && (
        <p className="text-xs text-red-300">
          Übertragung fehlgeschlagen ({errorMsg}). Versuch's nochmal oder schreib direkt an{' '}
          <a className="text-security-400" href="mailto:support@realsyncdynamicsai.de">
            support@realsyncdynamicsai.de
          </a>
          .
        </p>
      )}

      <p className="text-[11px] text-titanium-500 leading-relaxed">
        Mit Absenden willigst du ein, dass wir deine Angaben (E-Mail, Firma, Slot, Thema) für die Beantwortung
        der Anfrage verarbeiten. Rechtsgrundlage: Art. 6 Abs. 1 lit. b/f DSGVO. Details:{' '}
        <Link to="/legal/privacy" className="text-titanium-400 underline">
          Datenschutzerklärung
        </Link>
        .
      </p>
    </form>
  );
}
