import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, Settings, CreditCard, ChevronDown,
  Bot, Sparkles, Send, Paperclip, FileText,
  LayoutPanelLeft, CheckCircle2, Shield, Plus,
  MessageSquare, FolderKanban, Star, Copy, Save,
  AlertTriangle, X, Search, Globe, Library, UploadCloud,
  Server
} from 'lucide-react';
import { processAIGatewayRequest, ModelProvider } from '../core/ai-gateway/gateway';
import Markdown from 'react-markdown';
import { WorkflowsView } from '../features/workflows/WorkflowsView';
import { AssetsView } from '../features/assets/AssetsView';
import { PromptsView } from '../features/workspace/PromptsView';
import { SettingsView } from '../features/settings/SettingsView';
import { BillingView } from '../features/billing/BillingView';

type Message = { role: 'user' | 'ai', text: string, status?: 'loading' | 'error' | 'success' };
type ThreadMode = 'chat' | 'research' | 'policy' | 'roi';

export function CreatorDashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<'context' | 'files' | 'params'>('params');
  const [selectedModel, setSelectedModel] = useState<ModelProvider>('gemini');
  const [selectedMode, setSelectedMode] = useState<ThreadMode>('chat');
  const [isStrictEU, setIsStrictEU] = useState(true);
  const [activeView, setActiveView] = useState<'chat' | 'assets' | 'workflows' | 'prompts' | 'settings' | 'billing'>('chat');
  const [useContext, setUseContext] = useState(false);

  const handleSend = async (overridePrompt?: string) => {
    setActiveView('chat'); // Ensure we are in chat view
    const promptText = overridePrompt || input;
    if (!promptText.trim()) return;

    const newMessages: Message[] = [...messages, { role: 'user', text: promptText, status: 'success' }];
    setMessages([...newMessages, { role: 'ai', text: '', status: 'loading' }]);
    setInput('');

    try {
      let extractedContext = isStrictEU ? '[STRICT EU COMPLIANCE MODE ACTIVE]\n\n' : '';
      if (useContext) {
        const selection = window.getSelection()?.toString();
        if (selection && selection.trim().length > 0) {
          extractedContext += `[Nutzer Selection Context]:\n${selection}`;
        } else {
          // Grab the main dashboard content if nothing is selected
          const mainContent = document.querySelector('main')?.innerText;
          if (mainContent) {
             extractedContext += `[Current View Context]:\n${mainContent.substring(0, 4000)}`;
          }
        }
      }

      const response = await processAIGatewayRequest({
        prompt: promptText,
        provider: selectedModel,
        context: extractedContext.trim() !== '' ? extractedContext : undefined
      });

      if (!response.success) throw new Error(response.error || 'Gateway Fehler');

      setMessages([...newMessages, { role: 'ai', text: response.modelOutput || '', status: 'success' }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'ai', text: 'Fehler beim Modellaufruf – bitte erneut senden oder anderes Modell wählen.', status: 'error' }]);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-white font-sans overflow-hidden text-slate-800">
      
      {/* 1. Global Header (Thin) */}
      <header className="h-14 shrink-0 border-b border-slate-200/60 bg-white flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-slate-900 p-1.5 rounded-lg shadow-sm">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-slate-900 hidden sm:block">
              RealSync<span className="text-slate-500 font-medium">Dynamics</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center bg-slate-100/50 p-1 rounded-lg border border-slate-200/50">
            <button className="px-3 py-1 text-sm font-medium bg-white shadow-sm rounded-md text-slate-900">Chat</button>
            <button className="px-3 py-1 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">Research</button>
            <button className="px-3 py-1 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">Automations</button>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as ModelProvider)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg pl-3 pr-8 py-1.5 outline-none hover:bg-slate-100 cursor-pointer font-medium"
            >
              <option value="gemini">Gemini 3.1 Pro</option>
              <option value="claude">Claude 4.6</option>
              <option value="openai">GPT-5</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-sm border-2 border-white ring-1 ring-slate-200">
            JS
          </div>
        </div>
      </header>

      {/* Main 3-Column Area */}
      <div className="flex flex-1 overflow-hidden bg-white">
        
        {/* 2. Left Column - Navigation & Spaces */}
        <aside className="w-[260px] shrink-0 border-r border-slate-200/60 bg-slate-50 flex flex-col hidden md:flex">
          <div className="p-3">
            <button 
              onClick={() => setMessages([])}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm font-semibold shadow-[0_2px_10px_rgba(37,99,235,0.2)] transition-all"
            >
              <Plus className="h-4 w-4" />
              Neuer Agenten-Run
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto py-2">
            <div className="px-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Spaces</div>
            <nav className="space-y-0.5 px-2 mb-6">
              <button 
                onClick={() => setActiveView('chat')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'chat' ? 'bg-slate-200/50 text-slate-900' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'}`}
              >
                <MessageSquare className={`h-4 w-4 ${activeView === 'chat' ? 'text-blue-600' : ''}`} /> Alle Chats
              </button>
              <button 
                onClick={() => setActiveView('assets')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'assets' ? 'bg-slate-200/50 text-slate-900' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'}`}
              >
                <ShieldCheck className={`h-4 w-4 ${activeView === 'assets' ? 'text-blue-600' : ''}`} /> C2PA Assets
              </button>
              <button
                onClick={() => setActiveView('workflows')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'workflows' ? 'bg-slate-200/50 text-slate-900' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'}`}
              >
                <FolderKanban className={`h-4 w-4 ${activeView === 'workflows' ? 'text-blue-600' : ''}`} /> Workflows
              </button>
              <Link
                to="/kodee"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 transition-colors"
              >
                <Server className="h-4 w-4 text-emerald-600" /> Kodee · VPS Sidekick
              </Link>
            </nav>

            <div className="px-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              Favoriten <Plus className="h-3 w-3 cursor-pointer hover:text-slate-600" />
            </div>
            <nav className="space-y-0.5 px-2 text-sm text-slate-600 font-medium">
              <button onClick={() => setActiveView('chat')} className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-200/50 rounded-lg transition-colors">
                <Star className="h-3.5 w-3.5 text-amber-400" /> Maschinenbau GmbH
              </button>
              <button onClick={() => setActiveView('chat')} className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-200/50 rounded-lg transition-colors">
                <Star className="h-3.5 w-3.5 text-amber-400" /> Policy Blueprint Q2
              </button>
            </nav>
          </div>

          <div className="p-3 border-t border-slate-200/60 bg-white/50 space-y-0.5">
            <button 
              onClick={() => setActiveView('prompts')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'prompts' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <Library className="h-4 w-4" /> Prompts & Vorlagen
            </button>
            <button 
              onClick={() => setActiveView('settings')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'settings' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <Settings className="h-4 w-4" /> Einstellungen
            </button>
            <button
              onClick={() => setActiveView('billing')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'billing' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <div className="flex items-center gap-2.5"><CreditCard className="h-4 w-4" /> Billing / Plan</div>
              <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold tracking-wider">GOLD</span>
            </button>
            <Link
              to="/billing/usage"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <Bot className="h-4 w-4 text-indigo-600" /> Verbrauch & Limits
            </Link>
          </div>
        </aside>

        {/* 3. Main Area */}
        {activeView === 'chat' ? (
          <>
            <main className="flex-1 flex flex-col min-w-0 bg-white relative">
              
              {/* Middle Header */}
              <div className="shrink-0 pt-4 px-4 sm:px-6 pb-2 border-b border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h1 className="text-xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-2 cursor-text hover:bg-slate-50 p-1 -ml-1 rounded transition-colors group">
                    Kunde: Maschinenbau GmbH – Discovery <div className="invisible group-hover:visible h-4 w-4 bg-slate-200 rounded shrink-0 flex items-center justify-center"><ChevronDown className="h-3 w-3" /></div>
                  </h1>
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
                      <Bot className="h-3.5 w-3.5" /> {selectedModel.toUpperCase()}
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
                      <Sparkles className="h-3.5 w-3.5" /> {selectedMode.toUpperCase()}
                    </span>
                    <button 
                      onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                      className={`p-1.5 rounded-md transition-colors ${isRightPanelOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}
                    >
                      <LayoutPanelLeft className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Context Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50/50 border border-blue-100/50 rounded-lg px-3 py-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-slate-600">
                    <span className="font-semibold text-blue-700 hidden sm:inline">Kontext:</span>
                    <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm"><Globe className="h-3 w-3 text-slate-400" /> maschinenbau-gmbh.de/agb</span>
                    <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm"><FileText className="h-3 w-3 text-slate-400" /> last_audit.pdf</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-blue-600 font-medium hover:underline">Bearbeiten</button>
                    <span className="text-slate-300 hidden sm:inline">|</span>
                    <button className="flex items-center gap-1 text-slate-600 font-medium hover:text-slate-900"><Plus className="h-3 w-3" /> Mehr anhängen</button>
                  </div>
                </div>
              </div>

              {/* Chat Feed */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
                {messages.length === 0 ? (
                  // Empty State
                  <div className="h-full flex flex-col items-center justify-center animate-in fade-in duration-500 py-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                      <Sparkles className="h-8 w-8 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-slate-900 mb-8 text-center px-4">Was möchtest du heute machen?</h2>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl px-4">
                      <button onClick={() => handleSend("Starte eine Discovery für den Kunden Maschinenbau GmbH based auf deren AGBs.")} className="flex items-center gap-3 p-4 bg-white border border-slate-200/80 rounded-xl hover:border-blue-400 hover:shadow-md transition-all text-left group">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors"><Search className="h-4 w-4" /></div>
                        <div>
                          <h4 className="font-semibold text-slate-900 text-sm">Discovery starten</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Analysiert die referenzierten URLs</p>
                        </div>
                      </button>
                      <button onClick={() => handleSend("Bereite ein Betriebsrat-Informationspaket zur C2PA Einführung vor.")} className="flex items-center gap-3 p-4 bg-white border border-slate-200/80 rounded-xl hover:border-emerald-400 hover:shadow-md transition-all text-left group">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors"><Shield className="h-4 w-4" /></div>
                        <div>
                          <h4 className="font-semibold text-slate-900 text-sm">Betriebsrat-Paket</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Generiert standardisiertes Info-Material</p>
                        </div>
                      </button>
                      <button onClick={() => handleSend("Entwickle einen Policy-Blueprint für den CreatorSeal.")} className="flex items-center gap-3 p-4 bg-white border border-slate-200/80 rounded-xl hover:border-purple-400 hover:shadow-md transition-all text-left group">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors"><FileText className="h-4 w-4" /></div>
                        <div>
                          <h4 className="font-semibold text-slate-900 text-sm">Policy-Blueprint</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Erstellt C2PA Compliance Richtlinien</p>
                        </div>
                      </button>
                      <button onClick={() => handleSend("Skizziere die Architektur für die LocalFlow On-Premise Integration.")} className="flex items-center gap-3 p-4 bg-white border border-slate-200/80 rounded-xl hover:border-amber-400 hover:shadow-md transition-all text-left group">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-600 group-hover:text-white transition-colors"><LayoutPanelLeft className="h-4 w-4" /></div>
                        <div>
                          <h4 className="font-semibold text-slate-900 text-sm">Architektur skizzieren</h4>
                          <p className="text-xs text-slate-500 mt-0.5">System-Diagramme & API Specs</p>
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto space-y-8 pb-10">
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        
                        {msg.role === 'ai' && (
                          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mr-4 shadow-sm mt-1">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}
                        
                        <div className={`max-w-[85%] ${
                          msg.role === 'user' 
                            ? 'bg-slate-100 text-slate-900 px-5 py-3.5 rounded-2xl rounded-tr-sm text-[15px] shadow-sm' 
                            : 'w-full'
                        }`}>
                          {msg.status === 'loading' ? (
                            <div className="flex items-center gap-3 text-slate-400 py-2">
                              <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce"></span>
                              </div>
                              <span className="text-sm font-medium">EU Agent OS denkt...</span>
                            </div>
                          ) : msg.status === 'error' ? (
                            <div className="bg-red-50 border border-red-100 text-red-700 px-5 py-4 rounded-2xl flex items-start gap-3">
                              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                              <span className="text-sm">{msg.text}</span>
                            </div>
                          ) : msg.role === 'user' ? (
                            msg.text
                          ) : (
                            <div className="group">
                              <div className="prose prose-slate prose-headings:font-display prose-headings:tracking-tight prose-a:text-blue-600 max-w-none text-[15px] leading-relaxed">
                                <Markdown>{msg.text}</Markdown>
                              </div>
                              
                              {/* AI Block Actions */}
                              <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-xs font-semibold text-slate-600 transition-colors">
                                  <Copy className="h-3.5 w-3.5" /> Copy
                                </button>
                                <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-xs font-semibold text-slate-600 transition-colors">
                                  <Save className="h-3.5 w-3.5" /> In Notizen
                                </button>
                                <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md text-xs font-semibold text-blue-700 transition-colors">
                                  Als Task/Agent speichern
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="shrink-0 p-4 bg-white border-t border-slate-200/60 z-10 flex flex-col gap-2">
                
                {useContext && (
                  <div className="max-w-3xl mx-auto w-full flex items-center justify-between px-3 py-2 bg-blue-50/50 border border-blue-100 rounded-lg text-xs">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Globe className="h-3.5 w-3.5" />
                      <span className="font-semibold">Seitenkontext aktiv:</span>
                      <span className="truncate opacity-80 max-w-[200px] sm:max-w-[400px]">Der aktuelle Screen-Inhalt wird bei Sendung mitgeschickt.</span>
                    </div>
                    <button onClick={() => setUseContext(false)} className="text-blue-400 hover:text-blue-700 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <div className="max-w-3xl mx-auto w-full relative flex items-end gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all">
                  <button 
                    type="button"
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/50 transition-colors mb-1" 
                    title="Prompts & Vorlagen"
                  >
                    <Library className="h-5 w-5" />
                  </button>
                  <button 
                    type="button"
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/50 transition-colors mb-1" 
                    title="Datei anhängen"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setUseContext(!useContext)}
                    className={`p-2 rounded-xl transition-colors mb-1 ${useContext ? 'text-blue-600 bg-blue-100 hover:bg-blue-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'}`} 
                    title={useContext ? "Seitenkontext aktiviert" : "Seitenkontext lesen"}
                  >
                    <Globe className="h-5 w-5" />
                  </button>
                  
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Frage eingeben oder One-Liner-Prompt einfügen…"
                    className="flex-1 max-h-40 min-h-[44px] bg-transparent resize-none py-3 px-2 text-[15px] outline-none text-slate-800 placeholder:text-slate-400 scrollbar-hide"
                    rows={1}
                  />
                  
                  <div className="flex flex-col items-end gap-2 mb-1 shrink-0">
                    <select 
                      value={selectedMode}
                      onChange={(e) => setSelectedMode(e.target.value as ThreadMode)}
                      className="hidden sm:block text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 outline-none cursor-pointer hover:bg-slate-50"
                      title="Agenten Modus"
                    >
                      <option value="chat">Chat Modus</option>
                      <option value="research">Deep Research</option>
                      <option value="policy">Policy Check</option>
                      <option value="roi">ROI Analyse</option>
                    </select>
                    <button 
                      onClick={() => handleSend()}
                      disabled={!input.trim()}
                      className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="text-center mt-3">
                  <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                    RealSync Sovereign AI kann Fehler machen. Verifizieren Sie geschäftskritische Outputs.
                  </span>
                </div>
              </div>
            </main>

            {/* 4. Right Column - Context / Parameters */}
            {isRightPanelOpen && (
              <aside className="w-[320px] shrink-0 border-l border-slate-200/60 bg-slate-50 hidden lg:flex flex-col animate-in slide-in-from-right-8 duration-300">
                {/* Tabs */}
                <div className="flex px-3 pt-4 gap-2 border-b border-slate-200/60">
                  <button 
                    onClick={() => setActiveRightTab('context')}
                    className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${activeRightTab === 'context' ? 'border-blue-600 text-blue-600 mb-[calc(-1px)]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    Kontext
                  </button>
                  <button 
                    onClick={() => setActiveRightTab('files')}
                    className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${activeRightTab === 'files' ? 'border-blue-600 text-blue-600 mb-[calc(-1px)]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    Dateien
                  </button>
                  <button 
                    onClick={() => setActiveRightTab('params')}
                    className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${activeRightTab === 'params' ? 'border-blue-600 text-blue-600 mb-[calc(-1px)]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    Parameter
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-5">
                  
                  {activeRightTab === 'context' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-200 transition-colors">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          <Globe className="h-3.5 w-3.5" /> Aktuelle Domain
                        </div>
                        <p className="text-sm font-medium text-slate-900 truncate">maschinenbau-gmbh.de</p>
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-3">"Allgemeine Geschäftsbedingungen der Maschinenbau GmbH für digitale Dienstleistungen. Stand: Q2/2026. Diese Richtlinie regelt die Verarbeitung..."</p>
                        <div className="mt-4 flex gap-2">
                          <button className="flex-1 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors">Sammeln</button>
                          <button className="flex-1 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors">Zusammenfassen</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeRightTab === 'files' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-start gap-3 group hover:border-red-200 transition-colors">
                        <div className="p-2 bg-red-50 text-red-600 rounded-lg shrink-0"><FileText className="h-5 w-5" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">last_audit_report.pdf</p>
                          <p className="text-xs text-slate-500 mt-0.5">2.4 MB • Als Kontext aktiv</p>
                        </div>
                        <button className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-4 w-4" /></button>
                      </div>
                      
                      <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all flex flex-col items-center justify-center gap-1.5">
                        <UploadCloud className="h-5 w-5" /> Dateien hochladen
                      </button>
                    </div>
                  )}

                  {activeRightTab === 'params' && (
                    <div className="space-y-6">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Agenten-Typ</label>
                        <select className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm appearance-none">
                          <option>Discovery & Analyse</option>
                          <option>Betriebsrat & Compliance</option>
                          <option>Data Policy Generator</option>
                          <option>Architektur & Code</option>
                          <option>ROI & Business Case</option>
                        </select>
                      </div>

                      <div className="space-y-3 p-4 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-indigo-700" />
                            <span className="text-sm font-bold text-slate-900 tracking-tight">Strict EU-Compliance</span>
                          </div>
                          <button 
                            onClick={() => setIsStrictEU(!isStrictEU)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${isStrictEU ? 'bg-indigo-600' : 'bg-slate-300'}`}
                          >
                            <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 shadow-sm transition-transform ${isStrictEU ? 'translate-x-[22px]' : 'translate-x-1'}`}></div>
                          </button>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          Erzwingt das strenge System-Prompt Set (DSGVO, eIDAS, AI Act) bei jedem Modell-Aufruf in diesem Thread.
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Provider API Key <span className="normal-case text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded ml-1">BYO</span></label>
                        <input 
                          type="password" 
                          placeholder="sk-..." 
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm placeholder:text-slate-300" 
                        />
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">Lassen Sie dieses Feld leer, um die RealSync Gateway Quota zu nutzen.</p>
                      </div>
                    </div>
                  )}

                </div>
              </aside>
            )}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto bg-slate-50/50">
            {activeView === 'assets' && <AssetsView />}
            {activeView === 'workflows' && <div className="p-4 sm:p-6 lg:p-8"><WorkflowsView /></div>}
            {activeView === 'prompts' && <PromptsView />}
            {activeView === 'settings' && <SettingsView />}
            {activeView === 'billing' && <BillingView />}
          </div>
        )}
      </div>
    </div>
  );
}
