import { describe, expect, it } from 'vitest';
import { cardioPlanLabel, formatDuration, formatPace, intervalState, intervalTotalSec } from './cardio';

describe('cardio', () => {
  it('formats durations and pace', () => {
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(32 * 60 + 10)).toBe('32:10');
    expect(formatDuration(3909)).toBe('1:05:09');
    expect(formatPace(3, 27 * 60, 'mi')).toBe('9:00 /mi');
    expect(formatPace(0, 600, 'mi')).toBe('—');
  });

  it('labels a plan', () => {
    expect(cardioPlanLabel({ distance: 3, durationMin: 30 }, 'mi')).toBe('3 mi · 30 min');
    expect(cardioPlanLabel({ intervals: { rounds: 8, workSec: 30, restSec: 90 } }, 'mi')).toBe('8× 30s on / 90s off');
  });

  it('tracks interval phases', () => {
    const iv = { rounds: 3, workSec: 30, restSec: 60 };
    expect(intervalTotalSec(iv)).toBe(210);
    expect(intervalState(iv, 0)).toMatchObject({ phase: 'work', round: 1, left: 30, completed: 0 });
    expect(intervalState(iv, 30)).toMatchObject({ phase: 'rest', round: 1, left: 60, completed: 1 });
    expect(intervalState(iv, 95)).toMatchObject({ phase: 'work', round: 2, left: 25, completed: 1 });
    expect(intervalState(iv, 180)).toMatchObject({ phase: 'work', round: 3, left: 30, completed: 2 });
    expect(intervalState(iv, 210)).toMatchObject({ phase: 'done', completed: 3 });
  });
});
