/**
 * Microsoft Graph — Token und Abholung (P2-2).
 *
 * WARUM DIESES MODUL EXISTIERT
 * Zwei Functions brauchen denselben Zugriff: `microsoft365-connect` prueft die
 * Verbindung, `microsoft365-audit-sync` holt die Protokolle. Zwei Kopien des
 * OAuth-Ablaufs waeren der Fragmentierungsbefund (§1.4 des Enforcement-Plans)
 * eine Ebene tiefer — sie laufen auseinander, und die Abweichung faellt erst
 * auf, wenn ein Pfad noch funktioniert und der andere nicht mehr.
 *
 * WELCHER OAUTH-ABLAUF UND WARUM
 * Client Credentials (App-only), nicht der Ablauf im Namen eines Nutzers.
 * Ein Pruefprotokoll muss vollstaendig sein und darf nicht davon abhaengen,
 * ob gerade jemand angemeldet ist. Der Preis ist eine Zustimmung des
 * Azure-Administrators (`AuditLog.Read.All`, `Directory.Read.All`) — sie ist
 * die ehrliche Voraussetzung dieser Anbindung und steht in der Oberflaeche.
 *
 * SICHERHEITSRELEVANZ: Das App-Geheimnis wird hier nur benutzt, nie
 * zurueckgegeben oder protokolliert. Fehlermeldungen von Microsoft werden
 * gekuerzt weitergereicht — sie koennen Teile der Anfrage enthalten.
 *
 * DSGVO Art. 32 · EU AI Act Art. 12 (Aufzeichnung).
 */

/** Nur diese Hosts werden angesprochen. */
const LOGIN_HOST = 'https://login.microsoftonline.com';
const GRAPH_HOST = 'https://graph.microsoft.com';

/**
 * Der Hostname von Graph — die Prüfgröße, nicht das Präfix.
 *
 * Warum getrennt von `GRAPH_HOST`: Ein Vergleich auf das Präfix
 * (`url.startsWith(GRAPH_HOST)`) ist unvollständig, weil ein Angreifer den
 * erlaubten Text vorne anhängen kann und die Zeichenkette trotzdem passt —
 * `https://graph.microsoft.com.example.invalid/…` beginnt mit dem Präfix,
 * zeigt aber auf eine fremde Domain, und `https://graph.microsoft.com@example.invalid/`
 * schiebt den erlaubten Teil in den Benutzer-Anteil der URL. Beides hätte
 * das Bearer-Token an einen fremden Host geschickt (CodeQL:
 * „Incomplete URL substring sanitization", hoch).
 */
const GRAPH_HOSTNAME = 'graph.microsoft.com';

/**
 * Ist das eine echte Graph-URL?
 *
 * Geprüft wird am geparsten `hostname` und am Protokoll, nie an der
 * Zeichenkette. `URL` normalisiert dabei Benutzer-Anteil, Port und
 * Groß-/Kleinschreibung — genau die Stellen, an denen ein Präfixvergleich
 * danebengreift. Eine unparsbare Eingabe gilt als nicht erlaubt.
 */
export function isGraphUrl(candidate: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return false;
  }
  // Ein Port wäre bei Graph nie gesetzt; ein gesetzter deutet auf eine
  // nachgebaute URL hin. `username`/`password` müssen leer sein, sonst
  // steht der erlaubte Name nur im Benutzer-Anteil.
  return parsed.protocol === 'https:'
    && parsed.hostname === GRAPH_HOSTNAME
    && parsed.port === ''
    && parsed.username === ''
    && parsed.password === '';
}

export interface GraphCredentials {
  azure_tenant_id: string;
  client_id: string;
  client_secret: string;
}

export interface GraphToken {
  access_token: string;
  expires_at: number;
}

/**
 * Holt ein App-only-Token.
 *
 * Wirft mit einer kurzen, nicht vertraulichen Meldung. Der Rohtext von
 * Microsoft kann die gesendeten Parameter zurueckspiegeln und gehoert deshalb
 * nicht ungefiltert in ein Protokoll.
 */
export async function fetchGraphToken(creds: GraphCredentials): Promise<GraphToken> {
  const body = new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    scope: `${GRAPH_HOST}/.default`,
    grant_type: 'client_credentials',
  });

  const res = await fetch(
    `${LOGIN_HOST}/${encodeURIComponent(creds.azure_tenant_id)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  );

  if (!res.ok) {
    // Nur den Fehlercode uebernehmen, nicht die Beschreibung: Letztere
    // enthaelt bei Microsoft regelmaessig die uebermittelten Werte.
    let code = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (typeof j?.error === 'string') code = j.error;
    } catch { /* Antwort war kein JSON — der Status genuegt */ }
    throw new Error(`Token nicht erhalten (${code})`);
  }

  const json = await res.json();
  const token = json?.access_token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Token nicht erhalten (leere Antwort)');
  }
  const expiresIn = Number(json?.expires_in ?? 3600);
  return {
    access_token: token,
    // 60 s Sicherheitsabstand: Ein Token, das waehrend einer Seitenfolge
    // ablaeuft, bricht den Lauf mitten in der Abholung ab.
    expires_at: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  };
}

/** Ein Graph-GET mit Bearer-Token. */
export async function graphGet(
  token: string,
  urlOrPath: string,
): Promise<Record<string, unknown>> {
  const url = urlOrPath.startsWith('http') ? urlOrPath : `${GRAPH_HOST}/v1.0${urlOrPath}`;
  if (!isGraphUrl(url)) {
    // Die `@odata.nextLink` kommt von Microsoft, wird aber wie jede fremde
    // Angabe behandelt: Sie darf nur auf Graph zeigen. Sonst waere die
    // Paginierung ein Weg, das Token an einen fremden Host zu schicken.
    //
    // Geprueft wird am geparsten Hostnamen, nicht am Praefix — siehe
    // `isGraphUrl`. Der Host darf nicht in der Fehlermeldung stehen: Sie
    // landet im Pruefpfad, und eine untergeschobene URL gehoert dort nicht
    // ungefiltert hinein.
    throw new Error('Unerwartete Folge-URL ausserhalb von Microsoft Graph');
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  if (!res.ok) {
    let code = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (typeof j?.error?.code === 'string') code = j.error.code;
    } catch { /* Status genuegt */ }
    throw new Error(`Graph-Abruf fehlgeschlagen (${code})`);
  }
  return await res.json() as Record<string, unknown>;
}

/**
 * Holt eine begrenzte Zahl Seiten. Die Grenze ist Absicht: Ein Lauf, der einem
 * Mandanten mit Jahren an Protokoll folgt, laeuft in das Zeitlimit der Edge
 * Function und hinterlaesst einen halb fortgeschriebenen Zeiger. Lieber
 * mehrere kurze Laeufe mit sauberem Zeiger als ein langer ohne.
 */
export async function graphCollect(
  token: string,
  firstPath: string,
  maxPages = 5,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let next: string | null = firstPath;
  for (let page = 0; page < maxPages && next; page++) {
    const json: Record<string, unknown> = await graphGet(token, next);
    const value = json.value;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v && typeof v === 'object') out.push(v as Record<string, unknown>);
      }
    }
    const link = json['@odata.nextLink'];
    next = typeof link === 'string' ? link : null;
  }
  return out;
}

/**
 * Die Hauptdomaene des Azure-Mandanten.
 *
 * WARUM GELESEN UND NICHT EINGEGEBEN: An ihr haengt die Unterscheidung
 * „intern / extern". Duerfte der Kunde sie eintippen, koennte er jeden
 * Externen zum Internen erklaeren und damit die Regeln aushebeln, die genau
 * auf dieser Unterscheidung beruhen.
 */
export async function fetchPrimaryDomain(token: string): Promise<string | null> {
  const json = await graphGet(token, '/domains?$select=id,isDefault');
  const value = json.value;
  if (!Array.isArray(value)) return null;
  for (const d of value) {
    if (d && typeof d === 'object' && (d as Record<string, unknown>).isDefault === true) {
      const id = (d as Record<string, unknown>).id;
      if (typeof id === 'string') return id.toLowerCase();
    }
  }
  return null;
}
