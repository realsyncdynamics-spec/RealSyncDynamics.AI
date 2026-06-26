import React, { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, TrendingUp, Zap } from 'lucide-react';

const GlobeVisualization = lazy(() =>
  import('../components/visual/GlobeVisualization').then((m) => ({
    default: m.GlobeVisualization,
  }))
);

export function DemoLandingPage() {
  const navigate = useNavigate();

  const handleStartFree = () => {
    navigate('/demo-login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-obsidian-950 via-obsidian-900 to-obsidian-950 overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Navigation */}
      <header className="relative z-10 border-b border-titanium-800/30 bg-obsidian-900/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-titanium-100">RealSyncDynamics</h1>
            <button
              onClick={handleStartFree}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition-colors"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10">
        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-5xl lg:text-6xl font-bold text-titanium-100 mb-4 leading-tight">
                  AI Governance <span className="text-blue-400">Reimagined</span>
                </h2>
                <p className="text-xl text-titanium-400 leading-relaxed">
                  Enterprise-grade compliance, risk management, and evidence tracking for the AI era. Secure your AI systems with confidence.
                </p>
              </div>

              {/* Key Features */}
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-obsidian-800/30 border border-titanium-800/30 rounded">
                  <Shield className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-titanium-100 mb-1">Compliance Ready</h3>
                    <p className="text-sm text-titanium-500">EU AI Act + GDPR out of the box</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-obsidian-800/30 border border-titanium-800/30 rounded">
                  <TrendingUp className="w-6 h-6 text-orange-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-titanium-100 mb-1">Real-time Monitoring</h3>
                    <p className="text-sm text-titanium-500">Live risk scores and evidence collection</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-obsidian-800/30 border border-titanium-800/30 rounded">
                  <Zap className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-titanium-100 mb-1">Lightning Fast</h3>
                    <p className="text-sm text-titanium-500">Scan & analyze in seconds</p>
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={handleStartFree}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold rounded flex items-center justify-center gap-2 transition-all duration-200 transform hover:translate-y-[-2px]"
                >
                  Kostenlos starten
                  <ArrowRight size={20} />
                </button>

                <button className="px-8 py-3 bg-obsidian-800/50 hover:bg-obsidian-800 border border-titanium-700/30 text-titanium-100 font-semibold rounded transition-colors">
                  Dokumentation
                </button>
              </div>

              {/* Trust metrics */}
              <div className="pt-4 text-sm text-titanium-500">
                ✨ Deployed to <span className="text-titanium-300 font-mono">realsyncdynamics-ai.pages.dev</span>
              </div>
            </div>

            {/* Right: Globe Visualization */}
            <div className="relative h-96 lg:h-full min-h-96 animate-fade-in" style={{ animationDelay: '100ms' }}>
              <Suspense
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center text-titanium-400">
                    Lade Globe …
                  </div>
                }
              >
                <GlobeVisualization />
              </Suspense>
            </div>
          </div>
        </div>

        {/* Metrics Section */}
        <div className="border-t border-titanium-800/30 bg-obsidian-900/30 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-400 mb-2">87</div>
                <div className="text-titanium-400">Average Governance Score</div>
              </div>

              <div className="text-center">
                <div className="text-4xl font-bold text-orange-400 mb-2">1.248</div>
                <div className="text-titanium-400">Evidence Artifacts</div>
              </div>

              <div className="text-center">
                <div className="text-4xl font-bold text-green-400 mb-2">24/7</div>
                <div className="text-titanium-400">Continuous Monitoring</div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-titanium-100 mb-4">
              Everything you need for AI Governance
            </h2>
            <p className="text-xl text-titanium-400 max-w-2xl mx-auto">
              Comprehensive tools to manage, monitor, and ensure compliance across your AI systems.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: '📊',
                title: 'Risk Assessment',
                description: 'Automated risk scoring based on EU AI Act criteria',
              },
              {
                icon: '📋',
                title: 'Evidence Vault',
                description: 'Centralized repository for compliance documentation',
              },
              {
                icon: '🔍',
                title: 'Real-time Scanning',
                description: 'Continuous monitoring of your AI systems',
              },
              {
                icon: '✅',
                title: 'DSGVO Ready',
                description: 'Privacy-by-design compliance checks',
              },
              {
                icon: '🤖',
                title: 'AI Act Compliant',
                description: 'Full EU AI Act classification support',
              },
              {
                icon: '📈',
                title: 'Reporting',
                description: 'Export audit reports and compliance matrices',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-6 bg-obsidian-900/50 border border-titanium-800/30 rounded hover:border-blue-500/30 transition-colors group"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-titanium-100 mb-2">{feature.title}</h3>
                <p className="text-sm text-titanium-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="bg-gradient-to-r from-blue-600/10 to-blue-500/10 border border-blue-500/30 rounded-lg p-12 text-center">
            <h2 className="text-3xl font-bold text-titanium-100 mb-4">
              Ready to take control of your AI governance?
            </h2>
            <p className="text-xl text-titanium-400 mb-8">
              Get started in minutes with our demo dashboard. No credit card required.
            </p>
            <button
              onClick={handleStartFree}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold rounded flex items-center justify-center gap-2 transition-all duration-200 transform hover:translate-y-[-2px] mx-auto"
            >
              Launch Dashboard
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-titanium-800/30 bg-obsidian-900/30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-titanium-500 text-sm">
          <p>© 2024 RealSyncDynamics. All rights reserved. | EU-Sovereign AI Governance.</p>
        </div>
      </footer>
    </div>
  );
}
