import { useState, useRef, useEffect } from 'react';
import { useAgenticTerminal } from './useAgenticTerminal';
import { Copy, ChevronRight } from 'lucide-react';

const COMMAND_SUGGESTIONS = [
  { cmd: '/scan', desc: 'Scan website for AI systems' },
  { cmd: '/upgrade', desc: 'Upgrade subscription tier' },
  { cmd: '/audit', desc: 'Generate compliance audit' },
  { cmd: '/register', desc: 'Create account' },
  { cmd: '/pay', desc: 'Request invoice' },
  { cmd: '/help', desc: 'Show help' },
  { cmd: '/status', desc: 'Account status' },
  { cmd: '/history', desc: 'Recent scans & audits' },
];

export function TerminalInterface() {
  const { messages, isExecuting, error, executeCommand, sessionId } = useAgenticTerminal();
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<typeof COMMAND_SUGGESTIONS>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (value: string) => {
    setInputValue(value);

    if (value.startsWith('/')) {
      const searchTerm = value.toLowerCase();
      const filtered = COMMAND_SUGGESTIONS.filter(
        (s) => s.cmd.includes(searchTerm) || s.desc.toLowerCase().includes(searchTerm)
      );
      setSuggestions(filtered.slice(0, 4));
    } else {
      setSuggestions([]);
    }
  };

  const handleExecute = async () => {
    if (!inputValue.trim()) return;

    await executeCommand(inputValue);
    setInputValue('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isExecuting) {
      handleExecute();
    } else if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      setInputValue(suggestions[0].cmd + ' ');
      setSuggestions([]);
    }
  };

  const formatMessage = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => (
      <div key={idx} className="font-mono text-sm leading-relaxed">
        {line}
      </div>
    ));
  };

  const getMessageColor = (type?: string) => {
    switch (type) {
      case 'error':
        return 'text-red-400';
      case 'info':
        return 'text-blue-400';
      case 'command':
        return 'text-green-400';
      default:
        return 'text-titanium-300';
    }
  };

  const getTimestampFormat = (date: Date): string => {
    const ms = date.getMilliseconds();
    return `T+${date.getSeconds()}.${Math.floor(ms / 100)}s`;
  };

  return (
    <div className="flex flex-col h-full bg-obsidian-900 border border-titanium-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-titanium-700 bg-obsidian-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="font-mono text-sm text-titanium-400">
              RealSync Governance Runtime (Beta)
            </span>
          </div>
          {sessionId && (
            <span className="font-mono text-xs text-titanium-600">
              Session: sess_{sessionId.slice(0, 8)}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-titanium-500 text-sm font-mono">
            Type /help for available commands.
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="space-y-1">
              <div className="flex items-start gap-2">
                <span className="text-titanium-600 font-mono text-xs whitespace-nowrap">
                  {getTimestampFormat(msg.timestamp)}
                </span>
                <span className={`font-mono text-xs whitespace-nowrap ${getMessageColor(msg.type)}`}>
                  {msg.role === 'user' ? '❯' : msg.role === 'agent' ? '🤖' : '•'}
                </span>
              </div>
              <div className={`ml-12 font-mono text-sm ${getMessageColor(msg.type)}`}>
                {formatMessage(msg.content)}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-red-900 border-t border-red-700">
          <div className="text-red-300 font-mono text-xs">{error}</div>
        </div>
      )}

      {/* Suggestions Dropdown */}
      {suggestions.length > 0 && (
        <div className="px-4 py-2 bg-obsidian-800 border-t border-titanium-700 space-y-1">
          {suggestions.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 text-titanium-500 hover:text-titanium-300 cursor-pointer text-xs font-mono hover:bg-obsidian-700 px-2 py-1 rounded"
              onClick={() => {
                setInputValue(s.cmd + ' ');
                setSuggestions([]);
                inputRef.current?.focus();
              }}
            >
              <span className="text-blue-400">{s.cmd}</span>
              <span className="text-titanium-600">— {s.desc}</span>
            </div>
          ))}
        </div>
      )}

      {/* Input Section */}
      <div className="px-4 py-3 border-t border-titanium-700 bg-obsidian-800">
        <div className="flex items-center gap-2">
          <span className="text-titanium-600 font-mono text-sm">❯</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type command (e.g., /scan, /help)"
            disabled={isExecuting}
            className="flex-1 bg-obsidian-900 border border-titanium-700 rounded px-3 py-2 font-mono text-sm text-titanium-300 placeholder-titanium-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            autoFocus
          />
          <button
            onClick={handleExecute}
            disabled={isExecuting || !inputValue.trim()}
            className="p-2 text-titanium-400 hover:text-titanium-300 disabled:opacity-50 hover:bg-titanium-800 rounded transition-colors"
            title="Execute (Enter)"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="text-xs text-titanium-600 mt-2">
          Tip: Use Tab to autocomplete commands, type /help for all available commands
        </div>
      </div>
    </div>
  );
}
