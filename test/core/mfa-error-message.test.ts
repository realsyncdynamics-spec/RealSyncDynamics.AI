import { describe, it, expect } from 'vitest';
import { mfaErrorMessage } from '../../src/core/access/mfa';

// Die rohen Supabase-Fehlertexte sind für Endnutzer nicht handlungsleitend —
// der Mapper muss die bekannten Fälle in konkrete deutsche Hinweise übersetzen.
describe('mfaErrorMessage', () => {
  it('übersetzt einen ungültigen TOTP-Code in einen Hinweis auf frischen Code + Gerätezeit', () => {
    const msg = mfaErrorMessage(new Error('Invalid TOTP code entered'));
    expect(msg).toContain('Code ungültig');
    expect(msg).toContain('Gerätezeit');
  });

  it('übersetzt den friendlyName-Konflikt (verwaistes Enrollment) in eine Neustart-Anleitung', () => {
    const msg = mfaErrorMessage(new Error('A factor with the friendly name "RealSync TOTP" for this user already exists'));
    expect(msg).toContain('angefangenes MFA-Setup');
  });

  it('übersetzt eine abgelaufene Challenge', () => {
    const msg = mfaErrorMessage(new Error('MFA challenge has expired'));
    expect(msg).toContain('abgelaufen');
  });

  it('reicht unbekannte Fehler unverändert durch', () => {
    expect(mfaErrorMessage(new Error('Something else'))).toBe('Something else');
    expect(mfaErrorMessage('plain string')).toBe('plain string');
  });
});
