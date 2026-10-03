import type { DayExercise, Session, SetLog } from '../db/schema';

export interface SessionSets {
  session: Pick<Session, 'id' | 'date' | 'finishedAt' | 'status'>;
  sets: Pick<SetLog, 'weight' | 'reps' | 'done'>[];
}

/** Every planned set finished at (or above) the working weight and target. */
export function isClean(de: Pick<DayExercise, 'sets' | 'target' | 'weight'>, sets: SessionSets['sets']): boolean {
  if (sets.length < de.sets) return false;
  return sets.every((s) => s.done && s.weight >= de.weight && s.reps >= de.target);
}

/** Clean sessions in a row (most recent backwards) since the anchor. */
export function cleanStreak(de: DayExercise, history: SessionSets[]): number {
  const relevant = history
    .filter((h) => h.session.status === 'done')
    .filter((h) => !de.anchor || (h.session.finishedAt ?? h.session.date) > de.anchor)
    .sort((a, b) => (a.session.finishedAt ?? a.session.date).localeCompare(b.session.finishedAt ?? b.session.date));
  let n = 0;
  for (let i = relevant.length - 1; i >= 0; i--) {
    if (isClean(de, relevant[i].sets)) n++;
    else break;
  }
  return n;
}

export interface Suggestion {
  from: number;
  to: number;
  reason: 'streak' | 'flag';
  clean: number;
}

export function suggestIncrease(
  de: DayExercise,
  increment: number,
  history: SessionSets[],
  threshold: number,
): Suggestion | null {
  if (de.retired || de.weight <= 0 || increment <= 0) return null;
  const clean = cleanStreak(de, history);
  if (de.flagUp) return { from: de.weight, to: de.weight + increment, reason: 'flag', clean };
  if (clean >= threshold) return { from: de.weight, to: de.weight + increment, reason: 'streak', clean };
  return null;
}

/** Epley estimated one-rep max. */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}
