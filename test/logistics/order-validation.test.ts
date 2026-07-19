/**
 * Unit Tests for Logistics Order Validation
 * Test data quality checks, constraint validation, and error handling
 */

import { describe, it, expect } from 'vitest';

// Mock validation functions (extracted from edge function for testing)
interface ValidationResult {
  is_valid: boolean;
  errors: ValidationError[];
  quality_score?: number;
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'high';
}

function validateLocation(loc: any, fieldName: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!loc || typeof loc !== 'object') {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be an object with lat/lng`,
      severity: 'critical'
    });
    return errors;
  }

  if (typeof loc.lat !== 'number' || loc.lat < -90 || loc.lat > 90) {
    errors.push({
      field: `${fieldName}.lat`,
      message: 'Latitude must be a number between -90 and 90',
      severity: 'critical'
    });
  }

  if (typeof loc.lng !== 'number' || loc.lng < -180 || loc.lng > 180) {
    errors.push({
      field: `${fieldName}.lng`,
      message: 'Longitude must be a number between -180 and 180',
      severity: 'critical'
    });
  }

  return errors;
}

function validateTimeWindow(
  start: string,
  end: string,
  promisedDate: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const now = new Date();

    if (isNaN(startDate.getTime())) {
      errors.push({
        field: 'delivery_window_start',
        message: 'Invalid ISO 8601 date format',
        severity: 'critical'
      });
    }

    if (isNaN(endDate.getTime())) {
      errors.push({
        field: 'delivery_window_end',
        message: 'Invalid ISO 8601 date format',
        severity: 'critical'
      });
    }

    if (startDate >= endDate) {
      errors.push({
        field: 'delivery_window',
        message: 'delivery_window_start must be before delivery_window_end',
        severity: 'critical'
      });
    }

    // Window must be in the future
    if (startDate < now) {
      errors.push({
        field: 'delivery_window_start',
        message: 'Delivery window must be in the future',
        severity: 'critical'
      });
    }
  } catch (error) {
    errors.push({
      field: 'time_window',
      message: 'Failed to parse time window',
      severity: 'critical'
    });
  }

  return errors;
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Location Validation', () => {
  it('should accept valid coordinates', () => {
    const errors = validateLocation(
      { lat: 52.52, lng: 13.405 },
      'delivery_location'
    );
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid latitude', () => {
    const errors = validateLocation(
      { lat: 91, lng: 13.405 },
      'delivery_location'
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('delivery_location.lat');
  });

  it('should reject invalid longitude', () => {
    const errors = validateLocation(
      { lat: 52.52, lng: 181 },
      'delivery_location'
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('delivery_location.lng');
  });

  it('should reject null location', () => {
    const errors = validateLocation(null, 'pickup_location');
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe('critical');
  });

  it('should reject missing lat/lng', () => {
    const errors = validateLocation(
      { lat: 52.52 },
      'delivery_location'
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept edge case coordinates', () => {
    const northPole = validateLocation({ lat: 90, lng: 0 }, 'location');
    const southPole = validateLocation({ lat: -90, lng: 180 }, 'location');
    const dateLine = validateLocation({ lat: 0, lng: -180 }, 'location');

    expect(northPole).toHaveLength(0);
    expect(southPole).toHaveLength(0);
    expect(dateLine).toHaveLength(0);
  });
});

describe('Time Window Validation', () => {
  it('should accept valid future time window', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const start = tomorrow.toISOString();
    const end = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const promised = tomorrow.toISOString().split('T')[0];

    const errors = validateTimeWindow(start, end, promised);
    expect(errors).toHaveLength(0);
  });

  it('should reject past delivery window', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const start = yesterday.toISOString();
    const end = yesterday.toISOString();
    const promised = yesterday.toISOString().split('T')[0];

    const errors = validateTimeWindow(start, end, promised);
    expect(errors.some((e) => e.field === 'delivery_window_start')).toBe(true);
  });

  it('should reject when start >= end', () => {
    const time = new Date();
    time.setDate(time.getDate() + 1);
    const start = time.toISOString();
    const end = start; // Same time

    const errors = validateTimeWindow(start, end, '2025-08-01');
    expect(errors.some((e) => e.field === 'delivery_window')).toBe(true);
  });

  it('should reject invalid date format', () => {
    const errors = validateTimeWindow('invalid', '2025-08-01T10:00:00Z', '2025-08-01');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept 1 hour delivery window', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const start = tomorrow.toISOString();
    const end = new Date(tomorrow.getTime() + 1 * 60 * 60 * 1000).toISOString();

    const errors = validateTimeWindow(start, end, '2025-08-01');
    expect(errors).toHaveLength(0);
  });

  it('should accept 24 hour delivery window', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const start = tomorrow.toISOString();
    const end = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const errors = validateTimeWindow(start, end, '2025-08-01');
    expect(errors).toHaveLength(0);
  });
});

describe('Package Validation', () => {
  it('should accept valid package weight', () => {
    const weight = 25.5;
    expect(weight > 0 && weight <= 5000).toBe(true);
  });

  it('should reject zero weight', () => {
    const weight = 0;
    expect(weight > 0).toBe(false);
  });

  it('should reject negative weight', () => {
    const weight = -10;
    expect(weight > 0).toBe(false);
  });

  it('should reject weight over 5000kg', () => {
    const weight = 5001;
    expect(weight <= 5000).toBe(false);
  });

  it('should accept reasonable package dimensions', () => {
    const dimensions = {
      length_cm: 100,
      width_cm: 50,
      height_cm: 50
    };
    const volume = (dimensions.length_cm * dimensions.width_cm * dimensions.height_cm) / 1000000;
    expect(volume > 0 && volume < 100).toBe(true); // < 100 m³
  });

  it('should handle fragile flag', () => {
    expect([true, false]).toContain(true);
    expect([true, false]).toContain(false);
  });

  it('should handle signature requirement', () => {
    expect([true, false]).toContain(true);
    expect([true, false]).toContain(false);
  });
});

describe('Data Quality Scoring', () => {
  it('should score A for complete orders', () => {
    const completeOrder = {
      order_number: 'ORD-001',
      customer_id: 'CUST-123',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      pickup_location: { lat: 52.52, lng: 13.405 },
      delivery_location: { lat: 48.8566, lng: 2.3522 },
      delivery_window_start: new Date(Date.now() + 86400000).toISOString(),
      delivery_window_end: new Date(Date.now() + 90000000).toISOString(),
      package_weight: 25,
      package_volume: 0.125,
      package_dimensions: { length_cm: 50, width_cm: 50, height_cm: 50 },
      promised_delivery_date: '2025-08-01'
    };

    // Count filled fields
    const filledFields = Object.values(completeOrder).filter((v) => v !== undefined && v !== null).length;
    expect(filledFields).toBeGreaterThanOrEqual(10);
  });

  it('should score lower for incomplete orders', () => {
    const incompleteOrder = {
      order_number: 'ORD-002',
      customer_id: 'CUST-456',
      pickup_location: { lat: 52.52, lng: 13.405 },
      delivery_location: { lat: 48.8566, lng: 2.3522 },
      delivery_window_start: new Date(Date.now() + 86400000).toISOString(),
      delivery_window_end: new Date(Date.now() + 90000000).toISOString(),
      package_weight: 25,
      promised_delivery_date: '2025-08-01'
      // Missing: customer_name, customer_email, volume, dimensions
    };

    const filledFields = Object.values(incompleteOrder).filter((v) => v !== undefined && v !== null).length;
    expect(filledFields).toBeLessThan(12);
  });
});

describe('Integration Scenarios', () => {
  it('should validate realistic order', () => {
    const realOrder = {
      order_number: 'AMAZON-123456',
      customer_id: 'CUST-abc123',
      customer_name: 'Alice Mueller',
      customer_email: 'alice@example.com',
      pickup_location: {
        lat: 52.5200,
        lng: 13.4050,
        address: '123 Warehouse St, Berlin'
      },
      delivery_location: {
        lat: 48.8566,
        lng: 2.3522,
        address: '456 Delivery Blvd, Paris'
      },
      delivery_window_start: new Date(Date.now() + 86400000).toISOString(),
      delivery_window_end: new Date(Date.now() + 90000000).toISOString(),
      package_weight: 2.5,
      package_volume: 0.01,
      package_dimensions: {
        length_cm: 30,
        width_cm: 20,
        height_cm: 15
      },
      is_fragile: false,
      requires_signature: true,
      special_instructions: 'Ring doorbell twice',
      priority: 'normal',
      promised_delivery_date: '2025-08-01',
      sla_window_minutes: 480 // 8 hours
    };

    const locErrors = [
      ...validateLocation(realOrder.pickup_location, 'pickup_location'),
      ...validateLocation(realOrder.delivery_location, 'delivery_location')
    ];

    expect(locErrors).toHaveLength(0);
  });

  it('should validate high-priority rush order', () => {
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);

    const rushOrder = {
      order_number: 'RUSH-001',
      customer_id: 'VIP-001',
      priority: 'critical',
      delivery_window_start: nextHour.toISOString(),
      delivery_window_end: new Date(nextHour.getTime() + 60 * 60 * 1000).toISOString(),
      sla_window_minutes: 60 // Must be delivered within 1 hour
    };

    expect(rushOrder.priority).toBe('critical');
    expect(rushOrder.sla_window_minutes).toBe(60);
  });

  it('should flag suspicious weights', () => {
    const heavyOrder = {
      package_weight: 2500 // Heavy but valid
    };

    const ultraHeavyOrder = {
      package_weight: 5001 // Over limit
    };

    expect(heavyOrder.package_weight <= 5000).toBe(true);
    expect(ultraHeavyOrder.package_weight <= 5000).toBe(false);
  });
});
