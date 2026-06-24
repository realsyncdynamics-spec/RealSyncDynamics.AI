import React from 'react';
import { useLanguage, type Language } from '../lib/i18n';
import { Globe } from 'lucide-react';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded border border-titanium-700 bg-obsidian-900 p-1">
      <button
        onClick={() => setLanguage('de')}
        className={`px-3 py-1 text-xs font-semibold transition-colors ${
          language === 'de'
            ? 'bg-security-500 text-white'
            : 'text-titanium-400 hover:text-titanium-200'
        }`}
      >
        DE
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1 text-xs font-semibold transition-colors ${
          language === 'en'
            ? 'bg-security-500 text-white'
            : 'text-titanium-400 hover:text-titanium-200'
        }`}
      >
        EN
      </button>
    </div>
  );
}
