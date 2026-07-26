import { useState } from 'react';
import { CredentialType, setCredential } from './mcpApi';

interface CredentialInputProps {
  serverId: string;
  onSuccess?: () => void;
}

export function CredentialInput({ serverId, onSuccess }: CredentialInputProps) {
  const [credentialKey, setCredentialKey] = useState('');
  const [credentialValue, setCredentialValue] = useState('');
  const [credentialType, setCredentialType] = useState<CredentialType>('api_key');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const credentialTypes: CredentialType[] = ['api_key', 'token', 'password', 'oauth_token', 'custom'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      await setCredential(serverId, {
        credential_key: credentialKey,
        credential_value: credentialValue,
        credential_type: credentialType,
        expires_at: expiresAt || undefined,
      });

      setSuccess(true);
      setCredentialKey('');
      setCredentialValue('');
      setExpiresAt('');
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to store credential');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
          {error}
        </div>
      )}

      {success && (
        <div className="p-2 bg-green-50 border border-green-200 rounded text-green-700 text-xs">
          Credential stored successfully
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Credential Key</label>
          <input
            type="text"
            value={credentialKey}
            onChange={(e) => setCredentialKey(e.target.value)}
            placeholder="api_key"
            className="w-full px-2 py-1.5 border rounded text-xs"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Type</label>
          <select
            value={credentialType}
            onChange={(e) => setCredentialType(e.target.value as CredentialType)}
            className="w-full px-2 py-1.5 border rounded text-xs"
          >
            {credentialTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Value</label>
        <input
          type="password"
          value={credentialValue}
          onChange={(e) => setCredentialValue(e.target.value)}
          placeholder="••••••••"
          className="w-full px-2 py-1.5 border rounded text-xs font-mono"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Expires At (optional)</label>
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full px-2 py-1.5 border rounded text-xs"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-2 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Storing...' : 'Store Credential'}
      </button>
    </form>
  );
}
