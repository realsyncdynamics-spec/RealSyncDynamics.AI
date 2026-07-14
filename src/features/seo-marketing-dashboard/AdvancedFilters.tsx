import React, { useState } from 'react';
import { ChevronDown, X, Filter } from 'lucide-react';

interface FilterState {
  dateRange: 'week' | 'month' | '3months' | '6months' | 'custom';
  customStart?: string;
  customEnd?: string;
  minCAC?: number;
  maxCAC?: number;
  minLTV?: number;
  maxLTV?: number;
  minRatio?: number;
  metrics: ('cac' | 'ltv' | 'conversion' | 'churn' | 'cmrr')[];
  sortBy: 'date' | 'cac' | 'ltv' | 'ratio';
  sortOrder: 'asc' | 'desc';
}

interface AdvancedFiltersProps {
  onFilterChange: (filters: FilterState) => void;
  onReset: () => void;
}

export function AdvancedFilters({ onFilterChange, onReset }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: '6months',
    metrics: ['cac', 'ltv', 'conversion'],
    sortBy: 'date',
    sortOrder: 'desc',
  });

  const handleFilterChange = (updates: Partial<FilterState>) => {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const getDateRangeLabel = () => {
    const labels = {
      week: 'Diese Woche',
      month: 'Diesen Monat',
      '3months': 'Letzte 3 Monate',
      '6months': 'Letzte 6 Monate',
      custom: 'Benutzerdefinierten Bereich',
    };
    return labels[filters.dateRange];
  };

  const activeFiltersCount = Object.values(filters).filter((v) => {
    if (typeof v === 'number' && v !== 0) return true;
    if (Array.isArray(v) && v.length < 5) return true;
    return false;
  }).length;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-slate-700 font-semibold hover:text-slate-900"
        >
          <Filter size={18} />
          Erweiterte Filter
          {activeFiltersCount > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
              {activeFiltersCount} aktiv
            </span>
          )}
          <ChevronDown
            size={18}
            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {activeFiltersCount > 0 && (
          <button
            onClick={() => {
              setFilters({
                dateRange: '6months',
                metrics: ['cac', 'ltv', 'conversion'],
                sortBy: 'date',
                sortOrder: 'desc',
              });
              onReset();
            }}
            className="text-sm text-slate-600 hover:text-slate-900 underline"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Zeitraum
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) =>
                handleFilterChange({ dateRange: e.target.value as any })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
            >
              <option value="week">Diese Woche</option>
              <option value="month">Diesen Monat</option>
              <option value="3months">Letzte 3 Monate</option>
              <option value="6months">Letzte 6 Monate</option>
              <option value="custom">Benutzerdefinierten Bereich</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {filters.dateRange === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Von
                </label>
                <input
                  type="date"
                  value={filters.customStart || ''}
                  onChange={(e) =>
                    handleFilterChange({ customStart: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Bis
                </label>
                <input
                  type="date"
                  value={filters.customEnd || ''}
                  onChange={(e) =>
                    handleFilterChange({ customEnd: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </>
          )}

          {/* CAC Range */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              CAC Min (€)
            </label>
            <input
              type="number"
              value={filters.minCAC || ''}
              onChange={(e) =>
                handleFilterChange({ minCAC: e.target.value ? parseFloat(e.target.value) : undefined })
              }
              placeholder="z.B. 100"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              CAC Max (€)
            </label>
            <input
              type="number"
              value={filters.maxCAC || ''}
              onChange={(e) =>
                handleFilterChange({ maxCAC: e.target.value ? parseFloat(e.target.value) : undefined })
              }
              placeholder="z.B. 1000"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          {/* LTV Range */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              LTV Min (€)
            </label>
            <input
              type="number"
              value={filters.minLTV || ''}
              onChange={(e) =>
                handleFilterChange({ minLTV: e.target.value ? parseFloat(e.target.value) : undefined })
              }
              placeholder="z.B. 500"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              LTV Max (€)
            </label>
            <input
              type="number"
              value={filters.maxLTV || ''}
              onChange={(e) =>
                handleFilterChange({ maxLTV: e.target.value ? parseFloat(e.target.value) : undefined })
              }
              placeholder="z.B. 10000"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          {/* Min Ratio */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Min LTV:CAC Ratio
            </label>
            <input
              type="number"
              value={filters.minRatio || ''}
              onChange={(e) =>
                handleFilterChange({ minRatio: e.target.value ? parseFloat(e.target.value) : undefined })
              }
              placeholder="z.B. 3"
              step="0.1"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          {/* Metrics Selection */}
          <div className="md:col-span-2 lg:col-span-4">
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Anzuzeigende Metriken
            </label>
            <div className="flex flex-wrap gap-2">
              {['cac', 'ltv', 'conversion', 'churn', 'cmrr'].map((metric) => (
                <label key={metric} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.metrics.includes(metric as any)}
                    onChange={(e) => {
                      const newMetrics = e.target.checked
                        ? [...filters.metrics, metric as any]
                        : filters.metrics.filter((m) => m !== metric);
                      handleFilterChange({ metrics: newMetrics });
                    }}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700 capitalize">{metric}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sorting */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Sortieren nach
            </label>
            <select
              value={filters.sortBy}
              onChange={(e) =>
                handleFilterChange({ sortBy: e.target.value as any })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
            >
              <option value="date">Datum</option>
              <option value="cac">CAC</option>
              <option value="ltv">LTV</option>
              <option value="ratio">LTV:CAC Ratio</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Reihenfolge
            </label>
            <select
              value={filters.sortOrder}
              onChange={(e) =>
                handleFilterChange({ sortOrder: e.target.value as any })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
            >
              <option value="asc">Aufsteigend</option>
              <option value="desc">Absteigend</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
