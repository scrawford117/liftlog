import { describe, expect, it } from 'vitest';
import { currentStreak, dayStatus, longestStreak, planForDate, weekAdherence, type StreakInput } from './streak';
import { weekday } from './dates';
import type { PlanEntry, WeeklySchedule } from '../db/schema';

// 2026-10-03 is a Saturday.
const W = (d: number): PlanEntry => ({ kind: 'workout', dayId: d });
const R: PlanEntry = { kind: 'rest' };
// Sun rest, Mon-Sat workouts
const weekly: WeeklySchedule = [R, W(1), W(2), W(3), W(4), W(5), W(6)];

function input(done: string[], opts: Partial<StreakInput> = {}, overrides = new Map<string, PlanEntry | null>()): StreakInput {
  return {
    today: '2026-10-03',
    start: '2026-09-20',
    doneDates: new Set(done),
    planFor: (d) => planForDate(d, weekly, overrides, weekday),
    ...opts,
  };
}

describe('streak', () => {
  it('counts workouts and planned rest days', () => {
    // Sun 27 rest, Mon 28–Sat 3 done
    const done = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];
    expect(currentStreak(input(done))).toBe(7);
  });

  it('does not break on a pending workout today', () => {
    const done = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
    const i = input(done);
    expect(dayStatus('2026-10-03', i)).toBe('pending');
    expect(currentStreak(i)).toBe(6);
  });

  it('a missed scheduled workout breaks it', () => {
    const done = ['2026-09-28', '2026-09-29', '2026-10-01', '2026-10-02'];
    expect(currentStreak(input(done))).toBe(2);
  });

  it('override to rest saves the streak', () => {
    const done = ['2026-09-28', '2026-09-29', '2026-10-01', '2026-10-02'];
    const ov = new Map<string, PlanEntry | null>([['2026-09-30', R]]);
    expect(currentStreak(input(done, {}, ov))).toBe(6);
  });

  it('a day with no plan and no workout breaks it', () => {
    const ov = new Map<string, PlanEntry | null>([['2026-10-01', null]]);
    expect(currentStreak(input(['2026-10-02'], {}, ov))).toBe(1);
  });

  it('stops at the tracking start date', () => {
    const done = ['2026-10-01', '2026-10-02'];
    expect(currentStreak(input(done, { start: '2026-10-01' }))).toBe(2);
  });

  it('tracks the longest streak', () => {
    // 20 rest(Sun),21..26 done => 7, then 27 rest, 28 missed
    const done = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-02'];
    const i = input(done);
    expect(longestStreak(i)).toBe(8);
    expect(currentStreak(i)).toBe(1);
  });

  it('computes weekly adherence', () => {
    const done = ['2026-09-28', '2026-09-30'];
    expect(weekAdherence('2026-10-03', input(done))).toEqual({ planned: 6, done: 2 });
  });
});
