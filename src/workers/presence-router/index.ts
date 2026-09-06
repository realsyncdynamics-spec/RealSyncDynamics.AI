/**
 * Presence Tenant-Router — Skelett (Scope 1, Aufgabe 3)
 *
 * ZWECK
 *
 * Ein Cloudflare Worker, der `{slug}.realsync.app` und Custom Domains auf
 * einen Mandanten auflöst und dessen Template-Konfiguration lädt.
 *
 * **Ein Deployment für alle Mandanten.** Kein Worker je Kunde: Der Mandant
 * steckt im Hostnamen der Anfrage, nicht in der Bereitstellung. Ein Deployment
 * je Kunde wäre bei hundert Handwerksbetrieben hundert Deployments, die
 * einzeln altern — und der Grund, aus dem solche Plattformen unwartbar werden.
 *
 * **Supabase bleibt System of Record.** Der Worker hält keinen eigenen
 * Zustand; er fragt und liefert weiter.
 *
 * WAS DIESER SCOPE AUSDRÜCKLICH NICHT TUT
 *
 * Kein Rendering. Der Router gibt die aufgelöste Konfiguration als JSON
 * zurück — das ist ein Skelett und gibt sich auch als solches aus, statt
 * eine halbe Seite auszuliefern und Vollständigkeit zu behaupten.
 *
 * SICHERHEIT — warum hier der anon-Schlüssel steht und stehen darf
 *
 * Der Service-Role-Schlüssel gehört laut CLAUDE.md §3 ausschliesslich in Edge
 * Functions, nie in einen Worker. Der Router kommt ohne ihn aus: Er ruft die
 * SECURITY-DEFINER-Funktion `presence_resolve_host()` auf, die nur
 * veröffentlichte Sites kennt und weder Bereitstellungskennungen noch
 * personenbezogene Inhaberdaten herausgibt. Ein Leserecht auf
 * `presence_sites` hat `anon` **nicht** — der öffentliche Schlüssel öffnet
 * hier also genau eine Auskunft und nicht die Tabelle.
 *
 * Beide Werte kommen aus Umgebungsvariablen. Nichts davon gehört ins Repo.
 */

/** Umgebung des Workers. Ausschliesslich über `wrangler secret put` / Vars gesetzt. */
export interface PresenceRouterEnv {
  /** z. B. https://<projekt>.supabase.co — keine Anmeldedaten, nur die Adresse. */
  SUPABASE_URL: string;
  /**
   * Der öffentliche anon-Schlüssel. Per Definition öffentlich (CLAUDE.md §2);
   * seine Wirkung wird nicht durch Geheimhaltung begrenzt, sondern durch RLS
   * und dadurch, dass `anon` nur `presence_resolve_host` ausführen darf.
   */
  SUPABASE_ANON_KEY: string;
}

/** Was die Auflösung über eine Site hergibt. Spiegelt `presence_resolve_host()`. */
export interface ResolvedSite {
  tenant_id: string;
  site_id: string;
  slug: string;
  template_id: string;
  status: string;
  published_at: string | null;
  ai_system_id: string | null;
  business: {
    business_name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo_url: string | null;
    services: unknown;
    opening_hours: unknown;
  } | null;
}

/**
 * Normalisiert einen Host-Header auf die Form, die die Datenbank vergleicht.
 *
 * Ein Host-Header darf Grossbuchstaben, einen Port und einen abschliessenden
 * Punkt tragen (`Beispiel.REALSYNC.app:443.`). Ohne diese Normalisierung
 * löste dieselbe Site je nach Aufrufer mal auf und mal nicht — ein Fehler,
 * der sich als „geht bei mir" tarnt.
 *
 * Dieselbe Normalisierung steht in `presence_resolve_host()`. Sie hier
 * ebenfalls zu machen ist kein Duplikat, sondern der Grund, aus dem die
 * Fehlersuche am Worker möglich ist, ohne die Datenbank zu befragen.
 */
export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  let h = host.trim().toLowerCase();
  const colon = h.indexOf(':');
  if (colon >= 0) h = h.slice(0, colon);
  while (h.endsWith('.')) h = h.slice(0, -1);
  return h.length > 0 ? h : null;
}

/**
 * Fragt Supabase nach dem Mandanten hinter einem Hostnamen.
 *
 * Gibt `null` zurück, wenn nichts passt — das ist kein Fehler, sondern die
 * normale Antwort für einen unbekannten oder unveröffentlichten Host.
 * Wirft nur, wenn die Auskunft selbst nicht erreichbar ist; der Aufrufer
 * unterscheidet damit „kenne ich nicht" (404) von „kann gerade nicht
 * antworten" (502). Beides in einen Topf zu werfen hiesse, einen Ausfall
 * der Datenbank als „Seite gibt es nicht" auszuliefern.
 */
export async function resolveHost(
  host: string,
  env: PresenceRouterEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<ResolvedSite | null> {
  const res = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/rpc/presence_resolve_host`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_host: host }),
  });

  if (!res.ok) {
    throw new Error(`presence_resolve_host antwortete mit ${res.status}`);
  }

  const data = (await res.json()) as ResolvedSite | null;
  return data ?? null;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Der Router liefert je Host etwas anderes. Ohne Vary würde ein Cache
      // die Seite des einen Mandanten unter dem Hostnamen des nächsten
      // ausliefern — der schwerwiegendste Fehler, den ein Multi-Tenant-Router
      // machen kann.
      vary: 'Host',
      'cache-control': 'no-store',
    },
  });
}

export default {
  async fetch(request: Request, env: PresenceRouterEnv): Promise<Response> {
    const url = new URL(request.url);

    // Betriebsprüfung ohne Datenbankzugriff — beantwortet „läuft der Worker?",
    // nicht „ist die Auflösung gesund?". Die beiden Fragen zu vermischen wäre
    // ein Health-Check, der grün bleibt, während nichts mehr auflöst.
    if (url.pathname === '/__health') {
      return json({ ok: true, worker: 'presence-router' }, 200);
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      // Fehlkonfiguration laut melden statt still 404 zu liefern: Sonst
      // sieht ein fehlender Umgebungswert genauso aus wie ein unbekannter Host.
      return json({ error: 'router_misconfigured' }, 500);
    }

    const host = normalizeHost(request.headers.get('host'));
    if (!host) {
      return json({ error: 'no_host' }, 400);
    }

    let site: ResolvedSite | null;
    try {
      site = await resolveHost(host, env);
    } catch {
      return json({ error: 'resolution_unavailable', host }, 502);
    }

    if (!site) {
      return json({ error: 'unknown_host', host }, 404);
    }

    // Skelett-Antwort. Das Ausliefern der Seite folgt in Scope 2 — bis dahin
    // gibt der Router zurück, was er weiss, und behauptet nichts darüber
    // hinaus.
    return json({ resolved: true, host, site }, 200);
  },
};
