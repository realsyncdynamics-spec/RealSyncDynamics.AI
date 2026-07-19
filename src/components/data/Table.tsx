import React, { useState } from 'react';

export interface TableColumn<T = unknown> {
  id: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface TableProps<T = unknown> {
  columns: TableColumn<T>[];
  data: T[];
  striped?: boolean;
  hoverable?: boolean;
  selectable?: boolean;
  onRowSelect?: (selectedRows: T[]) => void;
  onSort?: (columnId: string, direction: 'asc' | 'desc') => void;
}

type SortDirection = 'asc' | 'desc' | null;

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  <T,>(
    {
      columns,
      data,
      striped = true,
      hoverable = true,
      selectable = false,
      onRowSelect,
      onSort,
    }: TableProps<T>,
    ref: React.ForwardedRef<HTMLTableElement>
  ) => {
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
        const allIndexes = new Set(data.map((_, i) => i));
        setSelectedRows(allIndexes);
        onRowSelect?.(data);
      } else {
        setSelectedRows(new Set());
        onRowSelect?.([]);
      }
    };

    const handleSelectRow = (index: number) => {
      const newSelected = new Set(selectedRows);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      setSelectedRows(newSelected);
      onRowSelect?.(data.filter((_, i) => newSelected.has(i)));
    };

    const handleSort = (columnId: string) => {
      let newDirection: SortDirection = 'asc';
      if (sortColumn === columnId && sortDirection === 'asc') {
        newDirection = 'desc';
      } else if (sortColumn === columnId && sortDirection === 'desc') {
        newDirection = null;
      }

      setSortColumn(newDirection ? columnId : null);
      setSortDirection(newDirection);

      if (newDirection) {
        onSort?.(columnId, newDirection);
      }
    };

    return (
      <div className="overflow-x-auto rounded-lg border border-titanium/10">
        <table
          ref={ref}
          className="w-full text-sm font-mono text-titanium"
        >
          <thead>
            <tr className="border-b border-titanium/10 bg-obsidian/50">
              {selectable && (
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={selectedRows.size === data.length && data.length > 0}
                    className="accent-security-blue cursor-pointer"
                  />
                </th>
              )}
              {columns.map(column => (
                <th
                  key={column.id}
                  className={`px-4 py-3 text-left font-semibold ${
                    column.sortable ? 'cursor-pointer hover:text-security-blue' : ''
                  }`}
                  onClick={() => column.sortable && handleSort(column.id)}
                  style={{ width: column.width }}
                >
                  <div className="flex items-center gap-2">
                    {column.header}
                    {column.sortable && sortColumn === column.id && (
                      <span className="text-xs">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`border-b border-titanium/10 transition-colors ${
                  striped && rowIndex % 2 === 1 ? 'bg-titanium/5' : ''
                } ${hoverable ? 'hover:bg-titanium/10' : ''}`}
              >
                {selectable && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(rowIndex)}
                      onChange={() => handleSelectRow(rowIndex)}
                      className="accent-security-blue cursor-pointer"
                    />
                  </td>
                )}
                {columns.map(column => (
                  <td key={column.id} className="px-4 py-3" style={{ width: column.width }}>
                    {column.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
);

Table.displayName = 'Table';
