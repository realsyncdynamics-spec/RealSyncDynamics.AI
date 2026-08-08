import { useEffect, useState } from 'react';
import { McpServer, getServers, deleteServer } from './mcpApi';

export function MCPServersList() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getServers();
      setServers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (serverId: string) => {
    if (!confirm('Are you sure you want to delete this MCP server?')) return;

    try {
      setDeletingId(serverId);
      await deleteServer(serverId);
      setServers((prev) => prev.filter((s) => s.id !== serverId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete server');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading MCP servers...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
        Error: {error}
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600 mb-4">No MCP servers configured yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr>
            <th className="text-left p-3">Name</th>
            <th className="text-left p-3">URL</th>
            <th className="text-left p-3">Auth Type</th>
            <th className="text-left p-3">Status</th>
            <th className="text-left p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => (
            <tr key={server.id} className="border-b hover:bg-gray-50">
              <td className="p-3 font-medium">{server.name}</td>
              <td className="p-3 font-mono text-xs text-gray-600">{server.server_url}</td>
              <td className="p-3">{server.auth_type}</td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      server.is_verified ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                  {server.is_active ? 'Active' : 'Inactive'}
                </div>
              </td>
              <td className="p-3">
                <button
                  onClick={() => handleDelete(server.id)}
                  disabled={deletingId === server.id}
                  className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                >
                  {deletingId === server.id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
