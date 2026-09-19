export interface CalibrationInputRow {
  urgency_score: number | null;
  revenue_potential: 'low' | 'medium' | 'high' | 'very_high' | null;
  build_complexity: 'low' | 'medium' | 'high' | null;
}

export interface CalibrationSnapshot {
  sampleSize: number;
  avgUrgency: number | null;
  revenueShare: Record<'low' | 'medium' | 'high' | 'very_high', number>;
  complexityShare: Record<'low' | 'medium' | 'high', number>;
}

const REVENUE_BUCKETS: Array<'low' | 'medium' | 'high' | 'very_high'> = ['low', 'medium', 'high', 'very_high'];
const COMPLEXITY_BUCKETS: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

function percentage(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

export function buildCalibrationSnapshot(rows: CalibrationInputRow[]): CalibrationSnapshot {
  const revenueCounts: Record<'low' | 'medium' | 'high' | 'very_high', number> = {
    low: 0,
    medium: 0,
    high: 0,
    very_high: 0,
  };
  const complexityCounts: Record<'low' | 'medium' | 'high', number> = {
    low: 0,
    medium: 0,
    high: 0,
  };

  let urgencySum = 0;
  let urgencyCount = 0;

  for (const row of rows) {
    if (row.revenue_potential && REVENUE_BUCKETS.includes(row.revenue_potential)) {
      revenueCounts[row.revenue_potential] += 1;
    }
    if (row.build_complexity && COMPLEXITY_BUCKETS.includes(row.build_complexity)) {
      complexityCounts[row.build_complexity] += 1;
    }
    if (typeof row.urgency_score === 'number' && Number.isFinite(row.urgency_score)) {
      urgencySum += row.urgency_score;
      urgencyCount += 1;
    }
  }

  const sampleSize = rows.length;
  return {
    sampleSize,
    avgUrgency: urgencyCount > 0 ? Number((urgencySum / urgencyCount).toFixed(1)) : null,
    revenueShare: {
      low: percentage(revenueCounts.low, sampleSize),
      medium: percentage(revenueCounts.medium, sampleSize),
      high: percentage(revenueCounts.high, sampleSize),
      very_high: percentage(revenueCounts.very_high, sampleSize),
    },
    complexityShare: {
      low: percentage(complexityCounts.low, sampleSize),
      medium: percentage(complexityCounts.medium, sampleSize),
      high: percentage(complexityCounts.high, sampleSize),
    },
  };
}

export function buildCalibrationPromptBlock(snapshot: CalibrationSnapshot): string {
  if (snapshot.sampleSize < 10) {
    return [
      'Kalibrierung: Zu wenig Bestand (<10 Einträge). Nutze konservative Scores und nur belegbare High/Very-High-Einstufungen.',
      'Nutze die komplette Skala nur bei klarer Evidenz.',
    ].join(' ');
  }

  return [
    `Kalibrierung auf Bestand (n=${snapshot.sampleSize}):`,
    `bisher urgency Ø ${snapshot.avgUrgency ?? 'n/a'},`,
    `revenue low/medium/high/very_high = ${snapshot.revenueShare.low}%/${snapshot.revenueShare.medium}%/${snapshot.revenueShare.high}%/${snapshot.revenueShare.very_high}%,`,
    `build low/medium/high = ${snapshot.complexityShare.low}%/${snapshot.complexityShare.medium}%/${snapshot.complexityShare.high}%.`,
    'Wichtig: Vergib high/very_high nur, wenn die neue Lücke klar über dem Median des bisherigen Bestands liegt.',
    'Wenn die Evidenz nur durchschnittlich ist, nutze medium statt high.',
    'Nutze urgency 1..10 relativ zum Bestand; Werte >=9 nur bei akuter Regulierung, Umsatzverlust oder Betriebsrisiko.',
  ].join(' ');
}
