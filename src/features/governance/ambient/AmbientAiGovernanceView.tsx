import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  Cpu,
  Database,
  Eye,
  FileCheck2,
  MapPin,
  Mic,
  Network,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';

export type AmbientDeviceType =
  | 'wearable'
  | 'camera'
  | 'voice_device'
  | 'vehicle'
  | 'robot'
  | 'iot';

export type AmbientSensorType =
  | 'camera'
  | 'microphone'
  | 'location'
  | 'biometric'
  | 'other';

export type AmbientPolicyResult =
  | 'allow'
  | 'limit'
  | 'approval_required'
  | 'deny';

export interface AmbientGovernanceEvent {
  tenant_id: string;
  device: {
    device_id: string;
    device_type: AmbientDeviceType;
    manufacturer?: string;
    owner_type: 'company' | 'employee' | 'customer' | 'third_party';
  };
  sensor: {
    type: AmbientSensorType;
    active: boolean;
  };
  context: {
    environment: 'office' | 'customer_area' | 'production' | 'public' | 'remote' | 'other';
    purpose: string;
  };
  data: {
    categories: string[];
    contains_personal_data: boolean;
    contains_special_category_data?: boolean;
  };
  runtime: {
    provider?: string;
    model?: string;
    region?: string;
  };
  decision: {
    result: AmbientPolicyResult;
    policy_id: string;
    reasons: string[];
  };
  evidence: {
    timestamp: string;
    execution_verified: boolean;
  };
}

const PIPELINE = [
  'Sensor Event',
  'Device Identity',
  'Tenant',
  'Context',
  'Data Classification',
  'Policy',
  'AI Decision',
  'Approval',
  'Execution',
  'Verification',
  'Evidence',
] as const;

const CAPABILITIES = [
  {
    icon: Radio,
    title: 'Device Inventory',
    text: 'Wearables, Kameras, Sprachgeräte, Fahrzeuge, Roboter und IoT-Endpunkte tenant-gebunden erfassen.',
  },
  {
    icon: Network,
    title: 'Data-Flow Map',
    text: 'Audio-, Bild-, Standort- und Kontextdaten von der Quelle bis zu Runtime, Speicher und Empfänger nachvollziehen.',
  },
  {
    icon: ShieldCheck,
    title: 'Policy Enforcement',
    text: 'Kontextabhängige Regeln vor einer KI-Entscheidung oder externen Weitergabe auswerten.',
  },
  {
    icon: FileCheck2,
    title: 'Evidence',
    text: 'Policy-Entscheidungen, Freigaben, Ausführung und Verifikation als prüfbare Ereigniskette festhalten.',
  },
] as const;

const SENSOR_TYPES = [
  { icon: Camera, label: 'Camera' },
  { icon: Mic, label: 'Microphone' },
  { icon: MapPin, label: 'Location' },
  { icon: Eye, label: 'Biometric / Vision' },
] as const;

function EmptyMetric({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-titanium-900 bg-obsidian-900/70 px-4 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-titanium-500">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold text-titanium-100">0</div>
      <div className="mt-1 text-[11px] text-titanium-500">keine verbundenen Datenquellen</div>
    </div>
  );
}

export function AmbientAiGovernanceView() {
  const { activeTenantId } = useTenant();
  const tenantBound = Boolean(activeTenantId);

  return (
    <div className="min-h-full bg-obsidian text-titanium-100">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 border-b border-titanium-900 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-teal-400">
              <Radio className="h-3.5 w-3.5" />
              Ambient AI Governance
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-titanium-50 sm:text-3xl">
              Governance zwischen Wahrnehmung und Aktion
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-titanium-400">
              Control Plane für physische und kontextsensitive KI. Geräte und Sensoren liefern Signale;
              Tenant, Policy, Risiko, Freigabe und Evidence bleiben serverseitig autoritativ.
            </p>
          </div>

          <div className="rounded-lg border border-titanium-900 bg-obsidian-900 px-3 py-2 font-mono text-[10px] text-titanium-400">
            <span className={tenantBound ? 'text-teal-400' : 'text-amber-400'}>
              {tenantBound ? 'TENANT BOUND' : 'NO TENANT'}
            </span>
            {' · '}keine Device-Telemetrie verbunden
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <EmptyMetric label="Devices" />
          <EmptyMetric label="Active Sensors" />
          <EmptyMetric label="AI Runtimes" />
          <EmptyMetric label="Policy Events" />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
          <section className="rounded-2xl border border-titanium-900 bg-obsidian-950">
            <div className="border-b border-titanium-900 px-5 py-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-titanium-500">Runtime path</div>
              <h2 className="mt-1 text-base font-semibold text-titanium-100">Sensor → Policy → Evidence</h2>
            </div>

            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                {PIPELINE.map((step, index) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="rounded-md border border-titanium-800 bg-obsidian-900 px-2.5 py-1.5 font-mono text-[10px] text-titanium-300">
                      {step}
                    </span>
                    {index < PIPELINE.length - 1 && <ArrowRight className="h-3 w-3 text-titanium-700" />}
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-teal-900/60 bg-teal-950/20 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" />
                  <div>
                    <div className="text-sm font-medium text-titanium-100">Authority boundary</div>
                    <p className="mt-1 text-xs leading-5 text-titanium-400">
                      Device und Sensor sind Eingänge, keine Autoritätsquelle. Tenant-Auflösung, Policy-Entscheidung,
                      Freigabe und Verifikation bleiben in der Governance Runtime.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-titanium-900 bg-obsidian-950">
            <div className="border-b border-titanium-900 px-5 py-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-titanium-500">Sensor classes</div>
              <h2 className="mt-1 text-base font-semibold text-titanium-100">Noch nicht inventarisiert</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 p-5">
              {SENSOR_TYPES.map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-lg border border-titanium-900 bg-obsidian-900/70 p-3">
                  <Icon className="h-4 w-4 text-titanium-500" />
                  <div className="mt-2 text-xs text-titanium-300">{label}</div>
                  <div className="mt-1 font-mono text-[10px] text-titanium-600">0 sources</div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-teal-400" />
            <h2 className="text-sm font-semibold text-titanium-100">Governance capabilities</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {CAPABILITIES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-xl border border-titanium-900 bg-obsidian-900/60 p-4">
                <Icon className="h-4 w-4 text-teal-400" />
                <h3 className="mt-3 text-sm font-medium text-titanium-100">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-titanium-500">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-titanium-900 bg-obsidian-950">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-5 w-5 shrink-0 text-titanium-500" />
              <div>
                <h2 className="text-sm font-semibold text-titanium-100">Keine erfundenen Runtime-Daten</h2>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-titanium-500">
                  Diese erste Fläche zeigt nur das Governance-Modell. Geräte, Sensoren, Datenflüsse und Policy-Events
                  erscheinen erst, wenn eine reale tenant-gebundene Quelle angeschlossen ist.
                </p>
              </div>
            </div>
            <Link
              to="/app/monitoring"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-titanium-800 px-3 py-2 text-xs font-medium text-titanium-300 transition-colors hover:border-teal-800 hover:text-teal-300"
            >
              Monitoring öffnen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
