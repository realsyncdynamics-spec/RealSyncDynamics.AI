// RealSync AI Command Center — internes Betriebs-Dashboard (/admin/ai-os).
//
// Zugang: angemeldet (AuthGate) + aktiver Plattform-Operator. Die Rolle prüft
// der Server (`ai-os-control` op `session` → is_platform_operator() mit dem
// Nutzer-JWT); der Browser entscheidet nichts über Berechtigungen.
// Kundenflächen (/app/*) sind davon unberührt.

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity, BookOpen, Bot, CalendarClock, Coins, GitPullRequest, LayoutDashboard, Moon, ShieldCheck, Sun, Wrench,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useAiOsResource } from './aiOsApi';
import { ErrorNote, Pill } from './ui';
import { OverviewSection } from './sections/OverviewSection';
import { AgentControlSection } from './sections/AgentControlSection';
import { SkillLibrarySection } from './sections/SkillLibrarySection';
import { RoutineCenterSection } from './sections/RoutineCenterSection';
import { KnowledgeCenterSection } from './sections/KnowledgeCenterSection';
import { DevOpsSection } from './sections/DevOpsSection';
import { CostsSection } from './sections/CostsSection';
import { SecurityAuditSection } from './sections/SecurityAuditSection';
import './ai-os.css';

export interface AiOsSession {
  operator: boolean;
  aal: 'aal1' | 'aal2' | null;
  githubConfigured: boolean;
  repo: string;
}

export const AI_OS_SECTIONS = [
  { slug: 'uebersicht', label: 'Übersicht', icon: LayoutDashboard },
  { slug: 'agenten', label: 'Agentensteuerung', icon: Bot },
  { slug: 'skills', label: 'Skill-Bibliothek', icon: Wrench },
  { slug: 'routinen', label: 'Routinen', icon: CalendarClock },
  { slug: 'wissen', label: 'Wissen', icon: BookOpen },
  { slug: 'entwicklung', label: 'Entwicklung & CI', icon: GitPullRequest },
  { slug: 'kosten', label: 'KI-Nutzung & Kosten', icon: Coins },
  { slug: 'sicherheit', label: 'Sicherheit & Prüfpfad', icon: ShieldCheck },
] as const;

export type AiOsSectionSlug = (typeof AI_OS_SECTIONS)[number]['slug'];

const THEME_KEY = 'aios-theme';

function initialTheme(): 'dark' | 'light' {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch { /* Speicher gesperrt — Systemvorgabe nutzen */ }
  try {
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function AiOsCommandCenter() {
  return <AuthGate>{(session) => <Gate session={session} />}</AuthGate>;
}

function Gate({ session }: { session: Session }) {
  const res = useAiOsResource<AiOsSession>('session');
  const [theme, setTheme] = useState<'dark' | 'light'>(initialTheme);
  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try { window.localStorage.setItem(THEME_KEY, next); } catch { /* egal */ }
      return next;
    });
  }, []);

  useEffect(() => {
    document.title = 'AI Command Center · RealSync';
  }, []);

  let content: React.ReactNode;
  if (res.loading || !res.result) {
    content = <p className="aios-main aios-muted" role="status">Berechtigung wird geprüft …</p>;
  } else if (!res.result.ok) {
    const denied = res.result.status === 403;
    content = (
      <div className="aios-main max-w-xl">
        <h1 className="aios-h1">{denied ? 'Kein Zugriff' : 'Command Center nicht erreichbar'}</h1>
        {denied ? (
          <p className="aios-lead">
            Das AI Command Center ist nur für aktive Plattform-Operatoren freigegeben
            (<span className="aios-mono">platform_operators</span>). Angemeldet als {session.user.email ?? 'unbekannt'}.
          </p>
        ) : (
          <ErrorNote result={res.result} />
        )}
        <Link to="/" className="aios-link text-sm">Zur Startseite</Link>
      </div>
    );
  } else {
    content = <Shell session={res.result.data} />;
  }

  return (
    <div className="aios" data-theme={theme}>
      <header className="aios-header">
        <div className="flex items-center gap-3 min-w-0">
          <Activity className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">RealSync AI Command Center</div>
            <div className="text-xs aios-muted truncate">Internes AI-OS · nur Plattform-Betrieb</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {res.result?.ok && (
            <Pill tone={res.result.data.aal === 'aal2' ? 'ok' : 'warn'}>
              {res.result.data.aal === 'aal2' ? '2FA aktiv' : 'ohne 2FA: nur lesen'}
            </Pill>
          )}
          <button
            type="button"
            className="aios-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
            title={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>
      {content}
    </div>
  );
}

function Shell({ session }: { session: AiOsSession }) {
  const params = useParams<{ section?: string }>();
  const active = (AI_OS_SECTIONS.find((s) => s.slug === params.section)?.slug ?? 'uebersicht') as AiOsSectionSlug;

  return (
    <div className="aios-layout">
      <nav className="aios-nav" aria-label="Bereiche des Command Center">
        {AI_OS_SECTIONS.map(({ slug, label, icon: Icon }) => (
          <Link
            key={slug}
            to={`/admin/ai-os/${slug}`}
            aria-current={active === slug ? 'page' : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <main className="aios-main" id="aios-main">
        {active === 'uebersicht' && <OverviewSection session={session} />}
        {active === 'agenten' && <AgentControlSection session={session} />}
        {active === 'skills' && <SkillLibrarySection session={session} />}
        {active === 'routinen' && <RoutineCenterSection session={session} />}
        {active === 'wissen' && <KnowledgeCenterSection session={session} />}
        {active === 'entwicklung' && <DevOpsSection />}
        {active === 'kosten' && <CostsSection />}
        {active === 'sicherheit' && <SecurityAuditSection session={session} />}
      </main>
    </div>
  );
}

export default AiOsCommandCenter;
