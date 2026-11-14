/**
 * Evaluates the signed-in astronaut's latest measurements against the
 * reference catalog. Only parameters with a live metric and numeric bands can
 * raise an alert; everything else in the catalog is reference material.
 *
 * Every alert carries the consequence and operational-impact text from the
 * guideline file, so the UI can explain why a limit matters rather than only
 * showing a number.
 */

import { CompletedLog, WatchReading } from '../src/types.ts';
import { listParameters, ParameterBands, RefParameter } from './db.ts';

export type Severity = 'red' | 'yellow';

export interface HealthAlert {
  parameterId: string;
  name: string;
  domain: string;
  domainLabel: string;
  severity: Severity;
  value: number;
  unit: string | null;
  greenMin: number;
  greenMax: number;
  bandLabel: string | null;
  targetText: string;
  consequence: string;
  operationalImpact: string;
  countermeasures: string;
  relatedRisks: string;
  monitoringSource: string;
  cadence: string;
  aggregation: string;
  sampleSize: number;
}

export interface WarningReport {
  generatedAt: string;
  checked: Array<{ parameterId: string; name: string; value: number; unit: string | null }>;
  alerts: HealthAlert[];
}

const DAY_MS = 24 * 3600 * 1000;

function classify(value: number, b: ParameterBands): 'green' | Severity {
  if (value < b.redBelow || value > b.redAbove) return 'red';
  if (value < b.greenMin || value > b.greenMax) return 'yellow';
  return 'green';
}

function latestReading(readings: WatchReading[]): WatchReading | undefined {
  return readings.reduce<WatchReading | undefined>((acc, r) => {
    if (!acc) return r;
    return Date.parse(r.timestamp) > Date.parse(acc.timestamp) ? r : acc;
  }, undefined);
}

function metricValue(
  metricKey: string,
  readings: WatchReading[],
  now: number
): { value: number; sampleSize: number } | null {
  const reading = latestReading(readings);
  if (!reading) return null;
  // A nightly/daily value older than 48 h no longer describes current state.
  if (now - Date.parse(reading.timestamp) > 48 * 3600_000) return null;
  switch (metricKey) {
    case 'sleep_hours':
      return reading.sleepHours == null ? null : { value: reading.sleepHours, sampleSize: 1 };
    case 'stress_index':
      return reading.stressIndex == null ? null : { value: reading.stressIndex, sampleSize: 1 };
    default:
      return null;
  }
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function evaluateParameter(
  p: RefParameter,
  readings: WatchReading[],
  history: CompletedLog[],
  now: number
): { value: number; sampleSize: number } | null {
  if (!p.bands || !p.metricKey) return null;

  if (p.aggregation === 'latest') {
    return metricValue(p.metricKey, readings, now);
  }

  const recentReadings = readings.filter((r) => now - Date.parse(r.timestamp) <= 7 * DAY_MS);

  if (p.aggregation === 'avg_7d' && p.metricKey === 'active_minutes') {
    const values = recentReadings
      .map((r) => r.activeMinutes)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (values.length === 0) return null;
    return { value: average(values), sampleSize: values.length };
  }

  if (p.aggregation === 'avg_7d_mood') {
    const values = history
      .filter((h) => now - Date.parse(h.completedAt) <= 7 * DAY_MS)
      .map((h) => h.moodAfter)
      .filter((v) => Number.isFinite(v));
    // A single check-in is too noisy to call a trend.
    if (values.length < 2) return null;
    return { value: average(values), sampleSize: values.length };
  }

  return null;
}

export function evaluateWarnings(
  readings: WatchReading[],
  history: CompletedLog[],
  now = Date.now()
): WarningReport {
  const alerts: HealthAlert[] = [];
  const checked: WarningReport['checked'] = [];

  for (const p of listParameters()) {
    if (p.status !== 'monitored' || !p.bands) continue;
    const result = evaluateParameter(p, readings, history, now);
    if (!result) continue;

    const rounded = Math.round(result.value * 10) / 10;
    checked.push({ parameterId: p.parameterId, name: p.name, value: rounded, unit: p.unit });

    const severity = classify(result.value, p.bands);
    if (severity === 'green') continue;

    alerts.push({
      parameterId: p.parameterId,
      name: p.name,
      domain: p.domain,
      domainLabel: p.domainLabel,
      severity,
      value: rounded,
      unit: p.unit,
      greenMin: p.bands.greenMin,
      greenMax: p.bands.greenMax,
      bandLabel: p.bandLabel,
      targetText: p.targetText,
      consequence: p.consequence,
      operationalImpact: p.operationalImpact,
      countermeasures: p.countermeasures,
      relatedRisks: p.relatedRisks,
      monitoringSource: p.monitoringSource,
      cadence: p.cadence,
      aggregation: p.aggregation ?? 'latest',
      sampleSize: result.sampleSize,
    });
  }

  alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'red' ? -1 : 1));

  return { generatedAt: new Date(now).toISOString(), checked, alerts };
}
