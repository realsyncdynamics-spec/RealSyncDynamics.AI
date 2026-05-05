// Decrypt SSH private keys stored in vps_ssh_keys.encrypted_private_key.
//
// Storage format (JSON, base64 fields):
//   { alg: "AES-GCM", iv: "<base64>", ct: "<base64>", aad?: "<base64>" }
//
// The wrapping key comes from the env var KODEE_SECRETS_KEY — a 32-byte
// base64-encoded key. Generate with:
//   openssl rand -base64 32
// and set as a Supabase Function secret:
//   supabase secrets set KODEE_SECRETS_KEY=<value>
//
// Rationale for AES-GCM with an env-held wrapping key (rather than Supabase Vault):
// works out of the box, no extra extension required, easy to rotate by re-encrypting
// rows with a new key version. We can swap to Vault later without API changes.

interface Envelope {
  alg: 'AES-GCM';
  iv: string;
  ct: string;
  aad?: string;
}

let cachedKey: CryptoKey | null = null;

async function loadWrappingKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = Deno.env.get('KODEE_SECRETS_KEY');
  if (!raw) throw new Error('KODEE_SECRETS_KEY env var not set');
  const keyBytes = b64decode(raw);
  if (keyBytes.length !== 32) throw new Error('KODEE_SECRETS_KEY must be 32 bytes (base64)');
  cachedKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'],
  );
  return cachedKey;
}

export async function decryptPrivateKey(stored: string | Uint8Array): Promise<string> {
  const text = typeof stored === 'string' ? stored : new TextDecoder().decode(stored);
  let env: Envelope;
  try {
    env = JSON.parse(text);
  } catch {
    throw new Error('encrypted_private_key is not valid envelope JSON');
  }
  if (env.alg !== 'AES-GCM') throw new Error(`unsupported alg: ${env.alg}`);

  const key = await loadWrappingKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(env.iv), additionalData: env.aad ? b64decode(env.aad) : undefined },
    key,
    b64decode(env.ct),
  );
  return new TextDecoder().decode(plaintext);
}

export async function encryptPrivateKey(plaintext: string, aad?: string): Promise<string> {
  const key = await loadWrappingKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad ? new TextEncoder().encode(aad) : undefined },
    key,
    new TextEncoder().encode(plaintext),
  );
  const env: Envelope = {
    alg: 'AES-GCM',
    iv: b64encode(iv),
    ct: b64encode(new Uint8Array(ct)),
    aad: aad ? b64encode(new TextEncoder().encode(aad)) : undefined,
  };
  return JSON.stringify(env);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64encode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
