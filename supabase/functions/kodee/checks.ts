// DNS and TLS checks — pure network probes, no SSH required.

import type {
  DnsCheckArgs, DnsCheckData,
  TlsCheckArgs, TlsCheckData,
  VpsConnectionRow,
} from './types.ts';

const TLS_TIMEOUT_MS = 10_000;

export async function dnsCheck(
  args: DnsCheckArgs,
  conn: VpsConnectionRow,
): Promise<DnsCheckData> {
  if (!args.domain) throw new Error('domain is required');
  const types = (args.types && args.types.length ? args.types : ['A', 'AAAA']) as Array<
    Parameters<typeof Deno.resolveDns>[1]
  >;

  const records: Record<string, string[]> = {};
  for (const t of types) {
    try {
      const res = await Deno.resolveDns(args.domain, t);
      records[t as string] = normalizeDns(t as string, res);
    } catch (e) {
      records[t as string] = [`error: ${(e as Error).message}`];
    }
  }

  // Resolve VPS host to compare A/AAAA against
  let matches: boolean | null = null;
  try {
    const aA = records['A'] ?? (await Deno.resolveDns(conn.host, 'A').catch(() => []));
    const aAAAA = records['AAAA'] ?? (await Deno.resolveDns(conn.host, 'AAAA').catch(() => []));
    const vpsA = await Deno.resolveDns(conn.host, 'A').catch(() => []);
    const vpsAAAA = await Deno.resolveDns(conn.host, 'AAAA').catch(() => []);
    const haveAny = (aA.length || aAAAA.length) && (vpsA.length || vpsAAAA.length);
    if (haveAny) {
      matches =
        aA.some((ip) => vpsA.includes(ip)) ||
        aAAAA.some((ip) => vpsAAAA.includes(ip));
    }
  } catch { matches = null; }

  return {
    domain: args.domain,
    records,
    matches_vps: matches,
    vps_host: conn.host,
  };
}

function normalizeDns(type: string, res: unknown): string[] {
  if (Array.isArray(res)) {
    if (type === 'MX') {
      return (res as { preference: number; exchange: string }[]).map(
        (r) => `${r.preference} ${r.exchange}`,
      );
    }
    if (type === 'TXT') {
      return (res as string[][]).map((parts) => parts.join(''));
    }
    return res as string[];
  }
  return [];
}

export async function tlsCheck(
  args: TlsCheckArgs,
  conn: VpsConnectionRow,
): Promise<TlsCheckData> {
  const domain = args.domain ?? conn.host;
  const port = args.port ?? 443;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TLS_TIMEOUT_MS);

  try {
    const tlsConn = await Deno.connectTls({
      hostname: domain,
      port,
      // SNI defaults to hostname; that's what we want.
    });
    clearTimeout(timer);

    // Deno exposes peer certificates as parsed structures.
    // deno-lint-ignore no-explicit-any
    const certs: any = (tlsConn as any).handshake
      ? await (tlsConn as any).handshake().then(() => (tlsConn as any).getPeerCertificates?.())
      : (tlsConn as any).getPeerCertificates?.();

    tlsConn.close();

    if (!certs || !certs.length) {
      return {
        domain, port,
        issuer: null, subject: null,
        valid_from: null, valid_to: null,
        days_remaining: null, san: [],
        matches_domain: false,
      };
    }

    const leaf = certs[0];
    const validTo = leaf.validTo ? new Date(leaf.validTo) : null;
    const validFrom = leaf.validFrom ? new Date(leaf.validFrom) : null;
    const daysRemaining = validTo
      ? Math.floor((validTo.getTime() - Date.now()) / 86_400_000)
      : null;
    const san: string[] = leaf.subjectAltNames ?? [];
    const matches = san.some((n) => n === domain || (n.startsWith('*.') && domain.endsWith(n.slice(1))));

    return {
      domain, port,
      issuer: leaf.issuer ?? null,
      subject: leaf.subject ?? null,
      valid_from: validFrom?.toISOString() ?? null,
      valid_to: validTo?.toISOString() ?? null,
      days_remaining: daysRemaining,
      san,
      matches_domain: matches,
    };
  } finally {
    clearTimeout(timer);
  }
}
