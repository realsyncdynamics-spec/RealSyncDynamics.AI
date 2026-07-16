import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, Bell, Plus, Trash2, Edit2, Loader2, CheckCircle2,
  AlertCircle, Eye, EyeOff, Save, X, ChevronDown,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';

type TriggerEvent = 'risk_detected' | 'risk_escalated' | 'audit_failed' | 'dpia_overdue' | 'sub_processor_change' | 'policy_violation' | 'compliance_score_drop';
type Severity = 'low' | 'medium' | 'high' | 'critical';

interface ComplianceAlertRule {
  id: string;
  tenant_id: string;
  rule_name: string;
  description: string | null;
  enabled: boolean;
  trigger_event: TriggerEvent;
  severity_threshold: Severity | null;
  scope_entity_type: string | null;
  actions: Array<{
    action: 'alert_email' | 'webhook' | 'alert_slack';
    recipients?: string[];
    url?: string;
    webhook_url?: string;
  }>;
  auto_remediate: boolean;
  remediation_template: Record<string, any> | null;
  created_at: string;
}

const TRIGGER_EVENT_LABELS: Record<TriggerEvent, string> = {
  risk_detected: 'Risk Detected',
  risk_escalated: 'Risk Escalated',
  audit_failed: 'Audit Failed',
  dpia_overdue: 'DPIA Overdue',
  sub_processor_change: 'Sub-Processor Change',
  policy_violation: 'Policy Violation',
  compliance_score_drop: 'Compliance Score Drop',
};

const SEVERITY_LABELS: Record<Severity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const SEVERITY_COLORS: Record<Severity, string> = {
  low: 'bg-blue-950 border-blue-900 text-blue-300',
  medium: 'bg-amber-950 border-amber-900 text-amber-300',
  high: 'bg-orange-950 border-orange-900 text-orange-300',
  critical: 'bg-red-950 border-red-900 text-red-300',
};

export function ComplianceAlertRulesView() {
  const { activeTenantId } = useTenant();
  const [rules, setRules] = useState<ComplianceAlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<ComplianceAlertRule>>({
    rule_name: '',
    description: '',
    trigger_event: 'risk_detected',
    severity_threshold: 'high',
    enabled: true,
    actions: [],
    auto_remediate: false,
  });

  const loadRules = useCallback(async () => {
    if (!activeTenantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await getSupabase()
        .from('compliance_alert_rules')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setRules((data as ComplianceAlertRule[]) || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleSaveRule = async () => {
    if (!activeTenantId || !formData.rule_name?.trim()) {
      setError('Rule name is required');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        const { error: err } = await getSupabase()
          .from('compliance_alert_rules')
          .update({
            rule_name: formData.rule_name,
            description: formData.description,
            trigger_event: formData.trigger_event,
            severity_threshold: formData.severity_threshold,
            actions: formData.actions,
            auto_remediate: formData.auto_remediate,
            enabled: formData.enabled,
          })
          .eq('id', editingId);

        if (err) throw err;
      } else {
        const { error: err } = await getSupabase()
          .from('compliance_alert_rules')
          .insert({
            tenant_id: activeTenantId,
            rule_name: formData.rule_name,
            description: formData.description,
            trigger_event: formData.trigger_event,
            severity_threshold: formData.severity_threshold,
            actions: formData.actions,
            auto_remediate: formData.auto_remediate,
            enabled: formData.enabled,
          });

        if (err) throw err;
      }

      await loadRules();
      setShowForm(false);
      setEditingId(null);
      setFormData({
        rule_name: '',
        description: '',
        trigger_event: 'risk_detected',
        severity_threshold: 'high',
        enabled: true,
        actions: [],
        auto_remediate: false,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Delete this alert rule? This action cannot be undone.')) return;

    try {
      const { error: err } = await getSupabase()
        .from('compliance_alert_rules')
        .delete()
        .eq('id', ruleId);

      if (err) throw err;
      await loadRules();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const { error: err } = await getSupabase()
        .from('compliance_alert_rules')
        .update({ enabled: !enabled })
        .eq('id', ruleId);

      if (err) throw err;
      await loadRules();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleEditRule = (rule: ComplianceAlertRule) => {
    setFormData(rule);
    setEditingId(rule.id);
    setShowForm(true);
  };

  if (loading && rules.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-titanium-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading rules…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-titanium-50 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
            Compliance Alert Rules
          </h2>
          <p className="text-xs text-titanium-400 mt-1">Create and manage automated compliance alerts</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({
              rule_name: '',
              description: '',
              trigger_event: 'risk_detected',
              severity_threshold: 'high',
              enabled: true,
              actions: [],
              auto_remediate: false,
            });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-security-500 hover:bg-security-600 text-white text-sm font-semibold rounded-none"
        >
          <Plus className="h-4 w-4" /> New Rule
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <RuleForm
          data={formData}
          isEditing={!!editingId}
          onSave={handleSaveRule}
          onCancel={() => {
            setShowForm(false);
            setEditingId(null);
          }}
          onChange={setFormData}
        />
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 text-center">
          <Bell className="h-12 w-12 text-titanium-700 mx-auto mb-3 opacity-50" />
          <p className="text-titanium-400 text-sm">No alert rules configured yet.</p>
          <p className="text-titanium-500 text-xs mt-1">Create your first rule to automate compliance monitoring.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={handleEditRule}
              onDelete={handleDeleteRule}
              onToggle={handleToggleRule}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RuleCard ──────────────────────────────────────────────────────────────

function RuleCard({
  rule, onEdit, onDelete, onToggle,
}: {
  rule: ComplianceAlertRule;
  onEdit: (rule: ComplianceAlertRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const severity = rule.severity_threshold || 'high';

  return (
    <div className={`bg-obsidian-900 border rounded-none p-4 transition-colors ${rule.enabled ? 'border-titanium-900 hover:border-titanium-800' : 'border-titanium-950 opacity-60'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-0 text-titanium-500 hover:text-titanium-300"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            <div className="flex-1">
              <h3 className="font-semibold text-titanium-50 text-sm">{rule.rule_name}</h3>
              {rule.description && (
                <p className="text-xs text-titanium-400 mt-1">{rule.description}</p>
              )}
            </div>
          </div>

          {/* Summary row */}
          <div className="flex flex-wrap gap-2 mt-3 ml-6">
            <Badge>{TRIGGER_EVENT_LABELS[rule.trigger_event]}</Badge>
            {rule.severity_threshold && (
              <Badge className={SEVERITY_COLORS[severity]}>
                {SEVERITY_LABELS[severity]}
              </Badge>
            )}
            {rule.auto_remediate && <Badge>Auto-Remediate</Badge>}
            <Badge className="bg-titanium-950 border-titanium-900 text-titanium-400">
              {rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onToggle(rule.id, rule.enabled)}
            className="p-1.5 text-titanium-500 hover:text-titanium-300 hover:bg-obsidian-800 rounded-none"
            title={rule.enabled ? 'Disable' : 'Enable'}
          >
            {rule.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onEdit(rule)}
            className="p-1.5 text-titanium-500 hover:text-titanium-300 hover:bg-obsidian-800 rounded-none"
            title="Edit"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            className="p-1.5 text-red-500 hover:text-red-300 hover:bg-red-950/20 rounded-none"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 ml-6 pt-4 border-t border-titanium-900 space-y-3 text-xs">
          <div>
            <span className="text-titanium-400 font-semibold">Trigger Event:</span>
            <span className="text-titanium-300 ml-2">{TRIGGER_EVENT_LABELS[rule.trigger_event]}</span>
          </div>

          {rule.actions.length > 0 && (
            <div>
              <span className="text-titanium-400 font-semibold">Actions:</span>
              <div className="mt-1 space-y-1">
                {rule.actions.map((action, idx) => (
                  <div key={idx} className="text-titanium-300 ml-2">
                    • {action.action === 'alert_email' && `Email to ${action.recipients?.join(', ')}`}
                    {action.action === 'webhook' && `Webhook: ${action.url}`}
                    {action.action === 'alert_slack' && `Slack: ${action.webhook_url}`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {rule.auto_remediate && (
            <div>
              <span className="text-titanium-400 font-semibold">Auto-Remediation:</span>
              <span className="text-titanium-300 ml-2">Enabled</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── RuleForm ──────────────────────────────────────────────────────────────

function RuleForm({
  data, isEditing, onSave, onCancel, onChange,
}: {
  data: Partial<ComplianceAlertRule>;
  isEditing: boolean;
  onSave: () => void;
  onCancel: () => void;
  onChange: (data: Partial<ComplianceAlertRule>) => void;
}) {
  const [emailRecipients, setEmailRecipients] = useState<string>(
    data.actions?.find((a) => a.action === 'alert_email')?.recipients?.join(', ') || ''
  );

  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6 space-y-4">
      <h3 className="font-semibold text-titanium-50 flex items-center gap-2">
        <Edit2 className="h-4 w-4" />
        {isEditing ? 'Edit Alert Rule' : 'Create New Alert Rule'}
      </h3>

      <div className="space-y-3">
        {/* Rule Name */}
        <Field
          label="Rule Name"
          value={data.rule_name || ''}
          onChange={(v) => onChange({ ...data, rule_name: v })}
          placeholder="e.g., High-Risk Domain Detection"
        />

        {/* Description */}
        <Field
          label="Description (optional)"
          value={data.description || ''}
          onChange={(v) => onChange({ ...data, description: v })}
          placeholder="What should this rule do?"
          textarea
        />

        {/* Trigger Event */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">Trigger Event</label>
          <select
            value={data.trigger_event || 'risk_detected'}
            onChange={(e) => onChange({ ...data, trigger_event: e.target.value as TriggerEvent })}
            className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-security-500 text-titanium-300"
          >
            {Object.entries(TRIGGER_EVENT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Severity Threshold */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">Severity Threshold</label>
          <select
            value={data.severity_threshold || 'high'}
            onChange={(e) => onChange({ ...data, severity_threshold: e.target.value as Severity })}
            className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-security-500 text-titanium-300"
          >
            {Object.entries(SEVERITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Email Action */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">Email Recipients (comma-separated)</label>
          <input
            type="text"
            value={emailRecipients}
            onChange={(e) => setEmailRecipients(e.target.value)}
            placeholder="admin@example.com, security@example.com"
            className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-security-500 text-titanium-300"
          />
        </div>

        {/* Auto-Remediate */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.auto_remediate || false}
            onChange={(e) => onChange({ ...data, auto_remediate: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm text-titanium-300">Automatically execute remediation actions</span>
        </label>

        {/* Enabled */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.enabled !== false}
            onChange={(e) => onChange({ ...data, enabled: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm text-titanium-300">Enable this rule</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-titanium-900">
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-4 py-2 bg-security-500 hover:bg-security-600 text-white text-sm font-semibold rounded-none"
        >
          <Save className="h-4 w-4" /> Save Rule
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 bg-obsidian-950 border border-titanium-900 hover:bg-obsidian-800 text-titanium-300 text-sm rounded-none"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Badge ─────────────────────────────────────────────────────────────────

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const baseClass = 'inline-block px-2.5 py-1 text-[10px] font-semibold rounded-none border';
  const defaultClass = 'bg-titanium-900 border-titanium-800 text-titanium-300';
  return <span className={`${baseClass} ${className || defaultClass}`}>{children}</span>;
}

// ─── Field ─────────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-security-500 text-titanium-300 resize-none"
          rows={3}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-security-500 text-titanium-300"
        />
      )}
    </div>
  );
}
