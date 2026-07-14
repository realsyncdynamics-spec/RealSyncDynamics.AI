import React, { useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { exportToCSV, exportToJSON, exportToPDF, generateSummary, type DashboardData } from './exportUtils';

interface ExportButtonProps {
  data: DashboardData[];
  isLoading?: boolean;
}

export function ExportButton({ data, isLoading = false }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!data || data.length === 0) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-500 rounded-lg cursor-not-allowed"
      >
        <Download size={16} />
        Exportieren
      </button>
    );
  }

  const handleExport = (format: 'csv' | 'json' | 'pdf') => {
    const filename = `seo-metrics-${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'txt' : format}`;

    switch (format) {
      case 'csv':
        exportToCSV(data, filename);
        break;
      case 'json':
        exportToJSON(data, filename);
        break;
      case 'pdf':
        exportToPDF(data, filename);
        break;
    }

    setIsOpen(false);
  };

  const summary = generateSummary(data);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download size={16} />
        Exportieren
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
          {/* Summary */}
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Export Summary</h3>
            <div className="space-y-1 text-xs text-slate-600">
              <p>📊 Datensätze: {data.length}</p>
              <p>💰 Ø CAC: €{summary.avgCac.toFixed(2)}</p>
              <p>📈 Ø LTV: €{summary.avgLtv.toFixed(2)}</p>
              <p>🎯 Ø Ratio: {summary.avgRatio.toFixed(2)}:1</p>
              <p>💵 Gesamt Revenue: €{summary.totalRevenue.toFixed(2)}</p>
            </div>
          </div>

          {/* Export Options */}
          <div className="p-2">
            <button
              onClick={() => handleExport('csv')}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded flex items-center gap-2"
            >
              <span className="text-lg">📋</span>
              <span className="text-sm text-slate-900">Export as CSV</span>
            </button>
            <button
              onClick={() => handleExport('json')}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded flex items-center gap-2"
            >
              <span className="text-lg">📄</span>
              <span className="text-sm text-slate-900">Export as JSON</span>
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded flex items-center gap-2"
            >
              <span className="text-lg">📑</span>
              <span className="text-sm text-slate-900">Export as Text</span>
            </button>
          </div>

          {/* Close button */}
          <div className="p-2 border-t border-slate-200">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full text-center text-xs text-slate-600 hover:text-slate-900 py-1"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
