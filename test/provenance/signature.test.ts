import { describe, it, expect } from 'vitest';
import {
  generateEd25519KeyPair, signEd25519, verifyEd25519,
  exportPublicKeySpkiB64, importEd25519PublicKeySpki,
  bytesToHex, hexToBytes, bytesToB64, b64ToBytes,
} from '../../src/lib/provenance/signature';

const EVENT_HASH = 'a'.repeat(64);

describe('Ed25519 sign/verify', () => {
  it('verifiziert eine gültige Signatur', async () => {
    const kp = await generateEd25519KeyPair();
    const sig = await signEd25519(kp.privateKey, EVENT_HASH);
    expect(await verifyEd25519(kp.publicKey, EVENT_HASH, sig)).toBe(true);
  });

  it('lehnt eine Signatur über eine andere Nachricht ab', async () => {
    const kp = await generateEd25519KeyPair();
    const sig = await signEd25519(kp.privateKey, EVENT_HASH);
    expect(await verifyEd25519(kp.publicKey, 'b'.repeat(64), sig)).toBe(false);
  });

  it('lehnt eine Signatur eines fremden Schlüssels ab', async () => {
    const a = await generateEd25519KeyPair();
    const b = await generateEd25519KeyPair();
    const sig = await signEd25519(a.privateKey, EVENT_HASH);
    expect(await verifyEd25519(b.publicKey, EVENT_HASH, sig)).toBe(false);
  });

  it('lehnt eine verfälschte Signatur robust ab (kein Throw)', async () => {
    const kp = await generateEd25519KeyPair();
    expect(await verifyEd25519(kp.publicKey, EVENT_HASH, 'nothex!!')).toBe(false);
    expect(await verifyEd25519(kp.publicKey, EVENT_HASH, 'ff'.repeat(64))).toBe(false);
  });

  it('prüft über den EXPORTIERTEN öffentlichen Schlüssel (externe Verifizierung)', async () => {
    const kp = await generateEd25519KeyPair();
    const sig = await signEd25519(kp.privateKey, EVENT_HASH);
    const spkiB64 = await exportPublicKeySpkiB64(kp.publicKey);
    const imported = await importEd25519PublicKeySpki(spkiB64);
    expect(await verifyEd25519(imported, EVENT_HASH, sig)).toBe(true);
  });
});

describe('Kodierungs-Helfer', () => {
  it('hex round-trip', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
    expect(bytesToHex(bytes)).toBe('00010f10ff');
  });
  it('base64 round-trip', () => {
    const bytes = new Uint8Array([0, 42, 200, 255]);
    expect(b64ToBytes(bytesToB64(bytes))).toEqual(bytes);
  });
  it('hexToBytes normalisiert 0x-Präfix und Großschreibung', () => {
    expect(bytesToHex(hexToBytes('0xABCD'))).toBe('abcd');
  });
});
