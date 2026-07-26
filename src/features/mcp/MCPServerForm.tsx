import { useState } from 'react';
import { AuthType, CreateServerRequest, createServer, updateServer, McpServer } from './mcpApi';

interface MCPServerFormProps {
  server?: McpServer;
  onSuccess: () => void;
  onCancel: () => void;
}

export function MCPServerForm({ server, onSuccess, onCancel }: MCPServerFormProps) {
  const [formData, setFormData] = useState<CreateServerRequest>({
    name: server?.name || '',
    description: server?.description || '',
    server_url: server?.server_url || '',
    auth_type: server?.auth_type || 'api_key',
    auth_header_name: server?.auth_header_name || 'Authorization',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authTypes: AuthType[] = ['api_key', 'oauth', 'token', 'basic', 'none'];

  const handleChange = (field: keyof CreateServerRequest, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      if (server) {
        await updateServer(server.id, formData);
      } else {
        await createServer(formData);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Server Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="My MCP Server"
          className="w-full px-3 py-2 border rounded text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description (optional)</label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Brief description"
          className="w-full px-3 py-2 border rounded text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Server URL</label>
        <input
          type="url"
          value={formData.server_url}
          onChange={(e) => handleChange('server_url', e.target.value)}
          placeholder="https://mcp-server.example.com"
          className="w-full px-3 py-2 border rounded text-sm"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Authentication Type</label>
          <select
            value={formData.auth_type}
            onChange={(e) => handleChange('auth_type', e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm"
          >
            {authTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Auth Header Name</label>
          <input
            type="text"
            value={formData.auth_header_name}
            onChange={(e) => handleChange('auth_header_name', e.target.value)}
            placeholder="Authorization"
            className="w-full px-3 py-2 border rounded text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : server ? 'Update' : 'Create'} Server
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 border rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
