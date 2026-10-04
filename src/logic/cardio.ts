import type { DayExercise } from '../db/schema';

export function distanceUnit(weightUnit: 'lb' | 'kg' | string): 'mi' | 'km' {
  return weightUnit === 'kg' ? 'km' : 'mi';
}

/** 1:05:09, 32:10, 0:45 */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Seconds per distance unit, or null if it can't be computed. */
export function paceSec(distance?: number, durationSec?: number): number | null {
  if (!distance || !durationSec || distance <= 0 || durationSec <= 0) return null;
  return durationSec / distance;
}

export function formatPace(distance: number | undefined, durationSec: number | undefined, unit: string): string {
  const p = paceSec(distance, durationSec);
  return p == null ? '—' : `${formatDuration(p)} /${unit}`;
}

export function formatSecShort(sec: number): string {
  return sec % 60 === 0 && sec >= 60 ? `${sec / 60}m` : `${sec}s`;
}

export function cardioPlanLabel(de: Pick<DayExercise, 'distance' | 'durationMin' | 'intervals'>, unit: string): string {
  const parts: string[] = [];
  if (de.distance) parts.push(`${de.distance} ${unit}`);
  if (de.durationMin) parts.push(`${de.durationMin} min`);
  if (de.intervals?.rounds) {
    const { rounds, workSec, restSec } = de.intervals;
    parts.push(`${rounds}× ${formatSecShort(workSec)} on / ${formatSecShort(restSec)} off`);
  }
  return parts.join(' · ') || 'Cardio';
}

export type IntervalPhase = 'work' | 'rest' | 'done';

/** Where an interval session is after `elapsedSec` (work then rest each round, no rest after the last). */
export function intervalState(iv: { rounds: number; workSec: number; restSec: number }, elapsedSec: number) {
  let t = Math.max(0, elapsedSec);
  for (let round = 1; round <= iv.rounds; round++) {
    if (t < iv.workSec) return { phase: 'work' as IntervalPhase, round, left: iv.workSec - t, completed: round - 1 };
    t -= iv.workSec;
    if (round === iv.rounds) break;
    if (t < iv.restSec) return { phase: 'rest' as IntervalPhase, round, left: iv.restSec - t, completed: round };
    t -= iv.restSec;
  }
  return { phase: 'done' as IntervalPhase, round: iv.rounds, left: 0, completed: iv.rounds };
}

export function intervalTotalSec(iv: { rounds: number; workSec: number; restSec: number }) {
  return iv.rounds * iv.workSec + Math.max(0, iv.rounds - 1) * iv.restSec;
}
