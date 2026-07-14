import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Copy, Save, X, AlertCircle, CheckCircle2,
  ChevronDown, Zap, Settings, Grid3x3, BookOpen,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';

interface FrameworkBase {
  id: string;
  name: string;
  description: string;
  controlCount: number;
}

interface CustomControl {
  id: string;
  name: string;
  description: string;
  criteria: string[];
  maturityLevels: Array<{
    level: number;
    description: string;
  }>;
  evidenceRequired: string[];
}

interface CustomFramework {
  id?: string;
  name: string;
  description: string;
  basedOn?: string; // 'iso27001', 'iso42001', 'custom', etc.
  controls: CustomControl[];
  mappedFrameworks: string[]; // AI Act, DSGVO, NIS2, etc.
  version: string;
  isPublished: boolean;
}

export function CustomFrameworkBuilder() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [step, setStep] = useState<'select-base' | 'configure' | 'controls' | 'review'>('select-base');
  const [framework, setFramework] = useState<CustomFramework>({
    name: '',
    description: '',
    controls: [],
    mappedFrameworks: [],
    version: '1.0.0',
    isPublished: false,
  });
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [newControl, setNewControl] = useState<CustomControl | null>(null);

  const basesAvailable: FrameworkBase[] = [
    { id: 'iso27001', name: 'ISO 27001', description: 'Information Security Management', controlCount: 100 },
    { id: 'iso42001', name: 'ISO 42001', description: 'AI Management System', controlCount: 22 },
    { id: 'nist', name: 'NIST Cybersecurity', description: 'NIST CSF', controlCount: 78 },
    { id: 'cis', name: 'CIS Controls', description: 'Critical Security Controls', controlCount: 18 },
    { id: 'blank', name: 'Blank', description: 'Start from scratch', controlCount: 0 },
  ];

  const frameworkOptions = [
    { id: 'ai_act', label: 'AI Act', color: 'text-violet-400' },
    { id: 'dsgvo', label: 'DSGVO', color: 'text-amber-400' },
    { id: 'nis2', label: 'NIS2', color: 'text-cyan-400' },
    { id: 'hipaa', label: 'HIPAA', color: 'text-emerald-400' },
  ];

  const handleSelectBase = (baseId: string) => {
    setSelectedBase(baseId);
    setFramework((prev) => ({
      ...prev,
      basedOn: baseId,
      name: baseId === 'blank' ? 'Custom Framework' : `${basesAvailable.find((b) => b.id === baseId)?.name} Customized`,
    }));
    setStep('configure');
  };

  const handleAddControl = () => {
    if (newControl && newControl.name) {
      setFramework((prev) => ({
        ...prev,
        controls: [...prev.controls, { ...newControl, id: `ctrl-${Date.now()}` }],
      }));
      setNewControl(null);
    }
  };

  const handleRemoveControl = (controlId: string) => {
    setFramework((prev) => ({
      ...prev,
      controls: prev.controls.filter((c) => c.id !== controlId),
    }));
  };

  const handlePublish = async () => {
    // In production, would save to database
    console.log('Publishing framework:', framework);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/governance/custom-frameworks" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="font-display font-bold text-sm text-titanium-50">Custom Framework Builder</div>
            <div className="text-[11px] text-titanium-400">Create tailored compliance frameworks</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8">
          {[
            { step: 'select-base', label: 'Select Base', icon: BookOpen },
            { step: 'configure', label: 'Configure', icon: Settings },
            { step: 'controls', label: 'Controls', icon: Grid3x3 },
            { step: 'review', label: 'Review', icon: CheckCircle2 },
          ].map((s, idx, arr) => {
            const Icon = s.icon;
            const isActive = step === s.step;
            const isComplete = arr.findIndex((x) => x.step === s.step) < arr.findIndex((x) => x.step === step);

            return (
              <React.Fragment key={s.step}>
                <button
                  onClick={() => setStep(s.step as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-none font-semibold text-xs transition-colors ${
                    isActive
                      ? 'bg-cyan-600 text-white'
                      : isComplete
                        ? 'bg-green-900 text-green-200'
                        : 'bg-obsidian-900 text-titanium-400 hover:bg-obsidian-800'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {s.label}
                </button>
                {idx < arr.length - 1 && <ChevronDown className="h-4 w-4 text-titanium-700 rotate-[-90deg]" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step: Select Base */}
        {step === 'select-base' && (
          <div className="space-y-6">
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
              <h2 className="font-semibold text-titanium-50 mb-4">Choose Framework Base</h2>
              <p className="text-sm text-titanium-400 mb-6">
                Start with an existing framework or create from scratch. You can customize any controls.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {basesAvailable.map((base) => (
                  <button
                    key={base.id}
                    onClick={() => handleSelectBase(base.id)}
                    className={`p-4 rounded-none border-2 text-left transition-colors ${
                      selectedBase === base.id
                        ? 'border-cyan-600 bg-cyan-900/20'
                        : 'border-titanium-800 bg-obsidian-800 hover:border-titanium-700'
                    }`}
                  >
                    <h3 className="font-semibold text-titanium-50 mb-1">{base.name}</h3>
                    <p className="text-xs text-titanium-400 mb-2">{base.description}</p>
                    <div className="text-[10px] font-mono text-titanium-500">{base.controlCount} controls</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step: Configure */}
        {step === 'configure' && (
          <div className="space-y-6">
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
              <h2 className="font-semibold text-titanium-50 mb-4">Framework Details</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-titanium-300 mb-2">Framework Name</label>
                  <input
                    type="text"
                    value={framework.name}
                    onChange={(e) => setFramework((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600"
                    placeholder="e.g., Our Custom ISO 27001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-titanium-300 mb-2">Description</label>
                  <textarea
                    value={framework.description}
                    onChange={(e) => setFramework((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600 resize-none"
                    rows={3}
                    placeholder="Describe the purpose and scope of this framework"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-titanium-300 mb-2">Version</label>
                  <input
                    type="text"
                    value={framework.version}
                    onChange={(e) => setFramework((prev) => ({ ...prev, version: e.target.value }))}
                    className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600"
                    placeholder="1.0.0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-titanium-300 mb-2">Map to External Frameworks</label>
                  <div className="grid grid-cols-2 gap-3">
                    {frameworkOptions.map((fw) => (
                      <label key={fw.id} className="flex items-center gap-2 p-2 bg-obsidian-800 border border-titanium-800 rounded-none cursor-pointer hover:border-titanium-700">
                        <input
                          type="checkbox"
                          checked={framework.mappedFrameworks.includes(fw.id)}
                          onChange={(e) => {
                            setFramework((prev) => ({
                              ...prev,
                              mappedFrameworks: e.target.checked
                                ? [...prev.mappedFrameworks, fw.id]
                                : prev.mappedFrameworks.filter((f) => f !== fw.id),
                            }));
                          }}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <span className={`text-xs font-semibold ${fw.color}`}>{fw.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep('select-base')}
                  className="px-4 py-2 border border-titanium-700 hover:border-titanium-600 text-titanium-200 font-semibold rounded-none transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('controls')}
                  className="ml-auto px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-none transition-colors"
                >
                  Next: Add Controls
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Controls */}
        {step === 'controls' && (
          <div className="space-y-6">
            {/* Add Control Form */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
              <h2 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Custom Control
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-titanium-300 mb-2">Control Name</label>
                  <input
                    type="text"
                    value={newControl?.name || ''}
                    onChange={(e) => setNewControl((prev) => {
                      if (!prev) {
                        return { id: '', name: e.target.value, description: '', criteria: [], maturityLevels: [], evidenceRequired: [] };
                      }
                      return { ...prev, name: e.target.value };
                    })}
                    className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600"
                    placeholder="e.g., Multi-Factor Authentication"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-titanium-300 mb-2">Description</label>
                  <textarea
                    value={newControl?.description || ''}
                    onChange={(e) => setNewControl((prev) => {
                      if (!prev) {
                        return { id: '', name: '', description: e.target.value, criteria: [], maturityLevels: [], evidenceRequired: [] };
                      }
                      return { ...prev, description: e.target.value };
                    })}
                    className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600 resize-none"
                    rows={2}
                    placeholder="Control objective and scope"
                  />
                </div>

                <button
                  onClick={handleAddControl}
                  className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-none transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Control
                </button>
              </div>
            </div>

            {/* Controls List */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
              <h3 className="font-semibold text-titanium-50 mb-4">
                Framework Controls ({framework.controls.length})
              </h3>

              {framework.controls.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-8 w-8 text-titanium-600 mx-auto mb-2" />
                  <p className="text-titanium-400 text-sm">No controls added yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {framework.controls.map((control) => (
                    <div key={control.id} className="bg-obsidian-800 border border-titanium-800 rounded-none p-4 flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-titanium-50 text-sm">{control.name}</h4>
                        <p className="text-xs text-titanium-400 mt-1">{control.description}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveControl(control.id)}
                        className="p-1.5 hover:bg-red-900/30 text-red-400 rounded-none transition-colors shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('configure')}
                className="px-4 py-2 border border-titanium-700 hover:border-titanium-600 text-titanium-200 font-semibold rounded-none transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep('review')}
                className="ml-auto px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-none transition-colors"
              >
                Review & Publish
              </button>
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-900 to-cyan-900 border border-blue-800 rounded-none p-6">
              <h2 className="text-2xl font-bold text-white mb-2">{framework.name}</h2>
              <p className="text-blue-200 mb-4">{framework.description}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/10 backdrop-blur rounded-none border border-white/20 p-3">
                  <div className="text-xs text-blue-200 mb-1">Version</div>
                  <div className="text-lg font-bold text-white">{framework.version}</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-none border border-white/20 p-3">
                  <div className="text-xs text-blue-200 mb-1">Controls</div>
                  <div className="text-lg font-bold text-white">{framework.controls.length}</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-none border border-white/20 p-3">
                  <div className="text-xs text-blue-200 mb-1">Based On</div>
                  <div className="text-lg font-bold text-white">{framework.basedOn?.toUpperCase() || 'Custom'}</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-none border border-white/20 p-3">
                  <div className="text-xs text-blue-200 mb-1">Mapped Frameworks</div>
                  <div className="text-lg font-bold text-white">{framework.mappedFrameworks.length}</div>
                </div>
              </div>
            </div>

            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
              <h3 className="font-semibold text-titanium-50 mb-4">Controls Summary</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {framework.controls.map((control, idx) => (
                  <div key={control.id} className="text-sm text-titanium-300 flex items-start gap-2">
                    <span className="text-cyan-400 font-mono text-xs mt-0.5">{idx + 1}.</span>
                    <span>{control.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('controls')}
                className="px-4 py-2 border border-titanium-700 hover:border-titanium-600 text-titanium-200 font-semibold rounded-none transition-colors"
              >
                Back
              </button>
              <button
                onClick={handlePublish}
                className="ml-auto px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-none transition-colors flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Publish Framework
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
