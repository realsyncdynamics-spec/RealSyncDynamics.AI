import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, Plus, CheckCircle, AlertCircle } from 'lucide-react';

interface EmailTemplate {
  id: string;
  event_type: string;
  subject_template: string;
  body_template: string;
  is_default: boolean;
  created_at: string;
}

export function EmailTemplateManager() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    event_type: 'quota_warning',
    subject_template: '',
    body_template: '',
  });

  const DEFAULT_TEMPLATES = [
    {
      event_type: 'quota_warning',
      subject: 'Alert: API Quota at 80%',
      body: 'Your API quota usage has reached 80%. Please review your usage or upgrade your plan.',
    },
    {
      event_type: 'quota_exceeded',
      subject: 'Alert: API Quota Exceeded',
      body: 'Your API quota limit has been exceeded. Further API requests will be blocked.',
    },
    {
      event_type: 'rate_limit_warning',
      subject: 'Alert: Rate Limit Warning',
      body: 'Your API requests are approaching the rate limit for this time window.',
    },
    {
      event_type: 'suspicious_activity',
      subject: 'Security Alert: Unusual API Activity',
      body: 'Unusual API activity has been detected on your account. Please review your recent requests.',
    },
  ];

  useEffect(() => {
    // In a real implementation, fetch templates from database
    // For now, show default templates
    setTemplates(
      DEFAULT_TEMPLATES.map((t, idx) => ({
        id: idx.toString(),
        event_type: t.event_type,
        subject_template: t.subject,
        body_template: t.body,
        is_default: true,
        created_at: new Date().toISOString(),
      }))
    );
    setLoading(false);
  }, []);

  const handleSaveTemplate = () => {
    if (!formData.subject_template || !formData.body_template) {
      setError('Subject and body templates are required');
      return;
    }

    if (editingId) {
      // Update template
      setTemplates(prev =>
        prev.map(t =>
          t.id === editingId
            ? { ...t, ...formData, is_default: false }
            : t
        )
      );
      setEditingId(null);
    } else {
      // Add new template
      const newTemplate: EmailTemplate = {
        id: Date.now().toString(),
        ...formData,
        is_default: false,
        created_at: new Date().toISOString(),
      };
      setTemplates([...templates, newTemplate]);
    }

    setFormData({ event_type: 'quota_warning', subject_template: '', body_template: '' });
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (template: EmailTemplate) => {
    if (template.is_default) {
      setError('Cannot edit default templates. Create a custom template instead.');
      return;
    }
    setFormData({
      event_type: template.event_type,
      subject_template: template.subject_template,
      body_template: template.body_template,
    });
    setEditingId(template.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const template = templates.find(t => t.id === id);
    if (template?.is_default) {
      setError('Cannot delete default templates.');
      return;
    }
    if (confirm('Delete this template?')) {
      setTemplates(prev => prev.filter(t => t.id !== id));
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-titanium-400">Lade E-Mail-Vorlagen...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900 border border-red-700 rounded p-4">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Add Template Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-security-500 text-white font-bold hover:bg-security-600 rounded"
        >
          <Plus className="h-4 w-4" />
          Neue Vorlage erstellen
        </button>
      )}

      {/* Template Form */}
      {showForm && (
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-6">
          <h3 className="text-lg font-bold text-titanium-50 mb-4">
            {editingId ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-titanium-300 mb-1">Ereignistyp</label>
              <select
                value={formData.event_type}
                onChange={e => setFormData({ ...formData, event_type: e.target.value })}
                className="w-full px-3 py-2 bg-obsidian-900 border border-titanium-600 rounded text-titanium-50 text-sm"
              >
                <option value="quota_warning">Quota-Warnung (80%)</option>
                <option value="quota_exceeded">Kontingent überschritten</option>
                <option value="rate_limit_warning">Rate-Limit-Warnung</option>
                <option value="suspicious_activity">Verdächtige Aktivität</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-titanium-300 mb-1">Betreffzeile (Template)</label>
              <input
                type="text"
                value={formData.subject_template}
                onChange={e => setFormData({ ...formData, subject_template: e.target.value })}
                placeholder="z.B. Alert: API Quota at 80%"
                className="w-full px-3 py-2 bg-obsidian-900 border border-titanium-600 rounded text-titanium-50 text-sm"
              />
              <p className="text-xs text-titanium-400 mt-1">
                Verfügbare Variablen: {'{api_calls}'}, {'{quota_limit}'}, {'{percentage}'}
              </p>
            </div>

            <div>
              <label className="block text-sm text-titanium-300 mb-1">E-Mail-Body (Template)</label>
              <textarea
                value={formData.body_template}
                onChange={e => setFormData({ ...formData, body_template: e.target.value })}
                placeholder="z.B. Your API quota usage has reached {percentage}%..."
                rows={6}
                className="w-full px-3 py-2 bg-obsidian-900 border border-titanium-600 rounded text-titanium-50 text-sm font-mono"
              />
              <p className="text-xs text-titanium-400 mt-1">
                Verfügbare Variablen: {'{api_calls}'}, {'{quota_limit}'}, {'{percentage}'}, {'{timestamp}'}
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleSaveTemplate}
                className="flex-1 px-4 py-2 bg-security-500 text-white font-bold hover:bg-security-600 rounded"
              >
                {editingId ? 'Vorlage aktualisieren' : 'Vorlage erstellen'}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({ event_type: 'quota_warning', subject_template: '', body_template: '' });
                }}
                className="flex-1 px-4 py-2 bg-obsidian-700 text-titanium-100 font-bold border border-titanium-700 rounded hover:bg-obsidian-600"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="bg-obsidian-800 border border-titanium-700 rounded p-6">
        <h3 className="text-lg font-bold text-titanium-50 mb-4">E-Mail-Vorlagen</h3>

        {templates.length === 0 ? (
          <p className="text-titanium-400 text-sm">Keine Vorlagen verfügbar</p>
        ) : (
          <div className="space-y-4">
            {templates.map(template => (
              <div key={template.id} className="bg-obsidian-900 border border-obsidian-700 rounded p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-mono text-sm text-titanium-300">{template.event_type}</p>
                      {template.is_default && (
                        <span className="text-xs px-2 py-1 bg-security-900 text-security-300 rounded">
                          Standard
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-titanium-50 font-medium">{template.subject_template}</p>
                    <p className="text-xs text-titanium-400 mt-1 line-clamp-2">
                      {template.body_template}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(template)}
                      disabled={template.is_default}
                      className={`p-2 rounded ${
                        template.is_default
                          ? 'text-titanium-600 cursor-not-allowed'
                          : 'text-security-400 hover:bg-security-900'
                      }`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      disabled={template.is_default}
                      className={`p-2 rounded ${
                        template.is_default
                          ? 'text-titanium-600 cursor-not-allowed'
                          : 'text-red-400 hover:bg-red-900'
                      }`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
