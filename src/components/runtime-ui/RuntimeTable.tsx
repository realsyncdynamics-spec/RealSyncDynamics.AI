import type { ReactNode } from 'react';

export interface RuntimeColumn<T> {
  key:      string;
  header:   string;
  /** Optional: feste Spaltenbreite. */
  width?:   string;
  /** Optional: rechtsbuendig (z. B. Zahlen). */
  align?:   'left' | 'right';
  render: (row: T) => ReactNode;
}

export interface RuntimeTableProps<T> {
  columns:   Array<RuntimeColumn<T>>;
  rows:      T[];
  /** Eindeutige Row-ID — falls fehlend, faellt die Tabelle auf den Index zurueck. */
  rowKey?:  (row: T, index: number) => string;
  emptyHint?: string;
}

export function RuntimeTable<T>({ columns, rows, rowKey, emptyHint }: RuntimeTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="border border-titanium-800 bg-obsidian-950 px-4 py-8 text-center text-sm text-titanium-400">
        {emptyHint ?? '— keine Eintraege —'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-titanium-800 bg-obsidian-950">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-titanium-800 bg-obsidian-900">
            {columns.map((column) => (
              <th
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
                className={`px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-titanium-500 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey ? rowKey(row, index) : String(index)}
              className="border-b border-titanium-800/60 last:border-b-0 hover:bg-obsidian-900/60"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-3 py-2 align-top text-titanium-200 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
