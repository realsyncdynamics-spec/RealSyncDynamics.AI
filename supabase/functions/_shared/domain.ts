// Domain-Normalisierung für den Vergleich zwischen Browser-Eingabe und dem
// gespeicherten Audit-Hostnamen.
//
// Hintergrund: `gdpr-audit/index.ts:99` speichert `new URL(url).hostname`, also
// den Hostnamen INKLUSIVE `www.`. Der CTA reicht denselben Wert weiter, aber ein
// Nutzer kann die URL zwischendurch verändert haben (Groß-/Kleinschreibung,
// Schema, Pfad, Port, Trailing-Dot). Ohne beidseitig identische Normalisierung
// würde ein völlig gültiger Audit mit AUDIT_DOMAIN_MISMATCH abgelehnt.
//
// Bewusste Entscheidung: `www.` wird für den VERGLEICH entfernt, damit
// `www.example.com` und `example.com` als dieselbe Domain gelten. Für die
// Speicherung (websites.domain, monitoring_sources.url) wird derselbe
// normalisierte Wert verwendet, damit die Registry pro Domain genau eine Zeile
// führt und nicht zwischen www- und apex-Schreibweise aufsplittet.

/**
 * Normalisiert eine Domain oder URL auf einen vergleichbaren Hostnamen.
 * Gibt `null` zurück, wenn nichts Brauchbares übrig bleibt.
 *
 *   'https://WWW.Example.com:443/pfad?q=1' → 'example.com'
 *   'example.com.'                          → 'example.com'
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null;

  let value = input.trim().toLowerCase();
  if (!value) return null;

  // Schema entfernen (auch schemalose //host-Schreibweise).
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^\/\//, '');

  // Credentials aus user:pass@host entfernen.
  const atIndex = value.lastIndexOf('@');
  if (atIndex !== -1) value = value.slice(atIndex + 1);

  // Pfad, Query und Fragment abschneiden.
  value = value.split(/[/?#]/)[0];

  // Port entfernen — IPv6-Literale in Klammern bleiben unangetastet.
  if (!value.startsWith('[')) {
    const colonIndex = value.indexOf(':');
    if (colonIndex !== -1) value = value.slice(0, colonIndex);
  }

  // Trailing-Dot des FQDN entfernen.
  value = value.replace(/\.+$/, '');

  // Führendes `www.` für den Vergleich abziehen.
  value = value.replace(/^www\./, '');

  if (!value) return null;
  // Ein Hostname ohne Punkt ist für diesen Flow nicht brauchbar (localhost,
  // Tippfehler). Der Free Audit lehnt solche Eingaben bereits ab.
  if (!value.includes('.')) return null;
  if (value.length > 253) return null;
  if (!/^[a-z0-9.\-_]+$/.test(value)) return null;

  return value;
}

/** Prüft, ob zwei Eingaben dieselbe Domain bezeichnen. */
export function domainsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeDomain(a);
  const nb = normalizeDomain(b);
  return na !== null && nb !== null && na === nb;
}
