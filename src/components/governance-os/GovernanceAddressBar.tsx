import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export function GovernanceAddressBar() {
  const [value, setValue] = useState('');
  const navigate = useNavigate();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      // Navigiere zum Audit mit dem eingegebenen Wert
      navigate(`/audit?target=${encodeURIComponent(value.trim())}`);
      setValue('');
    }
  };

  return (
    <div className="flex-1 flex items-center gap-2 bg-obsidian-950 border border-titanium-800 px-3 py-1.5 max-w-xl focus-within:border-cyan-600 transition-colors">
      <Search className="h-3.5 w-3.5 text-titanium-600 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Website, KI-System, Vendor oder Risiko prüfen…"
        className="flex-1 bg-transparent text-xs text-titanium-200 placeholder-titanium-600 outline-none min-w-0"
      />
      {value && (
        <span className="font-mono text-[9px] text-titanium-700 shrink-0">↵ Audit</span>
      )}
    </div>
  );
}
