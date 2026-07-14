import React, { useState } from 'react';
import {
  Plus, Trash2, AlertTriangle, CheckCircle2, Clock, Save, X, Shield, Flag,
} from 'lucide-react';
import { useCustomFrameworks, type CustomFramework, type CustomControl } from './useCustomFrameworks';

export function CustomFrameworkBuilder() {
  const { frameworks, loading, error, createFramework, updateFramework, deleteFramework } = useCustomFrameworks();

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    version: string;
    status: 'draft' | 'active' | 'archived';
    controls: CustomControl[];
    tags: string[];
  }>({
    name: '',
    description: '',
    version: '1.0',
    status: 'draft',
    controls: [],
    tags: [],
  });

  const [tagInput, setTagInput] = useState('');
  const [controlForm, setControlForm] = useState<Partial<CustomControl>>({
    name: '',
    description: '',
    category: '',
    status: 'compliant',
    riskLevel: 'medium',
    evidence: [],
  });

  const handleCreateOrUpdate = async () => {
    if (!formData.name.trim()) {
      setFormError('Framework name is required');
      return;
    }

    if (formData.controls.length === 0) {
      setFormError('At least one control is required');
      return;
    }

    try {
      setFormError(null);

      if (editingId) {
        const success = await updateFramework(editingId, formData);
        if (!success) {
          setFormError('Failed to update framework');
          return;
        }
      } else {
        const result = await createFramework(formData);
        if (!result) {
          setFormError('Failed to create framework');
          return;
        }
      }

      resetForm();
      setShowNewForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this framework?')) {
      return;
    }

    try {
      const success = await deleteFramework(id);
      if (!success) {
        setFormError('Failed to delete framework');
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete framework');
    }
  };

  const addControl = () => {
    if (!controlForm.name?.trim() || !controlForm.description?.trim()) {
      setFormError('Control name and description are required');
      return;
    }

    const newControl: CustomControl = {
      id: `control_${Date.now()}`,
      name: controlForm.name,
      description: controlForm.description,
      category: controlForm.category || 'general',
      status: controlForm.status as 'compliant' | 'in-progress' | 'non-compliant' | 'not-applicable',
      riskLevel: controlForm.riskLevel as 'critical' | 'high' | 'medium' | 'low',
      evidence: controlForm.evidence || [],
      dueDate: controlForm.dueDate,
      assignee: controlForm.assignee,
    };

    setFormData({
      ...formData,
      controls: [...formData.controls, newControl],
    });

    setControlForm({
      name: '',
      description: '',
      category: '',
      status: 'compliant',
      riskLevel: 'medium',
      evidence: [],
    });

    setFormError(null);
  };

  const removeControl = (id: string) => {
    setFormData({
      ...formData,
      controls: formData.controls.filter((c) => c.id !== id),
    });
  };

  const addTag = () => {
    if (!tagInput.trim()) return;

    if (formData.tags.includes(tagInput.trim())) {
      setFormError('Tag already exists');
      return;
    }

    setFormData({
      ...formData,
      tags: [...formData.tags, tagInput.trim()],
    });

    setTagInput('');
    setFormError(null);
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
  };

  const editFramework = (framework: CustomFramework) => {
    setFormData({
      name: framework.name,
      description: framework.description,
      version: framework.version,
      status: framework.status,
      controls: framework.controls,
      tags: framework.tags,
    });
    setEditingId(framework.id);
    setShowNewForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      version: '1.0',
      status: 'draft',
      controls: [],
      tags: [],
    });
    setEditingId(null);
    setTagInput('');
    setControlForm({
      name: '',
      description: '',
      category: '',
      status: 'compliant',
      riskLevel: 'medium',
      evidence: [],
    });
    setFormError(null);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'rose';
      case 'high':
        return 'orange';
      case 'medium':
        return 'amber';
      default:
        return 'emerald';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'emerald';
      case 'in-progress':
        return 'amber';
      case 'non-compliant':
        return 'rose';
      default:
        return 'titanium';
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-titanium-50 mb-2 flex items-center gap-2">
              <Shield className="w-8 h-8" />
              Custom Compliance Frameworks
            </h1>
            <p className="text-titanium-400">
              Define custom compliance frameworks tailored to your organization's requirements.
            </p>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowNewForm(!showNewForm);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-ai-cyan-500 hover:bg-ai-cyan-600 text-obsidian-950 font-semibold rounded-none transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Framework
          </button>
        </div>

        {/* New/Edit Form */}
        {showNewForm && (
          <div className="bg-obsidian-900 border border-titanium-800 p-6 rounded-none space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-titanium-50">
                {editingId ? 'Edit Framework' : 'Create New Framework'}
              </h2>
              <button
                onClick={() => {
                  setShowNewForm(false);
                  resetForm();
                }}
                className="p-2 text-titanium-400 hover:text-titanium-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="flex items-start gap-2 p-3 bg-rose-950/30 border border-rose-500/30 rounded-none">
                <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <p className="text-sm text-rose-300">{formError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-titanium-300 mb-2">
                  Framework Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Data Protection SOP"
                  className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 placeholder-titanium-500 focus:border-ai-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-titanium-300 mb-2">
                  Version
                </label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="1.0"
                  className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 placeholder-titanium-500 focus:border-ai-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-titanium-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the purpose and scope of this framework..."
                rows={3}
                className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 placeholder-titanium-500 focus:border-ai-cyan-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-titanium-300 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 focus:border-ai-cyan-500 focus:outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {/* Tags Section */}
            <div>
              <label className="block text-sm font-medium text-titanium-300 mb-2">
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag and press Enter"
                  className="flex-1 px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 placeholder-titanium-500 focus:border-ai-cyan-500 focus:outline-none"
                />
                <button
                  onClick={addTag}
                  className="px-3 py-2 bg-titanium-800 hover:bg-titanium-700 text-titanium-50 rounded-none transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-ai-cyan-500/10 border border-ai-cyan-500/30 rounded-none text-xs text-ai-cyan-400"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="hover:text-ai-cyan-300 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Controls Section */}
            <div className="border-t border-titanium-800 pt-4">
              <h3 className="text-sm font-semibold text-titanium-50 mb-4 flex items-center gap-2">
                <Flag className="w-4 h-4" />
                Control Points ({formData.controls.length})
              </h3>

              {/* Add Control Form */}
              <div className="bg-obsidian-950 p-4 rounded-none border border-titanium-800 mb-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Control name *"
                    value={controlForm.name || ''}
                    onChange={(e) => setControlForm({ ...controlForm, name: e.target.value })}
                    className="px-3 py-2 bg-obsidian-900 border border-titanium-700 rounded-none text-titanium-50 placeholder-titanium-500 focus:border-ai-cyan-500 focus:outline-none text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Category"
                    value={controlForm.category || ''}
                    onChange={(e) => setControlForm({ ...controlForm, category: e.target.value })}
                    className="px-3 py-2 bg-obsidian-900 border border-titanium-700 rounded-none text-titanium-50 placeholder-titanium-500 focus:border-ai-cyan-500 focus:outline-none text-sm"
                  />
                </div>

                <textarea
                  placeholder="Control description *"
                  value={controlForm.description || ''}
                  onChange={(e) => setControlForm({ ...controlForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-obsidian-900 border border-titanium-700 rounded-none text-titanium-50 placeholder-titanium-500 focus:border-ai-cyan-500 focus:outline-none text-sm"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={controlForm.status || 'compliant'}
                    onChange={(e) => setControlForm({ ...controlForm, status: e.target.value as any })}
                    className="px-3 py-2 bg-obsidian-900 border border-titanium-700 rounded-none text-titanium-50 focus:border-ai-cyan-500 focus:outline-none text-sm"
                  >
                    <option value="compliant">Compliant</option>
                    <option value="in-progress">In Progress</option>
                    <option value="non-compliant">Non-Compliant</option>
                    <option value="not-applicable">Not Applicable</option>
                  </select>

                  <select
                    value={controlForm.riskLevel || 'medium'}
                    onChange={(e) => setControlForm({ ...controlForm, riskLevel: e.target.value as any })}
                    className="px-3 py-2 bg-obsidian-900 border border-titanium-700 rounded-none text-titanium-50 focus:border-ai-cyan-500 focus:outline-none text-sm"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>

                  <button
                    onClick={addControl}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none transition-colors font-medium text-sm"
                  >
                    Add Control
                  </button>
                </div>
              </div>

              {/* Controls List */}
              {formData.controls.length > 0 && (
                <div className="space-y-2">
                  {formData.controls.map((control) => (
                    <div
                      key={control.id}
                      className="flex items-start justify-between p-3 bg-obsidian-950 border border-titanium-800 rounded-none hover:border-titanium-700 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm text-titanium-50 truncate">
                            {control.name}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-none bg-${
                              getStatusColor(control.status)
                            }-500/10 text-${getStatusColor(control.status)}-400 shrink-0`}
                          >
                            {control.status}
                          </span>
                        </div>
                        <p className="text-xs text-titanium-400 mb-1">{control.description}</p>
                        <div className="flex gap-3 text-xs text-titanium-500">
                          {control.category && <span>Category: {control.category}</span>}
                          <span className={`text-${getRiskColor(control.riskLevel)}-400`}>
                            Risk: {control.riskLevel}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => removeControl(control.id)}
                        className="p-2 text-titanium-400 hover:text-rose-400 hover:bg-rose-950/20 rounded-none transition-colors ml-3 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save/Cancel */}
            <div className="flex gap-3 pt-4 border-t border-titanium-800">
              <button
                onClick={handleCreateOrUpdate}
                className="flex-1 px-4 py-2.5 bg-ai-cyan-500 hover:bg-ai-cyan-600 text-obsidian-950 font-semibold rounded-none transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'Update Framework' : 'Create Framework'}
              </button>
              <button
                onClick={() => {
                  setShowNewForm(false);
                  resetForm();
                }}
                className="flex-1 px-4 py-2.5 border border-titanium-700 text-titanium-300 hover:text-titanium-50 rounded-none transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Frameworks List */}
        <div className="bg-obsidian-900 border border-titanium-800 rounded-none p-6">
          <h2 className="text-lg font-semibold text-titanium-50 mb-4">
            Your Frameworks ({frameworks.length})
          </h2>

          {loading ? (
            <p className="text-titanium-400 text-center py-8">Loading frameworks...</p>
          ) : error ? (
            <div className="flex items-start gap-2 p-4 bg-rose-950/30 border border-rose-500/30 rounded-none">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-300">{error}</p>
            </div>
          ) : frameworks.length === 0 ? (
            <p className="text-titanium-400 text-center py-8">
              No frameworks yet. Create one to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {frameworks.map((framework) => (
                <div
                  key={framework.id}
                  className="flex items-start justify-between p-4 bg-obsidian-950 border border-titanium-800 rounded-none hover:border-titanium-700 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm text-titanium-50 truncate">
                        {framework.name}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-none ${
                          framework.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : framework.status === 'draft'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-titanium-500/10 text-titanium-400'
                        } shrink-0`}
                      >
                        {framework.status}
                      </span>
                    </div>

                    <p className="text-xs text-titanium-400 mb-2">{framework.description}</p>

                    <div className="flex gap-4 text-xs text-titanium-500 mb-2">
                      <span>v{framework.version}</span>
                      <span>{framework.controls.length} controls</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {framework.updatedAt.toLocaleDateString('de-DE', {
                          month: 'short',
                          day: 'numeric',
                          year: '2-digit',
                        })}
                      </span>
                    </div>

                    {framework.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {framework.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block px-2 py-0.5 bg-titanium-800/30 border border-titanium-700/30 rounded-none text-xs text-titanium-400"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0 ml-3">
                    <button
                      onClick={() => editFramework(framework)}
                      className="px-3 py-2 bg-titanium-800 hover:bg-titanium-700 text-titanium-50 rounded-none transition-colors text-xs font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(framework.id)}
                      className="p-2 text-titanium-400 hover:text-rose-400 hover:bg-rose-950/20 rounded-none transition-colors"
                      title="Delete framework"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
