import { db, DEFAULT_SETTINGS, setKV, type ExerciseKind, type WeeklySchedule } from './schema';
import { today } from '../logic/dates';
import { addCardioTemplates } from './cardioSeed';

/**
 * Hand-transcribed from the Workout Notes files. Working weights come from the latest
 * logged row in each note. Exercises listed together without a blank line in the notes
 * are grouped as supersets (B1/B2…).
 */

type Lib = Record<string, { kind: ExerciseKind; inc: number; items?: string[] }>;

const KB_ITEMS = [
  'Horizontal swings x10',
  'Around the worlds x20 (change direction every 5)',
  'Elbow uppercuts x10',
  'Kneeling wood cuts x6 / side',
];

const LIB: Lib = {
  'Bench Press': { kind: 'weighted', inc: 10 },
  'Incline Bench Press': { kind: 'weighted', inc: 10 },
  'Flat DB Press': { kind: 'weighted', inc: 5 },
  'Skull Crushers': { kind: 'weighted', inc: 10 },
  'DB Flies': { kind: 'weighted', inc: 5 },
  'Overhead Press': { kind: 'weighted', inc: 10 },
  'DB Shoulder Press': { kind: 'weighted', inc: 5 },
  'Overhead DB Tricep Extension': { kind: 'weighted', inc: 10 },
  'Side Raises': { kind: 'weighted', inc: 5 },
  'Rear Delt Raises': { kind: 'weighted', inc: 5 },
  'Shrugs': { kind: 'weighted', inc: 10 },
  'Barbell Row': { kind: 'weighted', inc: 10 },
  'T-Bar Row': { kind: 'weighted', inc: 10 },
  'Single-Arm DB Row': { kind: 'weighted', inc: 5 },
  'DB Curls': { kind: 'weighted', inc: 5 },
  'Hammer Curls': { kind: 'weighted', inc: 5 },
  'Barbell Curls': { kind: 'weighted', inc: 10 },
  'Suitcase Carry': { kind: 'timed', inc: 10 },
  'Farmer Carry': { kind: 'timed', inc: 10 },
  'Dips': { kind: 'bodyweight', inc: 0 },
  'Pull Ups': { kind: 'bodyweight', inc: 0 },
  'Back Squat': { kind: 'weighted', inc: 10 },
  'Front Squat': { kind: 'weighted', inc: 10 },
  'Goblet Squat': { kind: 'weighted', inc: 5 },
  'Split Squat': { kind: 'weighted', inc: 20 },
  'Bulgarian Split Squat': { kind: 'weighted', inc: 10 },
  'Reverse Lunges': { kind: 'weighted', inc: 5 },
  'Calf Raises': { kind: 'weighted', inc: 20 },
  'Deadlift': { kind: 'weighted', inc: 10 },
  'Barbell RDL': { kind: 'weighted', inc: 10 },
  'Single-Leg DB RDL': { kind: 'weighted', inc: 5 },
  'Good Mornings': { kind: 'weighted', inc: 10 },
  'Hip Thrust': { kind: 'weighted', inc: 10 },
  'Single-Leg Hip Thrust': { kind: 'weighted', inc: 5 },
  'Glute Bridge March': { kind: 'bodyweight', inc: 0 },
  'Bodyweight Calf Raises': { kind: 'bodyweight', inc: 0 },
  'KB Swings': { kind: 'weighted', inc: 5 },
  'KB Circuit': { kind: 'circuit', inc: 5, items: KB_ITEMS },
  'Plank': { kind: 'timed', inc: 0 },
  'Side Plank': { kind: 'timed', inc: 0 },
};

/** [group, exercise, sets, target reps/seconds/rounds, weight, extras] */
type Row = [string, keyof typeof LIB, number, number, number, { notes?: string; retired?: boolean; flagUp?: boolean }?];
interface SeedProgram { name: string; restSec: number; archived: boolean; notes?: string; days: [string, Row[]][] }

const KB = (group: string, w: number): Row => [group, 'KB Circuit', 4, 1, w, { notes: '4 rounds' }];

const PROGRAMS: SeedProgram[] = [
  {
    name: 'Upper | Heavy', restSec: 120, archived: false,
    days: [
      ['Upper 1', [
        ['A', 'Bench Press', 4, 6, 245],
        ['B1', 'Skull Crushers', 4, 6, 135],
        ['B2', 'DB Flies', 4, 10, 40],
        ['C1', 'Overhead Press', 4, 6, 135],
        ['C2', 'Overhead DB Tricep Extension', 4, 10, 80],
        ['D', 'Suitcase Carry', 4, 60, 110, { notes: 'per side' }],
      ]],
      ['Upper 2', [
        ['A', 'Shrugs', 4, 6, 315, { flagUp: true }],
        ['B1', 'Barbell Row', 4, 6, 205],
        ['B2', 'Hammer Curls', 4, 8, 60],
        ['C1', 'Barbell Curls', 4, 8, 105, { flagUp: true }],
        ['C2', 'Single-Arm DB Row', 4, 8, 70],
        ['D', 'Suitcase Carry', 4, 60, 110, { notes: 'per side' }],
      ]],
      ['Upper 3', [
        ['A', 'Incline Bench Press', 4, 6, 225],
        ['B1', 'T-Bar Row', 4, 6, 225],
        ['B2', 'DB Curls', 4, 8, 40],
        ['C1', 'Side Raises', 4, 10, 30],
        ['C2', 'Rear Delt Raises', 4, 10, 25],
        ['D', 'Suitcase Carry', 4, 60, 110, { notes: 'per side' }],
      ]],
    ],
  },
  {
    name: 'Lower | Heavy', restSec: 120, archived: false,
    days: [
      ['Lower 1', [
        ['A', 'Back Squat', 4, 6, 365],
        ['B1', 'Split Squat', 4, 8, 255],
        ['B2', 'Calf Raises', 4, 10, 255],
        KB('C', 40),
      ]],
      ['Lower 2', [
        ['A', 'Front Squat', 4, 6, 225],
        ['B1', 'Bulgarian Split Squat', 4, 8, 80, { notes: 'One DB', flagUp: true }],
        ['B2', 'Calf Raises', 4, 10, 275, { flagUp: true }],
        KB('C', 40),
      ]],
      ['Lower 3', [
        ['A', 'Deadlift', 4, 6, 315],
        ['B1', 'Good Mornings', 4, 10, 95],
        ['B2', 'Single-Leg DB RDL', 4, 8, 60],
        KB('C', 40),
      ]],
    ],
  },
  {
    name: 'Upper | Burnout', restSec: 60, archived: false,
    days: [
      ['Upper 1', [
        ['A', 'Bench Press', 4, 8, 225],
        ['B1', 'Skull Crushers', 4, 12, 115],
        ['B2', 'Side Raises', 4, 12, 30],
        ['B3', 'Rear Delt Raises', 4, 12, 25],
        ['C1', 'Barbell Row', 4, 10, 155],
        ['C2', 'DB Curls', 4, 12, 30],
        ['D', 'Suitcase Carry', 4, 60, 110, { notes: 'Single arm carry' }],
        ['E', 'Farmer Carry', 4, 60, 90, { retired: true }],
      ]],
      ['Upper 2', [
        ['A', 'Incline Bench Press', 4, 8, 205],
        ['B1', 'T-Bar Row', 4, 10, 205, { flagUp: true }],
        ['B2', 'Overhead DB Tricep Extension', 4, 12, 80],
        ['C1', 'Overhead Press', 4, 10, 115, { flagUp: true }],
        ['C2', 'Hammer Curls', 4, 12, 40, { flagUp: true }],
        ['D', 'Suitcase Carry', 4, 60, 110, { notes: 'Single arm carry' }],
      ]],
    ],
  },
  {
    name: 'Lower | Burnout', restSec: 60, archived: false,
    days: [
      ['Lower 1', [
        ['A', 'Back Squat', 4, 8, 315],
        ['B1', 'Split Squat', 4, 10, 245],
        ['B2', 'Calf Raises', 4, 12, 245],
        ['C', 'Barbell RDL', 4, 12, 135],
        KB('D', 30),
        ['E', 'Side Plank', 4, 30, 0, { retired: true }],
      ]],
      ['Lower 2', [
        ['A', 'Deadlift', 4, 6, 225, { notes: 'Was 315 for 8 weeks; last note row was 225' }],
        ['B1', 'Front Squat', 4, 10, 155],
        ['B2', 'Bulgarian Split Squat', 4, 12, 60, { notes: 'One DB' }],
        ['C', 'Good Mornings', 4, 12, 65],
        KB('D', 30),
        ['E', 'Plank', 4, 60, 0, { retired: true }],
      ]],
    ],
  },
  {
    name: 'Sam | Nothing But Gainz', restSec: 90, archived: true, notes: "Sam's program",
    days: [
      ['Lower 1', [
        ['A', 'Hip Thrust', 4, 6, 225],
        ['B1', 'Barbell RDL', 4, 8, 85],
        ['B2', 'Reverse Lunges', 4, 8, 40],
        ['C', 'Plank', 4, 60, 0],
      ]],
      ['Lower 2', [
        ['A', 'Back Squat', 4, 6, 175],
        ['B1', 'Split Squat', 4, 8, 135, { notes: 'Barbell' }],
        ['B2', 'Bodyweight Calf Raises', 4, 15, 0],
        ['C', 'Side Plank', 4, 30, 0],
      ]],
      ['Upper 1', [
        ['A', 'Incline Bench Press', 4, 6, 75],
        ['B1', 'Skull Crushers', 4, 8, 45],
        ['B2', 'DB Flies', 4, 8, 25],
        ['C1', 'Dips', 4, 10, 0],
        ['C2', 'Side Raises', 4, 10, 8],
      ]],
      ['Upper 2', [
        ['A', 'Barbell Row', 4, 6, 85],
        ['B1', 'Overhead Press', 4, 6, 50],
        ['B2', 'Rear Delt Raises', 4, 10, 10],
        ['C1', 'Single-Arm DB Row', 4, 8, 35],
        ['C2', 'DB Curls', 4, 8, 20],
        ['D', 'Pull Ups', 4, 10, 0],
      ]],
    ],
  },
  {
    name: 'Sam | Swoll Patrol', restSec: 90, archived: true, notes: "Sam's program",
    days: [
      ['Lower 1', [
        ['A1', 'Hip Thrust', 4, 6, 225],
        ['A2', 'Bulgarian Split Squat', 4, 8, 40, { notes: 'Kettlebell' }],
        ['B1', 'Goblet Squat', 4, 12, 40],
        ['B2', 'Single-Leg DB RDL', 4, 8, 75],
        ['C1', 'Glute Bridge March', 4, 10, 0],
        ['C2', 'Plank', 4, 60, 0],
      ]],
      ['Lower 2', [
        ['A1', 'Back Squat', 4, 6, 155],
        ['A2', 'Bodyweight Calf Raises', 4, 15, 0],
        ['B1', 'Reverse Lunges', 4, 10, 25],
        ['B2', 'Single-Leg Hip Thrust', 4, 8, 25],
        ['C1', 'KB Swings', 4, 15, 20],
        ['C2', 'Side Plank', 4, 30, 0],
      ]],
      ['Upper 1', [
        ['A1', 'Incline Bench Press', 4, 6, 70],
        ['A2', 'Single-Arm DB Row', 4, 8, 40],
        ['B1', 'DB Curls', 4, 8, 20],
        ['B2', 'DB Shoulder Press', 4, 8, 20],
        ['C1', 'Dips', 4, 10, 0],
        ['C2', 'Pull Ups', 4, 10, 0],
        ['C3', 'Suitcase Carry', 4, 60, 40],
      ]],
      ['Upper 2', [
        ['A1', 'Barbell Row', 4, 6, 85],
        ['A2', 'Flat DB Press', 4, 8, 25],
        ['B1', 'Skull Crushers', 4, 8, 45],
        ['B2', 'Hammer Curls', 4, 8, 25],
        ['C1', 'DB Flies', 4, 10, 20],
        ['C2', 'Rear Delt Raises', 4, 10, 20],
        ['D1', 'Suitcase Carry', 4, 60, 0],
      ]],
    ],
  },
];

let seeding: Promise<void> | null = null;

export function seedIfEmpty() {
  seeding ??= db.programs.count().then((n) => (n > 0 ? undefined : seed()));
  return seeding;
}

export async function seed() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));

    const exIds = new Map<string, number>();
    for (const [name, def] of Object.entries(LIB)) {
      const id = await db.exercises.add({ name, kind: def.kind, increment: def.inc, items: def.items } as never);
      exIds.set(name, id as number);
    }

    const dayIds = new Map<string, number>();
    for (const p of PROGRAMS) {
      const programId = (await db.programs.add({ name: p.name, restSec: p.restSec, archived: p.archived, notes: p.notes } as never)) as number;
      for (const [dayOrder, [dayName, rows]] of p.days.entries()) {
        const dayId = (await db.days.add({ programId, name: dayName, order: dayOrder } as never)) as number;
        dayIds.set(`${p.name}/${dayName}`, dayId);
        for (const [order, [group, exName, sets, target, weight, extra]] of rows.entries()) {
          await db.dayExercises.add({
            dayId,
            exerciseId: exIds.get(exName)!,
            order,
            group,
            sets,
            target,
            weight,
            notes: extra?.notes,
            retired: extra?.retired ?? false,
            flagUp: extra?.flagUp ?? false,
          } as never);
        }
      }
    }

    await addCardioTemplates(db);

    // Default: the Heavy split, Upper/Lower alternating Mon–Sat, Sunday rest.
    const w = (k: string) => ({ kind: 'workout' as const, dayId: dayIds.get(k)! });
    const weekly: WeeklySchedule = [
      { kind: 'rest' },
      w('Upper | Heavy/Upper 1'),
      w('Lower | Heavy/Lower 1'),
      w('Upper | Heavy/Upper 2'),
      w('Lower | Heavy/Lower 2'),
      w('Upper | Heavy/Upper 3'),
      w('Lower | Heavy/Lower 3'),
    ];
    await setKV('schedule', weekly);
    await setKV('settings', { ...DEFAULT_SETTINGS, streakStart: today() });
  });
}
