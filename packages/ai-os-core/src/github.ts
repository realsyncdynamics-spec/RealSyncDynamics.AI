// Minimaler GitHub-REST-Client mit Aufrufbudget und begrenzten Wiederholungen.
// Läuft mit globalem `fetch` in Node ≥ 22 (Routinen) und Deno (Edge Function).
// Kein Token im Browser: Instanzen entstehen nur serverseitig.

export class GithubBudgetExceeded extends Error {
  constructor(limit: number) {
    super(`GitHub-API-Budget von ${limit} Aufrufen erschöpft`);
    this.name = 'GithubBudgetExceeded';
  }
}

export class GithubApiError extends Error {
  status: number;
  constructor(status: number, path: string) {
    super(`GitHub-API ${status} für ${path}`);
    this.name = 'GithubApiError';
    this.status = status;
  }
}

export interface GithubClientOptions {
  token: string;
  /** `owner/repo` */
  repo: string;
  maxCalls: number;
  maxAttempts: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  userAgent?: string;
}

export interface GithubClient {
  readonly repo: string;
  calls(): number;
  get<T>(path: string): Promise<T>;
  send<T>(method: 'POST' | 'PUT' | 'PATCH', path: string, body?: unknown): Promise<T | null>;
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export function createGithubClient(opts: GithubClientOptions): GithubClient {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(opts.repo)) throw new Error('repo muss owner/name sein');
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let used = 0;

  async function request<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    const url = path.startsWith('/repos/') || path.startsWith('/search/')
      ? `https://api.github.com${path}`
      : `https://api.github.com/repos/${opts.repo}${path}`;
    let lastStatus = 0;
    for (let attempt = 1; attempt <= opts.maxAttempts; attempt += 1) {
      if (used >= opts.maxCalls) throw new GithubBudgetExceeded(opts.maxCalls);
      used += 1;
      let res: Response;
      try {
        res = await doFetch(url, {
          method,
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${opts.token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': opts.userAgent ?? 'realsync-ai-os',
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch {
        lastStatus = 0;
        if (attempt < opts.maxAttempts) await sleep(1000 * attempt);
        continue;
      }
      if (res.ok) {
        if (res.status === 204) return null;
        const text = await res.text();
        return text ? (JSON.parse(text) as T) : null;
      }
      lastStatus = res.status;
      const rateLimited = res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0';
      if (!RETRYABLE.has(res.status) || rateLimited || attempt === opts.maxAttempts) break;
      await sleep(1000 * attempt);
    }
    throw new GithubApiError(lastStatus, path.split('?')[0]);
  }

  return {
    repo: opts.repo,
    calls: () => used,
    get: <T>(path: string) => request<T>('GET', path) as Promise<T>,
    send: <T>(method: 'POST' | 'PUT' | 'PATCH', path: string, body?: unknown) => request<T>(method, path, body),
  };
}
