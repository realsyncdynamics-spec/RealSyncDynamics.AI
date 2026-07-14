import React from 'react';
import { AlertCircle, Shield, Users } from 'lucide-react';

interface Tool {
  id: string;
  tool_name: string;
  tool_category: string;
  active_users: number;
  risk_level: 'low' | 'medium' | 'high';
  sso_enabled: boolean;
  account_type: 'business' | 'personal';
  data_exposure_risk: boolean;
}

interface ShadowSaasTableProps {
  tools: Tool[];
  isLoading?: boolean;
}

export function ShadowSaasTable({ tools, isLoading = false }: ShadowSaasTableProps) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-red-50 text-red-700';
      case 'medium':
        return 'bg-yellow-50 text-yellow-700';
      default:
        return 'bg-green-50 text-green-700';
    }
  };

  const getRiskIcon = (level: string) => {
    if (level === 'high') return <AlertCircle size={16} />;
    return <Shield size={16} />;
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">
          Ungenehmigte SEO-Tools (Shadow SaaS)
        </h3>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-12 bg-slate-200 rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-6">
        Ungenehmigte SEO-Tools (Shadow SaaS)
      </h3>

      {tools.length === 0 ? (
        <div className="text-center py-8">
          <Shield className="mx-auto mb-3 text-green-600" size={32} />
          <p className="text-slate-600">Keine ungenehmigten Tools erkannt</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-900">
                  Tool
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-900">
                  Kategorie
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-900">
                  Benutzer
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-900">
                  Risiko
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-900">
                  SSO
                </th>
                <th className="text-center py-3 px-4 font-semibold text-slate-900">
                  Datenexposition
                </th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-slate-900">
                    {tool.tool_name}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{tool.tool_category}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <Users size={14} />
                      {tool.active_users}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-medium text-xs ${getRiskColor(
                        tool.risk_level,
                      )}`}
                    >
                      {getRiskIcon(tool.risk_level)}
                      {tool.risk_level.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={
                        tool.sso_enabled
                          ? 'text-green-600 font-semibold'
                          : 'text-red-600 font-semibold'
                      }
                    >
                      {tool.sso_enabled ? '✓' : '✗'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {tool.data_exposure_risk ? (
                      <span className="text-red-600 font-semibold">
                        <AlertCircle size={16} className="inline" />
                      </span>
                    ) : (
                      <span className="text-green-600">✓</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
