import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { startSession } from '../db/actions';
import { useDayLabels, useSettings, useStreakInput } from '../db/hooks';
import { currentStreak, longestStreak, weekAdherence } from '../logic/streak';
import { addDays, formatDate } from '../logic/dates';
import { targetLabel } from '../components/ExerciseCard';
import { DayPicker } from './Programs';

export function Today({ activeSessionId, openSession }: { activeSessionId: number | null; openSession: (id: number) => void }) {
  const input = useStreakInput();
  const labels = useDayLabels();
  const settings = useSettings();
  const [otherDay, setOtherDay] = useState<number | null>(null);

  const plan = input?.planFor(input.today);
  const plannedDayId = plan?.kind === 'workout' ? plan.dayId : null;
  const preview = useLiveQuery(async () => {
    if (!plannedDayId) return [];
    const des = (await db.dayExercises.where('dayId').equals(plannedDayId).toArray()).filter((d) => !d.retired).sort((a, b) => a.order - b.order);
    const exs = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    return des.map((de) => ({ de, ex: exs.get(de.exerciseId)! }));
  }, [plannedDayId]);
  const todaysSessions = useLiveQuery(() => (input ? db.sessions.where('date').equals(input.today).toArray() : []), [input?.today]);

  if (!input || !labels || !settings) return null;

  const streak = currentStreak(input);
  const best = longestStreak(input);
  const week = weekAdherence(input.today, input);
  const doneToday = todaysSessions?.find((s) => s.status === 'done');

  const start = async (dayId: number) => openSession(await startSession(dayId, input.today));
  const label = (dayId: number) => {
    const l = labels.get(dayId);
    return l ? `${l.day.name} · ${l.program.name}` : 'Unknown day';
  };

  return (
    <div>
      <div className="muted small" style={{ marginTop: 8 }}>{formatDate(input.today, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      <h1>Today</h1>

      <div className="stats">
        <div className="stat hero"><div className="num">{streak}</div><div className="lbl">day streak</div></div>
        <div className="stat"><div className="num">{best}</div><div className="lbl">best streak</div></div>
        <div className="stat"><div className="num">{week.done}/{week.planned}</div><div className="lbl">this week</div></div>
      </div>

      {activeSessionId != null && (
        <div className="card" style={{ marginTop: 14, borderColor: 'var(--accent)' }}>
          <div className="row between">
            <div><strong>Workout in progress</strong><div className="muted small">Pick up where you left off</div></div>
            <button className="btn primary" onClick={() => openSession(activeSessionId)}>Resume</button>
          </div>
        </div>
      )}

      <h2>Plan</h2>
      {doneToday && (
        <div className="card">
          <div className="row between">
            <div><span className="pill good">Done</span> <strong>{label(doneToday.dayId)}</strong></div>
            <button className="btn small" onClick={() => openSession(doneToday.id)}>View</button>
          </div>
        </div>
      )}
      {!doneToday && plan?.kind === 'workout' && (
        <div className="card">
          <div className="row between">
            <div className="grow">
              <h3>{labels.get(plan.dayId)?.day.name}</h3>
              <div className="muted small">{labels.get(plan.dayId)?.program.name}</div>
            </div>
            {activeSessionId == null && <button className="btn primary" onClick={() => start(plan.dayId)}>Start</button>}
          </div>
          <ul className="list" style={{ marginTop: 8 }}>
            {preview?.map(({ de, ex }) => (
              <li key={de.id} className="row between small">
                <span><span className="muted">{de.group}</span>&nbsp; {ex.name}</span>
                <span className="muted">{targetLabel(ex, de, settings.units)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!doneToday && plan?.kind === 'rest' && (
        <div className="card"><span className="pill rest">Rest day</span> <span className="muted">Recover. Your streak keeps going.</span></div>
      )}
      {!doneToday && !plan && (
        <div className="card muted">Nothing planned today. Set up your week under Programs → Schedule, or start any workout below.</div>
      )}

      {activeSessionId == null && (
        <div className="card">
          <div className="small muted" style={{ marginBottom: 6 }}>Do a different workout</div>
          <div className="row">
            <div className="grow"><DayPicker value={otherDay} onChange={setOtherDay} /></div>
            <button className="btn" disabled={!otherDay} onClick={() => otherDay && start(otherDay)}>Start</button>
          </div>
        </div>
      )}

      <h2>Coming up</h2>
      <div className="card">
        <ul className="list">
          {Array.from({ length: 6 }, (_, i) => addDays(input.today, i + 1)).map((d) => {
            const p = input.planFor(d);
            return (
              <li key={d} className="row between">
                <span>{formatDate(d)}</span>
                {p?.kind === 'workout' ? <span className="small">{label(p.dayId)}</span>
                  : p?.kind === 'rest' ? <span className="pill rest">Rest</span>
                  : <span className="muted small">—</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
