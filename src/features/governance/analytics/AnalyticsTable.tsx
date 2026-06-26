import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { DbGovernanceKpiSnapshot } from './types';

interface AnalyticsTableProps {
  snapshots: DbGovernanceKpiSnapshot[];
}

type SortKey = keyof DbGovernanceKpiSnapshot;
type SortDirection = 'asc' | 'desc';

export function AnalyticsTable({ snapshots }: AnalyticsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('captured_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const sortedSnapshots = [...snapshots].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    return 0;
  });

  const totalPages = Math.ceil(sortedSnapshots.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const pageSnapshots = sortedSnapshots.slice(startIdx, endIdx);

  const SortHeader = ({ label, sortKey: key }: { label: string; sortKey: SortKey }) => (
    <button
      onClick={() => handleSort(key)}
      className="inline-flex items-center gap-1 font-medium text-titanium-300 hover:text-titanium-50 transition-colors"
    >
      {label}
      {sortKey === key && (
        sortDirection === 'asc' ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )
      )}
    </button>
  );

  return (
    <div className="bg-obsidian-800 border border-titanium-800 rounded overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-obsidian-900 border-b border-titanium-800">
            <tr>
              <th className="px-6 py-3 text-left">
                <SortHeader label="Date" sortKey="captured_date" />
              </th>
              <th className="px-6 py-3 text-right">
                <SortHeader label="Assets" sortKey="asset_count" />
              </th>
              <th className="px-6 py-3 text-right">
                <SortHeader label="Events" sortKey="event_count" />
              </th>
              <th className="px-6 py-3 text-right">
                <SortHeader label="Incidents" sortKey="incident_count" />
              </th>
              <th className="px-6 py-3 text-right">
                <SortHeader label="Critical" sortKey="critical_incident_count" />
              </th>
              <th className="px-6 py-3 text-right">
                <SortHeader label="Coverage %" sortKey="assets_with_evidence_percent" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-titanium-800">
            {pageSnapshots.map((snapshot) => (
              <tr
                key={snapshot.id}
                className="hover:bg-obsidian-700 transition-colors"
              >
                <td className="px-6 py-3 text-titanium-300">{snapshot.captured_date}</td>
                <td className="px-6 py-3 text-right text-titanium-300 font-mono">
                  {snapshot.asset_count.toLocaleString()}
                </td>
                <td className="px-6 py-3 text-right text-titanium-300 font-mono">
                  {snapshot.event_count.toLocaleString()}
                </td>
                <td className="px-6 py-3 text-right text-titanium-300 font-mono">
                  {snapshot.incident_count.toLocaleString()}
                </td>
                <td className="px-6 py-3 text-right">
                  {snapshot.critical_incident_count > 0 ? (
                    <span className="inline-block px-2 py-1 bg-red-900/30 text-red-200 rounded text-xs font-medium font-mono">
                      {snapshot.critical_incident_count}
                    </span>
                  ) : (
                    <span className="text-titanium-500 font-mono">0</span>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-obsidian-700 rounded overflow-hidden">
                      <div
                        className={`h-full rounded ${
                          snapshot.assets_with_evidence_percent >= 80
                            ? 'bg-green-600'
                            : snapshot.assets_with_evidence_percent >= 60
                              ? 'bg-yellow-600'
                              : 'bg-red-600'
                        }`}
                        style={{
                          width: `${snapshot.assets_with_evidence_percent}%`,
                        }}
                      />
                    </div>
                    <span className="text-titanium-300 font-mono text-right w-8">
                      {snapshot.assets_with_evidence_percent}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-obsidian-900 border-t border-titanium-800">
          <div className="text-sm text-titanium-400">
            Showing {startIdx + 1} to {Math.min(endIdx, sortedSnapshots.length)} of{' '}
            {sortedSnapshots.length} records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-obsidian-800 border border-titanium-700 rounded text-sm text-titanium-300 hover:bg-obsidian-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <div className="text-sm text-titanium-300">
              Page {currentPage} of {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-obsidian-800 border border-titanium-700 rounded text-sm text-titanium-300 hover:bg-obsidian-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
