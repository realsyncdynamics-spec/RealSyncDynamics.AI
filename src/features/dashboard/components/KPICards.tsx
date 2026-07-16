import { Globe, FileText, Users, Clock, BarChart3 } from 'lucide-react';

interface DashboardKPI {
  domains_active: number;
  policies_documented: number;
  vendors_managed: number;
  avg_incident_response_hours?: number;
  audit_coverage_percent?: number;
}

interface KPICardsProps {
  kpis: DashboardKPI;
  className?: string;
}

interface KPIItem {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
}

export function KPICards({ kpis, className = '' }: KPICardsProps) {
  const kpiItems: KPIItem[] = [
    {
      label: 'Active Domains',
      value: kpis.domains_active,
      icon: <Globe className="w-5 h-5" />,
      color: 'text-blue-400',
    },
    {
      label: 'Policies Documented',
      value: kpis.policies_documented,
      icon: <FileText className="w-5 h-5" />,
      color: 'text-green-400',
    },
    {
      label: 'Vendors Managed',
      value: kpis.vendors_managed,
      icon: <Users className="w-5 h-5" />,
      color: 'text-purple-400',
    },
    ...(kpis.avg_incident_response_hours !== undefined ? [{
      label: 'Avg Response Time',
      value: kpis.avg_incident_response_hours.toFixed(1),
      unit: 'hours',
      icon: <Clock className="w-5 h-5" />,
      color: 'text-amber-400',
    }] : []),
    ...(kpis.audit_coverage_percent !== undefined ? [{
      label: 'Audit Coverage',
      value: kpis.audit_coverage_percent.toFixed(0),
      unit: '%',
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'text-petrol-400',
    }] : []),
  ];

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 ${className}`}>
      {kpiItems.map((item) => (
        <div
          key={item.label}
          className="bg-obsidian-800 border border-obsidian-700 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-titanium-400">{item.label}</h3>
            <div className={item.color}>{item.icon}</div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-titanium-50">{item.value}</span>
            {item.unit && <span className="text-sm text-titanium-400">{item.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
