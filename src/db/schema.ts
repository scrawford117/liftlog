import Dexie, { type EntityTable } from 'dexie';
import { addCardioTemplates } from './cardioSeed';

export type ExerciseKind = 'weighted' | 'bodyweight' | 'timed' | 'circuit' | 'cardio';

export interface Exercise {
  id: number;
  name: string;
  kind: ExerciseKind;
  /** Weight added when a progression suggestion is accepted. */
  increment: number;
  /** For circuits: the movements done each round. */
  items?: string[];
}

export interface Program {
  id: number;
  name: string;
  restSec: number;
  archived: boolean;
  notes?: string;
}

export interface ProgramDay {
  id: number;
  programId: number;
  name: string;
  order: number;
}

export interface DayExercise {
  id: number;
  dayId: number;
  exerciseId: number;
  order: number;
  /** Superset label such as "A", "B1", "B2". */
  group: string;
  sets: number;
  /** Target reps, or seconds for timed exercises, or rounds' worth for circuits. */
  target: number;
  /** Current working weight; 0 for bodyweight. */
  weight: number;
  notes?: string;
  retired: boolean;
  /** Manually flagged "up weight next time". */
  flagUp: boolean;
  /** Clean sessions are counted only after this ISO timestamp (reset on accept/skip). */
  anchor?: string;
  /** Cardio plan: distance (mi or km, per settings). */
  distance?: number;
  /** Cardio plan: total minutes. */
  durationMin?: number;
  /** Cardio plan: repeated work/rest intervals, e.g. sprints. */
  intervals?: Intervals;
}

export interface Intervals {
  rounds: number;
  workSec: number;
  restSec: number;
}

export type SessionStatus = 'in_progress' | 'done';

export interface Session {
  id: number;
  /** Local date, YYYY-MM-DD. */
  date: string;
  dayId: number;
  status: SessionStatus;
  notes?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface SetLog {
  id: number;
  sessionId: number;
  dayExerciseId: number;
  exerciseId: number;
  idx: number;
  weight: number;
  /** Reps, seconds for timed work, or intervals completed for cardio. */
  reps: number;
  done: boolean;
  /** Cardio: distance covered. */
  distance?: number;
  /** Cardio: total time in seconds. */
  durationSec?: number;
}

export type PlanEntry = { kind: 'rest' } | { kind: 'workout'; dayId: number };

export interface Override {
  date: string;
  plan: PlanEntry | null;
}

export interface KV {
  key: string;
  value: unknown;
}

export class LiftDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  programs!: EntityTable<Program, 'id'>;
  days!: EntityTable<ProgramDay, 'id'>;
  dayExercises!: EntityTable<DayExercise, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  sets!: EntityTable<SetLog, 'id'>;
  overrides!: EntityTable<Override, 'date'>;
  kv!: EntityTable<KV, 'key'>;

  constructor(name = 'liftlog') {
    super(name);
    this.version(1).stores({
      exercises: '++id, name',
      programs: '++id',
      days: '++id, programId',
      dayExercises: '++id, dayId, exerciseId',
      sessions: '++id, date, dayId, status',
      sets: '++id, sessionId, dayExerciseId, exerciseId',
      overrides: 'date',
      kv: 'key',
    });
    // v2: cardio. Existing installs get the cardio exercises and a starter Cardio program.
    this.version(2).upgrade(async (tx) => {
      await addCardioTemplates({
        exercises: tx.table('exercises'),
        programs: tx.table('programs'),
        days: tx.table('days'),
        dayExercises: tx.table('dayExercises'),
      });
    });
  }
}

export const db = new LiftDB();

export interface Settings {
  units: 'lb' | 'kg';
  /** Clean sessions in a row before suggesting a weight increase. */
  threshold: number;
  /** ISO date the streak may start counting from. */
  streakStart: string;
  /** Play a chime when the rest timer ends. */
  restSound: boolean;
  /** Keep the screen on during a workout so the timer can alert. */
  keepAwake: boolean;
}

export const DEFAULT_SETTINGS: Settings = { units: 'lb', threshold: 3, streakStart: '', restSound: true, keepAwake: true };

/** Weekly plan indexed by JS weekday (0 = Sunday). */
export type WeeklySchedule = (PlanEntry | null)[];

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}

export function setKV(key: string, value: unknown) {
  return db.kv.put({ key, value });
}
