/**
 * Human Override Modal
 * Interface for operators to override AI decisions with business justification
 */

import React, { useState } from 'react';
import { LogisticsDecision, LogisticsRoute } from '../../../types/logistics';

interface HumanOverrideModalProps {
  route: LogisticsRoute;
  decision: LogisticsDecision;
  onClose: () => void;
  onSubmit: (reason: string, newRoute?: LogisticsRoute) => void;
}

type OverrideReason = 'customer_request' | 'driver_unavailable' | 'vehicle_breakdown' | 'traffic_incident' | 'other';

export function HumanOverrideModal({
  route,
  decision,
  onClose,
  onSubmit
}: HumanOverrideModalProps) {
  const [selectedReason, setSelectedReason] = useState<OverrideReason | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const overrideReasons: { value: OverrideReason; label: string; description: string }[] = [
    {
      value: 'customer_request',
      label: 'Customer Request',
      description: 'Customer requested expedited or alternate delivery'
    },
    {
      value: 'driver_unavailable',
      label: 'Driver Unavailable',
      description: 'Assigned driver called in sick or is unavailable'
    },
    {
      value: 'vehicle_breakdown',
      label: 'Vehicle Breakdown',
      description: 'Assigned vehicle has mechanical issues'
    },
    {
      value: 'traffic_incident',
      label: 'Traffic Incident',
      description: 'Unexpected traffic, road closure, or accident'
    },
    {
      value: 'other',
      label: 'Other',
      description: 'Specify reason below'
    }
  ];

  const handleSubmit = async () => {
    if (!selectedReason) {
      alert('Please select an override reason');
      return;
    }

    const finalReason = selectedReason === 'other' ? customReason : selectedReason;
    if (!finalReason) {
      alert('Please provide a reason for override');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(finalReason);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-obsidian-900 rounded border border-titanium-800 max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="border-b border-titanium-800 px-6 py-4 bg-obsidian-950">
          <h2 className="text-xl font-bold">Override Route Decision</h2>
          <p className="text-sm text-titanium-400 mt-1">
            Provide business justification for overriding the AI decision
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto space-y-4">
          {/* Original Decision Summary */}
          <div className="p-3 bg-obsidian-800 rounded border border-titanium-800">
            <h3 className="text-sm font-semibold mb-2">Original Decision</h3>
            <div className="space-y-1 text-xs text-titanium-400">
              <div>
                <span className="text-titanium-300">Vehicle:</span> {route.vehicle_id}
              </div>
              <div>
                <span className="text-titanium-300">Stops:</span> {route.stops?.length || 0}
              </div>
              <div>
                <span className="text-titanium-300">Distance:</span> {route.total_distance_km.toFixed(1)} km
              </div>
              <div>
                <span className="text-titanium-300">Cost:</span> ${route.estimated_cost?.toFixed(2) || 'N/A'}
              </div>
              <div>
                <span className="text-titanium-300">SLA Status:</span>{' '}
                <span className={route.sla_compliant ? 'text-emerald-500' : 'text-red-500'}>
                  {route.sla_compliant ? 'Compliant' : 'At Risk'}
                </span>
              </div>
            </div>
          </div>

          {/* Override Reason Selection */}
          <div>
            <label className="block text-sm font-semibold mb-3">Override Reason</label>
            <div className="space-y-2">
              {overrideReasons.map((reason) => (
                <label
                  key={reason.value}
                  className="flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors hover:bg-obsidian-800 hover:border-security-blue"
                  style={{
                    backgroundColor: selectedReason === reason.value ? 'rgba(0, 82, 255, 0.1)' : 'transparent',
                    borderColor: selectedReason === reason.value ? '#0052ff' : '#292e31'
                  }}
                >
                  <input
                    type="radio"
                    name="override-reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={() => setSelectedReason(reason.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-semibold text-sm">{reason.label}</div>
                    <div className="text-xs text-titanium-400">{reason.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Reason (if Other selected) */}
          {selectedReason === 'other' && (
            <div>
              <label className="block text-sm font-semibold mb-2">Please specify reason</label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Describe the business reason for overriding this decision..."
                className="w-full px-3 py-2 rounded bg-obsidian-800 border border-titanium-800 text-titanium-50 placeholder-titanium-600 text-sm focus:outline-none focus:border-security-blue"
                rows={3}
              />
            </div>
          )}

          {/* Business Impact Warning */}
          <div className="p-3 bg-amber-500 bg-opacity-10 rounded border border-amber-500 border-opacity-30">
            <p className="text-xs text-amber-400">
              <span className="font-semibold">⚠ Warning:</span> Overriding this decision may impact SLA compliance, cost efficiency, or environmental metrics. All overrides are audited and logged.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-titanium-800 bg-obsidian-950 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 rounded bg-obsidian-800 hover:bg-obsidian-700 text-titanium-50 font-semibold text-sm transition-colors border border-titanium-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedReason}
            className="flex-1 px-4 py-2 rounded bg-security-blue hover:bg-opacity-80 disabled:bg-opacity-50 text-obsidian-950 font-semibold text-sm transition-colors disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Processing...' : 'Confirm Override'}
          </button>
        </div>
      </div>
    </div>
  );
}
