import React, { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Shield, Globe, CheckCircle2, AlertTriangle,
  Save, X, Loader2,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { useCurrentTenant } from '../../lib/useCurrentTenant';
import type { AgentBrowserPolicy, BrowserActionType } from '../../types/agent-browser';

const ACTION_TYPES: BrowserActionType[] = [
  'navigate',
  'click',
  'fill_form',
  'submit_form',
  'extract_data',
  'take_screenshot',
  'wait_for_element',
  'scroll',
  'get_page_title',
  'get_text_content',
  'evaluate_script',
];

export function AgentBrowserPolicyManager() {
  const [policies, setPolicies] = useState<AgentBrowserPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<AgentBrowserPolicy>>({
    name: '',
    description: '',
    enabled: true,
    applies_to_agents: [],
    allowed_domains: [],
    blocked_domains: [],
    allowed_actions: [],
    blocked_actions: [],
    allow_subdomains: true,
    require_approval: false,
    screenshot_every_action: true,
    capture_har: false,
    max_concurrent_sessions: 5,
    max_session_duration_seconds: 600,
  });
  const tenant = useCurrentTenant();

  const supabase = getSupabase();

  useEffect(() => {
    loadPolicies();
  }, [tenant?.id]);

  const loadPolicies = async () => {
    if (!tenant?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_browser_policies')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading policies:', error);
      } else {
        setPolicies(data as AgentBrowserPolicy[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenant?.id) return;

    try {
      if (editingId) {
        const { error } = await supabase
          .from('agent_browser_policies')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('agent_browser_policies')
          .insert({
            tenant_id: tenant.id,
            ...formData,
          });

        if (error) throw error;
      }

      setIsCreating(false);
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        enabled: true,
        applies_to_agents: [],
        allowed_domains: [],
        blocked_domains: [],
        allowed_actions: [],
        blocked_actions: [],
        allow_subdomains: true,
        require_approval: false,
        screenshot_every_action: true,
        capture_har: false,
        max_concurrent_sessions: 5,
        max_session_duration_seconds: 600,
      });

      await loadPolicies();
    } catch (err) {
      console.error('Error saving policy:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this policy?')) return;

    try {
      const { error } = await supabase
        .from('agent_browser_policies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadPolicies();
    } catch (err) {
      console.error('Error deleting policy:', err);
    }
  };

  const handleStartEdit = (policy: AgentBrowserPolicy) => {
    setFormData(policy);
    setEditingId(policy.id);
    setIsCreating(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-titanium-50 flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-cyan-400" />
            Browser Policies
          </h2>
          <p className="text-sm text-titanium-500">
            Define which agents can browse which domains and perform which actions.
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={() => {
              setIsCreating(true);
              setEditingId(null);
              setFormData({
                name: '',
                description: '',
                enabled: true,
                applies_to_agents: [],
                allowed_domains: [],
                blocked_domains: [],
                allowed_actions: [],
                blocked_actions: [],
                allow_subdomains: true,
                require_approval: false,
                screenshot_every_action: true,
                capture_har: false,
                max_concurrent_sessions: 5,
                max_session_duration_seconds: 600,
              });
            }}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-obsidian-950 font-semibold rounded transition-colors text-sm"
          >
            <Plus className="h-4 w-4" />
            New Policy
          </button>
        )}
      </div>

      {/* Policy Form */}
      {isCreating && (
        <div className="bg-obsidian-800 border border-titanium-800 rounded p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-titanium-100">
              {editingId ? 'Edit Policy' : 'New Policy'}
            </h3>
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingId(null);
              }}
              className="text-titanium-500 hover:text-titanium-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-titanium-300 mb-1">
                Policy Name
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-obsidian-900 border border-titanium-700 rounded text-titanium-100 text-sm focus:border-cyan-500 outline-none"
                placeholder="e.g., Hermes Agent Policy"
              />
            </div>

            {/* Agent Pattern */}
            <div>
              <label className="block text-sm font-medium text-titanium-300 mb-1">
                Agent Patterns (comma-separated)
              </label>
              <input
                type="text"
                value={(formData.applies_to_agents || []).join(', ')}
                onChange={e =>
                  setFormData({
                    ...formData,
                    applies_to_agents: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  })
                }
                className="w-full px-3 py-2 bg-obsidian-900 border border-titanium-700 rounded text-titanium-100 text-sm focus:border-cyan-500 outline-none"
                placeholder="e.g., hermes-*, compliance-*"
              />
            </div>

            {/* Allowed Domains */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-titanium-300 mb-1">
                Allowed Domains (comma-separated, empty = all)
              </label>
              <input
                type="text"
                value={(formData.allowed_domains || []).join(', ')}
                onChange={e =>
                  setFormData({
                    ...formData,
                    allowed_domains: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  })
                }
                className="w-full px-3 py-2 bg-obsidian-900 border border-titanium-700 rounded text-titanium-100 text-sm focus:border-cyan-500 outline-none"
                placeholder="e.g., example.com, api.*.example.com"
              />
            </div>

            {/* Blocked Domains */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-titanium-300 mb-1">
                Blocked Domains (comma-separated)
              </label>
              <input
                type="text"
                value={(formData.blocked_domains || []).join(', ')}
                onChange={e =>
                  setFormData({
                    ...formData,
                    blocked_domains: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  })
                }
                className="w-full px-3 py-2 bg-obsidian-900 border border-titanium-700 rounded text-titanium-100 text-sm focus:border-cyan-500 outline-none"
                placeholder="e.g., malicious.com"
              />
            </div>

            {/* Allowed Actions */}
            <div>
              <label className="block text-sm font-medium text-titanium-300 mb-1">
                Allowed Actions (leave empty = all)
              </label>
              <select
                multiple
                value={formData.allowed_actions || []}
                onChange={e =>
                  setFormData({
                    ...formData,
                    allowed_actions: Array.from(e.target.selectedOptions, o => o.value as BrowserActionType),
                  })
                }
                className="w-full px-3 py-2 bg-obsidian-900 border border-titanium-700 rounded text-titanium-100 text-sm focus:border-cyan-500 outline-none"
                size={4}
              >
                {ACTION_TYPES.map(action => (
                  <option key={action} value={action} className="bg-obsidian-900">
                    {action}
                  </option>
                ))}
              </select>
            </div>

            {/* Settings */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-titanium-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                  className="rounded"
                />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-sm text-titanium-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.require_approval}
                  onChange={e => setFormData({ ...formData, require_approval: e.target.checked })}
                  className="rounded"
                />
                Require Approval
              </label>
              <label className="flex items-center gap-2 text-sm text-titanium-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.screenshot_every_action}
                  onChange={e => setFormData({ ...formData, screenshot_every_action: e.target.checked })}
                  className="rounded"
                />
                Screenshot Every Action
              </label>
              <label className="flex items-center gap-2 text-sm text-titanium-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.capture_har}
                  onChange={e => setFormData({ ...formData, capture_har: e.target.checked })}
                  className="rounded"
                />
                Capture HAR Logs
              </label>
            </div>

            {/* Duration Limit */}
            <div>
              <label className="block text-sm font-medium text-titanium-300 mb-1">
                Max Session Duration (seconds)
              </label>
              <input
                type="number"
                value={formData.max_session_duration_seconds || 600}
                onChange={e =>
                  setFormData({ ...formData, max_session_duration_seconds: parseInt(e.target.value, 10) })
                }
                className="w-full px-3 py-2 bg-obsidian-900 border border-titanium-700 rounded text-titanium-100 text-sm focus:border-cyan-500 outline-none"
                min="10"
                max="3600"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-titanium-700">
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingId(null);
              }}
              className="px-4 py-2 text-sm font-medium text-titanium-300 hover:text-titanium-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-obsidian-950 text-sm font-semibold rounded transition-colors"
            >
              <Save className="h-4 w-4" />
              Save Policy
            </button>
          </div>
        </div>
      )}

      {/* Policies List */}
      {loading ? (
        <div className="text-center py-8 text-titanium-500">
          <Loader2 className="h-5 w-5 inline-block animate-spin mr-2" />
          Loading policies...
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-titanium-800 rounded">
          <Shield className="h-8 w-8 text-titanium-700 mx-auto mb-3" />
          <p className="text-titanium-500">No policies yet.</p>
          <p className="text-xs text-titanium-600">Create your first agent browser policy to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map(policy => (
            <div
              key={policy.id}
              className="bg-obsidian-800 border border-titanium-800 rounded p-4 flex items-start justify-between hover:border-titanium-700 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {policy.enabled ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-titanium-600" />
                  )}
                  <h3 className="font-semibold text-titanium-100">{policy.name}</h3>
                </div>
                <p className="text-xs text-titanium-500 mb-2">{policy.description}</p>
                <div className="flex gap-4 text-xs text-titanium-600">
                  <span>Agents: {policy.applies_to_agents?.join(', ')}</span>
                  <span>
                    Domains: {policy.allowed_domains?.length === 0 ? 'All' : policy.allowed_domains?.join(', ')}
                  </span>
                  <span>Actions: {policy.allowed_actions?.length === 0 ? 'All' : policy.allowed_actions?.length}</span>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleStartEdit(policy)}
                  className="p-2 text-titanium-500 hover:text-titanium-300 transition-colors"
                  title="Edit"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(policy.id)}
                  className="p-2 text-titanium-500 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
