// CeoCockpitView — Executive-Einstieg unter /app.
//
// Verdichtet vorhandene, RLS-gescopte Daten (Count-Helfer + KPI-Snapshot +
// Detail-Listen) zu der einen Antwort, die eine Geschäftsführung in 30
// Sekunden braucht: Gesamt-Score, Audit-Readiness, Top-3-Pflichten, Fristen.
// Nutzt ausschliesslich bestehende APIs — kein neues Backend.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, FileCheck2, Loader2, ShieldCheck,
  TrendingDown, TrendingUp, Minus, Clock, ChevronRight, Rocket, CheckCircle,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../../../lib/hoc';
import { Card, CardHeader, CardBody } from '../../../enterprise-os/components/Card';
import { ScoreGauge } from '../../../enterprise-os/components/ScoreGauge';
import { Button } from '../../../enterprise-os/components/Button';
import { StatusBadge } from '../../../enterprise-os/components/Badge';
import { scoreLabel, scoreLevel } from './cockpitScore';
import { loadCockpitData, type CockpitData } from './cockpitData';
import { GovernanceBriefCard } from './GovernanceBriefCard';
import { ApiStatusCard } from '../../../features/api/ApiStatusCard';
import { usePerformanceMonitor, measureAsync } from '../../../lib/performance';

function _CeoCockpitView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const CeoCockpitView = withPerformanceMonitoring(
  _CeoCockpitView,
  'CeoCockpitView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  return <div className="p-8 text-titanium-400">CEO Cockpit view coming soon...</div>;
}

function TrendChip({ direction, percent }: { direction: 'up' | 'down' | 'flat'; percent: number }) {
  if (direction === 'flat' || percent === 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-titanium-500"><Minus className="h-3 w-3" /> stabil</span>;
  }
  const up = direction === 'up';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono ${up ? 'text-risk-passed' : 'text-risk-high'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {percent}%
    </span>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <p className={`font-mono text-2xl font-bold ${danger ? 'text-rose-300' : 'text-titanium-50'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono mt-0.5">{label}</p>
    </div>
  );
}

function CoverageCard({ label, percent }: { label: string; percent: number }) {
  const pct = Math.round(Math.max(0, Math.min(100, percent)));
  return (
    <div className="bg-obsidian-900 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono">{label}</p>
        <span className="font-mono text-sm font-bold text-titanium-50">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 bg-titanium-900 w-full">
        <div
          className="h-full bg-security-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
