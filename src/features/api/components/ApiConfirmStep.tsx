import { AlertCircle, Shield } from 'lucide-react';

interface ApiConfirmStepProps {
  name: string;
  purpose: string;
  permission: string;
}

export function ApiConfirmStep({ name, purpose, permission }: ApiConfirmStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-display font-bold text-titanium-50 mb-2">
          Bereit zum Erstellen?
        </h3>
        <p className="text-sm text-titanium-400">
          Überprüfe deine Einstellungen unten.
        </p>
      </div>

      <div className="bg-obsidian-900 border border-titanium-800 rounded-none p-4 space-y-3">
        <div className="flex justify-between items-start gap-4 pb-3 border-b border-titanium-800">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.1em] text-titanium-500">Verwendung</p>
            <p className="text-sm font-semibold text-titanium-100 mt-1">{purpose}</p>
          </div>
        </div>

        <div className="flex justify-between items-start gap-4 pb-3 border-b border-titanium-800">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.1em] text-titanium-500">Name</p>
            <p className="text-sm font-semibold text-titanium-100 mt-1">{name}</p>
          </div>
        </div>

        <div className="flex justify-between items-start gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.1em] text-titanium-500">Berechtigungen</p>
            <p className="text-sm font-semibold text-titanium-100 mt-1">{permission}</p>
          </div>
        </div>
      </div>

      <div className="bg-amber-950/50 border border-amber-700 rounded-none p-4 flex gap-3">
        <div className="shrink-0 mt-0.5">
          <AlertCircle className="h-5 w-5 text-amber-300" />
        </div>
        <div className="text-sm text-amber-100">
          <p className="font-semibold mb-1">Wichtig: Der Key wird nur einmal angezeigt</p>
          <p className="text-xs">
            Nach der Erstellung kannst du den Schlüssel nicht erneut anzeigen. Kopiere ihn sofort nach der Erstellung in einen sicheren Ort (Password-Manager, Datei, etc.).
          </p>
        </div>
      </div>

      <div className="bg-security-950/30 border border-security-700 rounded-none p-4 flex gap-3">
        <div className="shrink-0 mt-0.5">
          <Shield className="h-5 w-5 text-security-300" />
        </div>
        <div className="text-sm text-security-100">
          <p className="font-semibold mb-1">Sicherheit</p>
          <p className="text-xs">
            Wir speichern nur einen verschlüsselten Hash des Keys. Verlorene Keys können nicht wiederhergestellt werden — aber du kannst jederzeit neue Keys erstellen.
          </p>
        </div>
      </div>
    </div>
  );
}
