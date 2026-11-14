/**
 * Server-side warning entry point. The actual evaluation lives in
 * src/lib/healthWarnings.ts so the browser and API use exactly the same rules.
 */
import { CompletedLog, WarningReport, WatchReading } from '../src/types.ts';
import { evaluateHealthWarnings, WarningParameter } from '../src/lib/healthWarnings.ts';
import { listParameters } from './db.ts';

export type { HealthAlert, WarningReport } from '../src/types.ts';

export function evaluateWarnings(
  readings: WatchReading[],
  history: CompletedLog[],
  now = Date.now()
): WarningReport {
  return evaluateHealthWarnings(
    readings,
    history,
    now,
    listParameters() as unknown as WarningParameter[]
  );
}
