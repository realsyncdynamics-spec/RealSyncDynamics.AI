import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { acceptInvite } from './api';

export function AcceptInviteView() {
  return <AuthGate>{() => <AcceptInner />}</AuthGate>;
}

function AcceptInner() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refresh, setActiveTenant } = useTenant();
  const [state, setState] = useState<'pending' | 'ok' | 'error'>('pending');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setState('error'); setError('Kein Token in der URL'); return; }
    let cancelled = false;
    (async () => {
      const r = await acceptInvite(token);
      if (cancelled) return;
      if (r.ok && r.tenant_id) {
        await refresh();
        setActiveTenant(r.tenant_id);
        setState('ok');
        setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
      } else {
        setState('error');
        setError(r.error?.message ?? 'Einladung konnte nicht eingelöst werden');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-obsidian-950 p-4">
      <div className="w-full max-w-md bg-obsidian-900 border border-titanium-900 rounded-none shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-none bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
            <Users className="h-5 w-5 text-white" />
          </div>
          <h1 className="font-display text-lg font-bold tracking-tight text-titanium-50">Einladung einlösen</h1>
        </div>
        {state === 'pending' && (
          <div className="flex items-center gap-2 text-sm text-titanium-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Token wird geprüft …
          </div>
        )}
        {state === 'ok' && (
          <div className="flex items-start gap-2 text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900 rounded-none p-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
            <span>Beitritt erfolgreich. Du wirst zum Dashboard weitergeleitet …</span>
          </div>
        )}
        {state === 'error' && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
