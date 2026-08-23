/**
 * Abruf der zu prüfenden Seite.
 *
 * Der Endpunkt ist ohne Anmeldung erreichbar. Die Obergrenze für das
 * gelesene Volumen ist deshalb kein Feinschliff, sondern der Schutz davor,
 * dass eine beliebige Adresse die eigene Funktion lahmlegt. Genau das
 * prüfen die Fälle unten — mit einem Strom, der nie endet.
 */
import { describe, expect, it } from 'vitest';
import {
  extractThirdPartyHosts,
  observeSite,
  parseSetCookies,
  registrableDomain,
  MAX_REDIRECTS,
} from '../../supabase/functions/_shared/public-scan/observe';

/** Antwort mit Body-Stream, wie `fetch` ihn liefert. */
function antwort(
  body: string,
  init: { status?: number; headers?: Record<string, string>; url?: string } = {},
): Response {
  const response = new Response(body, {
    status: init.status ?? 200,
    headers: init.headers ?? { 'content-type': 'text/html' },
  });
  // `Response.url` ist schreibgeschützt; für die Auswertung nach einer
  // Weiterleitung muss der Test sie dennoch setzen können.
  Object.defineProperty(response, 'url', { value: init.url ?? 'https://firma.de/', configurable: true });
  return response;
}

describe('observeSite', () => {
  it('liefert Status, kleingeschriebene Header und HTML', async () => {
    const obs = await observeSite(new URL('https://firma.de'), {
      fetchImpl: async () => antwort('<html><body>Hallo</body></html>', {
        headers: { 'Content-Type': 'text/html', 'Strict-Transport-Security': 'max-age=63072000' },
      }),
      now: () => 1_700_000_000_000,
    });

    expect(obs.statusCode).toBe(200);
    expect(obs.html).toContain('Hallo');
    expect(obs.headers['strict-transport-security']).toBe('max-age=63072000');
    expect(obs.headers['content-type']).toBe('text/html');
  });

  it('sendet einen erkennbaren User-Agent', async () => {
    let gesendet: RequestInit | undefined;
    await observeSite(new URL('https://firma.de'), {
      fetchImpl: async (_input, init) => {
        gesendet = init;
        return antwort('<html></html>');
      },
    });

    const headers = gesendet?.headers as Record<string, string>;
    expect(headers['user-agent']).toMatch(/RealSyncDynamics-Scanner/);
  });

  it('meldet ohne Weiterleitung die angefragte Adresse', async () => {
    // `Response.url` wird bewusst nicht ausgewertet: Seit die
    // Weiterleitungen selbst verfolgt werden (redirect: 'manual'), setzt
    // die Laufzeit das Feld nicht mehr. Die gelesene Adresse ergibt sich
    // aus der Sprungkette — der Fall mit Weiterleitung steht weiter unten.
    const obs = await observeSite(new URL('https://firma.de/pfad'), {
      fetchImpl: async () => antwort('<html></html>', { url: 'https://irrefuehrend.example/' }),
    });

    expect(obs.url).toBe('https://firma.de/pfad');
  });

  it('misst die Antwortzeit über die eingesetzte Zeitquelle', async () => {
    let t = 1000;
    const obs = await observeSite(new URL('https://firma.de'), {
      fetchImpl: async () => { t = 1350; return antwort('<html></html>'); },
      now: () => t,
    });

    expect(obs.ttfbMs).toBe(350);
  });
});

describe('Obergrenze für das gelesene Volumen', () => {
  it('bricht einen endlosen Strom bei der Obergrenze ab', async () => {
    // Ohne Abbruch liefe dieser Test nicht durch — er ist der Beweis, dass
    // die Schranke greift, nicht nur ihre Beschreibung.
    let erzeugt = 0;
    const endlos = new ReadableStream<Uint8Array>({
      pull(controller) {
        erzeugt += 1024;
        controller.enqueue(new Uint8Array(1024).fill(65)); // 'A'
      },
    });

    const obs = await observeSite(new URL('https://firma.de'), {
      maxBytes: 8192,
      fetchImpl: async () => {
        const r = new Response(endlos, { headers: { 'content-type': 'text/html' } });
        Object.defineProperty(r, 'url', { value: 'https://firma.de/', configurable: true });
        return r;
      },
    });

    expect(obs.transferBytes).toBe(8192);
    expect(obs.html).toHaveLength(8192);
    // Der Erzeuger darf nicht endlos weitergelaufen sein.
    expect(erzeugt).toBeLessThan(1024 * 1024);
  });

  it('liest eine kurze Antwort vollständig', async () => {
    const obs = await observeSite(new URL('https://firma.de'), {
      maxBytes: 8192,
      fetchImpl: async () => antwort('<html>kurz</html>'),
    });

    expect(obs.html).toBe('<html>kurz</html>');
    expect(obs.transferBytes).toBe(17);
  });

  it('stürzt nicht ab, wenn die Grenze mitten in einem Umlaut liegt', async () => {
    // 'ä' braucht zwei Bytes. Wird bei ungerader Grenze abgeschnitten,
    // entsteht eine unvollständige Folge — die Dekodierung muss das
    // ertragen, statt die ganze Analyse zu beenden.
    const obs = await observeSite(new URL('https://firma.de'), {
      maxBytes: 5,
      fetchImpl: async () => antwort('ääää'),
    });

    expect(obs.transferBytes).toBe(5);
    expect(typeof obs.html).toBe('string');
  });
});

describe('parseSetCookies', () => {
  it('liest gesetzte Cookies mit ihrem Namen', () => {
    const headers = new Headers();
    headers.append('set-cookie', 'sitzung=abc; Path=/; HttpOnly');
    expect(parseSetCookies(headers, 'firma.de')).toEqual([{ name: 'sitzung', host: 'firma.de' }]);
  });

  it('übernimmt den setzenden Host aus dem Domain-Attribut', () => {
    const headers = new Headers();
    headers.append('set-cookie', '_ga=1; Domain=.firma.de; Path=/');
    expect(parseSetCookies(headers, 'www.firma.de')).toEqual([{ name: '_ga', host: 'firma.de' }]);
  });

  it('liefert ohne set-cookie eine leere Liste', () => {
    expect(parseSetCookies(new Headers(), 'firma.de')).toEqual([]);
  });
});

describe('extractThirdPartyHosts', () => {
  it('nennt Fremd-Hosts aus src und href', () => {
    const html = `
      <script src="https://cdn.fremd.example/a.js"></script>
      <link href="https://fonts.googleapis.com/css2">`;
    expect(extractThirdPartyHosts(html, 'firma.de'))
      .toEqual(['cdn.fremd.example', 'fonts.googleapis.com']);
  });

  it('hält eine eigene Subdomain nicht für einen Drittanbieter', () => {
    const html = '<script src="https://cdn.firma.de/a.js"></script>';
    expect(extractThirdPartyHosts(html, 'www.firma.de')).toEqual([]);
  });

  it('nennt jeden Host nur einmal', () => {
    const html = `
      <script src="https://cdn.fremd.example/a.js"></script>
      <script src="https://cdn.fremd.example/b.js"></script>`;
    expect(extractThirdPartyHosts(html, 'firma.de')).toEqual(['cdn.fremd.example']);
  });

  it('übergeht relative Verweise und unlesbare Adressen', () => {
    const html = '<img src="/bild.png"><a href="mailto:info@firma.de">Mail</a>';
    expect(extractThirdPartyHosts(html, 'firma.de')).toEqual([]);
  });
});

describe('registrableDomain', () => {
  it('fasst Subdomains auf die registrierbare Domain zusammen', () => {
    expect(registrableDomain('www.firma.de')).toBe('firma.de');
    expect(registrableDomain('a.b.c.firma.de')).toBe('firma.de');
  });

  it('behandelt zusammengesetzte Endungen wie co.uk richtig', () => {
    expect(registrableDomain('shop.firma.co.uk')).toBe('firma.co.uk');
  });

  it('lässt eine bereits kurze Domain unverändert', () => {
    expect(registrableDomain('firma.de')).toBe('firma.de');
  });
});

describe('Weiterleitungen — die Schranke gilt auf jedem Sprung', () => {
  /** Antwort mit Weiterleitung. */
  function umleitung(nach: string, status = 302): Response {
    return new Response(null, { status, headers: { location: nach } });
  }

  it('folgt einer Weiterleitung auf einen öffentlichen Host', async () => {
    const besucht: string[] = [];
    const obs = await observeSite(new URL('http://firma.de'), {
      fetchImpl: async (input) => {
        besucht.push(input);
        return besucht.length === 1
          ? umleitung('https://www.firma.de/')
          : antwort('<html>ziel</html>', { url: '' });
      },
    });

    expect(besucht).toEqual(['http://firma.de/', 'https://www.firma.de/']);
    expect(obs.html).toContain('ziel');
    // Die Analyse muss die tatsächlich gelesene Adresse sehen, sonst würde
    // eine Seite, die http auf https umleitet, als unverschlüsselt gemeldet.
    expect(obs.url).toBe('https://www.firma.de/');
  });

  it.each([
    ['http://169.254.169.254/latest/meta-data/', 'Cloud-Metadaten'],
    ['http://127.0.0.1:80/', 'Loopback'],
    ['http://10.0.0.5/', 'privates Netz'],
    ['file:///etc/passwd', 'Datei-Schema'],
  ])('weist eine Weiterleitung auf %s zurück (%s)', async (ziel) => {
    // Der eigentliche Angriff: Die Eingangsadresse ist harmlos und kommt
    // durch die Prüfung — erst die Antwort lenkt weiter. Ohne Prüfung je
    // Sprung wäre die gesamte SSRF-Schranke damit umgangen.
    const besucht: string[] = [];
    await expect(
      observeSite(new URL('https://firma.de'), {
        fetchImpl: async (input) => {
          besucht.push(input);
          return besucht.length === 1 ? umleitung(ziel) : antwort('<html>geheim</html>');
        },
      }),
    ).rejects.toThrow(/redirect target refused/);

    // Entscheidend: Das verbotene Ziel wurde nie abgerufen.
    expect(besucht).toEqual(['https://firma.de/']);
  });

  it('folgt auch einer relativen Weiterleitung', async () => {
    const besucht: string[] = [];
    const obs = await observeSite(new URL('https://firma.de/alt'), {
      fetchImpl: async (input) => {
        besucht.push(input);
        return besucht.length === 1 ? umleitung('/neu') : antwort('<html>neu</html>', { url: '' });
      },
    });

    expect(besucht[1]).toBe('https://firma.de/neu');
    expect(obs.html).toContain('neu');
  });

  it('bricht eine Weiterleitungsschleife ab', async () => {
    let aufrufe = 0;
    await expect(
      observeSite(new URL('https://firma.de'), {
        fetchImpl: async () => { aufrufe++; return umleitung('https://firma.de/'); },
      }),
    ).rejects.toThrow(/too many redirects/);

    expect(aufrufe).toBeLessThanOrEqual(MAX_REDIRECTS + 1);
  });

  it('behandelt eine 3xx-Antwort ohne Location als gewöhnliche Antwort', async () => {
    const obs = await observeSite(new URL('https://firma.de'), {
      fetchImpl: async () => new Response('<html>kein ziel</html>', { status: 302 }),
    });
    expect(obs.statusCode).toBe(302);
  });
});
