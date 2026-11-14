/**
 * Threshold tests for the warning engine. Uses a temporary database.
 *   VITANAUT_DB_PATH=/tmp/vitanaut-test.db npx tsx tests/warnings.test.ts
 */
import { initDb, closeDb } from '../server/db.ts';
import { evaluateWarnings } from '../server/warnings.ts';
import { CompletedLog, GardenElement, HabitCategory, MissionId, WatchReading } from '../src/types.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    passed++;
    console.log(`ok   ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name} ${extra}`);
  }
}

const now = Date.now();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

function reading(overrides: Partial<WatchReading>): WatchReading {
  return {
    id: `r-${Math.random()}`,
    timestamp: iso(3600_000),
    heartRateBpm: 66,
    hrvMs: 55,
    spo2Percent: 98,
    stressIndex: 30,
    sleepHours: 8,
    deepSleepPercent: 22,
    boneLoadKn: 1.6,
    activeMinutes: 95,
    source: 'wearable_sync',
    ...overrides,
  };
}

function log(mood: number, id: string): CompletedLog {
  return {
    id,
    habitId: 'h1',
    title: 'Test habit',
    category: HabitCategory.MENTAL_HEALTH,
    gardenElement: GardenElement.BIRD,
    completedAt: iso(3600_000),
    missionId: MissionId.ISS,
    durationMinutes: 10,
    moodBefore: 3,
    moodAfter: mood,
    notes: '',
  };
}

initDb();

const good = evaluateWarnings([reading({})], [log(4, 'm1'), log(5, 'm2')], now);
check('healthy values raise no alerts', good.alerts.length === 0, JSON.stringify(good.alerts));

const lowSleep = evaluateWarnings([reading({ sleepHours: 5.2 })], [], now);
const sleepAlert = lowSleep.alerts.find((a) => a.parameterId === 'total_sleep_time');
check('short sleep raises a red alert', sleepAlert?.severity === 'red');
check(
  'short sleep carries the guideline consequence',
  Boolean(sleepAlert?.consequence.includes('Cumulative sleep debt'))
);
check(
  'short sleep carries the operational impact',
  Boolean(sleepAlert?.operationalImpact.includes('Higher error rates'))
);

const highStress = evaluateWarnings([reading({ stressIndex: 82 })], [], now);
check(
  'high stress raises a red alert',
  highStress.alerts.some((a) => a.parameterId === 'stress' && a.severity === 'red')
);

const lowExercise = evaluateWarnings(
  [reading({ activeMinutes: 45 }), reading({ activeMinutes: 55, timestamp: iso(7200_000) })],
  [],
  now
);
const exerciseAlert = lowExercise.alerts.find((a) => a.parameterId === 'exercise_dose');
check('low 7-day exercise raises a red alert', exerciseAlert?.severity === 'red');
check('exercise alert averages its samples', exerciseAlert?.sampleSize === 2);

const lowMood = evaluateWarnings([], [log(2, 'm3'), log(2, 'm4'), log(3, 'm5')], now);
check(
  'sustained low mood raises a red alert',
  lowMood.alerts.some((a) => a.parameterId === 'mood' && a.severity === 'red')
);

const oneMood = evaluateWarnings([], [log(1, 'm6')], now);
check('a single low mood log is not treated as a trend', oneMood.alerts.length === 0);

const stale = evaluateWarnings(
  [reading({ sleepHours: 4, timestamp: iso(30 * 24 * 3600_000) })],
  [],
  now
);
check('stale readings do not trigger latest-value alerts', stale.alerts.length === 0);

closeDb();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
