import type { DayExercise, Exercise, SetLog } from '../db/schema';

/** Builds the sets for a new session from each exercise's working weight and target. */
export function prefillSets(
  sessionId: number,
  dayExercises: DayExercise[],
  exercises: Map<number, Exercise>,
): Omit<SetLog, 'id'>[] {
  const out: Omit<SetLog, 'id'>[] = [];
  for (const de of [...dayExercises].sort((a, b) => a.order - b.order)) {
    if (de.retired) continue;
    const ex = exercises.get(de.exerciseId);
    if (!ex) continue;
    if (ex.kind === 'cardio') {
      out.push({
        sessionId, dayExerciseId: de.id, exerciseId: de.exerciseId, idx: 0, weight: 0, reps: 0, done: false,
        distance: de.distance, durationSec: de.durationMin ? de.durationMin * 60 : undefined,
      });
      continue;
    }
    for (let i = 0; i < de.sets; i++) {
      out.push({
        sessionId,
        dayExerciseId: de.id,
        exerciseId: de.exerciseId,
        idx: i,
        weight: ex.kind === 'bodyweight' ? 0 : de.weight,
        reps: de.target,
        done: false,
      });
    }
  }
  return out;
}
