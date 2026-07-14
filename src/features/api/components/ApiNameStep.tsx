interface ApiNameStepProps {
  value: string;
  onChange: (name: string) => void;
}

export function ApiNameStep({ value, onChange }: ApiNameStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-display font-bold text-titanium-50 mb-2">
          Wie heißt deine Verbindung?
        </h3>
        <p className="text-sm text-titanium-400">
          Wähle einen aussagekräftigen Namen, um deine Keys später zu erkennen.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="api-key-name" className="block text-sm font-semibold text-titanium-100 mb-2">
            Name
          </label>
          <input
            id="api-key-name"
            type="text"
            maxLength={64}
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, 64))}
            placeholder="z.B. Website Verbindung"
            className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-800 rounded-none text-titanium-100 placeholder-titanium-600 focus:outline-none focus:border-security-500 transition-colors"
            data-testid="api-name-input"
          />
        </div>

        <div className="bg-obsidian-900 border border-titanium-800 rounded-none p-3 text-sm">
          <p className="font-semibold text-titanium-200 mb-2">Beispiel-Namen:</p>
          <ul className="space-y-1 text-xs text-titanium-400">
            <li>• Website Verbindung</li>
            <li>• Mein Chatbot</li>
            <li>• Make Automatisierung</li>
            <li>• Kundenportal</li>
            <li>• CI/CD Pipeline</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
