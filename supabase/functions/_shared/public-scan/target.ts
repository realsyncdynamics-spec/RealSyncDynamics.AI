// Zielprüfung des öffentlichen Scans — Normalisierung und SSRF-Schranke.
//
// Diese Datei ist bewusst frei von Laufzeit-APIs (kein fetch, kein Deno):
// Sie wird von der Edge Function und von Vitest gleichermaßen importiert,
// damit die Sicherheitsschranke testbar ist statt nur behauptet.
//
// Sicherheitsrelevanz: Der öffentliche Scan ruft eine Adresse ab, die ein
// **nicht angemeldeter** Besucher bestimmt. Ohne Schranke wäre er ein
// Werkzeug, um aus dem Supabase-Netz heraus interne Dienste und
// Cloud-Metadaten-Endpunkte anzusprechen. Der Filter unten ist deshalb eine
// Zulassungsprüfung, keine Blockliste mit Ausnahmen.

/** Ergebnis der Zielprüfung. `reason` ist für Endnutzer formuliert. */
export type TargetCheck =
  | { ok: true; url: URL; domain: string }
  | { ok: false; reason: string };

/**
 * Ergänzt ein fehlendes Schema. Der Besucher tippt „firma.de“, nicht
 * „https://firma.de“ — das ist der Regelfall, kein Sonderfall.
 *
 * Bewusst **kein** Trimmen von Pfaden: Wer eine Unterseite prüfen lassen
 * will, soll das dürfen. Entfernt werden nur umschließende Leerzeichen und
 * ein versehentlich mitkopiertes „@“ aus Mail-Signaturen.
 */
export function normalizeScanInput(raw: string): string {
  const trimmed = raw.trim().replace(/^@+/, '');
  if (trimmed === '') return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Ein Schema, das wir nicht unterstützen, bleibt stehen und fällt in der
  // Prüfung durch — es wird nicht stillschweigend zu https umgebogen.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Prüft ein Scan-Ziel. Erlaubt sind ausschließlich http/https auf
 * öffentliche Hosts über die Standard-Ports.
 *
 * Bekannte Grenze: DNS-Rebinding schließt das nicht aus — dafür müsste der
 * Host vor dem Abruf aufgelöst und die Verbindung an die geprüfte Adresse
 * gebunden werden. Die Schranke senkt die Angriffsfläche, ersetzt aber
 * keine Netzsegmentierung. Diese Grenze steht hier, damit die nächste
 * Sitzung sie kennt statt sie neu zu entdecken.
 */
export function validateScanTarget(raw: string): TargetCheck {
  const normalized = normalizeScanInput(raw);
  if (normalized === '') return { ok: false, reason: 'Bitte geben Sie eine Adresse ein.' };

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return { ok: false, reason: 'Die Adresse ist nicht lesbar. Beispiel: firma.de' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Es lassen sich nur http- und https-Adressen prüfen.' };
  }

  if (url.port !== '' && url.port !== '80' && url.port !== '443') {
    return { ok: false, reason: 'Es lassen sich nur die Standard-Ports 80 und 443 prüfen.' };
  }

  // Zugangsdaten in der URL deuten auf einen internen Endpunkt hin und
  // würden sonst mit dem Abruf an einen Fremdhost gehen.
  if (url.username !== '' || url.password !== '') {
    return { ok: false, reason: 'Adressen mit Zugangsdaten lassen sich nicht prüfen.' };
  }

  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    host.endsWith('.home.arpa')
  ) {
    return { ok: false, reason: 'Interne Hostnamen lassen sich nicht prüfen.' };
  }

  // Ein Host ohne Punkt ist entweder ein interner Kurzname oder ein
  // Adressliteral in ungewöhnlicher Schreibweise. Beides wird abgelehnt.
  if (!host.includes('.') && !host.startsWith('[')) {
    return { ok: false, reason: 'Bitte geben Sie eine vollständige Domain an, z. B. firma.de' };
  }

  if (isPrivateAddressLiteral(host)) {
    return { ok: false, reason: 'Adressen aus privaten Netzbereichen lassen sich nicht prüfen.' };
  }

  return { ok: true, url, domain: host };
}

/**
 * Adressliterale aus nicht-öffentlichen Bereichen. Deckt auch die
 * Cloud-Metadaten-Adresse 169.254.169.254 ab — der klassische Zielpunkt
 * eines SSRF-Angriffs auf gehostete Umgebungen.
 *
 * Erwartet einen Host, wie ihn `URL.hostname` liefert, **nicht** die
 * Rohreingabe. Das ist wesentlich: Der WHATWG-Parser vereinheitlicht die
 * ausweichenden Schreibweisen von IPv4 vorher selbst — `0177.0.0.1`,
 * `0x7f.0.0.1`, `2130706433` und `127.1` kommen hier alle als `127.0.0.1`
 * an. Eine eigene Oktal-/Hex-Erkennung wäre deshalb nicht nur überflüssig,
 * sie würde echte öffentliche Adressen fälschlich sperren (`010.0.0.1`
 * normalisiert zu `8.0.0.1`, und das ist öffentlich).
 */
export function isPrivateAddressLiteral(host: string): boolean {
  // IPv6-Literale erscheinen in URL.hostname in eckigen Klammern.
  if (host.startsWith('[')) {
    const inner = host.slice(1, -1).toLowerCase();
    if (inner === '::1' || inner === '::') return true;
    // Unique-Local (fc00::/7) und Link-Local (fe80::/10).
    if (/^f[cd]/.test(inner)) return true;
    if (/^fe[89ab]/.test(inner)) return true;

    // IPv4-gemappte Adressen. Der Parser schreibt sie in Hex-Gruppen um:
    // `::ffff:169.254.169.254` wird zu `::ffff:a9fe:a9fe`. Wer nur auf die
    // gepunktete Schreibweise prüft, lässt genau die Metadaten-Adresse
    // durch — deshalb werden beide Formen zurückgerechnet.
    const mappedDotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(inner);
    if (mappedDotted) return isPrivateAddressLiteral(mappedDotted[1]);

    const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(inner);
    if (mappedHex) {
      const high = parseInt(mappedHex[1], 16);
      const low = parseInt(mappedHex[2], 16);
      const dotted = [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
      return isPrivateAddressLiteral(dotted);
    }

    return false;
  }

  const parts = host.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => Number(p));
  if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return false;

  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // Link-local, u. a. Cloud-Metadaten
  if (a === 100 && b >= 64 && b <= 127) return true; // Carrier-Grade NAT
  if (a >= 224) return true; // Multicast und reservierter Bereich
  return false;
}
