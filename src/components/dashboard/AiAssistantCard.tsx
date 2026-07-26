import React from 'react';
import { Sparkles, MessageCircle, TrendingUp, FileText, Zap } from 'lucide-react';

interface AiAction {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

interface AiAssistantCardProps {
  title?: string;
  subtitle?: string;
  actions?: AiAction[];
  className?: string;
  onActionClick?: (actionLabel: string) => void;
}

export const AiAssistantCard: React.FC<AiAssistantCardProps> = ({
  title = '🤖 AI Compliance Assistant',
  subtitle = 'Intelligente Unterstützung für Ihre Compliance-Anforderungen',
  actions = [
    { label: 'Risiko analysieren', icon: <TrendingUp size={18} /> },
    { label: 'Audit vorbereiten', icon: <MessageCircle size={18} /> },
    { label: 'Maßnahmen generieren', icon: <Zap size={18} /> },
    { label: 'ISO-Bericht erstellen', icon: <FileText size={18} /> },
  ],
  className = '',
  onActionClick,
}) => {
  return (
    <div
      className={`group relative overflow-hidden rounded-none border border-security-blue/30 bg-gradient-to-br from-security-blue/10 to-obsidian-900 p-8 transition-all duration-300 hover:border-security-blue/50 hover:from-security-blue/15 ${className}`}
    >
      {/* Accent line */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-1 bg-gradient-to-r from-security-blue to-transparent" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Sparkles size={24} className="text-security-blue" />
          <h3 className="text-lg font-display font-semibold text-white">{title}</h3>
        </div>
        <p className="text-sm text-titanium/70 mb-6">{subtitle}</p>

        {/* Action Grid */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => onActionClick?.(action.label)}
              className="group/btn flex flex-col items-center gap-2 px-4 py-3 rounded-none border border-security-blue/20 bg-obsidian/50 transition-all duration-200 hover:border-security-blue/50 hover:bg-security-blue/5"
            >
              <span className="text-security-blue group-hover/btn:text-security-blue/80 transition-colors">
                {action.icon}
              </span>
              <span className="text-xs font-medium text-titanium/70 group-hover/btn:text-titanium text-center">
                {action.label}
              </span>
            </button>
          ))}
        </div>

        {/* Info Footer */}
        <div className="mt-6 pt-4 border-t border-titanium/10">
          <p className="text-xs text-titanium/50 font-mono">
            Die KI-Assistentin analysiert kontinuierlich Ihre Systeme und gibt Empfehlungen basierend
            auf DSGVO, EU AI Act und Ihre spezifischen Anforderungen.
          </p>
        </div>
      </div>
    </div>
  );
};
