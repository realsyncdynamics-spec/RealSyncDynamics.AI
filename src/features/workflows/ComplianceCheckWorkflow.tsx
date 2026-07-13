import { useState } from 'react';
import { Clock, AlertCircle, CheckCircle2, Slack, Mail, Settings2, Play } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import { Button } from '../../enterprise-os/components/Button';
import { useTenant } from '../../core/access/TenantProvider';

export interface ComplianceCheckWorkflowConfig {
  id: string;
  name: string;
  description: string;
  schedule: 'daily' | 'weekly' | 'monthly';
  time_of_day: string;
  target_assets: string[];
  include_all_assets: boolean;
  notification_channels: ('slack' | 'email')[];
  slack_webhook_url?: string;
  email_recipients?: string[];
  enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
  run_count: number;
}

interface ComplianceCheckWorkflowProps {
  workflow?: ComplianceCheckWorkflowConfig;
  onSave?: (workflow: ComplianceCheckWorkflowConfig) => Promise<void>;
  isNew?: boolean;
}

const SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'Täglich', icon: '📅' },
  { value: 'weekly', label: 'Wöchentlich', icon: '📊' },
  { value: 'monthly', label: 'Monatlich', icon: '📆' },
];

export function ComplianceCheckWorkflow({
  workflow,
  onSave,
  isNew = false,
}: ComplianceCheckWorkflowProps) {
  const { activeTenantId } = useTenant();
  const [formData, setFormData] = useState<ComplianceCheckWorkflowConfig>(
    workflow || {
      id: '',
      name: 'Compliance-Check',
      description: 'Automatische tägliche Compliance-Prüfung aller Assets',
      schedule: 'daily',
      time_of_day: '09:00',
      target_assets: [],
      include_all_assets: true,
      notification_channels: ['email'],
      email_recipients: [],
      enabled: false,
      run_count: 0,
    }
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Workflow-Name ist erforderlich');
      return;
    }

    if (formData.notification_channels.includes('email') && (!formData.email_recipients || formData.email_recipients.length === 0)) {
      setError('Mindestens eine E-Mail-Adresse erforderlich');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (onSave) {
        await onSave(formData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Compliance-Check Workflow"
          eyebrow={isNew ? 'Neuer Workflow' : 'Bearbeiten'}
          subtitle="Automatische regelmäßige Compliance-Überprüfung mit Notifications"
        />
        <CardBody>
          <div className="space-y-4">
            {/* Name and Description */}
            <div>
              <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                Workflow-Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 focus:border-security-500 focus:outline-none"
                placeholder="z.B. Daily Compliance Check"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                Beschreibung
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 focus:border-security-500 focus:outline-none"
                rows={2}
                placeholder="Beschreibe den Zweck dieses Workflows"
              />
            </div>

            {/* Schedule */}
            <div>
              <label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                <Clock className="inline h-3.5 w-3.5 mr-1" />
                Zeitplan
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SCHEDULE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFormData({ ...formData, schedule: option.value as any })}
                    className={`p-3 border transition-all text-center text-sm font-semibold ${
                      formData.schedule === option.value
                        ? 'border-security-500 bg-security-500/10 text-security-300'
                        : 'border-titanium-700 bg-obsidian-900 text-titanium-300 hover:border-titanium-600'
                    }`}
                  >
                    <span className="text-lg">{option.icon}</span>
                    <div className="mt-1 text-[10px] uppercase tracking-wider">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Time of Day */}
            <div>
              <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                Uhrzeit (UTC)
              </label>
              <input
                type="time"
                value={formData.time_of_day}
                onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })}
                className="w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 focus:border-security-500 focus:outline-none"
              />
            </div>

            {/* Notification Channels */}
            <div>
              <label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                Benachrichtigungskanäle
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const updated = formData.notification_channels.includes('email')
                      ? formData.notification_channels.filter((c) => c !== 'email')
                      : [...formData.notification_channels, 'email'];
                    setFormData({ ...formData, notification_channels: updated });
                  }}
                  className={`flex items-center gap-2 px-3 py-2 border transition-all ${
                    formData.notification_channels.includes('email')
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-titanium-700 bg-obsidian-900 text-titanium-300 hover:border-titanium-600'
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  E-Mail
                </button>
                <button
                  onClick={() => {
                    const updated = formData.notification_channels.includes('slack')
                      ? formData.notification_channels.filter((c) => c !== 'slack')
                      : [...formData.notification_channels, 'slack'];
                    setFormData({ ...formData, notification_channels: updated });
                  }}
                  className={`flex items-center gap-2 px-3 py-2 border transition-all ${
                    formData.notification_channels.includes('slack')
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-titanium-700 bg-obsidian-900 text-titanium-300 hover:border-titanium-600'
                  }`}
                >
                  <Slack className="h-4 w-4" />
                  Slack
                </button>
              </div>
            </div>

            {/* Email Recipients */}
            {formData.notification_channels.includes('email') && (
              <div>
                <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                  E-Mail-Empfänger
                </label>
                <input
                  type="text"
                  placeholder="user@example.com, admin@example.com"
                  value={formData.email_recipients?.join(', ') || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      email_recipients: e.target.value.split(',').map((e) => e.trim()).filter(Boolean),
                    })
                  }
                  className="w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 focus:border-security-500 focus:outline-none"
                />
              </div>
            )}

            {/* Target Assets */}
            <div>
              <label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                Ziel-Assets
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.include_all_assets}
                  onChange={(e) => setFormData({ ...formData, include_all_assets: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-titanium-300">Alle Assets prüfen</span>
              </label>
            </div>

            {/* Status */}
            <div className="border-t border-titanium-800 pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {formData.enabled ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                )}
                <span className="text-sm text-titanium-300">
                  {formData.enabled ? 'Aktiv' : 'Inaktiv'} — {formData.run_count} Ausführungen
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-xs text-titanium-400">Aktivieren</span>
              </label>
            </div>

            {error && <div className="border border-risk-critical/40 bg-risk-critical/5 px-4 py-3 text-xs text-risk-critical">{error}</div>}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Speichern...' : 'Speichern & Aktivieren'}
              </Button>
              <Button variant="secondary">
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Jetzt testen
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Execution History */}
      {!isNew && (
        <Card>
          <CardHeader title="Letzte Ausführungen" eyebrow="Compliance-Check Runs" />
          <CardBody>
            <div className="space-y-2 text-sm text-titanium-400">
              <p className="text-center py-4">Noch keine Ausführungen</p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
