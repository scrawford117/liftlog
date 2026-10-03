import { describe, expect, it } from 'vitest';
import { cleanStreak, e1rm, isClean, suggestIncrease, type SessionSets } from './progression';
import { prefillSets } from './prefill';
import type { DayExercise, Exercise } from '../db/schema';

const de: DayExercise = {
  id: 1, dayId: 1, exerciseId: 1, order: 0, group: 'A', sets: 4, target: 6, weight: 245,
  retired: false, flagUp: false,
};

const clean = (w = 245, r = 6) => Array.from({ length: 4 }, () => ({ weight: w, reps: r, done: true }));
let n = 0;
const sess = (date: string, sets: SessionSets['sets']): SessionSets => ({
  session: { id: ++n, date, status: 'done', finishedAt: `${date}T12:00:00.000Z` },
  sets,
});

describe('progression', () => {
  it('recognises clean sessions', () => {
    expect(isClean(de, clean())).toBe(true);
    expect(isClean(de, [...clean().slice(0, 3), { weight: 245, reps: 5, done: true }])).toBe(false);
    expect(isClean(de, clean().slice(0, 3))).toBe(false);
  });

  it('suggests after 3 clean sessions', () => {
    const h = [sess('2026-09-01', clean()), sess('2026-09-08', clean())];
    expect(suggestIncrease(de, 10, h, 3)).toBeNull();
    h.push(sess('2026-09-15', clean()));
    expect(suggestIncrease(de, 10, h, 3)).toMatchObject({ from: 245, to: 255, reason: 'streak' });
  });

  it('a missed rep resets the count', () => {
    const missed = [...clean().slice(0, 3), { weight: 245, reps: 5, done: true }];
    const h = [sess('2026-09-01', clean()), sess('2026-09-08', clean()), sess('2026-09-15', missed), sess('2026-09-22', clean())];
    expect(cleanStreak(de, h)).toBe(1);
    expect(suggestIncrease(de, 10, h, 3)).toBeNull();
  });

  it('only counts sessions after the anchor', () => {
    const h = [sess('2026-09-01', clean()), sess('2026-09-08', clean()), sess('2026-09-15', clean())];
    expect(cleanStreak({ ...de, anchor: '2026-09-10T00:00:00.000Z' }, h)).toBe(1);
  });

  it('manual flag triggers a suggestion', () => {
    expect(suggestIncrease({ ...de, flagUp: true }, 5, [], 3)).toMatchObject({ to: 250, reason: 'flag' });
  });

  it('no suggestion for bodyweight', () => {
    expect(suggestIncrease({ ...de, weight: 0, flagUp: true }, 5, [], 3)).toBeNull();
  });

  it('estimates 1RM', () => {
    expect(e1rm(225, 1)).toBe(225);
    expect(e1rm(300, 6)).toBe(360);
  });
});

describe('prefill', () => {
  it('builds sets from working weight, skipping retired', () => {
    const ex = new Map<number, Exercise>([
      [1, { id: 1, name: 'Bench', kind: 'weighted', increment: 5 }],
      [2, { id: 2, name: 'Dips', kind: 'bodyweight', increment: 0 }],
    ]);
    const des: DayExercise[] = [
      de,
      { ...de, id: 2, exerciseId: 2, order: 1, weight: 0, target: 10, sets: 3 },
      { ...de, id: 3, order: 2, retired: true },
    ];
    const sets = prefillSets(9, des, ex);
    expect(sets).toHaveLength(7);
    expect(sets[0]).toMatchObject({ sessionId: 9, weight: 245, reps: 6, idx: 0, done: false });
    expect(sets[6]).toMatchObject({ dayExerciseId: 2, weight: 0, reps: 10 });
  });
});
