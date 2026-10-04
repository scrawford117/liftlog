import type { Table } from 'dexie';
import type { DayExercise, Exercise, Intervals } from './schema';

export const CARDIO_TYPES = [
  'Outdoor Run',
  'Treadmill Run',
  'Walk',
  'Hike',
  'Outdoor Bike',
  'Stationary Bike',
  'Rower',
  'Elliptical',
  'Stair Climber',
  'Swim',
];

interface Tables {
  exercises: Table;
  programs: Table;
  days: Table;
  dayExercises: Table;
}

type CardioRow = [type: string, plan: { distance?: number; durationMin?: number; intervals?: Intervals; notes?: string }];

const CARDIO_DAYS: [string, CardioRow[]][] = [
  ['Easy Run', [['Outdoor Run', { distance: 3, durationMin: 30 }]]],
  ['Sprints', [['Treadmill Run', { durationMin: 20, intervals: { rounds: 8, workSec: 30, restSec: 90 }, notes: '5 min warm-up first' }]]],
  ['Bike', [['Stationary Bike', { durationMin: 30 }]]],
];

/** Adds the cardio exercise library and a starter "Cardio" program, skipping anything already there. */
export async function addCardioTemplates(t: Tables) {
  const existing = (await t.exercises.toArray()) as Exercise[];
  const ids = new Map(existing.map((e) => [e.name, e.id]));
  for (const name of CARDIO_TYPES) {
    if (!ids.has(name)) ids.set(name, (await t.exercises.add({ name, kind: 'cardio', increment: 0 })) as number);
  }

  const programs = (await t.programs.toArray()) as { name: string }[];
  if (programs.some((p) => p.name === 'Cardio')) return;
  const programId = (await t.programs.add({ name: 'Cardio', restSec: 0, archived: false })) as number;
  for (const [order, [dayName, rows]] of CARDIO_DAYS.entries()) {
    const dayId = (await t.days.add({ programId, name: dayName, order })) as number;
    for (const [i, [type, plan]] of rows.entries()) {
      const de: Omit<DayExercise, 'id'> = {
        dayId, exerciseId: ids.get(type)!, order: i, group: String.fromCharCode(65 + i),
        sets: 1, target: 0, weight: 0, retired: false, flagUp: false, ...plan,
      };
      await t.dayExercises.add(de);
    }
  }
}
