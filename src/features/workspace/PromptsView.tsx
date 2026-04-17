import React from 'react';
import { Plus, Search, FileText, Globe, Shield, LayoutPanelLeft, MoreVertical, Bookmark } from 'lucide-react';

const prompts = [
  { title: 'AGB/Policy Discovery', description: 'Analysiert Dokumente auf DSGVO, eIDAS & AI Act Compliance Lücken.', icon: <Search className="h-4 w-4" />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', tags: ['Research', 'Legal'] },
  { title: 'Betriebsrat-Guide C2PA', description: 'Erstellt ein transparentes Informationspaket für den Betriebsrat bezgl. Belegschafts-Tracking.', icon: <Shield className="h-4 w-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', tags: ['Internal', 'Compliance'] },
  { title: 'Generative AI Policy', description: 'Blueprint zur Unternehmensrichtlinie im Umgang mit externen AI Generatoren.', icon: <FileText className="h-4 w-4" />, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', tags: ['Policy', 'Governance'] },
  { title: 'On-Premise Architektur', description: 'Systemdiagramm und API Specifications für Self-Hosted Sovereign Flow.', icon: <LayoutPanelLeft className="h-4 w-4" />, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', tags: ['Tech', 'Architecture'] },
  { title: 'Website Content Metadaten', description: 'Extrahiert SEO & C2PA Metadaten für Website Relaunch Workflows.', icon: <Globe className="h-4 w-4" />, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', tags: ['Marketing', 'Web'] }
];

export function PromptsView() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 p-4 sm:p-6 lg:p-8">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Prompts & Vorlagen</h1>
          <p className="text-sm text-slate-500 mt-1">Verwalte deine wiederverwendbaren Agenten-Vorlagen für konsistente Workflows.</p>
        </div>
        <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 shadow-sm transition-all w-fit">
          <Plus className="h-4 w-4" />
          Neuer Prompt
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Vorlagen durchsuchen..." 
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-shadow"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {prompts.map((prompt, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-md transition-all group flex flex-col h-full cursor-pointer hover:border-blue-200">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-lg ${prompt.bg} ${prompt.color} ${prompt.border} border`}>
                {prompt.icon}
              </div>
              <button className="text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
            <h3 className="font-bold text-slate-900 mb-1.5">{prompt.title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-4 flex-1">
              {prompt.description}
            </p>
            <div className="flex gap-2">
              {prompt.tags.map((tag, j) => (
                <span key={j} className="text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center text-center hover:bg-slate-50 hover:border-blue-300 transition-all cursor-pointer min-h-[200px]">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-3 text-slate-400 group-hover:text-blue-600 transition-colors">
            <Plus className="h-6 w-6" />
          </div>
          <span className="font-semibold text-slate-600 text-sm">Leere Vorlage</span>
        </div>
      </div>
    </div>
  );
}
