import { describe, it, expect } from 'vitest';
import {
  buildCalibrationPromptBlock,
  buildCalibrationSnapshot,
  type CalibrationInputRow,
} from '../../supabase/functions/market-scanner/calibration.ts';

describe('market-scanner calibration', () => {
  it('builds a distribution snapshot from historical rows', () => {
    const rows: CalibrationInputRow[] = [
      { urgency_score: 9, revenue_potential: 'high', build_complexity: 'medium' },
      { urgency_score: 8, revenue_potential: 'high', build_complexity: 'medium' },
      { urgency_score: 7, revenue_potential: 'medium', build_complexity: 'low' },
      { urgency_score: 10, revenue_potential: 'very_high', build_complexity: 'high' },
    ];

    const snapshot = buildCalibrationSnapshot(rows);
    expect(snapshot.sampleSize).toBe(4);
    expect(snapshot.avgUrgency).toBe(8.5);
    expect(snapshot.revenueShare).toEqual({ low: 0, medium: 25, high: 50, very_high: 25 });
    expect(snapshot.complexityShare).toEqual({ low: 25, medium: 50, high: 25 });
  });

  it('adds strict guidance when enough baseline data exists', () => {
    const rows: CalibrationInputRow[] = Array.from({ length: 12 }, (_, i) => ({
      urgency_score: i < 10 ? 9 : 6,
      revenue_potential: i < 10 ? 'high' : 'medium',
      build_complexity: 'medium',
    }));

    const prompt = buildCalibrationPromptBlock(buildCalibrationSnapshot(rows));
    expect(prompt).toContain('Kalibrierung auf Bestand (n=12)');
    expect(prompt).toContain('high/very_high');
    expect(prompt).toContain('Wichtig: Vergib high/very_high nur');
    expect(prompt).toContain('Werte >=9 nur bei akuter Regulierung');
  });

  it('uses a conservative fallback for small samples', () => {
    const prompt = buildCalibrationPromptBlock(buildCalibrationSnapshot([]));
    expect(prompt).toContain('Zu wenig Bestand (<10 Einträge)');
    expect(prompt).toContain('konservative Scores');
  });
});
