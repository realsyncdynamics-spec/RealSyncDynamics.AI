import { useState } from 'react';
import { testServerConnection, ConnectionTestResult } from './mcpApi';

interface ServerConnectionTestProps {
  serverId: string;
  serverName: string;
}

export function ServerConnectionTest({ serverId, serverName }: ServerConnectionTestProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    try {
      setTesting(true);
      setError(null);
      const testResult = await testServerConnection(serverId);
      setResult(testResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleTest}
        disabled={testing}
        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium disabled:opacity-50"
      >
        {testing ? 'Testing...' : 'Test Connection'}
      </button>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
          {error}
        </div>
      )}

      {result && (
        <div
          className={`p-3 rounded text-sm ${
            result.success
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
          }`}
        >
          <p className="font-medium">{result.message}</p>
          {result.details && (
            <p className="text-xs mt-1 opacity-75">
              {result.details.timestamp}
              {result.details.status_code && ` • Status: ${result.details.status_code}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
