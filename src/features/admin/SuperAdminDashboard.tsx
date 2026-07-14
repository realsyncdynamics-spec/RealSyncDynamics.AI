import React, { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp, Users, CreditCard, Zap, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthGate } from '../kodee/connections/AuthGate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { SovereignButton } from '../../components/ui/SovereignButton';
import { getSupabase } from '../../lib/supabase';
import type { Session } from '@supabase/supabase-js';

interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  mrrEur: number;
  trialingCount: number;
  systemHealth: 'healthy' | 'degraded' | 'down';
}

export function SuperAdminDashboard() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }: { session: Session }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    (async () => {
      const { data: prof } = await sb.from('profiles')
        .select('is_super_admin').eq('id', session.user.id).maybeSingle();
      const isAdmin = !!prof?.is_super_admin;
      setAllowed(isAdmin);
      if (isAdmin) await load();
      else setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const sb = getSupabase();
      const { data, error: err } = await sb.rpc('admin_customers_list');
      if (err) throw err;

      const customers = (data ?? []) as any[];
      const activeCount = customers.filter((c) => c.status === 'active').length;
      const trialingCount = customers.filter((c) => c.status === 'trialing').length;

      const mrr = customers.filter((c) => c.status === 'active').reduce((sum, c) => {
        const price = c.plan_key === 'bronze' ? 29 : c.plan_key === 'silver' ? 99 : c.plan_key === 'gold' ? 299 : 0;
        return sum + price;
      }, 0);

      const totalUsers = customers.reduce((sum, c) => sum + (c.member_count || 1), 0);

      setMetrics({
        totalTenants: customers.length,
        activeTenants: activeCount,
        totalUsers,
        mrrEur: mrr,
        trialingCount,
        systemHealth: 'healthy',
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (allowed === false) {
    return (
      <div className="min-h-screen bg-obsidian text-titanium flex items-center justify-center px-4">
        <Card variant="default" className="max-w-md border-rose-900/50 bg-rose-950/20">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-10 w-10 text-rose-400 mx-auto mb-3" />
            <h1 className="font-display font-bold text-lg text-titanium-50 mb-2">Zugriff verweigert</h1>
            <p className="text-sm text-titanium-400 mb-4">Diese Seite erfordert Super-Admin-Rechte.</p>
            <Link to="/">
              <SovereignButton variant="secondary" size="sm" isFullWidth>
                Zur Startseite
              </SovereignButton>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian text-titanium p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-3xl text-titanium-50 mb-2">Platform Admin</h1>
            <p className="text-titanium-400">RealSyncDynamics.AI Plattform-Übersicht</p>
          </div>
          <div className="flex gap-2">
            <SovereignButton variant="outline" size="md" onClick={load} leftIcon={<Zap className="h-4 w-4" />}>
              Aktualisieren
            </SovereignButton>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Card variant="default" className="border-rose-900/50 bg-rose-950/20">
            <CardContent className="pt-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-rose-300 font-semibold mb-2">Fehler beim Laden der Metriken</p>
                <p className="text-xs text-rose-300/80">{error}</p>
              </div>
              <SovereignButton variant="outline" size="sm" onClick={load}>
                Neu laden
              </SovereignButton>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} variant="default" className="h-24 animate-pulse">
                <div />
              </Card>
            ))}
          </div>
        )}

        {/* KPI Cards */}
        {metrics && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card variant="default">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-titanium-200">Gesamt-Workspaces</CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <div>
                  <p className="font-display font-bold text-3xl text-titanium-50">{metrics.totalTenants}</p>
                  <p className="text-xs text-titanium-400 mt-1">{metrics.activeTenants} aktiv</p>
                </div>
                <Users className="h-8 w-8 text-security-blue opacity-50" />
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-titanium-200">Team-Benutzer</CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <div>
                  <p className="font-display font-bold text-3xl text-titanium-50">{metrics.totalUsers}</p>
                  <p className="text-xs text-titanium-400 mt-1">Gesamt</p>
                </div>
                <Users className="h-8 w-8 text-petrol opacity-50" />
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-titanium-200">MRR (EUR)</CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <div>
                  <p className="font-display font-bold text-3xl text-titanium-50">€{metrics.mrrEur}</p>
                  <p className="text-xs text-titanium-400 mt-1">Monatlich</p>
                </div>
                <CreditCard className="h-8 w-8 text-amber-500 opacity-50" />
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-titanium-200">System-Status</CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <div>
                  <Badge variant="success" size="sm">
                    {metrics.systemHealth === 'healthy' && 'Healthy'}
                    {metrics.systemHealth === 'degraded' && 'Degraded'}
                    {metrics.systemHealth === 'down' && 'Down'}
                  </Badge>
                  <p className="text-xs text-titanium-400 mt-1">Alle Systeme</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation Cards */}
        <div>
          <h2 className="font-display font-bold text-lg text-titanium-50 mb-4">Administration</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/admin/customers">
              <Card variant="default" className="hover:border-security-blue/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Customers
                  </CardTitle>
                  <CardDescription>Tenant-Verwaltung und Subscription-Status</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-security-blue">{metrics?.totalTenants || '—'}</p>
                  <p className="text-xs text-titanium-400 mt-1">Gesamt-Workspaces</p>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/leads">
              <Card variant="default" className="hover:border-security-blue/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Leads
                  </CardTitle>
                  <CardDescription>Sales-Pipeline und Conversion-Tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-petrol">—</p>
                  <p className="text-xs text-titanium-400 mt-1">Leads in Pipeline</p>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/system">
              <Card variant="default" className="hover:border-security-blue/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    System
                  </CardTitle>
                  <CardDescription>Plattform-Monitoring und Gesundheit</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="success" size="sm">Healthy</Badge>
                  <p className="text-xs text-titanium-400 mt-1">Alle Systeme aktiv</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Additional Admin Links */}
        <div>
          <h2 className="font-display font-bold text-lg text-titanium-50 mb-4">Weitere Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link to="/admin/onboarding">
              <Card variant="default" className="hover:border-titanium/50 transition-colors cursor-pointer">
                <CardContent className="py-4">
                  <p className="font-semibold text-titanium-100">Onboarding</p>
                  <p className="text-xs text-titanium-400 mt-1">Tenant-Setup und Checklisten</p>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/rebuilds">
              <Card variant="default" className="hover:border-titanium/50 transition-colors cursor-pointer">
                <CardContent className="py-4">
                  <p className="font-semibold text-titanium-100">Rebuilds</p>
                  <p className="text-xs text-titanium-400 mt-1">Deploy-History und Job-Verwaltung</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
