import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

export function BoltDesignLanding() {
  const [evidence, setEvidence] = useState(0);
  const [riskScore, setRiskScore] = useState(0);

  useEffect(() => {
    const evidenceTimer = setInterval(() => {
      setEvidence(prev => (prev < 1248 ? prev + 20 : 1248));
    }, 15);
    const riskTimer = setInterval(() => {
      setRiskScore(prev => (prev < 87 ? prev + 1 : 87));
    }, 20);
    return () => {
      clearInterval(evidenceTimer);
      clearInterval(riskTimer);
    };
  }, []);

  const cards = [
    { label: 'DSGVO', status: 'Compliant', icon: '✓' },
    { label: 'EU AI ACT', status: 'READY', icon: '⚡' },
    { label: 'MONITORING', status: 'LIVE', icon: '📡' },
    { label: 'RISK SCORE', value: '87', icon: '📊' },
    { label: 'EVIDENCE VAULT', value: '1,248', icon: '🔐' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(0, 255, 255, .05) 25%, rgba(0, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, .05) 75%, rgba(0, 255, 255, .05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 255, 255, .05) 25%, rgba(0, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, .05) 75%, rgba(0, 255, 255, .05) 76%, transparent 77%, transparent)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Animated Gradient Orbs */}
      <div className="absolute top-20 right-10 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />

      {/* Navigation */}
      <nav className="relative z-10 flex justify-between items-center px-8 py-6 border-b border-cyan-500/20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center font-bold text-white animate-spin" style={{ animationDuration: '3s' }}>⬢</div>
          <span className="text-xl font-bold text-white">RealSync Dynamics</span>
        </div>
        <div className="flex gap-8 items-center">
          <a href="#" className="text-gray-300 hover:text-cyan-400 transition">Produkt</a>
          <a href="#" className="text-gray-300 hover:text-cyan-400 transition">Governance</a>
          <a href="#" className="text-gray-300 hover:text-cyan-400 transition">Compliance</a>
          <button className="bg-cyan-500 text-black px-6 py-2 rounded font-semibold hover:bg-cyan-400 transition">Login</button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 max-w-6xl mx-auto px-8 py-24">
        <div className="grid grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-block px-4 py-2 bg-cyan-500/20 border border-cyan-500/40 rounded-full text-cyan-300 text-sm font-mono">
                ✨ NEU: GOVERNANCE COMPLEXITY SCORE
              </div>
              <h1 className="text-6xl font-bold text-white leading-tight">
                Das KI-Betriebssystem für DSGVO & EU AI Act
              </h1>
              <p className="text-xl text-gray-300">
                RealSync Dynamics entwickelt SaaS & KI-Innovationen für die Zukunft. Unser erstes Produkt überwacht Websites, KI-Systeme, Risiken und Nachweise kontinuierlich.
              </p>
            </div>

            <button className="bg-cyan-500 text-black px-8 py-4 rounded font-bold hover:bg-cyan-400 transition flex items-center gap-2 text-lg">
              KI-OS entdecken <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Right: Animated Hexagon with Counters */}
          <div className="relative h-96 flex items-center justify-center">
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Main Hexagon Container */}
              <div className="relative w-64 h-72">
                {/* Hexagon */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 to-blue-500/20 backdrop-blur-xl rounded-3xl border border-cyan-500/40 transform -skew-y-3" />

                {/* Content inside hexagon */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-8">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-cyan-300">{evidence.toLocaleString()}</div>
                    <div className="text-sm text-gray-300 font-mono mt-2">EVIDENCE VAULT</div>
                  </div>
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
                  <div className="text-center">
                    <div className="text-5xl font-bold text-cyan-300">{riskScore}/100</div>
                    <div className="text-sm text-gray-300 font-mono mt-2">RISK SCORE</div>
                  </div>
                </div>
              </div>

              {/* Floating status badges */}
              <div className="absolute top-0 right-0 animate-float" style={{ animationDelay: '0s' }}>
                <div className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/40 rounded-lg text-cyan-300 text-xs font-mono backdrop-blur-sm">
                  DSGVO Compliant
                </div>
              </div>
              <div className="absolute bottom-0 left-0 animate-float" style={{ animationDelay: '1s' }}>
                <div className="px-4 py-2 bg-blue-500/20 border border-blue-500/40 rounded-lg text-blue-300 text-xs font-mono backdrop-blur-sm">
                  EU AI ACT READY
                </div>
              </div>
              <div className="absolute bottom-1/4 right-0 animate-float" style={{ animationDelay: '2s' }}>
                <div className="px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-lg text-green-300 text-xs font-mono backdrop-blur-sm">
                  MONITORING LIVE
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cards Section */}
      <div className="relative z-10 max-w-6xl mx-auto px-8 py-16">
        <div className="grid grid-cols-5 gap-4">
          {cards.map((card, i) => (
            <div
              key={i}
              className="group p-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl backdrop-blur-sm hover:border-cyan-500/60 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
            >
              <div className="text-2xl mb-3">{card.icon}</div>
              <div className="text-xs text-gray-400 font-mono uppercase mb-2">{card.label}</div>
              {card.status ? (
                <div className="text-sm font-bold text-cyan-300">{card.status}</div>
              ) : (
                <div className="text-2xl font-bold text-cyan-300">{card.value}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <div className="relative z-10 max-w-6xl mx-auto px-8 py-24 border-t border-cyan-500/10">
        <h2 className="text-4xl font-bold text-white mb-16 text-center">Features</h2>
        <div className="grid grid-cols-3 gap-8">
          {[
            { title: 'Governance OS', desc: 'Zentrale Verwaltung aller AI-Systeme, Workflows und Risiken' },
            { title: 'Evidence Vault', desc: 'Automatische Dokumentation und Compliance-Nachweise' },
            { title: 'Risk Engine', desc: 'Echtzeit-Risikoanalyse mit EU AI Act Klassifizierung' },
          ].map((f, i) => (
            <div key={i} className="p-8 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/20 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4">{f.title}</h3>
              <p className="text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Styles for animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
