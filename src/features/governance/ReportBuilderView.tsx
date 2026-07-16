import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Download, FileText, Eye, Calendar, CheckCircle2,
  AlertTriangle, Settings, Copy, Share2, Clock, ChevronRight,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { tierById } from '../../config/pricing';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

interface ReportConfig {
  title: string;
  frameworks: string[];
  includeSummary: boolean;
  includeControlDetails: boolean;
  includeFindings: boolean;
  includeRoadmap: boolean;
  dateRange: 'current' | 'last_30' | 'last_90' | 'last_year' | 'custom';
  customDateStart?: string;
  customDateEnd?: string;
  format: 'pdf' | 'excel' | 'both';
  branding: 'minimal' | 'standard' | 'custom';
  customLogo?: string;
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    recipients: string[];
    nextRun?: string;
  };
}

interface ReportPreview {
  title: string;
  generatedAt: string;
  frameworks: string[];
  complianceScores: Record<string, number>;
  controlsTotal: number;
  controlsImplemented: number;
  gapsOpen: number;
}

function _ReportBuilderView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const ReportBuilderView = withPerformanceMonitoring(
  _ReportBuilderView,
  'ReportBuilderView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const [step, setStep] = useState<'config' | 'preview' | 'schedule' | 'download'>('config');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ReportConfig>({
    title: 'Monthly Compliance Report',
    frameworks: ['iso27001', 'dsgvo', 'ai_act'],
    includeSummary: true,
    includeControlDetails: true,
    includeFindings: true,
    includeRoadmap: false,
    dateRange: 'current',
    format: 'pdf',
    branding: 'standard',
  });
  const [preview, setPreview] = useState<ReportPreview | null>(null);

  const handleConfigChange = (key: keyof ReportConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleGeneratePreview = async () => {
    setLoading(true);
    // Simulate preview generation
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setPreview({
      title: config.title,
      generatedAt: new Date().toISOString(),
      frameworks: config.frameworks,
      complianceScores: {
        iso27001: 78,
        dsgvo: 82,
        ai_act: 71,
        iso42001: 75,
        nis2: 88,
      },
      controlsTotal: 147,
      controlsImplemented: 98,
      gapsOpen: 12,
    });
    setStep('preview');
    setLoading(false);
  };

  const handleDownloadReport = async () => {
    setLoading(true);
    // Simulate report generation and download
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // In production, this would trigger report-generator edge function
    console.log('Report generated:', config);
    setStep('download');
    setLoading(false);
  };

  const frameworkOptions = [
    { id: 'iso27001', label: 'ISO 27001', color: 'text-blue-400' },
    { id: 'iso42001', label: 'ISO 42001', color: 'text-emerald-400' },
    { id: 'dsgvo', label: 'DSGVO', color: 'text-amber-400' },
    { id: 'ai_act', label: 'AI Act', color: 'text-violet-400' },
    { id: 'nis2', label: 'NIS2', color: 'text-cyan-400' },
  ];

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/governance/audit-reports" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="font-display font-bold text-sm text-titanium-50">Report Builder</div>
            <div className="text-[11px] text-titanium-400">Generate PDF/Excel compliance reports</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Step Indicator */}
        <div className="flex items-center justify-between">
          {['config', 'preview', 'schedule', 'download'].map((s, idx, arr) => (
            <React.Fragment key={s}>
              <button
                onClick={() => setStep(s as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-none font-semibold text-xs transition-colors ${
                  step === s
                    ? 'bg-cyan-600 text-white'
                    : 'bg-obsidian-900 text-titanium-400 hover:bg-obsidian-800'
                }`}
              >
                {s === 'config' && <Settings className="h-3 w-3" />}
                {s === 'preview' && <Eye className="h-3 w-3" />}
                {s === 'schedule' && <Calendar className="h-3 w-3" />}
                {s === 'download' && <Download className="h-3 w-3" />}
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
              {idx < arr.length - 1 && <ChevronRight className="h-4 w-4 text-titanium-700" />}
            </React.Fragment>
          ))}
        </div>

        {/* Configuration Step */}
        {step === 'config' && (
          <div className="space-y-6">
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
              <h2 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Report Configuration
              </h2>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-titanium-300 mb-2">Report Title</label>
                  <input
                    type="text"
                    value={config.title}
                    onChange={(e) => handleConfigChange('title', e.target.value)}
                    className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600"
                    placeholder="e.g., Monthly Compliance Report"
                  />
                </div>

                {/* Frameworks */}
                <div>
                  <label className="block text-xs font-semibold text-titanium-300 mb-2">Frameworks to Include</label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {frameworkOptions.map((fw) => (
                      <label
                        key={fw.id}
                        className="flex items-center gap-2 p-2 bg-obsidian-800 border border-titanium-800 rounded-none cursor-pointer hover:border-titanium-700 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={config.frameworks.includes(fw.id)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...config.frameworks, fw.id]
                              : config.frameworks.filter((f) => f !== fw.id);
                            handleConfigChange('frameworks', updated);
                          }}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <span className={`text-xs font-semibold ${fw.color}`}>{fw.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sections */}
                <div>
                  <label className="block text-xs font-semibold text-titanium-300 mb-2">Report Sections</label>
                  <div className="space-y-2">
                    {([
                      { key: 'includeSummary' as const, label: 'Executive Summary' },
                      { key: 'includeControlDetails' as const, label: 'Control Details' },
                      { key: 'includeFindings' as const, label: 'Findings & Gaps' },
                      { key: 'includeRoadmap' as const, label: 'Remediation Roadmap' },
                    ] as const).map((section) => (
                      <label key={section.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config[section.key as keyof ReportConfig] as boolean}
                          onChange={(e) => handleConfigChange(section.key as keyof ReportConfig, e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-xs text-titanium-300">{section.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-xs font-semibold text-titanium-300 mb-2">Date Range</label>
                  <select
                    value={config.dateRange}
                    onChange={(e) => handleConfigChange('dateRange', e.target.value)}
                    className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600"
                  >
                    <option value="current">Current Period</option>
                    <option value="last_30">Last 30 Days</option>
                    <option value="last_90">Last 90 Days</option>
                    <option value="last_year">Last Year</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                {/* Format */}
                <div>
                  <label className="block text-xs font-semibold text-titanium-300 mb-2">Export Format</label>
                  <div className="flex gap-3">
                    {[
                      { value: 'pdf', label: 'PDF', icon: FileText },
                      { value: 'excel', label: 'Excel', icon: FileText },
                      { value: 'both', label: 'Both', icon: Copy },
                    ].map((fmt) => (
                      <button
                        key={fmt.value}
                        onClick={() => handleConfigChange('format', fmt.value)}
                        className={`flex-1 px-3 py-2 rounded-none text-xs font-semibold transition-colors flex items-center justify-center gap-2 ${
                          config.format === fmt.value
                            ? 'bg-cyan-600 text-white'
                            : 'bg-obsidian-800 text-titanium-400 hover:bg-obsidian-700'
                        }`}
                      >
                        <fmt.icon className="h-3 w-3" />
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Branding */}
                <div>
                  <label className="block text-xs font-semibold text-titanium-300 mb-2">Branding</label>
                  <select
                    value={config.branding}
                    onChange={(e) => handleConfigChange('branding', e.target.value)}
                    className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600"
                  >
                    <option value="minimal">Minimal (Headers only)</option>
                    <option value="standard">Standard (Company branding)</option>
                    <option value="custom">Custom (Upload logo & colors)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGeneratePreview}
                disabled={loading}
                className="mt-6 w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-obsidian-800 text-white font-semibold rounded-none transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Preview...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Generate Preview
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && preview && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-900 to-cyan-900 border border-blue-800 rounded-none p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-1">{preview.title}</h1>
                  <p className="text-blue-200 text-sm">Generated {new Date(preview.generatedAt).toLocaleString()}</p>
                </div>
                <FileText className="h-12 w-12 text-cyan-300" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/10 backdrop-blur rounded-none border border-white/20 p-3">
                  <div className="text-xs text-blue-200">Total Controls</div>
                  <div className="text-2xl font-bold text-white">{preview.controlsTotal}</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-none border border-white/20 p-3">
                  <div className="text-xs text-blue-200">Implemented</div>
                  <div className="text-2xl font-bold text-green-300">{preview.controlsImplemented}</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-none border border-white/20 p-3">
                  <div className="text-xs text-blue-200">Open Gaps</div>
                  <div className="text-2xl font-bold text-amber-300">{preview.gapsOpen}</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-none border border-white/20 p-3">
                  <div className="text-xs text-blue-200">Avg Compliance</div>
                  <div className="text-2xl font-bold text-cyan-300">
                    {Math.round(Object.values(preview.complianceScores).reduce((a, b) => a + b) / Object.values(preview.complianceScores).length)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
              <h3 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Framework Scores
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(preview.complianceScores).map(([fw, score]) => (
                  <div key={fw} className="bg-obsidian-800 border border-titanium-800 rounded-none p-3 text-center">
                    <div className="text-xs font-semibold text-cyan-400 mb-1">{fw.toUpperCase()}</div>
                    <div className="text-2xl font-bold text-white">{score}%</div>
                    <div className="w-full h-1 bg-obsidian-700 mt-2">
                      <div className="h-full bg-cyan-600" style={{ width: `${score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('config')}
                className="flex-1 px-4 py-2 border border-titanium-700 hover:border-titanium-600 text-titanium-200 font-semibold rounded-none transition-colors"
              >
                Back to Config
              </button>
              <button
                onClick={() => setStep('schedule')}
                className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-none transition-colors flex items-center justify-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Schedule Report
              </button>
              <button
                onClick={handleDownloadReport}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-obsidian-800 text-white font-semibold rounded-none transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download Now
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Schedule Step */}
        {step === 'schedule' && (
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
            <h2 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule Report Generation
            </h2>

            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4" defaultChecked={config.schedule?.enabled} />
                <span className="text-sm text-titanium-300">Enable Scheduled Reporting</span>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-titanium-300 mb-2">Frequency</label>
                  <select className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-titanium-300 mb-2">Day of Week / Month</label>
                  <select className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none">
                    <option>Monday</option>
                    <option>Friday</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-titanium-300 mb-2">Recipients (Email)</label>
                <input
                  type="text"
                  placeholder="compliance@company.com, ciso@company.com"
                  className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none"
                />
              </div>

              <div className="bg-obsidian-800 border border-titanium-800 rounded-none p-3">
                <div className="flex items-center gap-2 text-xs text-titanium-300">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  Next run scheduled for: <span className="font-semibold text-white">Friday, July 12 at 9:00 AM</span>
                </div>
              </div>

              <button className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-none transition-colors">
                Save Schedule
              </button>
            </div>
          </div>
        )}

        {/* Download Step */}
        {step === 'download' && (
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Report Generated Successfully!</h2>
            <p className="text-titanium-400 mb-6">Your compliance report is ready for download.</p>

            <div className="bg-obsidian-800 border border-titanium-800 rounded-none p-4 mb-6 text-left">
              <p className="text-sm text-titanium-300 mb-2">
                <span className="font-semibold">File:</span> Monthly_Compliance_Report_July_2026.pdf
              </p>
              <p className="text-sm text-titanium-300">
                <span className="font-semibold">Size:</span> 2.4 MB
              </p>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 px-4 py-2 border border-titanium-700 hover:border-titanium-600 text-titanium-200 font-semibold rounded-none transition-colors flex items-center justify-center gap-2">
                <Share2 className="h-4 w-4" />
                Share
              </button>
              <button className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-none transition-colors flex items-center justify-center gap-2">
                <Download className="h-4 w-4" />
                Download Report
              </button>
            </div>

            <button
              onClick={() => setStep('config')}
              className="w-full mt-4 px-4 py-2 border border-titanium-700 hover:border-titanium-600 text-titanium-300 font-semibold rounded-none transition-colors"
            >
              Generate Another Report
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
