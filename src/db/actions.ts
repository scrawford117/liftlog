import { db, getKV, setKV, DEFAULT_SETTINGS, type DayExercise, type PlanEntry, type Settings, type WeeklySchedule } from './schema';
import { prefillSets } from '../logic/prefill';
import type { SessionSets } from '../logic/progression';

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await getKV<Partial<Settings>>('settings', {})) };
}

export async function updateSettings(patch: Partial<Settings>) {
  await setKV('settings', { ...(await getSettings()), ...patch });
}

export async function getSchedule(): Promise<WeeklySchedule> {
  return getKV<WeeklySchedule>('schedule', [null, null, null, null, null, null, null]);
}

export async function setScheduleDay(weekday: number, plan: PlanEntry | null) {
  const s = [...(await getSchedule())];
  s[weekday] = plan;
  await setKV('schedule', s);
}

/** `undefined` clears the override so the weekly plan applies again. */
export async function setOverride(date: string, plan: PlanEntry | null | undefined) {
  if (plan === undefined) await db.overrides.delete(date);
  else await db.overrides.put({ date, plan });
}

export async function startSession(dayId: number, date: string): Promise<number> {
  return db.transaction('rw', [db.sessions, db.sets, db.dayExercises, db.exercises, db.kv], async () => {
    const sessionId = (await db.sessions.add({ date, dayId, status: 'in_progress', startedAt: new Date().toISOString() } as never)) as number;
    const des = await db.dayExercises.where('dayId').equals(dayId).toArray();
    const exs = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    await db.sets.bulkAdd(prefillSets(sessionId, des, exs) as never[]);
    await setKV('activeSession', sessionId);
    return sessionId;
  });
}

export async function finishSession(id: number, notes?: string) {
  await db.sessions.update(id, { status: 'done', finishedAt: new Date().toISOString(), notes });
  await setKV('activeSession', null);
}

export async function deleteSession(id: number) {
  await db.transaction('rw', [db.sessions, db.sets, db.kv], async () => {
    await db.sets.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
    if ((await getKV('activeSession', null)) === id) await setKV('activeSession', null);
  });
}

/** Finished sessions that include this day-exercise, with its sets. */
export async function historyFor(dayExerciseId: number, excludeSessionId?: number): Promise<SessionSets[]> {
  const sets = await db.sets.where('dayExerciseId').equals(dayExerciseId).toArray();
  const bySession = new Map<number, typeof sets>();
  for (const s of sets) {
    if (s.sessionId === excludeSessionId) continue;
    bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]);
  }
  const sessions = await db.sessions.bulkGet([...bySession.keys()]);
  return sessions
    .filter((s): s is NonNullable<typeof s> => !!s && s.status === 'done')
    .map((session) => ({ session, sets: bySession.get(session.id)!.sort((a, b) => a.idx - b.idx) }))
    .sort((a, b) => (a.session.finishedAt ?? a.session.date).localeCompare(b.session.finishedAt ?? b.session.date));
}

export async function acceptIncrease(de: DayExercise, to: number, activeSessionId?: number) {
  await db.transaction('rw', [db.dayExercises, db.sets], async () => {
    await db.dayExercises.update(de.id, { weight: to, flagUp: false, anchor: new Date().toISOString() });
    if (activeSessionId) {
      await db.sets
        .where('sessionId').equals(activeSessionId)
        .filter((s) => s.dayExerciseId === de.id && !s.done && s.weight === de.weight)
        .modify({ weight: to });
    }
  });
}

export async function skipIncrease(de: DayExercise) {
  await db.dayExercises.update(de.id, { flagUp: false, anchor: new Date().toISOString() });
}

/** Logs an off-program session as finished in one step. */
export async function logQuickSession(dayId: number, date: string, durationMin?: number, notes?: string): Promise<number> {
  const now = new Date().toISOString();
  return (await db.sessions.add({ date, dayId, status: 'done', startedAt: now, finishedAt: now, durationMin, notes } as never)) as number;
}
