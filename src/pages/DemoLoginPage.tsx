import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoAuth } from '../features/demo/DemoAuthContext';

export function DemoLoginPage() {
  const navigate = useNavigate();
  const { login } = useDemoAuth();
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/demo-app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-obsidian-950 via-obsidian-900 to-obsidian-950 flex items-center justify-center px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-titanium-200 mb-2">RealSyncDynamics</h1>
          <p className="text-titanium-400 text-sm">AI Governance & Compliance Platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-obsidian-900/50 backdrop-blur-xl border border-titanium-800/30 rounded-lg p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-titanium-100 mb-6">Login</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label className="block text-titanium-300 text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-obsidian-800/50 border border-titanium-700/30 rounded text-titanium-100 placeholder-titanium-600 focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50"
                placeholder="test@example.com"
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-titanium-300 text-sm font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-obsidian-800/50 border border-titanium-700/30 rounded text-titanium-100 placeholder-titanium-600 focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded transition-colors duration-200"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {/* Demo Hint */}
          <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-blue-300 text-xs">
            <strong>Demo:</strong> Use test@example.com / password123
          </div>
        </div>
      </div>
    </div>
  );
}
