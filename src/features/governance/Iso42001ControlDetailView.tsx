import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Brain, Loader2, AlertTriangle, CheckCircle2, Bot, Save,
  FileText, User, Calendar, TrendingUp, BarChart3, Lock, Unlock,
  Upload, Eye, EyeOff, MessageSquare, MoreVertical,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';
import { getAuthToken } from '../../lib/auth';

interface Iso42001ControlDetail {
  id: string;
  control_code: string;
  control_name: string;
  description: string;
  status: 'not_started' | 'planned' | 'in_progress' | 'implemented' | 'optimized';
  maturity_level: number;
  implementation_notes?: string;
  responsible_person_id?: string;
  reviewed_by_id?: string;
  implementation_date?: string;
  last_review_date?: string;
  next_review_date?: string;
  evidence_item_ids?: string[];
  assessment_results?: Record<string, unknown>;
  ai_system_id?: string;
  applies_to_all_systems?: boolean;
}

interface AuditHistoryItem {
  id: string;
  audit_date: string;
  auditor_id?: string;
  findings?: string;
  recommendations?: string;
  status_before?: string;
  status_after?: string;
  maturity_level_before?: number;
  maturity_level_after?: number;
}

interface EvidenceItem {
  id: string;
  name: string;
  url?: string;
  type: 'document' | 'screenshot' | 'log' | 'policy' | 'other';
  uploaded_at: string;
}

function _Iso42001ControlDetailView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const Iso42001ControlDetailView = withPerformanceMonitoring(
  _Iso42001ControlDetailView,
  'Iso42001ControlDetailView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { controlId } = useParams<{ controlId: string }>();
  const navigate = useNavigate();
  const { activeTenantId } = useTenant();

  const [control, setControl] = useState<Iso42001ControlDetail | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditHistoryItem[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Iso42001ControlDetail>>({});
  const [showNotes, setShowNotes] = useState(false);

  const loadData = async () => {
    if (!activeTenantId || !controlId) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `/functions/v1/iso42001-control-detail?tenant_id=${activeTenantId}&control_id=${controlId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to load control detail');
      const data = await response.json();

      setControl(data.control);
      setAuditHistory(data.audit_history || []);
      setEvidence(data.evidence || []);
      setEditForm(data.control);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [activeTenantId, controlId]);

  const handleSave = async () => {
    if (!control || !activeTenantId) return;
    setSaving(true);

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `/functions/v1/iso42001-control-update`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_id: activeTenantId,
            control_id: control.id,
            status: editForm.status || control.status,
            maturity_level: editForm.maturity_level !== undefined ? editForm.maturity_level : control.maturity_level,
            implementation_notes: editForm.implementation_notes,
            implementation_date: editForm.implementation_date,
            next_review_date: editForm.next_review_date,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to save');

      const result = await response.json();
      setControl(result.control);
      setEditMode(false);
      void loadData(); // Reload audit history
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  if (!activeTenantId) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center">
        <div className="text-titanium-500 text-sm">Tenant wählen.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-titanium-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Laden…
        </div>
      </div>
    );
  }

  if (!control) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100">
        <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
          <Link to="/app/governance/iso42001" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>Kontrolle nicht gefunden.</span>
          </div>
        </main>
      </div>
    );
  }

  const statusColors = {
    not_started: 'border-titanium-900 bg-obsidian-900 text-titanium-300',
    planned: 'border-yellow-900 bg-yellow-950 text-yellow-300',
    in_progress: 'border-blue-900 bg-blue-950 text-blue-300',
    implemented: 'border-green-900 bg-green-950 text-green-300',
    optimized: 'border-emerald-900 bg-emerald-950 text-emerald-300',
  }[control.status];

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance/iso42001" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">{control.control_code}</div>
              <div className="text-[11px] text-titanium-400 font-medium truncate max-w-xs">{control.control_name}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button
                onClick={() => { setEditMode(false); setEditForm(control); }}
                className="px-3 py-1.5 text-xs rounded-none border border-titanium-700 text-titanium-300 hover:bg-obsidian-800 font-medium"
              >
                Abbrechen
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="px-3 py-1.5 text-xs rounded-none bg-green-700 text-white hover:bg-green-600 font-medium disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="px-3 py-1.5 text-xs rounded-none border border-green-700 text-green-400 hover:bg-green-950 font-medium"
            >
              Bearbeiten
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Beschreibung
              </h3>
              <p className="text-[12px] text-titanium-300 leading-relaxed whitespace-pre-wrap">
                {control.description}
              </p>
            </div>

            {/* Implementation Status */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Implementierungsstatus
              </h3>

              {editMode ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide block mb-1.5">Status</label>
                    <select
                      value={editForm.status || control.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                      className="w-full bg-obsidian-800 border border-titanium-800 text-titanium-200 text-xs rounded-none px-2.5 py-2 outline-none"
                    >
                      <option value="not_started">Nicht gestartet</option>
                      <option value="planned">Geplant</option>
                      <option value="in_progress">In Arbeit</option>
                      <option value="implemented">Implementiert</option>
                      <option value="optimized">Optimiert</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide block mb-1.5">Reifegradstufe (0-5)</label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      value={editForm.maturity_level !== undefined ? editForm.maturity_level : control.maturity_level}
                      onChange={(e) => setEditForm({ ...editForm, maturity_level: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="text-[11px] text-titanium-400 mt-1">
                      Level {editForm.maturity_level !== undefined ? editForm.maturity_level : control.maturity_level}/5
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide block mb-1.5">Implementierungsdatum</label>
                    <input
                      type="date"
                      value={editForm.implementation_date || control.implementation_date || ''}
                      onChange={(e) => setEditForm({ ...editForm, implementation_date: e.target.value })}
                      className="w-full bg-obsidian-800 border border-titanium-800 text-titanium-200 text-xs rounded-none px-2.5 py-2 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide block mb-1.5">Nächste Überprüfung</label>
                    <input
                      type="date"
                      value={editForm.next_review_date || control.next_review_date || ''}
                      onChange={(e) => setEditForm({ ...editForm, next_review_date: e.target.value })}
                      className="w-full bg-obsidian-800 border border-titanium-800 text-titanium-200 text-xs rounded-none px-2.5 py-2 outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-titanium-400">Status</span>
                    <span className={`text-[11px] font-semibold px-2 py-1 border rounded-none ${statusColors}`}>
                      {control.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-titanium-400">Reifegrad</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`w-2 h-2 rounded-full ${
                            level <= control.maturity_level ? 'bg-green-400' : 'bg-titanium-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {control.implementation_date && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-titanium-400">Implementiert</span>
                      <span className="text-titanium-300">{new Date(control.implementation_date).toLocaleDateString('de-DE')}</span>
                    </div>
                  )}
                  {control.last_review_date && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-titanium-400">Letzte Überprüfung</span>
                      <span className="text-titanium-300">{new Date(control.last_review_date).toLocaleDateString('de-DE')}</span>
                    </div>
                  )}
                  {control.next_review_date && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-titanium-400">Nächste Überprüfung</span>
                      <span className="text-titanium-300">{new Date(control.next_review_date).toLocaleDateString('de-DE')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Implementation Notes */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-titanium-50 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Notizen
                </h3>
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className="p-1 text-titanium-400 hover:text-titanium-200"
                >
                  {showNotes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {editMode ? (
                <textarea
                  value={editForm.implementation_notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, implementation_notes: e.target.value })}
                  placeholder="Implementierungsdetails, Besonderheiten, Abhängigkeiten..."
                  className="w-full bg-obsidian-800 border border-titanium-800 text-titanium-200 text-xs rounded-none px-2.5 py-2 outline-none font-mono min-h-20"
                />
              ) : (
                <div className={`text-[12px] text-titanium-300 font-mono leading-relaxed whitespace-pre-wrap ${!showNotes ? 'blur-sm select-none' : ''}`}>
                  {control.implementation_notes || '(keine Notizen)'}
                </div>
              )}
            </div>

            {/* Evidence */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4" /> Nachweise ({evidence.length})
              </h3>

              {evidence.length === 0 ? (
                <div className="text-[12px] text-titanium-400">Keine Nachweise hochgeladen</div>
              ) : (
                <div className="space-y-2">
                  {evidence.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2 p-2 bg-obsidian-800 border border-titanium-900 rounded-none"
                    >
                      <FileText className="h-4 w-4 text-titanium-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-titanium-200 truncate">{item.name}</div>
                        <div className="text-[10px] text-titanium-500">
                          {item.type} • {new Date(item.uploaded_at).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: Audit Trail & Metadata */}
          <div className="space-y-6">
            {/* Metadata Card */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 mb-3 text-[12px] uppercase tracking-wide">Metadaten</h3>

              <div className="space-y-2 text-[11px]">
                {control.responsible_person_id && (
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-titanium-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-titanium-400">Verantwortlich</div>
                      <div className="text-titanium-200 font-mono">{control.responsible_person_id}</div>
                    </div>
                  </div>
                )}

                {control.reviewed_by_id && (
                  <div className="flex items-start gap-2 border-t border-titanium-900 pt-2">
                    <Lock className="h-4 w-4 text-titanium-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-titanium-400">Überprüft von</div>
                      <div className="text-titanium-200 font-mono">{control.reviewed_by_id}</div>
                    </div>
                  </div>
                )}

                {control.ai_system_id && (
                  <div className="flex items-start gap-2 border-t border-titanium-900 pt-2">
                    <Bot className="h-4 w-4 text-titanium-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-titanium-400">AI-System</div>
                      <div className="text-titanium-200 font-mono text-[10px] break-all">{control.ai_system_id}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Audit History */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 mb-3 text-[12px] uppercase tracking-wide flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Prüfprotokoll
              </h3>

              {auditHistory.length === 0 ? (
                <div className="text-[11px] text-titanium-400">Keine Einträge</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {auditHistory.map((audit, idx) => (
                    <div key={audit.id} className="text-[10px] border-b border-titanium-900/50 pb-2 last:border-0">
                      <div className="text-titanium-400">
                        {new Date(audit.audit_date).toLocaleDateString('de-DE')}
                      </div>
                      {audit.status_before && audit.status_after && (
                        <div className="text-titanium-300 mt-0.5">
                          {audit.status_before} → {audit.status_after}
                        </div>
                      )}
                      {audit.maturity_level_before !== undefined && audit.maturity_level_after !== undefined && (
                        <div className="text-titanium-300 text-[9px]">
                          Reifegrad: {audit.maturity_level_before} → {audit.maturity_level_after}
                        </div>
                      )}
                      {audit.findings && (
                        <div className="text-titanium-500 mt-1 italic">"{audit.findings}"</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
