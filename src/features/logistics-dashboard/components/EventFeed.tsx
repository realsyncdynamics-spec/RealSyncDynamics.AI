/**
 * Event Feed Component
 * Real-time stream of logistics events
 */

import React from 'react';
import { LogisticsEvent } from '../../../types/logistics';

interface EventFeedProps {
  events: LogisticsEvent[];
}

interface EventDisplay {
  event: LogisticsEvent;
  icon: string;
  color: string;
  label: string;
}

export function EventFeed({ events }: EventFeedProps) {
  const getEventDisplay = (event: LogisticsEvent): EventDisplay => {
    const displays: Record<string, Omit<EventDisplay, 'event'>> = {
      order_created: {
        icon: '📦',
        color: 'text-security-blue',
        label: 'Order Created'
      },
      route_started: {
        icon: '🚗',
        color: 'text-emerald-500',
        label: 'Route Started'
      },
      delivery_started: {
        icon: '📍',
        color: 'text-amber-500',
        label: 'Delivery Started'
      },
      delivery_completed: {
        icon: '✓',
        color: 'text-emerald-500',
        label: 'Delivery Completed'
      },
      delivery_failed: {
        icon: '✗',
        color: 'text-red-500',
        label: 'Delivery Failed'
      },
      sla_breach: {
        icon: '⚠',
        color: 'text-red-500',
        label: 'SLA Breach'
      },
      vehicle_breakdown: {
        icon: '🔧',
        color: 'text-red-500',
        label: 'Vehicle Breakdown'
      },
      decision_override: {
        icon: '↩',
        color: 'text-amber-500',
        label: 'Decision Override'
      }
    };

    const display = displays[event.event_type] || {
      icon: '•',
      color: 'text-titanium-400',
      label: event.event_type
    };

    return {
      event,
      ...display
    };
  };

  const formatTime = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins === 0) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-titanium-800 px-4 py-3 bg-obsidian-950">
        <h3 className="text-sm font-bold">Event Stream</h3>
        <p className="text-xs text-titanium-400 mt-1">Latest activity</p>
      </div>

      {/* Event List */}
      {events.length > 0 ? (
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-titanium-800">
            {events.map((event, idx) => {
              const display = getEventDisplay(event);
              return (
                <div key={idx} className="px-4 py-2 hover:bg-obsidian-800 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`text-lg ${display.color} flex-shrink-0 mt-0.5`}>
                      {display.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold truncate">
                          {display.label}
                        </span>
                        <span className="text-xs text-titanium-500 flex-shrink-0">
                          {formatTime(event.created_at)}
                        </span>
                      </div>
                      <div className="text-xs text-titanium-400 mt-0.5 space-y-0.5">
                        {event.order_id && (
                          <div>
                            <span className="font-mono">Order:</span> {event.order_id}
                          </div>
                        )}
                        {event.route_id && (
                          <div>
                            <span className="font-mono">Route:</span> {event.route_id}
                          </div>
                        )}
                        {event.vehicle_id && (
                          <div>
                            <span className="font-mono">Vehicle:</span> {event.vehicle_id}
                          </div>
                        )}
                        {event.details && (
                          <div className="text-titanium-500">
                            {typeof event.details === 'string'
                              ? event.details
                              : JSON.stringify(event.details)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-titanium-400 text-sm">No events yet</p>
          </div>
        </div>
      )}
    </div>
  );
}
