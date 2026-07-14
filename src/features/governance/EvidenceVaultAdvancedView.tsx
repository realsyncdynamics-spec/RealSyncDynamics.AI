import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Upload, Filter, Search,
  Calendar, Tag, Link as LinkIcon, FileText, Trash2, ChevronRight, Clock,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';

interface EvidenceItem {
  id: string;
  name: string;
  type: 'document' | 'certificate' | 'audit_log' | 'screenshot' | 'policy' | 'training_record' | 'incident_log' | 'other';
  status: 'active' | 'archived' | 'expired' | 'pending_review';
  framework_codes: string[];
  gap_ids: string[];
  tags: string[];
  expiration_date: string | null;
  storage_path: string;
  created_at: string;
}

export function EvidenceVaultAdvancedView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [evidence, setEvidence] = useState<EvidenceItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFramework, setFilterFramework] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const reload = async () => {
    if (!activeTenantId) return;
    setError(null);
    setEvidence(null);

    try {
      const response = await fetch(
        `/functions/v1/governance-resources?tenant_id=${activeTenantId}&resource_type=evidence_items`,
        { headers: { Authorization: `Bearer ${(await import('../../lib/auth')).getAuthToken()}` } }
      );
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      setEvidence(data.evidence || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  };

  useEffect(() => { void reload(); }, [activeTenantId]);

  const filtered = evidence?.filter(e => {
    const matchesQuery = searchQuery === '' ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFramework = filterFramework === 'all' || e.framework_codes.includes(filterFramework);
    const matchesStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchesType = filterType === 'all' || e.type === filterType;
    return matchesQuery && matchesFramework && matchesStatus && matchesType;
  }) || [];

  const expiringCount = evidence?.filter(e => {
    if (!e.expiration_date) return false;
    const days = Math.ceil((new Date(e.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 30;
  }).length || 0;

  const expiredCount = evidence?.filter(e => e.status === 'expired').length || 0;
  const activeCount = evidence?.filter(e => e.status === 'active').length || 0;

  const frameworks = Array.from(new Set(evidence?.flatMap(e => e.framework_codes) || [])).sort();

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Nachweis-Vault</div>
              <div className="text-[11px] text-titanium-400 font-medium">Compliance-Evidenzen & Nachweise</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <select
              value={activeTenantId ?? ''}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
            >
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-cyan-400 disabled:opacity-50 transition-colors"
          >
            <Upload className="h-4 w-4" /> Hochladen
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {expiringCount > 0 && (
          <div className="mb-4 flex items-start gap-3 text-sm bg-amber-950/50 border border-amber-900 rounded-none p-3">
            <Clock className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <div className="font-semibold text-amber-300">{expiringCount} Nachweise laufen ab!</div>
              <div className="text-amber-200 text-xs mt-1">Erneuerung in den nächsten 30 Tagen erforderlich.</div>
            </div>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Tenant wählen.</div>
        ) : evidence === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-obsidian-900 border border-green-900 rounded-none p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-[12px] text-green-300 font-semibold">AKTIV</span>
                </div>
                <div className="text-3xl font-bold text-green-400">{activeCount}</div>
                <p className="text-[11px] text-titanium-400 mt-1">Gültige Nachweise</p>
              </div>

              <div className="bg-obsidian-900 border border-amber-900 rounded-none p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <span className="text-[12px] text-amber-300 font-semibold">LÄUFT AB</span>
                </div>
                <div className="text-3xl font-bold text-amber-400">{expiringCount}</div>
                <p className="text-[11px] text-titanium-400 mt-1">Innerhalb 30 Tagen</p>
              </div>

              <div className="bg-obsidian-900 border border-red-900 rounded-none p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <span className="text-[12px] text-red-300 font-semibold">ABGELAUFEN</span>
                </div>
                <div className="text-3xl font-bold text-red-400">{expiredCount}</div>
                <p className="text-[11px] text-titanium-400 mt-1">Erneuerung erforderlich</p>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-titanium-500" />
              <input
                type="text"
                placeholder="Nachweise durchsuchen (Name, Tags)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-obsidian-900 border border-titanium-900 text-titanium-200 text-sm rounded-none px-3 py-2.5 pl-9 outline-none placeholder:text-titanium-600"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-[12px]">
                <Filter className="h-4 w-4 text-titanium-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-obsidian-900 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium"
                >
                  <option value="all">Status: Alle</option>
                  <option value="active">Aktiv</option>
                  <option value="archived">Archiviert</option>
                  <option value="expired">Abgelaufen</option>
                  <option value="pending_review">Überprüfung ausstehend</option>
                </select>
              </div>

              {frameworks.length > 0 && (
                <div className="flex items-center gap-2 text-[12px]">
                  <select
                    value={filterFramework}
                    onChange={(e) => setFilterFramework(e.target.value)}
                    className="bg-obsidian-900 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium"
                  >
                    <option value="all">Framework: Alle</option>
                    {frameworks.map((fw) => (
                      <option key={fw} value={fw}>{fw.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 text-[12px]">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-obsidian-900 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium"
                >
                  <option value="all">Typ: Alle</option>
                  <option value="document">Dokument</option>
                  <option value="certificate">Zertifikat</option>
                  <option value="audit_log">Audit-Log</option>
                  <option value="policy">Richtlinie</option>
                  <option value="training_record">Schulungsprotokoll</option>
                  <option value="incident_log">Vorfallprotokoll</option>
                  <option value="other">Sonstige</option>
                </select>
              </div>
            </div>

            {/* Evidence Grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 bg-obsidian-900 border border-titanium-900 rounded-none">
                <FileText className="h-12 w-12 text-titanium-600 mx-auto mb-3" />
                <h3 className="font-semibold text-titanium-50 mb-1">Keine Nachweise gefunden</h3>
                <p className="text-titanium-400 text-sm">Laden Sie Compliance-Evidenzen hoch, um sie hier zu verwalten.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((item) => (
                  <EvidenceCard key={item.id} evidence={item} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: EvidenceItem }) {
  const statusColors = {
    active: { bg: 'bg-green-950', border: 'border-green-900', badge: 'bg-green-600', text: 'text-green-300' },
    archived: { bg: 'bg-slate-950', border: 'border-slate-800', badge: 'bg-slate-600', text: 'text-slate-300' },
    expired: { bg: 'bg-red-950', border: 'border-red-900', badge: 'bg-red-600', text: 'text-red-300' },
    pending_review: { bg: 'bg-amber-950', border: 'border-amber-900', badge: 'bg-amber-600', text: 'text-amber-300' },
  }[evidence.status];

  const typeLabel = {
    document: '📄 Dokument',
    certificate: '🏆 Zertifikat',
    audit_log: '📊 Audit-Log',
    screenshot: '🖼️ Screenshot',
    policy: '📋 Richtlinie',
    training_record: '📚 Schulung',
    incident_log: '⚠️ Vorfall',
    other: '📦 Sonstiges',
  }[evidence.type];

  const isExpiring = evidence.expiration_date && !evidence.status.includes('expired') &&
    Math.ceil((new Date(evidence.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 30;

  return (
    <div className={`${statusColors.bg} border ${statusColors.border} rounded-none p-4 hover:shadow-lg transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-titanium-50 line-clamp-2">{evidence.name}</h4>
          <p className="text-[11px] text-titanium-400 mt-1">{typeLabel}</p>
        </div>
        <span className={`${statusColors.badge} text-white text-[10px] font-semibold px-2 py-1 rounded-none whitespace-nowrap`}>
          {evidence.status.replace('_', ' ').charAt(0).toUpperCase() + evidence.status.replace('_', ' ').slice(1)}
        </span>
      </div>

      {/* Frameworks */}
      {evidence.framework_codes.length > 0 && (
        <div className="mb-2">
          <div className="text-[11px] text-titanium-400 mb-1">Frameworks:</div>
          <div className="flex flex-wrap gap-1">
            {evidence.framework_codes.map((fw) => (
              <span key={fw} className="bg-obsidian-900 border border-titanium-700 text-titanium-300 text-[10px] px-2 py-0.5 rounded-none">
                {fw.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {evidence.tags.length > 0 && (
        <div className="mb-2">
          <div className="flex flex-wrap gap-1">
            {evidence.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 bg-obsidian-900 text-titanium-300 text-[10px] px-2 py-0.5 rounded-none">
                <Tag className="h-3 w-3" /> {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Gap Links */}
      {evidence.gap_ids.length > 0 && (
        <div className="mb-2">
          <div className="text-[11px] text-titanium-400 mb-1">Adressiert {evidence.gap_ids.length} Lücke(n)</div>
          <div className="flex items-center gap-1 text-[10px] text-cyan-400">
            <LinkIcon className="h-3 w-3" /> Zu Gap-Details
          </div>
        </div>
      )}

      {/* Expiration */}
      {evidence.expiration_date && (
        <div className={`mb-3 pt-2 border-t border-white/10 text-[11px] flex items-center gap-1.5 ${isExpiring ? 'text-amber-300' : 'text-titanium-400'}`}>
          <Calendar className="h-3 w-3" />
          <span className="font-mono">
            {isExpiring ? '⚠️ ' : ''}{new Date(evidence.expiration_date).toLocaleDateString('de-DE')}
          </span>
        </div>
      )}

      <Link
        to={`/app/evidence/${evidence.id}`}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-400 hover:text-blue-300 hover:underline"
      >
        Details <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
