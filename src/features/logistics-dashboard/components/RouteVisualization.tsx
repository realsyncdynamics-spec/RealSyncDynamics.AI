/**
 * Route Visualization Component
 * Displays routes on interactive map with real-time stop tracking
 */

import React, { useMemo } from 'react';
import { LogisticsRoute } from '../../../types/logistics';

interface RouteVisualizationProps {
  routes: LogisticsRoute[];
  selectedRoute: LogisticsRoute | null;
  onSelectRoute: (route: LogisticsRoute) => void;
  isLoading: boolean;
}

interface RoutePath {
  id: string;
  vehicle_id: string;
  lat: number[];
  lng: number[];
  stopCount: number;
  distance: number;
  status: string;
  color: string;
}

export function RouteVisualization({
  routes,
  selectedRoute,
  onSelectRoute,
  isLoading
}: RouteVisualizationProps) {
  const routePaths = useMemo((): RoutePath[] => {
    return routes.map(route => {
      const lats: number[] = [];
      const lngs: number[] = [];

      // Extract coordinates from stops
      if (route.stops && route.stops.length > 0) {
        route.stops.forEach(stop => {
          if (stop.location) {
            lats.push(stop.location.lat);
            lngs.push(stop.location.lng);
          }
        });
      }

      return {
        id: route.id,
        vehicle_id: route.vehicle_id,
        lat: lats,
        lng: lngs,
        stopCount: route.stops?.length || 0,
        distance: route.total_distance_km || 0,
        status: route.status,
        color: getRouteColor(route.sla_compliant, route.status)
      };
    });
  }, [routes]);

  const getRouteColor = (slaCompliant: boolean | null, status: string): string => {
    if (status === 'completed') return '#10b981'; // emerald
    if (slaCompliant === true) return '#0052ff'; // security-blue
    if (slaCompliant === false) return '#ef4444'; // red
    return '#f59e0b'; // amber (at-risk)
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin">
          <div className="w-12 h-12 border-4 border-titanium-800 border-t-security-blue rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Map area - SVG canvas for route visualization */}
      <div className="flex-1 relative bg-obsidian-950 overflow-hidden" id="route-map">
        <svg className="w-full h-full">
          {/* Grid background */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1f2937" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Route visualization - simplified line representation */}
          {routePaths.map((path, idx) => (
            <g key={path.id} onClick={() => onSelectRoute(routes[idx])}>
              {/* Route line */}
              {path.lat.length > 1 && (
                <polyline
                  points={path.lat.map((lat, i) => `${(lng + 180) * 3},${(90 - lat) * 3}`).join(' ')}
                  fill="none"
                  stroke={path.color}
                  strokeWidth={selectedRoute?.id === path.id ? '3' : '2'}
                  opacity={selectedRoute?.id === path.id ? 1 : 0.7}
                  className="cursor-pointer hover:stroke-opacity-100 transition-all"
                />
              )}

              {/* Stop markers */}
              {path.lat.map((lat, i) => (
                <circle
                  key={`stop-${i}`}
                  cx={(180 + path.lng[i]) * 3}
                  cy={(90 - lat) * 3}
                  r={selectedRoute?.id === path.id ? '6' : '4'}
                  fill={path.color}
                  opacity={0.8}
                  className="hover:opacity-100 cursor-pointer transition-all"
                />
              ))}
            </g>
          ))}
        </svg>

        {/* No routes message */}
        {routePaths.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-titanium-400 text-sm">No routes to display</p>
            </div>
          </div>
        )}
      </div>

      {/* Route list */}
      <div className="border-t border-titanium-800 bg-obsidian-900 max-h-32 overflow-y-auto">
        <div className="p-3 space-y-2">
          {routePaths.map((path, idx) => {
            const route = routes[idx];
            const isSelected = selectedRoute?.id === path.id;

            return (
              <button
                key={path.id}
                onClick={() => onSelectRoute(route)}
                className={`w-full text-left p-2 rounded text-xs transition-colors ${
                  isSelected
                    ? 'bg-security-blue bg-opacity-20 border border-security-blue'
                    : 'bg-obsidian-800 hover:bg-obsidian-700 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: path.color }} />
                    <span className="font-mono text-sm">{path.vehicle_id}</span>
                  </div>
                  <span className="text-titanium-400 text-xs">{path.stopCount} stops • {path.distance.toFixed(1)} km</span>
                </div>
                {route.sla_compliant === false && (
                  <div className="text-red-500 text-xs mt-1">⚠ SLA at risk</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
