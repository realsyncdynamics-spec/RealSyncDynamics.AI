import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { DATE_RANGE_PRESETS, ASSET_TYPES, SEVERITY_LEVELS } from './types';
import type { FilterState } from './types';

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function FilterPanel({ filters, onFiltersChange }: FilterPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleDateRangePreset = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    onFiltersChange({
      ...filters,
      dateRange: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      },
    });
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [type]: value,
      },
    });
  };

  const toggleAssetType = (type: string) => {
    const updated = filters.assetTypes.includes(type)
      ? filters.assetTypes.filter((t) => t !== type)
      : [...filters.assetTypes, type];
    onFiltersChange({ ...filters, assetTypes: updated });
  };

  const toggleSeverity = (level: string) => {
    const updated = filters.severityLevels.includes(level)
      ? filters.severityLevels.filter((l) => l !== level)
      : [...filters.severityLevels, level];
    onFiltersChange({ ...filters, severityLevels: updated });
  };

  const resetFilters = () => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    onFiltersChange({
      dateRange: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      },
      workspaceIds: [],
      assetTypes: [],
      severityLevels: [],
    });
  };

  return (
    <div className="bg-obsidian-800 border border-titanium-800 rounded p-4 space-y-4">
      {/* Date Range Presets */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-titanium-300">Date Range:</span>
        {DATE_RANGE_PRESETS.map((preset) => (
          <button
            key={preset.days}
            onClick={() => handleDateRangePreset(preset.days)}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${
              Math.ceil(
                (new Date(filters.dateRange.end).getTime() -
                  new Date(filters.dateRange.start).getTime()) /
                  (1000 * 60 * 60 * 24)
              ) === preset.days
                ? 'bg-titanium-700 text-obsidian-950'
                : 'bg-obsidian-700 text-titanium-400 hover:bg-obsidian-600'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-titanium-300">Custom:</label>
        <input
          type="date"
          value={filters.dateRange.start}
          onChange={(e) => handleDateChange('start', e.target.value)}
          className="px-3 py-1.5 bg-obsidian-700 border border-titanium-700 rounded text-sm text-titanium-50 placeholder-titanium-500 focus:outline-none focus:border-titanium-500"
        />
        <span className="text-titanium-500">—</span>
        <input
          type="date"
          value={filters.dateRange.end}
          onChange={(e) => handleDateChange('end', e.target.value)}
          className="px-3 py-1.5 bg-obsidian-700 border border-titanium-700 rounded text-sm text-titanium-50 placeholder-titanium-500 focus:outline-none focus:border-titanium-500"
        />
      </div>

      {/* Advanced Filters Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-sm font-medium text-titanium-400 hover:text-titanium-300 transition-colors"
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        Advanced Filters
      </button>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="pt-4 space-y-4 border-t border-titanium-700">
          {/* Asset Type Filter */}
          <div>
            <label className="text-sm font-medium text-titanium-300 block mb-2">Asset Types</label>
            <div className="flex flex-wrap gap-2">
              {ASSET_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleAssetType(type)}
                  className={`px-3 py-1.5 text-sm rounded transition-all ${
                    filters.assetTypes.includes(type)
                      ? 'bg-titanium-700 text-obsidian-950'
                      : 'bg-obsidian-700 text-titanium-400 hover:bg-obsidian-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Severity Level Filter */}
          <div>
            <label className="text-sm font-medium text-titanium-300 block mb-2">Severity Levels</label>
            <div className="flex flex-wrap gap-2">
              {SEVERITY_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => toggleSeverity(level)}
                  className={`px-3 py-1.5 text-sm rounded transition-all ${
                    filters.severityLevels.includes(level)
                      ? 'bg-titanium-700 text-obsidian-950'
                      : 'bg-obsidian-700 text-titanium-400 hover:bg-obsidian-600'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reset Button */}
      <div className="flex justify-end">
        <button
          onClick={resetFilters}
          className="flex items-center gap-1 text-sm font-medium text-titanium-500 hover:text-titanium-300 transition-colors"
        >
          <X className="w-4 h-4" />
          Reset Filters
        </button>
      </div>
    </div>
  );
}
