import catalog from '../../db/reference_parameters.json';
import { CompletedLog, HealthAlert, WarningReport, WatchReading } from '../types.ts';

export interface WarningBands {
  greenMin: number;
  greenMax: number;
  yellowMin: number;
  yellowMax: number;
  redBelow: number;
  redAbove: number;
}

export interface WarningParameter {
  parameterId: string;
  domain: string;
  domainLabel: string;
  name: string;
  targetText: string;
  consequence: string;
  operationalImpact: string;
  countermeasures: string;
  relatedRisks: string;
  monitoringSource: string;
  cadence: string;
  status: string;
  metricKey: string | null;
  aggregation: string | null;
  bandLabel: string | null;
  unit: string | null;
  bands: WarningBands | null;
}

const DAY_MS = 24 * 3600 * 1000;
const CATALOG = (catalog as { parameters: WarningParameter[] }).parameters;

export const PLAIN_GUIDANCE: Record<string, { summary: string; action: string }> = {
  heart_rate: {
    summary: 'Your resting heart rate is above the safe range.',
    action:
      'Sit down and stop activity. Breathe slowly for 2–3 minutes, drink water, and recheck your heart rate. If it stays above 120 bpm, or you feel chest pain, dizziness or shortness of breath, contact the flight surgeon now.',
  },
  total_sleep_time: {
    summary: 'You are not getting enough sleep.',
    action:
      'Start winding down 30 minutes earlier tonight. Keep the cabin dark and cool, and aim for 8–8.5 hours.',
  },
  exercise_dose: {
    summary: 'You are moving less than the healthy weekly amount.',
    action:
      'Add a 20–30 minute walk or easy cardio session today. Build up toward about 90 minutes of activity per day.',
  },
  stress: {
    summary: 'Your stress level is higher than the healthy range.',
    action:
      'Take a 10-minute slow-breathing break and check in with a crewmate. If it stays high, tell your flight surgeon.',
  },
  mood: {
    summary: 'Your mood has been low this week.',
    action:
      'Try a 15-minute Earth-gazing break or a call home. If the low mood lasts more than a few days, talk to your flight surgeon.',
  },
};

export function plainSummary(alert: HealthAlert): string {
  const preset = PLAIN_GUIDANCE[alert.parameterId];
  if (preset) return preset.summary;
  const direction = alert.value < alert.greenMin ? 'below' : 'above';
  return `Your ${alert.name.toLowerCase()} is ${direction} the healthy range.`;
}

export function plainAction(alert: HealthAlert): string {
  return PLAIN_GUIDANCE[alert.parameterId]?.action ?? alert.countermeasures;
}

function classify(value: number, bands: WarningBands): 'green' | 'yellow' | 'red' {
  if (value < bands.redBelow || value > bands.redAbove) return 'red';
  if (value < bands.greenMin || value > bands.greenMax) return 'yellow';
  return 'green';
}

function latestReading(readings: WatchReading[]): WatchReading | undefined {
  return readings.reduce<WatchReading | undefined>((latest, reading) => {
    if (!latest) return reading;
    return Date.parse(reading.timestamp) > Date.parse(latest.timestamp) ? reading : latest;
  }, undefined);
}

function latestMetric(
  metricKey: string,
  readings: WatchReading[],
  now: number
): { value: number; sampleSize: number } | null {
  const reading = latestReading(readings);
  if (!reading) return null;
  if (now - Date.parse(reading.timestamp) > 48 * 3600_000) return null;

  switch (metricKey) {
    case 'heart_rate':
      return typeof reading.heartRateBpm === 'number' && Number.isFinite(reading.heartRateBpm)
        ? { value: reading.heartRateBpm, sampleSize: 1 }
        : null;
    case 'sleep_hours':
      return reading.sleepHours == null ? null : { value: reading.sleepHours, sampleSize: 1 };
    case 'stress_index':
      return reading.stressIndex == null ? null : { value: reading.stressIndex, sampleSize: 1 };
    default:
      return null;
  }
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parameterValue(
  parameter: WarningParameter,
  readings: WatchReading[],
  history: CompletedLog[],
  now: number
): { value: number; sampleSize: number } | null {
  if (!parameter.bands || !parameter.metricKey) return null;

  if (parameter.aggregation === 'latest') {
    return latestMetric(parameter.metricKey, readings, now);
  }

  const recentReadings = readings.filter(
    (reading) => now - Date.parse(reading.timestamp) <= 7 * DAY_MS
  );

  if (parameter.aggregation === 'avg_7d' && parameter.metricKey === 'active_minutes') {
    const values = recentReadings
      .map((reading) => reading.activeMinutes)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (values.length === 0) return null;
    return { value: average(values), sampleSize: values.length };
  }

  if (parameter.aggregation === 'avg_7d_mood') {
    const values = history
      .filter((entry) => now - Date.parse(entry.completedAt) <= 7 * DAY_MS)
      .map((entry) => entry.moodAfter)
      .filter((value) => Number.isFinite(value));
    if (values.length < 2) return null;
    return { value: average(values), sampleSize: values.length };
  }

  return null;
}

export function evaluateHealthWarnings(
  readings: WatchReading[],
  history: CompletedLog[],
  now = Date.now(),
  parameters: WarningParameter[] = CATALOG
): WarningReport {
  const alerts: HealthAlert[] = [];
  const checked: WarningReport['checked'] = [];

  for (const parameter of parameters) {
    if (parameter.status !== 'monitored' || !parameter.bands) continue;
    const result = parameterValue(parameter, readings, history, now);
    if (!result) continue;

    const rounded = Math.round(result.value * 10) / 10;
    checked.push({
      parameterId: parameter.parameterId,
      name: parameter.name,
      value: rounded,
      unit: parameter.unit,
    });

    const severity = classify(result.value, parameter.bands);
    if (severity === 'green') continue;

    alerts.push({
      parameterId: parameter.parameterId,
      name: parameter.name,
      domain: parameter.domain,
      domainLabel: parameter.domainLabel,
      severity,
      value: rounded,
      unit: parameter.unit,
      greenMin: parameter.bands.greenMin,
      greenMax: parameter.bands.greenMax,
      bandLabel: parameter.bandLabel,
      targetText: parameter.targetText,
      consequence: parameter.consequence,
      operationalImpact: parameter.operationalImpact,
      countermeasures: parameter.countermeasures,
      relatedRisks: parameter.relatedRisks,
      monitoringSource: parameter.monitoringSource,
      cadence: parameter.cadence,
      aggregation: parameter.aggregation ?? 'latest',
      sampleSize: result.sampleSize,
    });
  }

  alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'red' ? -1 : 1));
  return { generatedAt: new Date(now).toISOString(), checked, alerts };
}
