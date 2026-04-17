import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  GitMerge, ArrowRight, Zap, RefreshCw, CircleSlash, 
  ShieldAlert, Play, Pause, Activity, Plus, BarChart3,
  Terminal, Shield
} from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  trigger: string;
  actions: { name: string; icon: React.ReactNode }[];
  status: 'active' | 'paused';
  executions: number;
  lastExecution: string;
}

const INITIAL_WORKFLOWS: Workflow[] = [
  {
    id: 'wf-001',
    name: 'Standard Image Distribution',
    trigger: 'Ordner: /marketing/public',
    actions: [
      { name: 'AI Audit (Light)', icon: <Zap className="h-3 w-3" /> },
      { name: 'C2PA Sign (Jane S.)', icon: <Shield className="h-3 w-3" /> }
    ],
    status: 'active',
    executions: 1204,
    lastExecution: 'Vor 2 Min.'
  },
  {
    id: 'wf-002',
    name: 'Stock Photo Monetization',
    trigger: 'Asset Tag: #premium_stock',
    actions: [
      { name: 'C2PA Policy: Commercial', icon: <Shield className="h-3 w-3" /> },
      { name: 'Stripe Pay-per-View', icon: <CircleSlash className="h-3 w-3" /> }
    ],
    status: 'active',
    executions: 89,
    lastExecution: 'Gestern'
  },
  {
    id: 'wf-003',
    name: 'Internal PR Approval',
    trigger: 'Upload via Intranet API',
    actions: [
      { name: 'Request Manager Review', icon: <RefreshCw className="h-3 w-3" /> },
      { name: 'C2PA Sign (Corporate)', icon: <Shield className="h-3 w-3" /> }
    ],
    status: 'paused',
    executions: 450,
    lastExecution: 'Vor 3 Tagen'
  }
];

export function WorkflowsView() {
  const [workflows, setWorkflows] = useState<Workflow[]>(INITIAL_WORKFLOWS);
  const [isCreating, setIsCreating] = useState(false);

  const toggleStatus = (id: string) => {
    setWorkflows(prev => prev.map(wf => 
      wf.id === id ? { ...wf, status: wf.status === 'active' ? 'paused' : 'active' } : wf
    ));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Header - RealSync Hard-Edge Design */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-mono font-bold text-[#0A0A0B] tracking-tight uppercase">Automatisierte Prüfpfade</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-[#0052FF]" />
            Steuerung von UFO-Bridge & CreatorSeal Automatisierungen.
          </p>
        </div>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-2 bg-[#0052FF] text-white px-6 py-3 rounded-none text-xs font-bold uppercase tracking-widest hover:bg-[#0041CC] transition-all shadow-[4px_4px_0px_0px_#0A0A0B]"
        >
          <Plus className="h-4 w-4" />
          Kette erstellen
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Main Workflow List */}
        <div className="lg:col-span-3 space-y-4">
          {workflows.map((wf, idx) => (
            <motion.div 
              key={wf.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-0 border border-slate-200 shadow-sm relative group hover:border-[#0052FF] transition-colors"
            >
              <div className="flex flex-col md:flex-row">
                {/* Left Indicator */}
                <div className={`w-1.5 shrink-0 ${wf.status === 'active' ? 'bg-[#0052FF]' : 'bg-slate-300'}`}></div>
                
                {/* Content */}
                <div className="flex-1 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 ${wf.status === 'active' ? 'bg-blue-50 text-[#0052FF]' : 'bg-slate-50 text-slate-400'}`}>
                        <GitMerge className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[#0A0A0B] font-mono leading-none mb-1">{wf.name}</h3>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          <Terminal className="h-3 w-3" />
                          Trigger: {wf.trigger}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <div className="text-xs font-bold text-[#0A0A0B] font-mono">{wf.executions} Execs</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Last: {wf.lastExecution}</div>
                      </div>
                      <button 
                        onClick={() => toggleStatus(wf.id)}
                        className={`p-2 transition-colors border ${wf.status === 'active' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                        title={wf.status === 'active' ? 'Workflow pausieren' : 'Workflow aktivieren'}
                      >
                        {wf.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
                    {wf.actions.map((action, i) => (
                      <React.Fragment key={i}>
                        <div className="flex items-center gap-2 bg-[#E2E2E2] text-[#0A0A0B] px-3 py-1.5 text-[11px] font-bold uppercase tracking-tight">
                          {action.icon}
                          {action.name}
                        </div>
                        {i < wf.actions.length - 1 && <ArrowRight className="h-3 w-3 text-slate-300" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {isCreating && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="border-2 border-dashed border-slate-300 p-12 flex flex-col items-center justify-center text-center bg-slate-50/50"
            >
              <Shield className="h-10 w-10 text-slate-300 mb-4" />
              <h4 className="text-lg font-bold text-slate-900 mb-2">Editor Initialisierung...</h4>
              <p className="text-sm text-slate-500 max-w-sm">Wähle einen Trigger (Webhooks, eIDAS Zertifikate oder Ordner-Watcher) um die Automatisierungskette zu starten.</p>
              <button 
                onClick={() => setIsCreating(false)}
                className="mt-6 text-xs font-bold text-[#0052FF] uppercase underline hover:no-underline"
              >
                Abbrechen
              </button>
            </motion.div>
          )}
        </div>

        {/* Sidebar Stats & Info */}
        <div className="space-y-6">
          <div className="bg-[#0A0A0B] p-6 text-white border-l-4 border-[#0052FF]">
             <BarChart3 className="h-6 w-6 text-[#0052FF] mb-4" />
             <h3 className="text-sm font-bold uppercase tracking-[0.2em] mb-4 font-mono">Performance Metriken</h3>
             <div className="space-y-4">
               <div>
                 <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1 tracking-wider uppercase">Uptime Monitor</div>
                 <div className="text-2xl font-mono font-bold">99.98%</div>
               </div>
               <div>
                 <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1 tracking-wider uppercase">Zertifizierungen (24h)</div>
                 <div className="text-2xl font-mono font-bold text-emerald-500">2,408</div>
               </div>
               <div>
                 <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1 tracking-wider uppercase">Compliance Alerts</div>
                 <div className="text-2xl font-mono font-bold text-amber-500">0</div>
               </div>
             </div>
          </div>

          <div className="bg-[#E2E2E2] p-6 border border-slate-300">
             <ShieldAlert className="h-6 w-6 text-[#0052FF] mb-3" />
             <h3 className="text-sm font-bold uppercase mb-2">Revision & Policy</h3>
             <p className="text-[11px] leading-relaxed text-slate-600 font-medium">
               Alle Workflow-Exekutionen werden im unveränderlichen **RealSync Prüfpfad** dokumentiert. 
               Änderungen an der UFO-Bridge Kette erfordern eine Re-Zertifizierung des Prozesses gem. EU AI Act.
             </p>
          </div>
        </div>

      </div>
    </div>
  );
}
