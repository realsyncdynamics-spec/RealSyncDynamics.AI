import React from 'react';
import { User, Key, ShieldCheck, Database, Bell, Briefcase, Lock } from 'lucide-react';

export function SettingsView() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Einstellungen</h1>
        <p className="text-sm text-slate-500 mt-1">Verwalte deinen Sovereign Space, API Keys und Security Limits.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          <button className="px-6 py-3.5 text-sm font-semibold text-blue-600 border-b-2 border-blue-600 bg-blue-50/30">Profil & Space</button>
          <button className="px-6 py-3.5 text-sm font-semibold text-slate-500 hover:text-slate-800">Modelle & API</button>
          <button className="px-6 py-3.5 text-sm font-semibold text-slate-500 hover:text-slate-800">Security & GDPR</button>
        </div>

        <div className="p-6 space-y-8">
          
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-sm border-4 border-white ring-1 ring-slate-200">
              JS
            </div>
            <div>
              <button className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors">Bild hochladen</button>
              <p className="text-xs text-slate-400 mt-2">JPG oder PNG, max 2MB.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Voller Name</label>
              <input type="text" defaultValue="Jane Smith" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">E-Mail</label>
              <input type="email" defaultValue="jane.smith@realsync.de" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rolle</label>
              <input type="text" defaultValue="Director Digital Trust" disabled className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Passwort</label>
              <button className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 text-left transition-colors flex items-center justify-between">
                <span>••••••••</span>
                <span className="text-blue-600 text-xs">Ändern</span>
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><Briefcase className="h-4 w-4" /> Organisationsdetails</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Workspace Name</label>
                <input type="text" defaultValue="RealSync Corp" className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          <div>
             <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><Key className="h-4 w-4" /> Bring Your Own Key (BYOK)</h3>
             <div className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">OpenAI API Key (GPT-4/5)</label>
                   <input type="password" placeholder="sk-..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Anthropic API Key (Claude)</label>
                   <input type="password" placeholder="sk-ant-..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" />
                 </div>
               </div>
               <p className="text-xs text-slate-400 mt-2">API Keys werden ausschließlich sicher im lokalen Speicher (localStorage) deines Browsers aufbewahrt.</p>
             </div>
          </div>

          <hr className="border-slate-100" />

          <div>
             <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><Lock className="h-4 w-4" /> Standard Policy (EU)</h3>
             <div className="flex items-center justify-between p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
               <div>
                  <p className="text-sm font-bold text-slate-900">Strict EU Compliance Mode erzwingen</p>
                  <p className="text-xs text-slate-500 mt-0.5">Startet alle neuen Chats & Workflows standardmäßig im DSGVO/AI Act konformen Modus.</p>
               </div>
               <button className="w-12 h-6 bg-indigo-600 rounded-full relative transition-colors shadow-sm">
                  <div className="w-4 h-4 bg-white rounded-full absolute top-1 left-7 shadow"></div>
               </button>
             </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Abbrechen</button>
            <button className="px-5 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 shadow-sm transition-colors">Speichern</button>
          </div>

        </div>
      </div>
    </div>
  );
}
