import type { CrewState } from '../types.ts';

/**
 * Formats a Date into the local system calendar date key (YYYY-MM-DD).
 */
export function getSystemDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKeyUtcMs(dateKey: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return Date.UTC(year, month, day);
}

function getSolIncrement(prevDateKey: string, nextDateKey: string): number {
  const prevMs = parseDateKeyUtcMs(prevDateKey);
  const nextMs = parseDateKeyUtcMs(nextDateKey);
  if (prevMs === null || nextMs === null) return 1;
  const diffDays = Math.round((nextMs - prevMs) / 86_400_000);
  return diffDays > 0 ? diffDays : 1;
}

export interface DailyResetResult {
  state: CrewState;
  didReset: boolean;
  needsPersist: boolean;
}

/**
 * Clears `completedToday` for all habits when the system date changes,
 * advancing the mission sol and recording the new `lastHabitResetDate`.
 */
export function applyDailyHabitReset(
  state: CrewState,
  currentDateKey: string = getSystemDateKey()
): DailyResetResult {
  if (state.lastHabitResetDate === currentDateKey) {
    return { state, didReset: false, needsPersist: false };
  }

  // Legacy accounts stored before `lastHabitResetDate` existed
  if (!state.lastHabitResetDate) {
    const hasTodayActivity = state.history.some(
      (entry) => getSystemDateKey(new Date(entry.completedAt)) === currentDateKey
    );

    if (hasTodayActivity) {
      return {
        state: {
          ...state,
          lastHabitResetDate: currentDateKey,
        },
        didReset: false,
        needsPersist: true,
      };
    }

    return {
      state: {
        ...state,
        lastHabitResetDate: currentDateKey,
        habits: state.habits.map((h) =>
          h.completedToday ? { ...h, completedToday: false } : h
        ),
      },
      didReset: true,
      needsPersist: true,
    };
  }

  // System date changed since the last reset -> fresh start for the new mission sol
  const solDelta = getSolIncrement(state.lastHabitResetDate, currentDateKey);

  return {
    state: {
      ...state,
      missionSol: state.missionSol + solDelta,
      lastHabitResetDate: currentDateKey,
      habits: state.habits.map((h) => ({
        ...h,
        completedToday: false,
      })),
    },
    didReset: true,
    needsPersist: true,
  };
}
