/**
 * Erzeugt ein Ed25519-Schlüsselpaar für die Provenance-Signatur (Phase 2a).
 *
 *   node scripts/gen-provenance-keypair.mjs
 *
 * Ausgabe: die drei Werte für die Edge-Function-Env (Supabase Secrets):
 *   PROVENANCE_ED25519_PRIVATE_KEY  (PKCS8, base64)  — GEHEIM
 *   PROVENANCE_ED25519_PUBLIC_KEY   (SPKI,  base64)  — öffentlich (Verify-Seite)
 *   PROVENANCE_ED25519_KEY_ID       (frei, z.B. rsd-ed25519-1)
 *
 * Der private Schlüssel gehört ausschließlich in Supabase Secrets, niemals ins
 * Repo. Der öffentliche Schlüssel darf frei verteilt werden.
 */
const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64');
const priv = b64(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
const pub = b64(await crypto.subtle.exportKey('spki', kp.publicKey));

console.log('# Supabase Secrets für die provenance Edge-Function:');
console.log(`PROVENANCE_ED25519_PRIVATE_KEY=${priv}`);
console.log(`PROVENANCE_ED25519_PUBLIC_KEY=${pub}`);
console.log('PROVENANCE_ED25519_KEY_ID=rsd-ed25519-1');
console.log('\n# Setzen mit: supabase secrets set --env-file <(node scripts/gen-provenance-keypair.mjs | grep PROVENANCE_)');
