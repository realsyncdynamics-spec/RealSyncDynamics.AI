/**
 * Vorbelegung des Audit-Steppers (`/audit`) aus der Adresszeile.
 *
 * Kanonisch ist `?domain=` — so schicken Startseite, `/scan/start`, der
 * Cookie-Scanner und die Design-Vorschauen die getippte Adresse mit.
 *
 * Die Suche oben in der App-Shell (`GovernanceAddressBar`, „Scannen" im
 * eingebetteten Browser) schickte dagegen `?target=`; `/audit` las nur
 * `domain`, die Eingabe ging auf dem Weg verloren. Beide Seiten gehen jetzt
 * über diese Datei: Sender bauen den Pfad mit `auditPathFor()`, der
 * Empfänger liest mit `readAuditPrefill()`. Ältere Links mit `target`,
 * `url` oder `q` werden weiter angenommen — `domain` gewinnt.
 */

/** Gelesene Parameter in Vorrangreihenfolge. */
export const AUDIT_PREFILL_PARAMS = ['domain', 'target', 'url', 'q'] as const;

/** Gleiche Obergrenze wie das Domain-Feld des Steppers. */
export const AUDIT_PREFILL_MAX = 255;

/** Startwert für das Domain-Feld aus einem `location.search`-String. */
export function readAuditPrefill(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of AUDIT_PREFILL_PARAMS) {
    const value = params.get(key)?.trim();
    if (value) return value.slice(0, AUDIT_PREFILL_MAX);
  }
  return '';
}

/**
 * Pfad zum Audit mit vorbelegter Eingabe. Leere Eingabe → nacktes `/audit`.
 * `source` landet wie bei den übrigen Einstiegen als `?source=` im Scan.
 */
export function auditPathFor(value: string, source?: string): string {
  const params = new URLSearchParams();
  const trimmed = value.trim().slice(0, AUDIT_PREFILL_MAX);
  if (trimmed) params.set('domain', trimmed);
  if (source) params.set('source', source);
  const query = params.toString();
  return query ? `/audit?${query}` : '/audit';
}
