interface AgentActionLog {
  id: string;
  created_at: string;
  action_type: string;
  status: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  agent_id: string | null;
}

interface AgentActionLogTableProps {
  rows: AgentActionLog[];
}

const STATUS_CLASS: Record<string, string> = {
  success: 'border-green-800 text-green-400',
  error: 'border-rose-900 text-rose-400',
  pending: 'border-amber-800 text-amber-400',
};

function statusClass(status: string | null): string {
  if (!status) return 'border-titanium-800 text-titanium-400';
  return STATUS_CLASS[status.toLowerCase()] ?? 'border-titanium-800 text-titanium-400';
}

function truncateJson(value: Record<string, unknown> | null): string {
  if (!value) return '—';
  try {
    const str = JSON.stringify(value);
    return str.length > 80 ? str.slice(0, 80) + '…' : str;
  } catch {
    return '—';
  }
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AgentActionLogTable({ rows }: AgentActionLogTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-titanium-500 py-6 text-center">Keine Aktionen gefunden.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-titanium-800">
            <th className="text-left py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-titanium-500">Zeitstempel</th>
            <th className="text-left py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-titanium-500">Agent</th>
            <th className="text-left py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-titanium-500">Aktion</th>
            <th className="text-left py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-titanium-500">Status</th>
            <th className="text-left py-2 font-mono text-[10px] uppercase tracking-widest text-titanium-500">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-titanium-900">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-obsidian-900 transition-colors">
              <td className="py-2 pr-4 font-mono text-[11px] text-titanium-400 whitespace-nowrap">
                {formatTimestamp(row.created_at)}
              </td>
              <td className="py-2 pr-4 text-titanium-300 whitespace-nowrap">
                {row.agent_id ? (
                  <span className="font-mono text-[10px] text-titanium-500">{row.agent_id.slice(0, 8)}…</span>
                ) : (
                  <span className="text-titanium-600">—</span>
                )}
              </td>
              <td className="py-2 pr-4 text-titanium-200">{row.action_type}</td>
              <td className="py-2 pr-4">
                {row.status ? (
                  <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 border ${statusClass(row.status)}`}>
                    {row.status}
                  </span>
                ) : (
                  <span className="text-titanium-600">—</span>
                )}
              </td>
              <td className="py-2">
                <span className="font-mono text-[10px] text-titanium-500 break-all">
                  {truncateJson(row.input)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
