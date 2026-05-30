// /settings/security — MFA-Self-Service (ADR 0006). TOTP einrichten/entfernen,
// Recovery-Codes erzeugen, Lockout-Escape, sowie (owner/admin) MFA-Erzwingung
// pro Tenant. Self-Service, EU-souverän, kein Kontaktpfad.
import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, Copy, Check, AlertTriangle } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';
import {
  getMfaStatus, enrollTotp, verifyTotp, unenroll,
  regenerateRecoveryCodes, redeemRecoveryCode, logAal2Intent,
  type MfaStatus, type EnrollResult,
} from '../../core/access/mfa';

export function SecuritySettings() {
  const { activeTenantId, tenants } = useTenant();
  const activeTenant = tenants.find((t) => t.tenantId === activeTenantId) ?? null;
  const role = activeTenant?.role ?? null;
  const isPublicSector = activeTenant?.isPublicSector ?? false;
  const isAdmin = role === 'owner' || role === 'admin';

  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [enroll, setEnroll] = useState<EnrollResult | null>(null);
  const [otp, setOtp] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const [redeemMode, setRedeemMode] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');

  const [enforceAll, setEnforceAll] = useState(false);

  async function refresh() {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    setUserId(user?.id ?? null);
    setStatus(await getMfaStatus());
    if (activeTenantId) {
      const { data } = await sb.from('tenant_security_settings')
        .select('enforce_mfa_all').eq('tenant_id', activeTenantId).maybeSingle();
      setEnforceAll(!!data?.enforce_mfa_all);
    }
  }
  useEffect(() => { refresh().catch((e) => setError(String(e))); /* eslint-disable-next-line */ }, [activeTenantId]);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error)?.message ?? String(e)); } finally { setBusy(false); }
  }

  const startEnroll = () => run(async () => { setEnroll(await enrollTotp()); });
  const confirmEnroll = () => run(async () => {
    if (!enroll) return;
    await verifyTotp(enroll.factorId, otp.trim());
    setEnroll(null); setOtp('');
    await refresh();
  });
  const removeFactor = () => run(async () => {
    const sb = getSupabase();
    const { data } = await sb.auth.mfa.listFactors();
    for (const f of data?.totp ?? []) await unenroll(f.id);
    await refresh();
  });
  const genRecovery = () => run(async () => {
    if (!userId) return;
    setRecoveryCodes(await regenerateRecoveryCodes(userId, activeTenantId));
  });
  const doRedeem = () => run(async () => {
    await redeemRecoveryCode(redeemCode);
    setRedeemMode(false); setRedeemCode('');
    await refresh();
  });
  const toggleEnforceAll = (next: boolean) => run(async () => {
    await logAal2Intent('tenant.security_settings.update');
    if (!activeTenantId) return;
    const sb = getSupabase();
    const { error: e } = await sb.from('tenant_security_settings')
      .upsert({ tenant_id: activeTenantId, enforce_mfa_all: next }, { onConflict: 'tenant_id' });
    if (e) throw e;
    setEnforceAll(next);
  });

  const copyCodes = () => {
    if (!recoveryCodes) return;
    navigator.clipboard?.writeText(recoveryCodes.join('\n'));
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 px-4 sm:px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <header>
          <h1 className="font-display font-bold text-2xl tracking-tight text-titanium-50">Sicherheit &amp; MFA</h1>
          <p className="text-sm text-titanium-400 mt-1">
            Zwei-Faktor-Authentifizierung (TOTP) für Ihr Konto. Pflicht für owner, admin und dpo
            {isPublicSector ? ' — im Public-Sector-Modus für alle Rollen.' : '.'}
          </p>
        </header>

        {error && (
          <div className="border border-rose-500/40 bg-rose-500/10 text-rose-200 text-sm p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* Status */}
        <section className="border border-titanium-800 bg-obsidian-900 p-5">
          <div className="flex items-center gap-3">
            {status?.hasVerifiedTotp
              ? <ShieldCheck className="h-6 w-6 text-emerald-400" />
              : <ShieldAlert className="h-6 w-6 text-amber-400" />}
            <div>
              <div className="font-display font-semibold text-titanium-50">
                {status?.hasVerifiedTotp ? 'MFA aktiv' : 'MFA nicht eingerichtet'}
              </div>
              <div className="font-mono text-[11px] text-titanium-500">
                AAL: {status?.currentLevel ?? '—'} · Faktoren: {status?.factorCount ?? 0}
              </div>
            </div>
          </div>
        </section>

        {/* Enrollment */}
        {!status?.hasVerifiedTotp && !enroll && (
          <button onClick={startEnroll} disabled={busy}
            className="inline-flex items-center gap-2 bg-cyan-400 text-obsidian-950 px-5 py-3 text-sm font-semibold hover:bg-cyan-300 disabled:opacity-40">
            <KeyRound className="h-4 w-4" /> MFA einrichten
          </button>
        )}

        {enroll && (
          <section className="border border-titanium-800 bg-obsidian-900 p-5 space-y-4">
            <p className="text-sm text-titanium-300">Scannen Sie den QR-Code mit Ihrer Authenticator-App und geben Sie den 6-stelligen Code ein.</p>
            {/* qr_code ist ein SVG-Data-URI */}
            <img src={enroll.qrCode} alt="TOTP QR-Code" className="bg-white p-2 w-44 h-44" />
            <div className="font-mono text-[11px] text-titanium-500 break-all">Secret: {enroll.secret}</div>
            <div className="flex gap-2">
              <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" placeholder="123456"
                className="bg-obsidian-950 border border-titanium-700 px-3 py-2 text-sm font-mono w-32 outline-none focus:border-cyan-400" />
              <button onClick={confirmEnroll} disabled={busy || otp.trim().length < 6}
                className="bg-cyan-400 text-obsidian-950 px-4 py-2 text-sm font-semibold hover:bg-cyan-300 disabled:opacity-40">
                Bestätigen
              </button>
              <button onClick={() => { setEnroll(null); setOtp(''); }} className="text-titanium-400 text-sm px-3">Abbrechen</button>
            </div>
          </section>
        )}

        {/* Recovery + Remove (wenn aktiv) */}
        {status?.hasVerifiedTotp && (
          <section className="border border-titanium-800 bg-obsidian-900 p-5 space-y-4">
            <h2 className="font-display font-semibold text-titanium-50">Recovery-Codes</h2>
            <p className="text-sm text-titanium-400">
              Bewahren Sie Recovery-Codes sicher auf — sie sind Ihr Zugang, falls das Gerät verloren geht.
              Jeder Code ist einmalig.
            </p>
            {recoveryCodes ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-obsidian-950 border border-titanium-800 p-3">
                  {recoveryCodes.map((c) => <span key={c} className="text-titanium-100">{c}</span>)}
                </div>
                <button onClick={copyCodes} className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Kopiert' : 'Kopieren'}
                </button>
                <p className="text-[11px] text-amber-300">Diese Codes werden nur jetzt angezeigt. Danach nicht mehr abrufbar.</p>
              </div>
            ) : (
              <button onClick={genRecovery} disabled={busy}
                className="border border-titanium-700 text-titanium-100 px-4 py-2 text-sm font-semibold hover:border-titanium-500 disabled:opacity-40">
                Recovery-Codes erzeugen
              </button>
            )}
            <div className="pt-2 border-t border-titanium-900">
              <button onClick={removeFactor} disabled={busy} className="text-rose-300 hover:text-rose-200 text-sm">
                MFA entfernen
              </button>
            </div>
          </section>
        )}

        {/* Lockout-Escape */}
        {!status?.hasVerifiedTotp && (
          <section className="border border-titanium-900 bg-obsidian-900 p-5">
            {redeemMode ? (
              <div className="space-y-3">
                <p className="text-sm text-titanium-300">Recovery-Code einlösen (entfernt das alte MFA-Gerät):</p>
                <div className="flex gap-2">
                  <input value={redeemCode} onChange={(e) => setRedeemCode(e.target.value)} placeholder="XXXX-XXXX-XXXX"
                    className="bg-obsidian-950 border border-titanium-700 px-3 py-2 text-sm font-mono w-44 outline-none focus:border-cyan-400" />
                  <button onClick={doRedeem} disabled={busy || redeemCode.trim().length < 8}
                    className="bg-cyan-400 text-obsidian-950 px-4 py-2 text-sm font-semibold hover:bg-cyan-300 disabled:opacity-40">Einlösen</button>
                  <button onClick={() => setRedeemMode(false)} className="text-titanium-400 text-sm px-3">Abbrechen</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setRedeemMode(true)} className="text-titanium-400 hover:text-titanium-200 text-sm">
                Gerät verloren? Recovery-Code einlösen
              </button>
            )}
          </section>
        )}

        {/* Tenant-Enforcement (owner/admin) */}
        {isAdmin && (
          <section className="border border-titanium-800 bg-obsidian-900 p-5">
            <h2 className="font-display font-semibold text-titanium-50 mb-2">Tenant-Sicherheit</h2>
            <label className="flex items-center gap-3 text-sm text-titanium-200">
              <input type="checkbox" checked={enforceAll || isPublicSector} disabled={busy || isPublicSector}
                onChange={(e) => toggleEnforceAll(e.target.checked)} />
              MFA für <strong>alle</strong> Mitglieder erzwingen
              {isPublicSector && <span className="font-mono text-[10px] text-security-400">· durch Public-Sector-Modus vorgegeben</span>}
            </label>
            <p className="text-[11px] text-titanium-500 mt-2">
              owner, admin und dpo benötigen MFA unabhängig von dieser Einstellung.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
