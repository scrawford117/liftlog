import { useLiveQuery } from 'dexie-react-hooks';
import { db, getKV, type PlanEntry, type Settings, type WeeklySchedule } from './schema';
import { getSchedule, getSettings } from './actions';
import { planForDate, type StreakInput } from '../logic/streak';
import { today, weekday } from '../logic/dates';

export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings, []);
}

export function useSchedule(): WeeklySchedule | undefined {
  return useLiveQuery(getSchedule, []);
}

export function useActiveSessionId(): number | null | undefined {
  return useLiveQuery(() => getKV<number | null>('activeSession', null), []);
}

/** Everything needed to compute streaks and the plan for any date. */
export function useStreakInput(): StreakInput | undefined {
  return useLiveQuery(async () => {
    const [settings, weekly, overrides, done] = await Promise.all([
      getSettings(),
      getSchedule(),
      db.overrides.toArray(),
      db.sessions.where('status').equals('done').toArray(),
    ]);
    const ov = new Map<string, PlanEntry | null>(overrides.map((o) => [o.date, o.plan]));
    return {
      today: today(),
      start: settings.streakStart,
      doneDates: new Set(done.map((s) => s.date)),
      planFor: (d: string) => planForDate(d, weekly, ov, weekday),
    } satisfies StreakInput;
  }, []);
}

/** Map of dayId -> { day, program } for labels. */
export function useDayLabels() {
  return useLiveQuery(async () => {
    const [days, programs] = await Promise.all([db.days.toArray(), db.programs.toArray()]);
    const pm = new Map(programs.map((p) => [p.id, p]));
    return new Map(days.map((d) => [d.id, { day: d, program: pm.get(d.programId)! }]));
  }, []);
}
