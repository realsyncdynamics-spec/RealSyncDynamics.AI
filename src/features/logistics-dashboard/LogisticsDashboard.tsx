/**
 * Logistics OS Dashboard
 * Real-time route visualization, decision explainability, and human override interface
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LogisticsRoute, LogisticsDecision, LogisticsEvent } from '../../types/logistics';
import { RouteVisualization } from './components/RouteVisualization';
import { DecisionExplainabilityPanel } from './components/DecisionExplainabilityPanel';
import { HumanOverrideModal } from './components/HumanOverrideModal';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { EventFeed } from './components/EventFeed';

interface LogisticsDashboardState {
  selectedRoute: LogisticsRoute | null;
  selectedDecision: LogisticsDecision | null;
  showOverrideModal: boolean;
  showExplainability: boolean;
  routes: LogisticsRoute[];
  decisions: LogisticsDecision[];
  events: LogisticsEvent[];
  isLoading: boolean;
  filters: {
    status: string[];
    vehicle: string[];
    slaStatus: 'all' | 'compliant' | 'at-risk' | 'violated';
  };
}

export function LogisticsDashboard() {
  const [state, setState] = useState<LogisticsDashboardState>({
    selectedRoute: null,
    selectedDecision: null,
    showOverrideModal: false,
    showExplainability: false,
    routes: [],
    decisions: [],
    events: [],
    isLoading: false,
    filters: {
      status: [],
      vehicle: [],
      slaStatus: 'all'
    }
  });

  // Load routes and decisions
  useEffect(() => {
    const loadData = async () => {
      setState(prev => ({ ...prev, isLoading: true }));
      try {
        // Mock data fetch - replace with actual API calls
        const mockRoutes: LogisticsRoute[] = [];
        const mockDecisions: LogisticsDecision[] = [];
        const mockEvents: LogisticsEvent[] = [];

        setState(prev => ({
          ...prev,
          routes: mockRoutes,
          decisions: mockDecisions,
          events: mockEvents,
          isLoading: false
        }));
      } catch (error) {
        console.error('Failed to load logistics data:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadData();
  }, []);

  const handleSelectRoute = useCallback((route: LogisticsRoute) => {
    setState(prev => ({
      ...prev,
      selectedRoute: route,
      selectedDecision: prev.decisions.find(d => d.id === route.decision_id) || null,
      showExplainability: true
    }));
  }, []);

  const handleSelectDecision = useCallback((decision: LogisticsDecision) => {
    setState(prev => ({
      ...prev,
      selectedDecision: decision,
      selectedRoute: prev.routes.find(r => r.decision_id === decision.id) || null,
      showExplainability: true
    }));
  }, []);

  const handleOpenOverride = useCallback(() => {
    setState(prev => ({ ...prev, showOverrideModal: true }));
  }, []);

  const handleCloseOverride = useCallback(() => {
    setState(prev => ({ ...prev, showOverrideModal: false }));
  }, []);

  const handleSubmitOverride = useCallback(async (reason: string, newRoute?: LogisticsRoute) => {
    if (!state.selectedRoute || !state.selectedDecision) return;

    try {
      // API call to record override
      // await recordOverride({
      //   decision_id: state.selectedDecision.id,
      //   route_id: state.selectedRoute.id,
      //   reason,
      //   new_route: newRoute
      // });

      setState(prev => ({
        ...prev,
        showOverrideModal: false,
        selectedRoute: newRoute || prev.selectedRoute
      }));
    } catch (error) {
      console.error('Failed to submit override:', error);
    }
  }, [state.selectedRoute, state.selectedDecision]);

  const handleFilterChange = useCallback((filterType: string, values: string[]) => {
    setState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [filterType]: values
      }
    }));
  }, []);

  const filteredRoutes = state.routes.filter(route => {
    if (state.filters.status.length > 0 && !state.filters.status.includes(route.status)) {
      return false;
    }
    if (state.filters.vehicle.length > 0 && !state.filters.vehicle.includes(route.vehicle_id)) {
      return false;
    }
    if (state.filters.slaStatus !== 'all') {
      const isCompliant = route.sla_compliant === true;
      if (state.filters.slaStatus === 'compliant' && !isCompliant) return false;
      if (state.filters.slaStatus === 'at-risk' && isCompliant) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-50">
      {/* Header */}
      <div className="border-b border-titanium-800 bg-obsidian-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Logistics OS</h1>
            <p className="text-titanium-400 text-sm mt-1">Real-time Route Optimization & Decision Management</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-security-blue">{filteredRoutes.length}</div>
              <div className="text-xs text-titanium-400">Active Routes</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-500">{state.routes.filter(r => r.sla_compliant).length}</div>
              <div className="text-xs text-titanium-400">SLA Compliant</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 p-6 h-[calc(100vh-120px)]">
        {/* Left: Route Visualization (60%) */}
        <div className="col-span-7 flex flex-col gap-4">
          <div className="flex-1 border border-titanium-800 rounded bg-obsidian-900 overflow-hidden">
            <RouteVisualization
              routes={filteredRoutes}
              selectedRoute={state.selectedRoute}
              onSelectRoute={handleSelectRoute}
              isLoading={state.isLoading}
            />
          </div>

          {/* Event Feed */}
          <div className="border border-titanium-800 rounded bg-obsidian-900 h-64 overflow-hidden">
            <EventFeed events={state.events.slice(0, 10)} />
          </div>
        </div>

        {/* Right: Explainability + Analytics (40%) */}
        <div className="col-span-5 flex flex-col gap-4">
          {/* Decision Explainability Panel */}
          {state.selectedDecision && (
            <div className="flex-1 border border-titanium-800 rounded bg-obsidian-900 overflow-hidden flex flex-col">
              <DecisionExplainabilityPanel
                decision={state.selectedDecision}
                route={state.selectedRoute}
                onOpenOverride={handleOpenOverride}
              />
            </div>
          )}

          {/* Analytics Dashboard */}
          <div className="flex-1 border border-titanium-800 rounded bg-obsidian-900 overflow-auto">
            <AnalyticsDashboard
              routes={filteredRoutes}
              decisions={state.decisions}
            />
          </div>
        </div>
      </div>

      {/* Override Modal */}
      {state.showOverrideModal && state.selectedRoute && state.selectedDecision && (
        <HumanOverrideModal
          route={state.selectedRoute}
          decision={state.selectedDecision}
          onClose={handleCloseOverride}
          onSubmit={handleSubmitOverride}
        />
      )}
    </div>
  );
}
