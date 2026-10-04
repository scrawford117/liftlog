import { addDays, weekStart } from './dates';
import type { PlanEntry, WeeklySchedule } from '../db/schema';

export type DayStatus =
  | 'done' // a workout was finished that day
  | 'rest' // planned rest, nothing logged
  | 'missed' // planned workout (or no plan) and nothing logged, in the past
  | 'pending' // today, workout planned but not done yet
  | 'future'
  | 'before'; // before tracking started

export interface StreakInput {
  today: string;
  /** First date that counts toward streaks. */
  start: string;
  /** Dates with at least one finished session. */
  doneDates: Set<string>;
  planFor: (date: string) => PlanEntry | null;
}

export function planForDate(
  date: string,
  weekly: WeeklySchedule,
  overrides: Map<string, PlanEntry | null>,
  weekdayOf: (d: string) => number,
): PlanEntry | null {
  if (overrides.has(date)) return overrides.get(date) ?? null;
  return weekly[weekdayOf(date)] ?? null;
}

export function dayStatus(date: string, input: StreakInput): DayStatus {
  if (input.start && date < input.start) return 'before';
  if (date > input.today) return 'future';
  if (input.doneDates.has(date)) return 'done';
  const plan = input.planFor(date);
  if (plan?.kind === 'rest') return 'rest';
  if (date === input.today) return 'pending';
  return 'missed';
}

/**
 * Current streak: consecutive days ending today where you either trained or it was a
 * planned rest day. Rest days only carry a streak — a run has to start with a workout,
 * so rest days alone never give you a streak. A pending workout today doesn't break it.
 */
export function currentStreak(input: StreakInput): number {
  let count = 0;
  let sinceWorkout = 0; // days counted since (back in time) the earliest workout seen
  let d = input.today;
  for (let i = 0; i < 3650; i++) {
    const s = dayStatus(d, input);
    if (s === 'done') {
      count++;
      sinceWorkout = 0;
    } else if (s === 'rest') {
      count++;
      sinceWorkout++;
    } else if (s !== 'pending') break;
    d = addDays(d, -1);
  }
  // Drop rest days before the first workout of the run.
  return count - sinceWorkout;
}

export function longestStreak(input: StreakInput): number {
  if (!input.start) return currentStreak(input);
  let best = 0;
  let run = 0; // 0 until the run's first workout
  for (let d = input.start; d <= input.today; d = addDays(d, 1)) {
    const s = dayStatus(d, input);
    if (s === 'done') run++;
    else if (s === 'rest') run = run > 0 ? run + 1 : 0;
    else if (s !== 'pending') run = 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Planned vs completed workouts in the week (Mon–Sun) containing `date`. */
export function weekAdherence(date: string, input: StreakInput) {
  const start = weekStart(date);
  let planned = 0;
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (input.start && d < input.start) continue;
    const plan = input.planFor(d);
    if (plan?.kind === 'workout') planned++;
    if (input.doneDates.has(d) && d <= input.today) done++;
  }
  return { planned, done };
}
