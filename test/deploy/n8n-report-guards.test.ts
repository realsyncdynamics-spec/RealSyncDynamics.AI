import { describe, expect, it } from 'vitest';
import {
  parseKumaMetricsResponse,
  redact,
  redactDeep,
  renderKumaSection,
  resolveKumaMetricsUrl,
} from '../../deploy/ollama-traefik/n8n-workflows/lib/report-guards.js';

// Testwerte sind synthetisch; sie entsprechen nur dem Format echter Tokens.
const FAKE_GH_TOKEN = 'ghp_' + 'A'.repeat(36);
const FAKE_PAT = 'github_pat_' + 'B1_'.repeat(10);

describe('redact', () => {
  it('Test 1: maskiert GitHub-Token und E-Mail in einem PR-Titel', () => {
    const title = `fix: Token ${FAKE_GH_TOKEN} von max.muster@example.de entfernt`;
    const out = String(redact(title));
    expect(out).not.toContain(FAKE_GH_TOKEN);
    expect(out).not.toContain('max.muster@example.de');
    expect(out).toContain('[REDACTED_TOKEN]');
    expect(out).toContain('[REDACTED_EMAIL]');
  });

  it('maskiert Fine-grained-PAT, Bearer-Header und AWS-Key', () => {
    const out = String(
      redact(`${FAKE_PAT} Authorization: Bearer abcdefghijklmnop AKIA${'Z'.repeat(16)}`),
    );
    expect(out).not.toContain(FAKE_PAT);
    expect(out).toContain('Bearer [REDACTED]');
    expect(out).toContain('[REDACTED_KEY]');
  });

  it('maskiert key=value auch mit Präfix (GITHUB_TOKEN, access_token)', () => {
    const out = String(redact('GITHUB_TOKEN=abc123 access_token: xyz db_password=geheim'));
    expect(out).toBe('GITHUB_TOKEN=[REDACTED] access_token: [REDACTED] db_password=[REDACTED]');
  });

  it('maskiert Zugangsdaten mit zitierten Schlüsseln und Werten vollständig', () => {
    expect(redact('{"password":"synthetic-secret-123"}')).toBe('{"password":[REDACTED]}');
    expect(redact("{'api_key': 'synthetic value'}")).toBe("{'api_key': [REDACTED]}");
    const out = String(redact('db_password="synthetic secret phrase" weiter'));
    expect(out).toBe('db_password=[REDACTED] weiter');
    expect(out).not.toContain('secret phrase');
  });

  it('maskiert Zugangsdaten in URLs', () => {
    expect(redact('https://admin:s3cret@kuma.example.de/metrics')).toBe(
      'https://[REDACTED]@kuma.example.de/metrics',
    );
  });

  it('lässt null/undefined unverändert und harmlose Texte unberührt', () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
    expect(redact('feat(landing): Hero schärfen (#2122)')).toBe('feat(landing): Hero schärfen (#2122)');
  });

  it('redactDeep maskiert verschachtelte Strings', () => {
    const out = redactDeep({ prs: [{ title: `x ${FAKE_GH_TOKEN}` }], n: 3 }) as {
      prs: { title: string }[];
      n: number;
    };
    expect(out.prs[0].title).toBe('x [REDACTED_TOKEN]');
    expect(out.n).toBe(3);
  });
});

describe('resolveKumaMetricsUrl', () => {
  it('Test 2: leere UPTIME_KUMA_BASE_URL ergibt „Nicht verfügbar“ statt Throw', () => {
    for (const value of ['', '   ', undefined, null]) {
      const res = resolveKumaMetricsUrl(() => value);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.item.status).toBe('not_available');
        expect(renderKumaSection(res.item)).toContain('Nicht verfügbar');
        expect(res.item.reason).toBe('UPTIME_KUMA_BASE_URL nicht gesetzt');
      }
    }
  });

  it('gesperrter $env-Zugriff wirft nicht', () => {
    const res = resolveKumaMetricsUrl(() => {
      throw new Error('access to env vars denied');
    });
    expect(res.ok).toBe(false);
  });

  it('baut die /metrics-URL ohne doppelten Slash', () => {
    expect(resolveKumaMetricsUrl(() => ' https://kuma.example.de// ')).toEqual({
      ok: true,
      url: 'https://kuma.example.de/metrics',
    });
  });

  it('lehnt Nicht-http-URLs ab', () => {
    expect(resolveKumaMetricsUrl(() => 'kuma.example.de').ok).toBe(false);
  });
});

describe('parseKumaMetricsResponse', () => {
  it('Test 3: 401 von /metrics ergibt „Nicht verfügbar“ mit Grund', () => {
    const res = parseKumaMetricsResponse({
      error: { message: 'Authorization failed - please check your credentials', httpCode: '401' },
    });
    expect(res.status).toBe('not_available');
    const section = renderKumaSection(res);
    expect(section).toContain('Nicht verfügbar');
    expect(section).toContain('HTTP 401');
  });

  it('maskiert Secrets in Fehlermeldungen', () => {
    const res = parseKumaMetricsResponse({ error: { message: `token=${FAKE_GH_TOKEN} failed` } });
    expect(JSON.stringify(res)).not.toContain(FAKE_GH_TOKEN);
  });

  it('erkennt HTML (Login-Seite) und leere Antworten', () => {
    expect(parseKumaMetricsResponse({ data: '<!DOCTYPE html><html>' }).status).toBe('not_available');
    expect(parseKumaMetricsResponse({ data: '' }).status).toBe('not_available');
    expect(parseKumaMetricsResponse({}).status).toBe('not_available');
    expect(parseKumaMetricsResponse(null).status).toBe('not_available');
  });

  it('parst monitor_status und zählt Zustände', () => {
    const body = [
      '# HELP monitor_status Monitor Status (1 = UP, 0= DOWN, 2= PENDING, 3= MAINTENANCE)',
      '# TYPE monitor_status gauge',
      'monitor_status{monitor_name="Website",monitor_type="http",monitor_url="https://example.de/",monitor_hostname="null",monitor_port="null"} 1',
      'monitor_status{monitor_name="Supabase",monitor_type="http",monitor_url="https://x.supabase.co/",monitor_hostname="null",monitor_port="null"} 0',
      'monitor_status{monitor_name="n8n",monitor_type="http",monitor_url="https://n8n.example.de/",monitor_hostname="null",monitor_port="null"} 3',
      'monitor_response_time{monitor_name="Website",monitor_type="http",monitor_url="https://example.de/",monitor_hostname="null",monitor_port="null"} 120',
    ].join('\n');
    const res = parseKumaMetricsResponse({ data: body });
    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.counts).toMatchObject({ up: 1, down: 1, maintenance: 1 });
    }
    const section = renderKumaSection(res);
    expect(section).toContain('Up: 1 · Down: 1');
    expect(section).toContain('- Supabase: down');
    expect(section).not.toContain('- Website');
  });

  it('verliert keinen Monitor mit } im Labelwert', () => {
    const body = [
      'monitor_status{monitor_name="Web",monitor_type="http"} 1',
      'monitor_status{monitor_name="DB {production}",monitor_type="port"} 0',
      'monitor_status{monitor_name="Quote \\"x\\" }",monitor_type="http"} 2',
    ].join('\n');
    const res = parseKumaMetricsResponse({ data: body });
    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.counts).toMatchObject({ up: 1, down: 1, pending: 1 });
    }
    expect(renderKumaSection(res)).toContain('- DB {production}: down');
  });

  it('meldet fehlende monitor_status-Werte', () => {
    expect(parseKumaMetricsResponse({ data: '# HELP nothing\n' }).status).toBe('not_available');
  });
});
