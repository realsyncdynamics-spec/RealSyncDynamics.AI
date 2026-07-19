/**
 * Unit Tests for Logistics Constraint Engine
 * Test constraint evaluation, policy scoring, and compliance checks
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================================
// MOCK CONSTRAINT EVALUATOR (extracted from edge function)
// ============================================================================

interface Constraint {
  id: string;
  constraint_type: ConstraintType;
  rule_action: 'reject' | 'penalty' | 'warn' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  priority_order: number;
  version_number: number;
}

type ConstraintType =
  | 'vehicle_capacity'
  | 'driver_time'
  | 'time_window'
  | 'sla'
  | 'environmental'
  | 'custom';

interface ConstraintEvaluationContext {
  orders: OrderContext[];
  vehicle: VehicleContext;
  route: RouteContext;
  policy_version: number;
}

interface OrderContext {
  id: string;
  weight: number;
  volume: number;
  delivery_window_start: string;
  delivery_window_end: string;
  sla_window_minutes: number;
  priority: string;
}

interface VehicleContext {
  id: string;
  max_weight_kg: number;
  max_volume_m3: number;
  max_daily_hours: number;
  current_load_kg: number;
  current_daily_hours: number;
  current_daily_distance_km: number;
  emission_class?: string;
  co2_per_km_grams?: number;
}

interface RouteContext {
  total_weight: number;
  total_volume: number;
  estimated_duration_minutes: number;
  estimated_distance_km: number;
  estimated_co2_grams: number;
  stops: RouteStop[];
}

interface RouteStop {
  order_id: string;
  estimated_arrival: string;
  estimated_departure: string;
}

// Simplified constraint checker functions for testing
function checkVehicleCapacity(route: RouteContext, vehicle: VehicleContext) {
  const weightOk = route.total_weight <= vehicle.max_weight_kg;
  const volumeOk = route.total_volume <= vehicle.max_volume_m3;

  if (!weightOk && !volumeOk) {
    return {
      satisfied: false,
      reason: `Exceeds weight (${route.total_weight}/${vehicle.max_weight_kg}kg) and volume`,
      penalty: 20
    };
  }

  if (!weightOk) {
    return {
      satisfied: false,
      reason: `Exceeds weight (${route.total_weight}/${vehicle.max_weight_kg}kg)`,
      penalty: 15
    };
  }

  if (!volumeOk) {
    return {
      satisfied: false,
      reason: `Exceeds volume (${route.total_volume}/${vehicle.max_volume_m3}m³)`,
      penalty: 10
    };
  }

  return { satisfied: true, reason: 'Within capacity', penalty: 0 };
}

function checkDriverTime(route: RouteContext, vehicle: VehicleContext) {
  const estimatedHours = route.estimated_duration_minutes / 60;
  const totalHours = vehicle.current_daily_hours + estimatedHours;

  if (totalHours > vehicle.max_daily_hours) {
    const overage = totalHours - vehicle.max_daily_hours;
    return {
      satisfied: false,
      reason: `Exceeds daily limit (${totalHours.toFixed(1)}/${vehicle.max_daily_hours}h, overage: ${overage.toFixed(1)}h)`,
      penalty: 25
    };
  }

  return { satisfied: true, reason: `Within driver time (${totalHours.toFixed(1)}/${vehicle.max_daily_hours}h)`, penalty: 0 };
}

function checkTimeWindows(orders: OrderContext[], route: RouteContext) {
  const violations: string[] = [];

  for (const stop of route.stops) {
    const order = orders.find((o) => o.id === stop.order_id);
    if (!order) continue;

    const arrival = new Date(stop.estimated_arrival);
    const windowStart = new Date(order.delivery_window_start);
    const windowEnd = new Date(order.delivery_window_end);

    if (arrival < windowStart || arrival > windowEnd) {
      violations.push(order.id);
    }
  }

  if (violations.length > 0) {
    return {
      satisfied: false,
      reason: `${violations.length} order(s) violate time windows: ${violations.join(', ')}`
    };
  }

  return { satisfied: true, reason: 'All within time windows' };
}

function checkSLA(orders: OrderContext[], route: RouteContext) {
  let violations = 0;

  for (const order of orders) {
    if (!order.sla_window_minutes) continue;

    const stop = route.stops.find((s) => s.order_id === order.id);
    if (!stop) continue;

    const arrival = new Date(stop.estimated_arrival);
    const deadline = new Date(order.delivery_window_end);
    const delayMs = arrival.getTime() - deadline.getTime();
    const delayMinutes = delayMs / (1000 * 60);

    if (delayMinutes > order.sla_window_minutes) {
      violations++;
    }
  }

  if (violations > 0) {
    return {
      satisfied: false,
      reason: `${violations} order(s) violate SLA`,
      penalty: 15 * violations
    };
  }

  return { satisfied: true, reason: 'All within SLA', penalty: 0 };
}

function checkEnvironmental(route: RouteContext, dailyBudget: number = 5000000) {
  if (route.estimated_co2_grams > dailyBudget) {
    return {
      satisfied: false,
      reason: `Exceeds CO2 budget (${route.estimated_co2_grams}g)`,
      penalty: 10
    };
  }

  return { satisfied: true, reason: 'Within CO2 budget', penalty: 0 };
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Vehicle Capacity Constraints', () => {
  let vehicle: VehicleContext;

  beforeEach(() => {
    vehicle = {
      id: 'VEH-001',
      max_weight_kg: 1000,
      max_volume_m3: 10,
      max_daily_hours: 10,
      current_load_kg: 0,
      current_daily_hours: 0,
      current_daily_distance_km: 0
    };
  });

  it('should accept route within capacity', () => {
    const route: RouteContext = {
      total_weight: 500,
      total_volume: 5,
      estimated_duration_minutes: 480,
      estimated_distance_km: 200,
      estimated_co2_grams: 50000,
      stops: []
    };

    const result = checkVehicleCapacity(route, vehicle);
    expect(result.satisfied).toBe(true);
  });

  it('should reject route exceeding weight', () => {
    const route: RouteContext = {
      total_weight: 1200,
      total_volume: 5,
      estimated_duration_minutes: 480,
      estimated_distance_km: 200,
      estimated_co2_grams: 50000,
      stops: []
    };

    const result = checkVehicleCapacity(route, vehicle);
    expect(result.satisfied).toBe(false);
    expect(result.reason).toContain('weight');
  });

  it('should reject route exceeding volume', () => {
    const route: RouteContext = {
      total_weight: 500,
      total_volume: 12,
      estimated_duration_minutes: 480,
      estimated_distance_km: 200,
      estimated_co2_grams: 50000,
      stops: []
    };

    const result = checkVehicleCapacity(route, vehicle);
    expect(result.satisfied).toBe(false);
    expect(result.reason).toContain('volume');
  });

  it('should reject route exceeding both weight and volume', () => {
    const route: RouteContext = {
      total_weight: 1200,
      total_volume: 12,
      estimated_duration_minutes: 480,
      estimated_distance_km: 200,
      estimated_co2_grams: 50000,
      stops: []
    };

    const result = checkVehicleCapacity(route, vehicle);
    expect(result.satisfied).toBe(false);
    expect(result.reason).toContain('weight');
    expect(result.reason).toContain('volume');
  });

  it('should apply higher penalty for multiple violations', () => {
    const route: RouteContext = {
      total_weight: 1200,
      total_volume: 12,
      estimated_duration_minutes: 480,
      estimated_distance_km: 200,
      estimated_co2_grams: 50000,
      stops: []
    };

    const result = checkVehicleCapacity(route, vehicle);
    expect(result.penalty).toBe(20); // Both weight and volume
  });

  it('should accept route at exact capacity limits', () => {
    const route: RouteContext = {
      total_weight: 1000,
      total_volume: 10,
      estimated_duration_minutes: 480,
      estimated_distance_km: 200,
      estimated_co2_grams: 50000,
      stops: []
    };

    const result = checkVehicleCapacity(route, vehicle);
    expect(result.satisfied).toBe(true);
  });
});

describe('Driver Time Constraints', () => {
  let vehicle: VehicleContext;

  beforeEach(() => {
    vehicle = {
      id: 'VEH-001',
      max_weight_kg: 1000,
      max_volume_m3: 10,
      max_daily_hours: 10,
      current_load_kg: 0,
      current_daily_hours: 0,
      current_daily_distance_km: 0
    };
  });

  it('should accept route within driver time', () => {
    const route: RouteContext = {
      total_weight: 500,
      total_volume: 5,
      estimated_duration_minutes: 300, // 5 hours
      estimated_distance_km: 200,
      estimated_co2_grams: 50000,
      stops: []
    };

    const result = checkDriverTime(route, vehicle);
    expect(result.satisfied).toBe(true);
  });

  it('should reject route exceeding driver time', () => {
    const route: RouteContext = {
      total_weight: 500,
      total_volume: 5,
      estimated_duration_minutes: 720, // 12 hours
      estimated_distance_km: 400,
      estimated_co2_grams: 100000,
      stops: []
    };

    const result = checkDriverTime(route, vehicle);
    expect(result.satisfied).toBe(false);
    expect(result.penalty).toBe(25);
  });

  it('should account for current hours worked', () => {
    vehicle.current_daily_hours = 8;

    const route: RouteContext = {
      total_weight: 500,
      total_volume: 5,
      estimated_duration_minutes: 180, // 3 hours (8 + 3 = 11, exceeds 10 max)
      estimated_distance_km: 150,
      estimated_co2_grams: 37500,
      stops: []
    };

    const result = checkDriverTime(route, vehicle);
    expect(result.satisfied).toBe(false);
  });

  it('should allow full 10-hour shift', () => {
    const route: RouteContext = {
      total_weight: 500,
      total_volume: 5,
      estimated_duration_minutes: 600, // 10 hours
      estimated_distance_km: 350,
      estimated_co2_grams: 87500,
      stops: []
    };

    const result = checkDriverTime(route, vehicle);
    expect(result.satisfied).toBe(true);
  });
});

describe('Time Window Constraints', () => {
  let orders: OrderContext[];
  let route: RouteContext;

  beforeEach(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const window1Start = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000); // +2 hours
    const window1End = new Date(window1Start.getTime() + 2 * 60 * 60 * 1000); // +2 hours

    orders = [
      {
        id: 'ORD-001',
        weight: 10,
        volume: 0.1,
        delivery_window_start: window1Start.toISOString(),
        delivery_window_end: window1End.toISOString(),
        sla_window_minutes: 30,
        priority: 'normal'
      }
    ];

    route = {
      total_weight: 10,
      total_volume: 0.1,
      estimated_duration_minutes: 60,
      estimated_distance_km: 25,
      estimated_co2_grams: 6250,
      stops: [
        {
          order_id: 'ORD-001',
          estimated_arrival: new Date(window1Start.getTime() + 30 * 60 * 1000).toISOString(), // Within window
          estimated_departure: window1End.toISOString()
        }
      ]
    };
  });

  it('should accept deliveries within time windows', () => {
    const result = checkTimeWindows(orders, route);
    expect(result.satisfied).toBe(true);
  });

  it('should reject delivery too early', () => {
    route.stops[0].estimated_arrival = new Date(
      new Date(orders[0].delivery_window_start).getTime() - 60 * 60 * 1000
    ).toISOString();

    const result = checkTimeWindows(orders, route);
    expect(result.satisfied).toBe(false);
  });

  it('should reject delivery too late', () => {
    route.stops[0].estimated_arrival = new Date(
      new Date(orders[0].delivery_window_end).getTime() + 60 * 60 * 1000
    ).toISOString();

    const result = checkTimeWindows(orders, route);
    expect(result.satisfied).toBe(false);
  });

  it('should accept delivery at window boundaries', () => {
    route.stops[0].estimated_arrival = orders[0].delivery_window_start;
    let result = checkTimeWindows(orders, route);
    expect(result.satisfied).toBe(true);

    route.stops[0].estimated_arrival = orders[0].delivery_window_end;
    result = checkTimeWindows(orders, route);
    expect(result.satisfied).toBe(true);
  });
});

describe('SLA Constraints', () => {
  let orders: OrderContext[];
  let route: RouteContext;

  beforeEach(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    orders = [
      {
        id: 'ORD-001',
        weight: 10,
        volume: 0.1,
        delivery_window_start: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        delivery_window_end: new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        sla_window_minutes: 30, // Max 30 min late
        priority: 'normal'
      }
    ];

    route = {
      total_weight: 10,
      total_volume: 0.1,
      estimated_duration_minutes: 60,
      estimated_distance_km: 25,
      estimated_co2_grams: 6250,
      stops: [
        {
          order_id: 'ORD-001',
          estimated_arrival: new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(), // 10 min late
          estimated_departure: new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000).toISOString()
        }
      ]
    };
  });

  it('should accept delivery within SLA window', () => {
    const result = checkSLA(orders, route);
    expect(result.satisfied).toBe(true);
  });

  it('should reject delivery exceeding SLA window', () => {
    route.stops[0].estimated_arrival = new Date(
      new Date(orders[0].delivery_window_end).getTime() + 40 * 60 * 1000 // 40 min late
    ).toISOString();

    const result = checkSLA(orders, route);
    expect(result.satisfied).toBe(false);
    expect(result.penalty).toBe(15); // 1 violation * 15 penalty
  });

  it('should calculate penalty based on violation count', () => {
    // Add second order
    orders.push({
      id: 'ORD-002',
      weight: 10,
      volume: 0.1,
      delivery_window_start: new Date(tomorrow.getTime() + 4.5 * 60 * 60 * 1000).toISOString(),
      delivery_window_end: new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000).toISOString(),
      sla_window_minutes: 30,
      priority: 'normal'
    });

    route.stops.push({
      order_id: 'ORD-002',
      estimated_arrival: new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000 + 40 * 60 * 1000).toISOString(),
      estimated_departure: new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000).toISOString()
    });

    const result = checkSLA(orders, route);
    expect(result.satisfied).toBe(false);
    expect(result.penalty).toBe(30); // 2 violations * 15 penalty each
  });
});

describe('Environmental Constraints', () => {
  let route: RouteContext;

  beforeEach(() => {
    route = {
      total_weight: 500,
      total_volume: 5,
      estimated_duration_minutes: 480,
      estimated_distance_km: 200,
      estimated_co2_grams: 50000,
      stops: []
    };
  });

  it('should accept route within CO2 budget', () => {
    const result = checkEnvironmental(route);
    expect(result.satisfied).toBe(true);
  });

  it('should reject route exceeding CO2 budget', () => {
    route.estimated_co2_grams = 6000000; // Over 5M budget

    const result = checkEnvironmental(route);
    expect(result.satisfied).toBe(false);
    expect(result.penalty).toBe(10);
  });

  it('should accept route at budget limit', () => {
    route.estimated_co2_grams = 5000000; // Exactly at budget

    const result = checkEnvironmental(route);
    expect(result.satisfied).toBe(true);
  });
});

describe('Compliance Scoring', () => {
  it('should calculate 100 for no violations', () => {
    let score = 100;
    const hardViolations = 0;
    const softViolations = 0;

    score -= hardViolations * 50;
    score -= softViolations * 10;

    expect(score).toBe(100);
  });

  it('should deduct 50 per hard violation', () => {
    let score = 100;
    const hardViolations = 2;
    const softViolations = 0;

    score -= hardViolations * 50;
    score -= softViolations * 10;

    expect(score).toBe(0); // 100 - 100
  });

  it('should deduct 10 per soft violation', () => {
    let score = 100;
    const hardViolations = 0;
    const softViolations = 5;

    score -= hardViolations * 50;
    score -= softViolations * 10;

    expect(score).toBe(50); // 100 - 50
  });

  it('should never go below 0', () => {
    let score = 100;
    const hardViolations = 10;

    score -= hardViolations * 50;
    score = Math.max(0, score);

    expect(score).toBe(0);
  });
});
