import React, { useState } from 'react';
import { ShieldCheck, Activity, CreditCard, ArrowUpRight, Image as ImageIcon, CheckCircle2, AlertCircle, ChevronRight, Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AssetWorkflowModal } from './AssetWorkflowModal';
import { AssetDetailModal } from './AssetDetailModal';

const data = [
  { name: '1 Apr', views: 400, revenue: 240 },
  { name: '5 Apr', views: 300, revenue: 139 },
  { name: '10 Apr', views: 550, revenue: 380 },
  { name: '15 Apr', views: 450, revenue: 290 },
  { name: '20 Apr', views: 700, revenue: 480 },
  { name: '25 Apr', views: 650, revenue: 450 },
  { name: '30 Apr', views: 850, revenue: 600 },
];

const recentAssets = [
  { id: 'AST-8902', name: 'Campaign_Header_v2.png', status: 'ready', views: '12.5k', date: 'Heute, 14:20', package: 'Creator Sovereign' },
  { id: 'AST-8901', name: 'Product_Launch_Video.mp4', status: 'ai_pending', views: '-', date: 'Heute, 11:05', package: 'Creator Pro' },
  { id: 'AST-8899', name: 'Website_Hero_Concept.jpg', status: 'ready', views: '45.2k', date: 'Gestern', package: 'Creator Start' },
  { id: 'AST-8898', name: 'CEO_Portrait_Official.jpg', status: 'policy_failed', views: '102k', date: '14. Apr 2026', package: 'Creator Pro' },
  { id: 'AST-8897', name: 'Corporate_Token_Logo.svg', status: 'revocation_detected', views: '2k', date: '12. Apr 2026', package: 'Creator Sovereign' },
];

const StatusBadge = ({ status }: { status: string }) => {
  const configs: Record<string, { label: string, color: string, bg: string, icon: React.ReactNode }> = {
    'ready': { 
      label: 'READY FOR DISTRIBUTION', 
      color: 'text-emerald-500', 
      bg: 'bg-emerald-500/10',
      icon: <CheckCircle2 className="h-3 w-3" />
    },
    'ai_pending': { 
      label: 'AI SCAN PENDING', 
      color: 'text-amber-500', 
      bg: 'bg-amber-500/10',
      icon: <Activity className="h-3 w-3 animate-pulse" />
    },
    'policy_failed': { 
      label: 'POLICY CHECK FAILED', 
      color: 'text-red-500', 
      bg: 'bg-red-500/10',
      icon: <AlertCircle className="h-3 w-3" />
    },
    'revocation_detected': { 
      label: 'REVOCATION DETECTED', 
      color: 'text-white', 
      bg: 'bg-red-600',
      icon: <ShieldCheck className="h-3 w-3" />
    },
    'verified': { 
      label: 'VERIFIED', 
      color: 'text-[#0052FF]', 
      bg: 'bg-[#0052FF]/10',
      icon: <CheckCircle2 className="h-3 w-3" />
    },
  };

  const config = configs[status] || configs['ai_pending'];

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${config.bg} ${config.color}`}>
      {config.icon}
      {config.label}
    </div>
  );
};

export function AssetsView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-titanium-900 pb-6">
          <div>
            <h1 className="text-3xl font-mono font-bold text-[#0A0A0B] tracking-tight uppercase">C2PA Assets & Performance</h1>
            <p className="text-sm text-titanium-400 mt-1 font-medium flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-[#0052FF]" />
              Status deiner signierten Inhalte und deren Performance.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-[#E2E2E2] p-1 border border-titanium-800 hidden sm:flex">
              <button className="px-4 py-1.5 bg-[#0A0A0B] text-white font-mono text-[10px] font-bold uppercase tracking-widest">30 Tage</button>
              <button className="px-4 py-1.5 text-titanium-300 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-obsidian-900 transition-colors">Dieses Jahr</button>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-[#0052FF] text-white px-6 py-3 rounded-none text-xs font-bold uppercase tracking-widest hover:bg-[#0041CC] transition-all shadow-[4px_4px_0px_0px_#0A0A0B]"
            >
              <Plus className="h-4 w-4" />
              Signieren
            </button>
          </div>
        </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-obsidian-900 p-6 border border-titanium-900 shadow-sm relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
          <div className="flex items-center gap-3 text-titanium-400 mb-4">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Aktive C2PA Seals</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-[#0A0A0B]">8,405</span>
            <span className="text-[10px] font-bold text-emerald-400 font-mono">+12.4%</span>
          </div>
        </div>

        <div className="bg-obsidian-900 p-6 border border-titanium-900 shadow-sm relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0052FF]"></div>
          <div className="flex items-center gap-3 text-titanium-400 mb-4">
            <Activity className="h-4 w-4 text-[#0052FF]" />
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Verifizierte Views</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-[#0A0A0B]">2.1M</span>
            <span className="text-[10px] font-bold text-emerald-400 font-mono">+8.1%</span>
          </div>
        </div>

        <div className="bg-obsidian-900 p-6 border border-titanium-900 shadow-sm relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
          <div className="flex items-center gap-3 text-titanium-400 mb-4">
            <CreditCard className="h-4 w-4 text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Lizenzeinnahmen</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-[#0A0A0B]">8,240€</span>
            <span className="text-[10px] font-bold text-emerald-400 font-mono">+24.2%</span>
          </div>
        </div>

        <div className="bg-[#0A0A0B] p-6 border border-[#E2E2E2]/10 shadow-md text-white relative">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-titanium-500">Quota usage</span>
            <span className="text-[10px] font-bold px-2 py-0.5 border border-[#0052FF] text-[#0052FF] font-mono">ENTERPRISE</span>
          </div>
          <div className="w-full bg-obsidian-800 h-1 mb-3">
            <div className="bg-[#0052FF] h-1" style={{ width: '84%' }}></div>
          </div>
          <p className="font-mono text-[10px] font-bold text-titanium-400">8,405 / 10,000 SIGNED</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-obsidian-900 border border-titanium-900 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-sm font-bold text-[#0A0A0B] uppercase tracking-widest font-mono border-l-4 border-[#0052FF] pl-3">Performance Historie</h2>
              <p className="text-[10px] text-titanium-400 font-mono font-bold mt-1 uppercase">Metric_Stream: Views & Revenue</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorViews)" />
                <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-obsidian-900 border border-titanium-900 p-8 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-bold text-[#0A0A0B] uppercase tracking-widest font-mono border-l-4 border-[#0052FF] pl-3">Asset Monitor</h2>
            <button className="text-[10px] font-bold text-[#0052FF] uppercase tracking-widest hover:underline">Full_Export</button>
          </div>
          <div className="flex-1 overflow-auto">
            <div className="space-y-3">
              {recentAssets.map((asset) => (
                <div key={asset.id} className="flex items-start gap-4 p-4 border border-transparent hover:border-titanium-900 hover:bg-obsidian-950 transition-all cursor-pointer group">
                  <div className="w-12 h-12 bg-[#E2E2E2] flex items-center justify-center shrink-0 border border-titanium-900 group-hover:border-[#0052FF] transition-colors">
                    <ImageIcon className={`h-6 w-6 text-[#0A0A0B]`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-[#0A0A0B] truncate font-mono uppercase">{asset.name}</p>
                      <StatusBadge status={asset.status} />
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[9px] font-bold uppercase tracking-wider text-titanium-500">
                      <span>ID: {asset.id}</span>
                      <span className="text-titanium-200">|</span>
                      <span className="flex items-center gap-1"><Activity className="h-2.5 w-2.5" /> {asset.views} VIEWS</span>
                      <span className="text-titanium-200">|</span>
                      <span>TS: {asset.date}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedAsset(asset)} className="mt-2 text-[10px] font-bold text-[#0052FF] uppercase tracking-widest hover:underline bg-[#0052FF]/10 px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    DETAILS_VIEW
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-titanium-900/50 font-mono">
            <button className="w-full flex items-center justify-center gap-3 py-4 bg-[#E2E2E2] text-[#0A0A0B] hover:bg-[#0A0A0B] hover:text-white font-bold text-[10px] tracking-[0.2em] uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-none translate-x-[-2px] translate-y-[-2px] hover:translate-x-0 hover:translate-y-0">
              PRÜFPFAD KONSOLE ÖFFNEN <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <AssetWorkflowModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    <AssetDetailModal isOpen={!!selectedAsset} onClose={() => setSelectedAsset(null)} asset={selectedAsset} />
  </>
);
}
