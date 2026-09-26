// @vitest-environment node
/**
 * governance_evidence content_hash convention (_shared/evidence-hash.ts).
 *
 * Pinned against the owner-approved manual resolve evidence written live on
 * 2026-09-25: governance_evidence 58bca6e1-010f-4a84-807f-41b727c80699
 * (event 33762763-3d6a-4482-b53d-662f15c0c7d9, resolves e712035d). Its
 * metadata.snapshot, canonicalised with RFC 8785 JCS, is SNAPSHOT_JCS below;
 * content_hash = sha256_hex(utf8(JCS(snapshot))) = EXPECTED_HASH.
 */
import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_HASH_METHOD,
  canonicalJson,
  evidenceContentHash,
} from '../../supabase/functions/_shared/evidence-hash';

const EXPECTED_HASH = '9ba200a766edf9a6a0f07a7a055c74c0fdd2d1c7d6d3455283d9e605e1e3c8c8';

// Exact canonical bytes of metadata.snapshot of evidence 58bca6e1 (hash input).
const SNAPSHOT_JCS = "{\"asset_id\":\"1838591e-7e42-46b6-a371-19341e9f922c\",\"checked_at\":\"2026-09-25T21:04:48Z\",\"domain\":\"realsyncdynamicsai.de\",\"event_id\":\"33762763-3d6a-4482-b53d-662f15c0c7d9\",\"evidence_id\":\"58bca6e1-010f-4a84-807f-41b727c80699\",\"previous_hash\":\"a996052b8c481af6514c9a600e9301a36badc3fb3136a22da742a98a76e8c710\",\"records\":{\"apex_txt\":[\"v=spf1 include:_spf.mail.hostinger.com ~all\"],\"dkim\":{\"default\":null,\"google\":null,\"hostingermail-a\":{\"cname\":\"hostingermail-a.dkim.mail.hostinger.com.\",\"txt\":[\"v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs+RijpkYCOFcf5HdHXcwSJJdaqCIf9jyybiM8GFNhzhQMYKXmKGefVdmAIaqcKstjtkCMktZRl6uqrd+gnAsslRoEOtfBbWuqtL/1NRovLakhLngQQChKrJQ1EIgbBBtQyJVN3+m/d6Bzq/xSJKqZjyX2LYwJArwZSpp3JoKp0X7JrzYSXCH312/WSv8htE/cHZ+K7PYJYRmu2CzeNUhh/pJr7liC6nrvWmJCfRAov5g8lAJPR9dKH/EvtCBiMk+sC8fv8395CEmQaOHMj54XCH9fYYHx9qxK4IfsbnvN3jYv+Rel6nSgluaapSwEll0Rl+YBY71bieyV0ZY2lrJ2wIDAQAB\"]},\"hostingermail-b\":{\"cname\":\"hostingermail-b.dkim.mail.hostinger.com.\",\"txt\":[\"v=DKIM1;p=\"]},\"hostingermail-c\":{\"cname\":\"hostingermail-c.dkim.mail.hostinger.com.\",\"txt\":[\"v=DKIM1;p=\"]},\"hostingermail1\":null,\"hostingermail2\":null,\"k1\":null,\"selector1\":null,\"selector2\":null},\"dmarc_txt\":[\"v=DMARC1; p=quarantine; rua=mailto:realsyncdynamics@gmail.com; pct=100; adkim=s; aspf=s\"]},\"resolvers\":[\"dns.google\",\"cloudflare-dns.com\"],\"tenant_id\":\"e6b3c8dd-d91a-42ca-b12f-d77a1bfd59fc\"}";

// Same snapshot with keys in a different order and pretty-printed, as a
// jsonb round-trip may return it.
const SNAPSHOT_REORDERED: Record<string, unknown> = {
  "tenant_id": "e6b3c8dd-d91a-42ca-b12f-d77a1bfd59fc",
  "resolvers": [
    "dns.google",
    "cloudflare-dns.com"
  ],
  "records": {
    "dmarc_txt": [
      "v=DMARC1; p=quarantine; rua=mailto:realsyncdynamics@gmail.com; pct=100; adkim=s; aspf=s"
    ],
    "dkim": {
      "selector2": null,
      "selector1": null,
      "k1": null,
      "hostingermail2": null,
      "hostingermail1": null,
      "hostingermail-c": {
        "txt": [
          "v=DKIM1;p="
        ],
        "cname": "hostingermail-c.dkim.mail.hostinger.com."
      },
      "hostingermail-b": {
        "txt": [
          "v=DKIM1;p="
        ],
        "cname": "hostingermail-b.dkim.mail.hostinger.com."
      },
      "hostingermail-a": {
        "txt": [
          "v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs+RijpkYCOFcf5HdHXcwSJJdaqCIf9jyybiM8GFNhzhQMYKXmKGefVdmAIaqcKstjtkCMktZRl6uqrd+gnAsslRoEOtfBbWuqtL/1NRovLakhLngQQChKrJQ1EIgbBBtQyJVN3+m/d6Bzq/xSJKqZjyX2LYwJArwZSpp3JoKp0X7JrzYSXCH312/WSv8htE/cHZ+K7PYJYRmu2CzeNUhh/pJr7liC6nrvWmJCfRAov5g8lAJPR9dKH/EvtCBiMk+sC8fv8395CEmQaOHMj54XCH9fYYHx9qxK4IfsbnvN3jYv+Rel6nSgluaapSwEll0Rl+YBY71bieyV0ZY2lrJ2wIDAQAB"
        ],
        "cname": "hostingermail-a.dkim.mail.hostinger.com."
      },
      "google": null,
      "default": null
    },
    "apex_txt": [
      "v=spf1 include:_spf.mail.hostinger.com ~all"
    ]
  },
  "previous_hash": "a996052b8c481af6514c9a600e9301a36badc3fb3136a22da742a98a76e8c710",
  "evidence_id": "58bca6e1-010f-4a84-807f-41b727c80699",
  "event_id": "33762763-3d6a-4482-b53d-662f15c0c7d9",
  "domain": "realsyncdynamicsai.de",
  "checked_at": "2026-09-25T21:04:48Z",
  "asset_id": "1838591e-7e42-46b6-a371-19341e9f922c"
};

describe('evidence-hash: RFC 8785 JCS + sha256 over metadata.snapshot', () => {
  it('names the method exactly like the manual row', () => {
    expect(EVIDENCE_HASH_METHOD).toBe('sha256_hex(utf8(RFC8785_JCS(metadata.snapshot)))');
  });

  it('reproduces the canonical input byte-for-byte from a reordered object', () => {
    expect(canonicalJson(SNAPSHOT_REORDERED)).toBe(SNAPSHOT_JCS);
    expect(canonicalJson(JSON.parse(SNAPSHOT_JCS))).toBe(SNAPSHOT_JCS);
  });

  it('reproduces the live content_hash of evidence 58bca6e1', async () => {
    expect(await evidenceContentHash(SNAPSHOT_REORDERED)).toBe(EXPECTED_HASH);
  });

  it('chains: the snapshot carries previous_hash, so changing it changes the hash', async () => {
    const other = { ...SNAPSHOT_REORDERED, previous_hash: '0'.repeat(64) };
    expect(await evidenceContentHash(other)).not.toBe(EXPECTED_HASH);
  });

  it('JCS details: sorted keys, no whitespace, null kept, undefined dropped, escapes', () => {
    expect(canonicalJson({ b: 1, a: [true, null, 'x'], c: undefined })).toBe('{"a":[true,null,"x"],"b":1}');
    expect(canonicalJson({ s: 'ä"\\\n' })).toBe('{"s":"ä\\"\\\\\\n"}');
    expect(canonicalJson({ n: 1.5, z: 0, big: 1e21 })).toBe('{"big":1e+21,"n":1.5,"z":0}');
    expect(() => canonicalJson({ x: Number.NaN })).toThrow();
  });
});
