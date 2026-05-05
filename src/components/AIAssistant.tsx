import React, { useState } from 'react';
import { Bot, Send, Sparkles, AlertCircle, Cpu, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import { processAIGatewayRequest, ModelProvider } from '../core/ai-gateway/gateway';

export function AIAssistant() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<ModelProvider>('gemini');
  const [useContext, setUseContext] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError('');
    setResponse('');

    try {
      let extractedContext = undefined;
      if (useContext) {
        const selection = window.getSelection()?.toString();
        if (selection && selection.trim().length > 0) {
          extractedContext = `[Vom Nutzer markierter Text]:\n${selection}`;
        } else {
          // Fallback to the entire main content
          const mainContent = document.querySelector('main')?.innerText;
          if (mainContent) {
            extractedContext = `[Inhalt der gesamten Seite]:\n${mainContent.substring(0, 4000)}`;
          }
        }
      }

      const result = await processAIGatewayRequest({
        prompt: prompt,
        provider: provider,
        context: extractedContext
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      setResponse(result.modelOutput || 'Keine Antwort generiert.');
    } catch (err: any) {
      console.error('Gateway Error:', err);
      setError(err.message || 'Ein Fehler ist im AI-Gateway aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="py-24 bg-obsidian-950 border-t border-titanium-900" id="ai-assistant">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-security-900/40 text-security-300 mb-6 shadow-sm border border-security-700/50">
            <Cpu className="h-4 w-4" />
            <span className="text-xs font-bold tracking-widest uppercase">RealSync Multi-Model Gateway</span>
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-titanium-50 sm:text-4xl">
            Sovereign Copilot
          </h2>
          <p className="mt-4 text-lg text-titanium-400 font-light">
            Ein dediziertes API-Gateway. Wählen Sie Ihr favorisiertes Modell für sichere C2PA- und Architektur-Analysen.
          </p>
        </div>

        <div className="bg-obsidian-900 rounded-[2rem] border border-titanium-900 shadow-2xl shadow-slate-200/50 overflow-hidden ring-1 ring-slate-900/5">
          <div className="p-5 bg-obsidian-950 border-b border-titanium-900 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-none bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-inner border border-white/10">
                <Bot className="h-5 w-5 text-white drop-shadow-md" />
              </div>
              <div>
                <h3 className="font-display font-semibold tracking-tight text-white">Copilot Interface</h3>
                <p className="text-xs text-titanium-500">Powered by RealSync Gateway</p>
              </div>
            </div>
            
            <div>
              <select 
                value={provider} 
                onChange={(e) => setProvider(e.target.value as ModelProvider)}
                className="bg-obsidian-800 text-white border border-titanium-800 text-sm rounded-none focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none cursor-pointer"
              >
                <option value="gemini">Gemini 3.1 Pro</option>
                <option value="claude">Claude 4.6</option>
                <option value="openai">GPT-5</option>
              </select>
            </div>
          </div>

          <div className="p-6 md:p-8 min-h-[300px] max-h-[450px] overflow-y-auto bg-obsidian-950">
            {error && (
              <div className="p-4 bg-red-950/50/80 text-red-300 rounded-none mb-4 flex items-start gap-3 border border-red-900">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-400" />
                <p className="text-sm">{error}</p>
              </div>
            )}
            
            {response ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="prose prose-slate prose-headings:font-display prose-headings:tracking-tight max-w-none"
              >
                <div className="markdown-body p-6 bg-obsidian-900 rounded-none border border-titanium-900 shadow-sm text-titanium-200 leading-relaxed text-sm lg:text-base">
                  <Markdown>{response}</Markdown>
                </div>
              </motion.div>
            ) : !isLoading && !error ? (
              <div className="h-full flex flex-col items-center justify-center text-titanium-500 py-16">
                <div className="w-16 h-16 rounded-none bg-obsidian-900 border border-titanium-900 flex items-center justify-center mb-6 shadow-sm">
                  <Sparkles className="h-8 w-8 text-titanium-600" />
                </div>
                <p className="font-medium text-titanium-400">Gateway ist bereit.</p>
                <p className="text-sm mt-2 font-light">Eingaben werden an <strong className="font-semibold">{provider.toUpperCase()}</strong> geroutet.</p>
              </div>
            ) : null}

            {isLoading && (
              <div className="flex items-center gap-3 py-8 px-2">
                <div className="flex gap-1.5 p-4 bg-obsidian-900 rounded-none border border-titanium-900 shadow-sm w-max">
                  <div className="w-2 h-2 bg-security-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-security-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-security-500 rounded-full animate-bounce"></div>
                </div>
              </div>
            )}
          </div>

          <div className="p-5 bg-obsidian-900 border-t border-titanium-900 flex flex-col gap-3">
            <div className="flex items-center gap-3 px-1">
              <button
                type="button"
                onClick={() => setUseContext(!useContext)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  useContext 
                    ? 'bg-security-900/30 text-security-300 border border-security-700/50 shadow-sm' 
                    : 'bg-obsidian-950 text-titanium-400 border border-titanium-900 hover:bg-obsidian-800'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                {useContext ? 'Seitenkontext aktiviert' : 'Seitenkontext einlesen'}
              </button>
              {useContext && (
                <span className="text-xs text-titanium-500 font-light hidden sm:inline-block">
                  Markiere Text für gezielte Fragen.
                </span>
              )}
            </div>
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`Nachricht an ${provider} senden...`}
                className="w-full bg-obsidian-950 border border-titanium-900 rounded-none py-4 pl-6 pr-16 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-obsidian-900 focus:border-indigo-500 transition-all text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="absolute right-2 p-2.5 bg-obsidian-950 text-white rounded-none hover:bg-obsidian-800 disabled:opacity-40 disabled:hover:bg-obsidian-950 transition-colors shadow-sm"
                aria-label="Senden"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
