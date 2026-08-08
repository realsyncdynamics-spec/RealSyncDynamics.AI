import { useState } from 'react';
import { MCPServersList } from './MCPServersList';
import { MCPServerForm } from './MCPServerForm';
import { ServerConnectionTest } from './ServerConnectionTest';
import { CredentialInput } from './CredentialInput';

type TabType = 'list' | 'add' | 'manage';

export function MCPServersSettings() {
  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSuccess = () => {
    setActiveTab('list');
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">MCP Server Management</h2>
        <p className="text-gray-600 text-sm">
          Register and manage Model Context Protocol (MCP) servers for this workspace.
        </p>
      </div>

      <div className="border-b">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            All Servers
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'add'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Add Server
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'manage'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Manage Credentials
          </button>
        </div>
      </div>

      {activeTab === 'list' && (
        <div key={refreshTrigger} className="bg-white rounded border p-4">
          <MCPServersList />
        </div>
      )}

      {activeTab === 'add' && (
        <div className="bg-white rounded border p-6 max-w-md">
          <h3 className="text-lg font-semibold mb-4">Register New MCP Server</h3>
          <MCPServerForm
            onSuccess={handleSuccess}
            onCancel={() => setActiveTab('list')}
          />
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="space-y-6">
          <ManagedServersList onManageCredentials={(serverId, serverName) => {
            // Show credential management UI
            return (
              <div key={serverId} className="bg-white rounded border p-4">
                <h3 className="font-semibold mb-4">{serverName}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Test Connection</h4>
                    <ServerConnectionTest serverId={serverId} serverName={serverName} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-3">Store Credential</h4>
                    <CredentialInput serverId={serverId} />
                  </div>
                </div>
              </div>
            );
          }} />
        </div>
      )}
    </div>
  );
}

function ManagedServersList({
  onManageCredentials,
}: {
  onManageCredentials: (serverId: string, serverName: string) => React.ReactNode;
}) {
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // TODO: Fetch servers list
  // useEffect(() => {
  //   getServers().then(setServers).finally(() => setLoading(false));
  // }, []);

  if (loading) {
    return <div className="text-center p-4">Loading servers...</div>;
  }

  if (servers.length === 0) {
    return (
      <div className="bg-white rounded border p-4 text-center">
        <p className="text-gray-600">No servers configured yet. Create one first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {servers.map((server) => onManageCredentials(server.id, server.name))}
    </div>
  );
}
