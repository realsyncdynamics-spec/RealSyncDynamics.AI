// Schutzfunktionen für n8n-Berichts-Workflows (GitHub-Bericht + Uptime-Kuma-/metrics).
//
// Reines JavaScript ohne Abhängigkeiten: Die Funktionen lassen sich 1:1 in einen
// n8n-Code-Node kopieren (dort ohne `export`). Getestet in
// test/deploy/n8n-report-guards.test.ts.
//
// Grundsatz: Jeder Fehler in einer Quelle ergibt einen Abschnitt „Nicht verfügbar“
// mit Grund, nie einen Workflow-Abbruch. Jeder Text aus externen Quellen läuft vor
// dem Bericht durch `redact`.

const KUMA_SOURCE = 'uptime_kuma';

/** Uptime-Kuma-Statuscodes aus `monitor_status`. */
export const KUMA_STATUS = { 0: 'down', 1: 'up', 2: 'pending', 3: 'maintenance' };

/**
 * Maskiert Tokens, Zugangsdaten und E-Mail-Adressen in einem Text.
 * Reihenfolge ist relevant: spezifische Muster zuerst, generisches key=value zuletzt.
 * @param {unknown} text
 * @returns {unknown}
 */
export function redact(text) {
  if (text == null) return text;
  return (
    String(text)
      // Zugangsdaten in URLs (https://user:pass@host)
      .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@')
      // GitHub-Tokens (classic, fine-grained, OAuth, App, Refresh)
      .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[REDACTED_TOKEN]')
      // Bearer-/Basic-Header
      .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{10,}/gi, '$1 [REDACTED]')
      // AWS-/R2-artige Access Keys
      .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED_KEY]')
      // key=value / key: value, auch mit Präfix (GITHUB_TOKEN, access_token, db_password)
      .replace(
        /\b([A-Za-z0-9_-]*(?:api[_-]?key|token|secret|password|passwd))(\s*[:=]\s*)(?!\[REDACTED)\S+/gi,
        '$1$2[REDACTED]',
      )
      // E-Mail-Adressen
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]')
  );
}

/**
 * Wendet `redact` rekursiv auf alle Strings in Objekten und Arrays an.
 * @param {unknown} value
 * @returns {unknown}
 */
export function redactDeep(value) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v)]));
  }
  return value;
}

/**
 * @param {string} reason
 * @returns {{ source: string, status: 'not_available', reason: string }}
 */
export function kumaNotAvailable(reason) {
  return { source: KUMA_SOURCE, status: 'not_available', reason: String(redact(reason)) };
}

/**
 * Ermittelt die /metrics-URL. `readEnv` kapselt den Zugriff auf `$env`, weil n8n
 * bei N8N_BLOCK_ENV_ACCESS_IN_NODE=true beim Lesen wirft.
 * Im Code-Node: resolveKumaMetricsUrl(() => $env.UPTIME_KUMA_BASE_URL)
 * @param {() => unknown} readEnv
 * @returns {{ ok: true, url: string } | { ok: false, item: ReturnType<typeof kumaNotAvailable> }}
 */
export function resolveKumaMetricsUrl(readEnv) {
  let raw;
  try {
    raw = readEnv();
  } catch {
    return { ok: false, item: kumaNotAvailable('Zugriff auf Umgebungsvariablen in n8n gesperrt') };
  }
  const baseUrl = typeof raw === 'string' ? raw.trim() : '';
  if (!baseUrl) {
    return { ok: false, item: kumaNotAvailable('UPTIME_KUMA_BASE_URL nicht gesetzt') };
  }
  if (!/^https?:\/\//i.test(baseUrl)) {
    return { ok: false, item: kumaNotAvailable('UPTIME_KUMA_BASE_URL ist keine http(s)-URL') };
  }
  return { ok: true, url: baseUrl.replace(/\/+$/, '') + '/metrics' };
}

/**
 * Liest ein Label aus einem Prometheus-Labelblock.
 * @param {string} labels
 * @param {string} name
 */
function readLabel(labels, name) {
  const m = labels.match(new RegExp(`(?:^|,)\\s*${name}="((?:[^"\\\\]|\\\\.)*)"`));
  return m ? m[1].replace(/\\(.)/g, '$1') : null;
}

/**
 * Wertet die Antwort des HTTP-Request-Nodes aus (Response Format „Text“,
 * Fehlerbehandlung `continueRegularOutput`). Bei 401/404/Timeout liegt dort ein
 * Fehlerobjekt statt Prometheus-Text.
 * @param {any} json  `$input.first().json`
 * @param {string} [dataField] Ausgabefeld des HTTP-Nodes (Standard `data`)
 */
export function parseKumaMetricsResponse(json, dataField = 'data') {
  if (!json || typeof json !== 'object') return kumaNotAvailable('Keine Metrics-Antwort');
  if (json.error) {
    const err = json.error;
    const code = err.httpCode || err.status || err.statusCode;
    const msg = err.message || err.description || 'Fehler beim Abruf von /metrics';
    return kumaNotAvailable(code ? `HTTP ${code}: ${msg}` : msg);
  }
  const body = json[dataField];
  if (typeof body !== 'string' || body.trim() === '') {
    return kumaNotAvailable('Keine Metrics-Antwort');
  }
  if (/^\s*</.test(body)) {
    return kumaNotAvailable('Antwort ist HTML statt Prometheus-Text (Login-Seite oder Proxy?)');
  }

  const monitors = [];
  const lineRe = /^monitor_status\{([^}]*)\}\s+(-?\d+(?:\.\d+)?)\s*$/;
  for (const line of body.split('\n')) {
    const m = line.trim().match(lineRe);
    if (!m) continue;
    const code = Number(m[2]);
    monitors.push({
      name: String(redact(readLabel(m[1], 'monitor_name') ?? 'unbenannt')),
      type: readLabel(m[1], 'monitor_type'),
      status: KUMA_STATUS[/** @type {0|1|2|3} */ (code)] ?? 'unknown',
    });
  }
  if (monitors.length === 0) {
    return kumaNotAvailable('Keine monitor_status-Werte in /metrics gefunden');
  }

  const counts = { up: 0, down: 0, pending: 0, maintenance: 0, unknown: 0 };
  for (const mon of monitors) counts[/** @type {keyof typeof counts} */ (mon.status)] += 1;
  return { source: KUMA_SOURCE, status: 'ok', counts, monitors };
}

/**
 * Markdown-Abschnitt für den Bericht.
 * @param {ReturnType<typeof parseKumaMetricsResponse>} result
 */
export function renderKumaSection(result) {
  if (result.status !== 'ok') {
    return `## Uptime Kuma\n\nNicht verfügbar – ${redact(result.reason)}`;
  }
  const { counts, monitors } = /** @type {any} */ (result);
  const lines = [
    '## Uptime Kuma',
    '',
    `Up: ${counts.up} · Down: ${counts.down} · Pending: ${counts.pending} · Wartung: ${counts.maintenance}`,
  ];
  const problems = monitors.filter((/** @type {any} */ m) => m.status !== 'up');
  if (problems.length) {
    lines.push('', ...problems.map((/** @type {any} */ m) => `- ${m.name}: ${m.status}`));
  }
  return lines.join('\n');
}
