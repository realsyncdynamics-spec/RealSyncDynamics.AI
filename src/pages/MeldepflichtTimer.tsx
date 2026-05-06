import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, AlertTriangle, Clock, ExternalLink, FileText,
} from 'lucide-react';

/**
 * 72h-Datenpanne-Meldepflicht-Timer (DSGVO Art. 33).
 *
 * User trägt Vorfalls-Zeitpunkt ein → Timer zählt 72h runter.
 * Plus: Authority-Lookup je Bundesland, Meldepflicht-Checkliste,
 * Vorlage-Link für die Aufsichts-Meldung.
 */

interface Authority {
  state: string;
  name: string;
  url: string;
  email: string;
}

const AUTHORITIES: Authority[] = [
  { state: 'Baden-Württemberg', name: 'LfDI BW', url: 'https://www.baden-wuerttemberg.datenschutz.de', email: 'poststelle@lfdi.bwl.de' },
  { state: 'Bayern', name: 'BayLDA', url: 'https://www.lda.bayern.de', email: 'poststelle@lda.bayern.de' },
  { state: 'Berlin', name: 'BlnBDI', url: 'https://www.datenschutz-berlin.de', email: 'mailbox@datenschutz-berlin.de' },
  { state: 'Brandenburg', name: 'LDA BB', url: 'https://www.lda.brandenburg.de', email: 'poststelle@lda.brandenburg.de' },
  { state: 'Bremen', name: 'LfDI HB', url: 'https://www.datenschutz.bremen.de', email: 'office@datenschutz.bremen.de' },
  { state: 'Hamburg', name: 'HmbBfDI', url: 'https://datenschutz-hamburg.de', email: 'mailbox@datenschutz.hamburg.de' },
  { state: 'Hessen', name: 'HBDI', url: 'https://datenschutz.hessen.de', email: 'poststelle@datenschutz.hessen.de' },
  { state: 'Mecklenburg-Vorpommern', name: 'LfDI MV', url: 'https://www.datenschutz-mv.de', email: 'info@datenschutz-mv.de' },
  { state: 'Niedersachsen', name: 'LfD NI', url: 'https://lfd.niedersachsen.de', email: 'poststelle@lfd.niedersachsen.de' },
  { state: 'Nordrhein-Westfalen', name: 'LDI NRW', url: 'https://www.ldi.nrw.de', email: 'poststelle@ldi.nrw.de' },
  { state: 'Rheinland-Pfalz', name: 'LfDI RLP', url: 'https://www.datenschutz.rlp.de', email: 'poststelle@datenschutz.rlp.de' },
  { state: 'Saarland', name: 'LfDI SL', url: 'https://datenschutz.saarland.de', email: 'poststelle@datenschutz.saarland.de' },
  { state: 'Sachsen', name: 'SächsDSB', url: 'https://www.saechsdsb.de', email: 'saechsdsb@slt.sachsen.de' },
  { state: 'Sachsen-Anhalt', name: 'LfD ST', url: 'https://datenschutz.sachsen-anhalt.de', email: 'poststelle@lfd.sachsen-anhalt.de' },
  { state: 'Schleswig-Holstein', name: 'ULD SH', url: 'https://www.datenschutzzentrum.de', email: 'mail@datenschutzzentrum.de' },
  { state: 'Thüringen', name: 'TLfDI', url: 'https://www.tlfdi.de', email: 'poststelle@datenschutz.thueringen.de' },
  { state: 'Bund (Telekom/Post)', name: 'BfDI', url: 'https://www.bfdi.bund.de', email: 'poststelle@bfdi.bund.de' },
];

export function MeldepflichtTimer() {
  const [incidentTime, setIncidentTime] = useState<Date | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [stateKey, setStateKey] = useState<string>('Bayern');

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedHours = useMemo(() => {
    if (!incidentTime) return 0;
    return (now.getTime() - incidentTime.getTime()) / 3_600_000;
  }, [incidentTime, now]);

  const remaining72 = Math.max(0, 72 - elapsedHours);
  const urgency: 'safe' | 'warning' | 'critical' = remaining72 > 48 ? 'safe' : remaining72 > 12 ? 'warning' : 'critical';
  const authority = AUTHORITIES.find((a) => a.state === stateKey) ?? AUTHORITIES[1];

  function fmt(h: number): string {
    const totalSec = Math.max(0, Math.floor(h * 3600));
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-red-500 to-orange-700 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">72h-Meldepflicht-Timer</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-red-900 bg-red-950/30 text-red-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Clock className="h-3 w-3" /> DSGVO Art. 33 · Pflicht-Meldung in 72h
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Datenpanne — <span className="text-red-400">72 Stunden Countdown</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Tracker für die DSGVO-Meldepflicht: Vorfalls-Zeitpunkt eintragen, Timer läuft.
              Plus: Aufsichtsbehörde je Bundesland + Meldepflicht-Checkliste.
            </p>
          </div>

          {!incidentTime ? (
            <div className="bg-obsidian-900 border border-titanium-900 p-6 rounded-none">
              <h2 className="font-display font-bold text-titanium-50 mb-3">Wann hast Du von der Datenpanne Kenntnis erhalten?</h2>
              <p className="text-sm text-titanium-400 mb-4">Die 72h-Frist beginnt nach Art. 33 ab dem Zeitpunkt der Kenntnisnahme — nicht ab Eintritt der Panne.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="datetime-local"
                  defaultValue={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setIncidentTime(new Date(e.target.value))}
                  className="flex-1 bg-obsidian-950 border border-titanium-700 px-3 py-2 text-sm rounded-none outline-none focus:border-security-500"
                />
                <button onClick={() => setIncidentTime(new Date())}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-none">
                  Jetzt — Vorfall ist gerade entdeckt
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={`p-6 sm:p-8 rounded-none border-2 ${
                urgency === 'critical' ? 'border-red-700 bg-red-950/40'
                : urgency === 'warning' ? 'border-amber-700 bg-amber-950/40'
                : 'border-emerald-700 bg-emerald-950/30'
              }`}>
                <div className={`text-xs uppercase tracking-[0.2em] font-bold mb-2 ${
                  urgency === 'critical' ? 'text-red-300' : urgency === 'warning' ? 'text-amber-300' : 'text-emerald-300'
                }`}>
                  Verbleibende Zeit bis 72h-Meldefrist
                </div>
                <div className={`font-display font-bold tabular-nums leading-none ${
                  urgency === 'critical' ? 'text-red-300' : urgency === 'warning' ? 'text-amber-300' : 'text-emerald-300'
                }`} style={{ fontSize: 'clamp(48px, 12vw, 96px)' }}>
                  {fmt(remaining72)}
                </div>
                <div className="text-xs text-titanium-400 mt-3">
                  Vorfall erkannt: {incidentTime.toLocaleString('de-DE')} · Vergangen: {elapsedHours.toFixed(1)}h
                </div>
                {remaining72 === 0 && (
                  <div className="mt-3 font-bold text-red-300 text-base">
                    ⚠️ Meldefrist überschritten — sofort {authority.name} kontaktieren!
                  </div>
                )}
              </div>

              <div className="bg-obsidian-900 border border-titanium-900 p-5 rounded-none">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="text-xs text-titanium-500 uppercase tracking-wider mb-1">Zuständige Aufsichtsbehörde</div>
                    <div className="font-display font-bold text-titanium-50">{authority.name} ({authority.state})</div>
                  </div>
                  <select value={stateKey} onChange={(e) => setStateKey(e.target.value)}
                    className="bg-obsidian-950 border border-titanium-700 px-2 py-1 text-xs rounded-none outline-none focus:border-security-500">
                    {AUTHORITIES.map((a) => <option key={a.state} value={a.state}>{a.state}</option>)}
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 text-xs">
                  <a href={authority.url} target="_blank" rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-security-400 hover:underline">
                    Web-Meldeformular <ExternalLink className="h-3 w-3" />
                  </a>
                  <a href={`mailto:${authority.email}?subject=Meldung%20gem%C3%A4%C3%9F%20Art.%2033%20DSGVO`}
                    className="inline-flex items-center gap-1 text-security-400 hover:underline">
                    {authority.email}
                  </a>
                </div>
              </div>

              <div className="bg-obsidian-900 border border-titanium-900 p-5 rounded-none">
                <h2 className="font-display font-bold text-titanium-50 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-titanium-400" />
                  Meldepflicht-Checkliste
                </h2>
                <ul className="space-y-2 text-sm text-titanium-300">
                  {[
                    'Art und Umfang der Datenpanne dokumentieren (welche Daten, wie viele Betroffene)',
                    'Mögliche Folgen abschätzen (Identitätsdiebstahl, finanzieller Schaden, Reputation)',
                    'Bisherige Maßnahmen zur Schadensbegrenzung beschreiben',
                    'DSB einbeziehen + interne Eskalation (falls vorhanden)',
                    'Wenn Risiko hoch: Betroffene zusätzlich gem. Art. 34 informieren',
                    'Meldung an Aufsicht (oben verlinkt) — innerhalb 72h',
                    'Verzeichnis der Datenpannen führen (Art. 33 Abs. 5)',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="shrink-0 w-5 h-5 bg-obsidian-950 border border-titanium-700 text-[10px] font-bold flex items-center justify-center text-titanium-300">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button onClick={() => setIncidentTime(null)}
                className="text-xs text-titanium-500 hover:text-titanium-200 underline">
                ← Vorfalls-Zeit korrigieren
              </button>
            </>
          )}

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <div className="flex items-start gap-3 mb-4">
              <ShieldCheck className="h-6 w-6 text-security-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
                  Datenpannen vermeiden, bevor sie passieren.
                </h2>
                <p className="text-sm text-titanium-300 leading-relaxed">
                  RealSyncDynamics.AI dokumentiert jeden KI-Aufruf revisionssicher. Wenn doch eine Panne kommt,
                  hast Du sofort den vollständigen Audit-Trail für die Aufsichts-Meldung.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/contact-sales?source=meldepflicht-timer" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Demo buchen
              </Link>
              <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Kostenloser DSGVO-Scan
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/legal/avv" className="hover:text-titanium-300">AVV</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
