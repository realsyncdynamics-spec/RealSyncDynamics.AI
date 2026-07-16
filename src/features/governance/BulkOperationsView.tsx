import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, Download, FileText, CheckCircle2, AlertCircle,
  Clock, Trash2, RotateCcw, Play, Pause, ChevronDown,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

interface BulkJob {
  id: string;
  type: 'import_gaps' | 'import_evidence' | 'bulk_update' | 'bulk_assign';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  filename: string;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  createdAt: string;
  completedAt?: string;
  errorLog?: string;
}

function _BulkOperationsView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const BulkOperationsView = withPerformanceMonitoring(
  _BulkOperationsView,
  'BulkOperationsView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const [view, setView] = useState<'upload' | 'history'>('upload');
  const [selectedJobType, setSelectedJobType] = useState<string>('import_gaps');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const [jobs, setJobs] = useState<BulkJob[]>([
    {
      id: 'job-001',
      type: 'import_gaps',
      status: 'completed',
      filename: 'q2-vulnerability-scan.csv',
      totalRows: 248,
      processedRows: 248,
      failedRows: 0,
      createdAt: '2026-07-04T10:30:00Z',
      completedAt: '2026-07-04T10:35:00Z',
    },
    {
      id: 'job-002',
      type: 'import_evidence',
      status: 'completed',
      filename: 'iso27001-evidence-batch.zip',
      totalRows: 156,
      processedRows: 156,
      failedRows: 0,
      createdAt: '2026-07-03T14:15:00Z',
      completedAt: '2026-07-03T14:22:00Z',
    },
    {
      id: 'job-003',
      type: 'bulk_update',
      status: 'processing',
      filename: 'control-status-updates.csv',
      totalRows: 84,
      processedRows: 52,
      failedRows: 2,
      createdAt: '2026-07-05T09:00:00Z',
    },
  ]);

  const jobTypes = [
    { id: 'import_gaps', label: 'Import Gaps (CSV)', description: 'Upload vulnerability/gap data from CSV' },
    { id: 'import_evidence', label: 'Import Evidence (ZIP)', description: 'Bulk upload evidence files in ZIP' },
    { id: 'bulk_update', label: 'Bulk Update Status', description: 'Update control/gap status in bulk' },
    { id: 'bulk_assign', label: 'Assign to Plans', description: 'Bulk assign gaps to remediation plans' },
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartJob = () => {
    if (selectedFile) {
      const newJob: BulkJob = {
        id: `job-${Date.now()}`,
        type: selectedJobType as any,
        status: 'processing',
        filename: selectedFile.name,
        totalRows: Math.floor(Math.random() * 300) + 50,
        processedRows: 0,
        failedRows: 0,
        createdAt: new Date().toISOString(),
      };
      setJobs([newJob, ...jobs]);
      setSelectedFile(null);
      setView('history');
    }
  };

  const handlePauseJob = (jobId: string) => {
    setJobs(jobs.map(j => j.id === jobId ? { ...j, status: 'paused' } : j));
  };

  const handleResumeJob = (jobId: string) => {
    setJobs(jobs.map(j => j.id === jobId ? { ...j, status: 'processing' } : j));
  };

  const handleRetryJob = (jobId: string) => {
    setJobs(jobs.map(j => j.id === jobId ? { ...j, status: 'processing', processedRows: 0, failedRows: 0 } : j));
  };

  const handleDeleteJob = (jobId: string) => {
    setJobs(jobs.filter(j => j.id !== jobId));
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-emerald-900 text-emerald-200';
      case 'processing': return 'bg-blue-900 text-blue-200';
      case 'paused': return 'bg-amber-900 text-amber-200';
      case 'failed': return 'bg-red-900 text-red-200';
      case 'pending': return 'bg-titanium-900 text-titanium-300';
      default: return 'bg-obsidian-800 text-titanium-400';
    }
  };

  const getProgressPercent = (job: BulkJob): number => {
    if (job.totalRows === 0) return 0;
    return Math.round((job.processedRows / job.totalRows) * 100);
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="font-display font-bold text-sm text-titanium-50">Bulk Operations</div>
            <div className="text-[11px] text-titanium-400">Import and batch update governance data</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* View Tabs */}
        <div className="flex gap-3 border-b border-titanium-900 pb-4">
          <button
            onClick={() => setView('upload')}
            className={`px-4 py-2 font-semibold text-xs rounded-none transition-colors ${
              view === 'upload'
                ? 'bg-cyan-600 text-white'
                : 'text-titanium-400 hover:text-titanium-200'
            }`}
          >
            New Upload
          </button>
          <button
            onClick={() => setView('history')}
            className={`px-4 py-2 font-semibold text-xs rounded-none transition-colors ${
              view === 'history'
                ? 'bg-cyan-600 text-white'
                : 'text-titanium-400 hover:text-titanium-200'
            }`}
          >
            Job History
          </button>
        </div>

        {/* Upload View */}
        {view === 'upload' && (
          <div className="space-y-6">
            {/* Job Type Selection */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
              <h2 className="font-semibold text-titanium-50 mb-4">Select Operation Type</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobTypes.map((jt) => (
                  <button
                    key={jt.id}
                    onClick={() => setSelectedJobType(jt.id)}
                    className={`p-4 rounded-none border-2 text-left transition-colors ${
                      selectedJobType === jt.id
                        ? 'border-cyan-600 bg-cyan-900/20'
                        : 'border-titanium-800 bg-obsidian-800 hover:border-titanium-700'
                    }`}
                  >
                    <h3 className="font-semibold text-titanium-50 mb-1">{jt.label}</h3>
                    <p className="text-xs text-titanium-400">{jt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* File Upload */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
              <h2 className="font-semibold text-titanium-50 mb-4">Upload File</h2>

              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-none p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-cyan-600 bg-cyan-900/10'
                    : 'border-titanium-800 bg-obsidian-800'
                }`}
              >
                <Upload className="h-8 w-8 mx-auto mb-3 text-titanium-500" />
                <p className="text-sm text-titanium-300 mb-1">
                  Drag and drop your file here, or click to select
                </p>
                <p className="text-xs text-titanium-500 mb-4">
                  Supported: CSV, JSON, ZIP (max 100MB)
                </p>
                <input
                  type="file"
                  onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-none cursor-pointer inline-block">
                  Choose File
                </label>
              </div>

              {selectedFile && (
                <div className="mt-4 bg-obsidian-800 border border-titanium-800 rounded-none p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-cyan-400" />
                    <div>
                      <div className="text-sm font-semibold text-titanium-200">{selectedFile.name}</div>
                      <div className="text-xs text-titanium-500">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Options */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
              <h2 className="font-semibold text-titanium-50 mb-4">Import Options</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-2 bg-obsidian-800 border border-titanium-800 rounded-none cursor-pointer hover:border-titanium-700">
                  <input type="checkbox" defaultChecked className="w-4 h-4" />
                  <span className="text-sm text-titanium-300">Validate before import</span>
                </label>
                <label className="flex items-center gap-3 p-2 bg-obsidian-800 border border-titanium-800 rounded-none cursor-pointer hover:border-titanium-700">
                  <input type="checkbox" className="w-4 h-4" />
                  <span className="text-sm text-titanium-300">Auto-assign to remediation plans</span>
                </label>
                <label className="flex items-center gap-3 p-2 bg-obsidian-800 border border-titanium-800 rounded-none cursor-pointer hover:border-titanium-700">
                  <input type="checkbox" defaultChecked className="w-4 h-4" />
                  <span className="text-sm text-titanium-300">Rollback on validation failure</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedFile(null)}
                className="px-4 py-2 border border-titanium-700 hover:border-titanium-600 text-titanium-200 font-semibold rounded-none transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartJob}
                disabled={!selectedFile}
                className="ml-auto px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-titanium-700 disabled:opacity-50 text-white font-semibold rounded-none transition-colors flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Start Import
              </button>
            </div>
          </div>
        )}

        {/* History View */}
        {view === 'history' && (
          <div className="space-y-4">
            {jobs.length === 0 ? (
              <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 text-center">
                <AlertCircle className="h-8 w-8 text-titanium-600 mx-auto mb-3" />
                <p className="text-titanium-400">No import jobs yet</p>
              </div>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="bg-obsidian-900 border border-titanium-900 rounded-none">
                  <button
                    onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                    className="w-full px-4 py-4 flex items-start justify-between hover:bg-obsidian-800/50 transition-colors"
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="h-4 w-4 text-titanium-500" />
                        <h3 className="font-semibold text-titanium-50">{job.filename}</h3>
                        <span className={`text-xs px-2 py-1 rounded-none font-semibold ${getStatusColor(job.status)}`}>
                          {job.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-titanium-500">
                        <span>{job.totalRows} rows</span>
                        <span>{getProgressPercent(job)}% complete</span>
                        <span>{new Date(job.createdAt).toLocaleString()}</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3 w-full bg-obsidian-800 rounded-none h-2">
                        <div
                          className="bg-gradient-to-r from-cyan-600 to-cyan-500 h-2 rounded-none transition-all"
                          style={{ width: `${getProgressPercent(job)}%` }}
                        />
                      </div>

                      {job.failedRows > 0 && (
                        <div className="mt-2 text-xs text-red-400">
                          {job.failedRows} rows failed
                        </div>
                      )}
                    </div>

                    <ChevronDown
                      className={`h-4 w-4 text-titanium-500 mt-1 transition-transform shrink-0 ${
                        expandedJob === job.id ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {expandedJob === job.id && (
                    <div className="px-4 py-4 bg-obsidian-950/50 border-t border-titanium-800 space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="bg-obsidian-800 rounded-none p-3 border border-titanium-800">
                          <div className="text-[11px] font-semibold text-titanium-400 mb-1">Total Rows</div>
                          <div className="text-lg font-bold text-titanium-200">{job.totalRows}</div>
                        </div>
                        <div className="bg-emerald-900/20 rounded-none p-3 border border-emerald-800">
                          <div className="text-[11px] font-semibold text-emerald-400 mb-1">Processed</div>
                          <div className="text-lg font-bold text-emerald-300">{job.processedRows}</div>
                        </div>
                        <div className="bg-red-900/20 rounded-none p-3 border border-red-800">
                          <div className="text-[11px] font-semibold text-red-400 mb-1">Failed</div>
                          <div className="text-lg font-bold text-red-300">{job.failedRows}</div>
                        </div>
                      </div>

                      {job.errorLog && (
                        <div className="bg-red-900/10 border border-red-800 rounded-none p-3">
                          <div className="text-xs font-mono text-red-400">{job.errorLog}</div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {job.status === 'processing' && (
                          <button
                            onClick={() => handlePauseJob(job.id)}
                            className="px-3 py-2 bg-amber-900/30 border border-amber-700 hover:bg-amber-900/50 text-amber-300 text-xs font-semibold rounded-none transition-colors flex items-center gap-2"
                          >
                            <Pause className="h-3 w-3" />
                            Pause
                          </button>
                        )}
                        {job.status === 'paused' && (
                          <button
                            onClick={() => handleResumeJob(job.id)}
                            className="px-3 py-2 bg-blue-900/30 border border-blue-700 hover:bg-blue-900/50 text-blue-300 text-xs font-semibold rounded-none transition-colors flex items-center gap-2"
                          >
                            <Play className="h-3 w-3" />
                            Resume
                          </button>
                        )}
                        {job.status === 'failed' && (
                          <button
                            onClick={() => handleRetryJob(job.id)}
                            className="px-3 py-2 bg-blue-900/30 border border-blue-700 hover:bg-blue-900/50 text-blue-300 text-xs font-semibold rounded-none transition-colors flex items-center gap-2"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Retry
                          </button>
                        )}
                        {job.completedAt && (
                          <button className="px-3 py-2 border border-titanium-700 hover:border-titanium-600 text-titanium-300 text-xs font-semibold rounded-none transition-colors flex items-center gap-2">
                            <Download className="h-3 w-3" />
                            Export Results
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          className="ml-auto px-3 py-2 border border-red-700/50 hover:border-red-600 text-red-400 text-xs font-semibold rounded-none transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
