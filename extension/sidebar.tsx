// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, Send, Settings, Sparkles, X, Globe } from 'lucide-react';
import { processAIGatewayRequest, ModelProvider } from '../src/core/ai-gateway/gateway';
import Markdown from 'react-markdown';

type Message = { role: 'user' | 'ai', text: string, status?: 'loading' | 'error' | 'success' };

function Sidebar() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [provider, setProvider] = useState<ModelProvider>('gemini');
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<string | undefined>();
  const [useContext, setUseContext] = useState(false);

  // Lauscher für markierten Text (Kontextmenü)
  useEffect(() => {
    const listener = (msg: any) => {
      if (msg.type === 'CONTEXT_SELECTION') {
        setContext(msg.payload);
      }
    };
    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(listener);
    }
    return () => chrome?.runtime?.onMessage?.removeListener(listener);
  }, []);

  const handleSend = async () => {
    if (!input.trim() && !context && !useContext) return;
    
    // We send input, if it's empty but we have context, maybe we use a default prompt.
    const promptText = input.trim() ? input : "Bitte analysiere diesen markierten Inhalt.";
    
    const newMessages: Message[] = [...messages, { role: 'user', text: promptText, status: 'success' }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      let finalContext = context || '';

      // Dynamically fetch context from active tab if useContext is enabled
      if (useContext && globalThis.chrome?.tabs && globalThis.chrome?.scripting) {
        const dynamicContext = await new Promise<string | null>((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab && activeTab.id) {
              chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                func: () => {
                  const selection = window.getSelection()?.toString();
                  if (selection && selection.trim().length > 0) {
                    return `[Nutzer Selection Context]:\n${selection}`;
                  }
                  return `[Current Page Context]:\n${document.body.innerText.substring(0, 4000)}`;
                }
              }, (results) => {
                if (results && results[0] && results[0].result) {
                  resolve(results[0].result);
                } else {
                  resolve(null);
                }
              });
            } else {
              resolve(null);
            }
          });
        });
        
        if (dynamicContext) {
           finalContext = finalContext ? `${finalContext}\n\n${dynamicContext}` : dynamicContext;
        }
      }

      const response = await processAIGatewayRequest({
        prompt: promptText,
        provider: provider,
        context: finalContext.trim() !== '' ? finalContext : undefined
      });

      if (!response.success) {
        throw new Error(response.error || 'Gateway Fehler');
      }

      setMessages([...newMessages, { role: 'ai', text: response.modelOutput || '', status: 'success' }]);
      // Clear explicit context after sending so it's not reused unintentionally. 
      // We keep useContext active for continuous conversation about the page.
      setContext(undefined);
    } catch (err: any) {
      setMessages([...newMessages, { role: 'ai', text: err.message || 'Fehler beim Abruf der Antwort.', status: 'error' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 rounded-md">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <select 
            value={provider} 
            onChange={e => setProvider(e.target.value as ModelProvider)}
            className="text-sm font-semibold bg-transparent border-none outline-none cursor-pointer focus:ring-0 text-slate-800"
          >
            <option value="gemini">Gemini 3.1 Pro</option>
            <option value="claude">Claude 4.6</option>
            <option value="openai">GPT-5</option>
          </select>
        </div>
        <button className="text-slate-400 hover:text-slate-600 transition-colors">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Sparkles className="w-8 h-8 mb-4 opacity-50 text-blue-600" />
            <p className="text-sm text-center px-4">Highlight text on a webpage and use the context menu to send it to the AI.</p>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] p-3 text-[14px] leading-relaxed shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm'
            }`}>
              {msg.status === 'error' ? (
                <span className="text-red-500 font-medium">{msg.text}</span>
              ) : msg.role === 'ai' ? (
                <div className="prose prose-sm prose-slate max-w-none">
                  <Markdown>{msg.text}</Markdown>
                </div>
              ) : (
                <span className="whitespace-pre-wrap">{msg.text}</span>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 py-3 px-4 rounded-2xl rounded-tl-sm flex gap-1.5 items-center shadow-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-slate-200 flex flex-col gap-2">
        
        {useContext && !context && (
           <div className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-md flex justify-between items-center text-xs text-blue-800">
             <div className="flex items-center gap-1.5 truncate">
               <Globe className="w-3 h-3 flex-shrink-0" />
               <span className="font-semibold whitespace-nowrap">Seitenkontext aktiv:</span>
               <span className="truncate opacity-80">Aktueller Tab-Inhalt wird mitgeschickt.</span>
             </div>
             <button onClick={() => setUseContext(false)} className="ml-2 hover:bg-blue-200 p-0.5 rounded-sm transition">
               <X className="w-3 h-3" />
             </button>
           </div>
        )}

        {context && (
           <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-md flex justify-between items-center text-xs text-indigo-800">
             <div className="flex items-center gap-1.5 truncate">
               <span className="font-semibold whitespace-nowrap">Markierter Text:</span>
               <span className="truncate opacity-80">"{context.substring(0, 40)}..."</span>
             </div>
             <button onClick={() => setContext(undefined)} className="ml-2 hover:bg-indigo-200 p-0.5 rounded-sm transition">
               <X className="w-3 h-3" />
             </button>
           </div>
        )}

        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-300 transition-all">
          <button 
            type="button"
            onClick={() => setUseContext(!useContext)}
            className={`absolute left-2 p-1.5 rounded-lg transition-colors z-10 ${useContext ? 'text-blue-600 bg-blue-100 hover:bg-blue-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`} 
            title={useContext ? "Seitenkontext aktiviert" : "Seitenkontext lesen"}
          >
            <Globe className="w-4 h-4" />
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
            placeholder={context || useContext ? "Frage zum Kontext..." : "Frag AI..."}
            rows={1}
            className="w-full bg-transparent border-none py-3 pl-[2.75rem] pr-12 text-sm focus:outline-none resize-none placeholder:text-slate-400"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button 
            onClick={handleSend}
            disabled={(!input.trim() && !context && !useContext) || isLoading}
            className="absolute right-2 p-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<Sidebar />);
}
