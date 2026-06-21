/**
 * Landing — Bolt-Design 1:1 Integration
 *
 * Modern Enterprise UI mit:
 * - Glass Panels und animierte Cards
 * - Cyan Glow & Effekte
 * - Responsive Design
 * - DSGVO/AI Act Positionierung
 */

import React from 'react';
import { ArrowRight, PlayCircle, ShieldCheck, BrainCircuit, TrendingUp, UserRound, Activity, MessageSquare } from 'lucide-react';
import bgImageUrl from '../assets/images/europe_centric_globe_1781964649365.jpg';

export function Landing() {
  return (
    <div className="relative min-h-screen flex flex-col bg-[#030712] overflow-hidden selection:bg-[#00f0ff]/30 selection:text-white font-sans text-white">
      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <img
          src={bgImageUrl}
          alt="Earth Space Background"
          className="w-full h-[120%] lg:h-[135%] object-cover object-[70%_20%] lg:object-[80%_10%] opacity-100 mix-blend-screen contrast-[1.15] saturate-[1.3] brightness-[1.05] animate-[slowDrift_40s_ease-in-out_infinite_alternate]"
        />
        {/* Subtle Tech Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#030712] via-[#030712]/80 to-transparent w-full lg:w-[65%]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent h-40 bottom-0 top-auto w-full"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#030712] via-transparent to-transparent h-40 top-0 w-full"></div>
      </div>

      {/* Header */}
      <header className="relative z-30 flex w-full justify-between items-center px-6 lg:px-12 py-8 max-w-[1920px] mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-[38px] h-[38px] flex items-center justify-center text-[#00f0ff]">
            <svg viewBox="0 0 40 40" className="w-full h-full" fill="currentColor">
              <path d="M19.3 0H20.7V17H19.3V0Z" />
              <path d="M19.3 23H20.7V40H19.3V23Z" />
              <path d="M0 19.3H17V20.7H0V19.3Z" />
              <path d="M23 19.3H40V20.7H23V19.3Z" />
              <path d="M6 6L16.2 16.2L15.2 17.2L5 7L6 6Z" />
              <path d="M22.8 22.8L33 33L32 34L21.8 23.8L22.8 22.8Z" />
              <path d="M33 6L22.8 16.2L23.8 17.2L34 7L33 6Z" />
              <path d="M16.2 22.8L6 33L5 32L15.2 21.8L16.2 22.8Z" />
              <circle cx="20" cy="20" r="3" />
            </svg>
          </div>
          <span className="text-[22px] tracking-tight text-white mb-0.5">
            <strong className="font-semibold">RealSync</strong> Dynamics.AI
          </span>
        </div>

        <div className="hidden xl:flex items-center gap-8 justify-end flex-1">
          <nav className="flex items-center gap-8 text-[14px] font-medium text-gray-300">
            <a href="#produkt" className="hover:text-white hover:text-[#00f0ff] transition-colors duration-300">Produkt</a>
            <a href="#automatisierung" className="hover:text-white hover:text-[#00f0ff] transition-colors duration-300">Automatisierung</a>
            <a href="#evidence" className="hover:text-white hover:text-[#00f0ff] transition-colors duration-300">Evidence</a>
            <a href="#aiact" className="hover:text-white hover:text-[#00f0ff] transition-colors duration-300">AI Act</a>
            <a href="#sicherheit" className="hover:text-white hover:text-[#00f0ff] transition-colors duration-300">Sicherheit</a>
            <a href="#preise" className="hover:text-white hover:text-[#00f0ff] transition-colors duration-300">Preise</a>
            <a href="#login" className="hover:text-white hover:text-[#00f0ff] transition-colors duration-300 ml-2">Login</a>
          </nav>
          <a href="/signup" className="bg-[#00f0ff] text-[#050B14] hover:bg-white px-5 py-2.5 rounded font-semibold transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] flex items-center gap-2 text-[14px] ml-4">
            KI-OS entdecken <ArrowRight className="w-4 h-4 stroke-[2]" />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-20 flex-1 w-full max-w-[1920px] mx-auto px-6 lg:px-12 pt-8 lg:pt-16 pb-20 flex flex-col xl:flex-row items-center">

        {/* Left Column */}
        <div className="w-full xl:w-[55%] flex flex-col items-start 2xl:pl-8">

          <div className="inline-flex items-center gap-3 border border-[#00f0ff]/30 bg-[#00f0ff]/5 rounded-full pl-1.5 pr-4 py-1.5 backdrop-blur-sm self-start shadow-[0_0_15px_rgba(0,240,255,0.15)]">
            <span className="bg-[#00f0ff] text-[#050B14] font-mono text-[10px] font-bold px-2 py-0.5 rounded-full tracking-widest">NEU</span>
            <span className="text-[#00f0ff] font-mono text-[11px] font-semibold tracking-[0.15em] uppercase flex items-center gap-2">
              GOVERNANCE COMPLEXITY SCORE <ArrowRight className="w-3 h-3 stroke-[2.5]" />
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-[56px] lg:text-[76px] leading-[1.1] lg:leading-[1.05] font-extrabold tracking-[-0.02em] text-white mt-8 lg:mt-10">
            Das KI-<br className="hidden sm:block" />
            Betriebssystem für<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ffffff] via-[#e2faff] to-[#00f0ff]">DSGVO & EU AI Act</span>
          </h1>

          <h2 className="text-[#00f0ff] font-mono text-[11px] md:text-[13px] font-bold tracking-[0.35em] mt-6 lg:mt-8 uppercase drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]">
            AI Governance OS for Trust & Value
          </h2>

          <p className="text-gray-300 text-[15px] md:text-[17px] lg:text-[20px] leading-[1.6] mt-4 lg:mt-5 max-w-[660px]">
            <strong className="text-white font-medium">RealSync Dynamics</strong> entwickelt SaaS & KI-Innovationen für die Zukunft. Unser erstes Produkt überwacht Websites, KI-Systeme, Risiken und Nachweise kontinuierlich — DSGVO-konform, AI-Act-ready und auditierbar.
          </p>

          <div className="flex flex-col md:flex-row gap-8 lg:gap-12 mt-12 max-w-[720px]">
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#00f0ff] mb-2">
                <ShieldCheck className="w-[22px] h-[22px] stroke-[1.5]" />
                <span className="font-mono text-[12px] font-bold tracking-widest uppercase text-white">DSGVO-KONFORM</span>
              </div>
              <p className="text-[14px] text-gray-400 leading-relaxed pr-6 md:pr-4">
                Nachweise, Prozesse und Richtlinien automatisiert.
              </p>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#00f0ff] mb-2">
                <BrainCircuit className="w-[22px] h-[22px] stroke-[1.5]" />
                <span className="font-mono text-[12px] font-bold tracking-widest uppercase text-white">AI-ACT-READY</span>
              </div>
              <p className="text-[14px] text-gray-400 leading-relaxed pr-6 md:pr-4">
                Risikobewertung, Transparenz & Dokumentation.
              </p>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#00f0ff] mb-2">
                <TrendingUp className="w-[22px] h-[22px] stroke-[1.5]" />
                <span className="font-mono text-[12px] font-bold tracking-widest uppercase text-white">KONTINUIERLICH</span>
              </div>
              <p className="text-[14px] text-gray-400 leading-relaxed pr-6 md:pr-4">
                Monitoring, Alerts & Evidence in Echtzeit.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 mt-8 lg:mt-12 w-full sm:w-auto">
            <a href="/signup" className="w-full sm:w-auto justify-center bg-[#00f0ff] text-[#050B14] hover:bg-white px-7 py-3.5 rounded font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:scale-[1.02] flex items-center gap-2 text-[15px]">
              KI-Betriebssystem entdecken <ArrowRight className="w-[18px] h-[18px] stroke-[2]" />
            </a>
            <a href="#demo" className="w-full sm:w-auto justify-center border border-white/20 hover:border-[#00f0ff]/50 hover:bg-[#00f0ff]/5 px-7 py-3.5 rounded font-medium text-white transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,240,255,0.1)] hover:scale-[1.02] flex items-center gap-3 text-[15px]">
              <PlayCircle className="w-5 h-5 opacity-80 stroke-[1.5]" /> Produkt-Tour ansehen
            </a>
          </div>
        </div>

        {/* Right Column / Glass Panels Layer */}
        <div className="w-full xl:w-[45%] h-[700px] relative hidden lg:block perspective-[1000px]">

           {/* DSGVO Panel */}
           <div className="absolute top-[8%] left-[28%] glass-panel panel-brackets flex flex-col p-4 w-[160px] transform transition-transform hover:scale-105">
             <div className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-widest text-white mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" /> DSGVO
             </div>
             <div className="text-[13px] text-[#00f0ff] font-semibold ml-3.5 tracking-wide">Compliant</div>
           </div>

           <div className="absolute top-[14%] left-[64%] connection-node" style={{ animationDelay: '0s' }}>
               <UserRound className="w-3.5 h-3.5" />
           </div>

           <div className="absolute top-[32%] left-[8%] connection-node" style={{ animationDelay: '1.2s' }}>
               <UserRound className="w-3.5 h-3.5" />
           </div>

           <div className="absolute top-[36%] right-[3%] connection-node" style={{ animationDelay: '2.5s' }}>
               <UserRound className="w-3.5 h-3.5" />
           </div>

           {/* RISK SCORE Panel */}
           <div className="absolute top-[39%] right-[12%] glass-panel panel-brackets flex flex-col p-4 w-[150px] transform transition-transform hover:scale-105">
             <div className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-widest text-white mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" /> RISK SCORE
             </div>
             <div className="flex flex-col relative w-full mt-1">
               <div className="flex items-baseline gap-1 text-white">
                 <span className="font-mono font-medium text-[42px] leading-none text-transparent bg-clip-text bg-gradient-to-r from-white to-[#00f0ff]">87</span>
                 <span className="font-mono text-[12px] text-gray-400">/100</span>
               </div>
               <div className="w-full h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-[#00f0ff] to-[#0099ff] rounded-full w-[87%] animate-[loadBar_2s_ease-out_forwards]" />
               </div>
             </div>
           </div>

           <div className="absolute top-[58%] right-[1%] connection-node" style={{ animationDelay: '0.8s' }}>
               <UserRound className="w-3.5 h-3.5" />
           </div>

           <div className="absolute top-[55%] left-[2%] connection-node" style={{ animationDelay: '2.1s' }}>
               <UserRound className="w-3.5 h-3.5" />
           </div>

           {/* EVIDENCE Panel */}
           <div className="absolute top-[68%] left-[7%] glass-panel panel-brackets flex flex-col p-4 w-[150px] transform transition-transform hover:scale-105">
             <div className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-widest text-white mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" /> EVIDENCE
             </div>
             <div className="font-mono text-[28px] font-medium text-white mb-0.5 leading-tight tracking-tight">1,248</div>
             <div className="text-[13px] text-gray-400 tracking-wide">Nachweise</div>
           </div>

           <div className="absolute top-[85%] left-[28%] connection-node" style={{ animationDelay: '1.5s' }}>
               <UserRound className="w-3.5 h-3.5" />
           </div>

           {/* MONITORING Panel */}
           <div className="absolute bottom-[2%] left-[45%] glass-panel panel-brackets flex flex-col p-4 w-[160px] transform transition-transform hover:scale-105">
             <div className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-widest text-white mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" /> MONITORING
             </div>
             <div className="flex items-center gap-3">
                <Activity className="w-6 h-6 text-[#00f0ff] stroke-[1.5]" />
                <span className="font-mono text-[14px] font-bold text-[#00f0ff] tracking-widest uppercase">Live</span>
             </div>
           </div>

            <div className="absolute bottom-[8%] right-[22%] connection-node" style={{ animationDelay: '3.0s' }}>
               <UserRound className="w-3.5 h-3.5" />
           </div>

           {/* EU AI ACT Panel */}
           <div className="absolute bottom-[35%] right-[-1%] glass-panel panel-brackets flex flex-col p-4 w-[140px] transform transition-transform hover:scale-105">
             <div className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-widest text-white mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" /> EU AI ACT
             </div>
             <div className="font-mono text-[14px] font-bold tracking-widest text-[#00f0ff] ml-3.5 mt-0.5">
               READY
             </div>
           </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-30 w-full border-t border-white/5 bg-[#030712]/80 backdrop-blur-xl mt-auto">
        <div className="max-w-[1920px] mx-auto px-6 lg:px-12 py-6 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div className="text-[13px] text-gray-500 font-medium">
            &copy; {new Date().getFullYear()} RealSync Dynamics. SaaS & KI-Innovationen.
          </div>
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-x-8 gap-y-3 text-[13px] font-medium text-gray-400">
            <a href="#roadmap" className="hover:text-[#00f0ff] transition-colors">Roadmap</a>
            <a href="#kontakt" className="hover:text-[#00f0ff] transition-colors">Kontakt</a>
            <a href="#impressum" className="hover:text-[#00f0ff] transition-colors">Impressum</a>
            <a href="#agb" className="hover:text-[#00f0ff] transition-colors">AGB & Datenschutz</a>
          </div>
        </div>
      </footer>

      {/* Floating Chatbot Button */}
      <button
        onClick={() => alert('Chatbot-Fenster wird geöffnet... (Integration folgt)')}
        className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 w-14 h-14 bg-gradient-to-br from-[#00f0ff] to-[#0099ff] rounded-full flex items-center justify-center text-[#0a0e27] shadow-[0_4px_15px_rgba(0,240,255,0.3)] hover:scale-110 hover:shadow-[0_6px_25px_rgba(0,240,255,0.5)] transition-all duration-300 z-50 group"
        title="Chatbot öffnen"
      >
        <MessageSquare className="w-6 h-6 fill-current group-hover:animate-pulse" />
      </button>

      <style>{`
        .glass-panel {
          background: linear-gradient(135deg, rgba(8, 12, 22, 0.6), rgba(4, 7, 14, 0.8));
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(0, 240, 255, 0.15);
          border-top: 1px solid rgba(0, 240, 255, 0.3);
          border-radius: 0.25rem;
          box-shadow: 0 10px 40px -4px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(0, 240, 255, 0.15);
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          position: relative;
        }

        .panel-brackets::before, .panel-brackets::after {
          content: "";
          position: absolute;
          width: 10px;
          height: 10px;
          border: 1px solid #00f0ff;
          opacity: 0.5;
          transition: all 0.3s ease;
          pointer-events: none;
        }
        .panel-brackets::before {
          top: -1px; left: -1px;
          border-right: none; border-bottom: none;
        }
        .panel-brackets::after {
          bottom: -1px; right: -1px;
          border-left: none; border-top: none;
        }
        .glass-panel:hover.panel-brackets::before,
        .glass-panel:hover.panel-brackets::after {
          opacity: 1;
          width: 14px; height: 14px;
        }

        .glass-panel:hover {
          background: linear-gradient(135deg, rgba(12, 18, 32, 0.8), rgba(6, 10, 20, 0.9));
          border-color: rgba(0, 240, 255, 0.5);
          box-shadow: 0 15px 50px -8px rgba(0, 240, 255, 0.25), inset 0 0 10px rgba(0, 240, 255, 0.1);
          transform: translateY(-8px) scale(1.02) !important;
        }

        .connection-node {
          width: 1.75rem;
          height: 1.75rem;
          border-radius: 9999px;
          background: rgba(10, 15, 25, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #00f0ff;
          box-shadow: 0 0 15px rgba(0, 240, 255, 0.2);
          transition: all 0.3s ease;
          animation: floatNode 6s ease-in-out infinite, pulseGlow 4s ease-in-out infinite;
        }
        .connection-node:hover {
          border-color: rgba(0, 240, 255, 0.8);
          box-shadow: 0 0 25px rgba(0, 240, 255, 0.6);
          color: #ffffff;
          transform: scale(1.15);
        }

        @keyframes floatNode {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.05); }
        }

        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 15px rgba(0, 240, 255, 0.2); }
          50% { box-shadow: 0 0 25px rgba(0, 240, 255, 0.5); }
        }

        @keyframes slowDrift {
          0% { transform: scale(1.05) translate(0, 0); }
          100% { transform: scale(1.1) translate(-1%, -1%); }
        }

        @keyframes loadBar {
          from { width: 0; }
          to { width: 87%; }
        }
      `}</style>
    </div>
  );
}
