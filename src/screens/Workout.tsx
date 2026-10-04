import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DayExercise, type Exercise, type SetLog } from '../db/schema';
import { deleteSession, finishSession, getSettings, historyFor } from '../db/actions';
import { useSettings } from '../db/hooks';
import { suggestIncrease, type SessionSets, type Suggestion } from '../logic/progression';
import { formatDate } from '../logic/dates';
import { ExerciseCard } from '../components/ExerciseCard';
import { CardioCard } from '../components/CardioCard';
import { distanceUnit } from '../logic/cardio';
import { useRestTimer } from '../components/RestTimer';
import { keepScreenAwake } from '../components/alerts';

interface Group { label: string; items: DayExercise[] }

function groupExercises(des: DayExercise[]): Group[] {
  const groups: Group[] = [];
  for (const de of des) {
    const letter = de.group.replace(/\d+$/, '') || de.group;
    const g = groups[groups.length - 1];
    if (g && g.label === letter) g.items.push(de);
    else groups.push({ label: letter, items: [de] });
  }
  return groups;
}

export function Workout({ sessionId, onClose }: { sessionId: number; onClose: () => void }) {
  const settings = useSettings();
  const timer = useRestTimer();
  const data = useLiveQuery(async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) return null;
    const day = await db.days.get(session.dayId);
    const program = day ? await db.programs.get(day.programId) : undefined;
    const des = (await db.dayExercises.where('dayId').equals(session.dayId).toArray()).sort((a, b) => a.order - b.order);
    const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
    const exs = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    return { session, day, program, des, sets, exs };
  }, [sessionId]);

  // Suggestions and "last time" are snapshotted when the workout opens, so flagging
  // "up weight next time" mid-session doesn't immediately prompt.
  const [snap, setSnap] = useState<{ sugg: Map<number, Suggestion>; last: Map<number, SessionSets> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await db.sessions.get(sessionId);
      if (!session) return;
      const s = await getSettings();
      const des = await db.dayExercises.where('dayId').equals(session.dayId).toArray();
      const exs = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
      const sugg = new Map<number, Suggestion>();
      const last = new Map<number, SessionSets>();
      for (const de of des) {
        const h = await historyFor(de.id, sessionId);
        if (h.length) last.set(de.id, h[h.length - 1]);
        const sg = suggestIncrease(de, exs.get(de.exerciseId)?.increment ?? 0, h, s.threshold);
        if (sg && session.status === 'in_progress') sugg.set(de.id, sg);
      }
      if (!cancelled) setSnap({ sugg, last });
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const inProgress = data?.session.status === 'in_progress';
  const keepAwake = settings?.keepAwake ?? true;
  useEffect(() => (inProgress && keepAwake ? keepScreenAwake() : undefined), [inProgress, keepAwake]);

  if (data === undefined || !settings) return null;
  if (data === null) {
    return (
      <div className="empty">
        Workout not found. <button className="btn" onClick={onClose}>Back</button>
      </div>
    );
  }

  const { session, day, program, des, sets, exs } = data;
  const setsBy = new Map<number, SetLog[]>();
  for (const s of sets.sort((a, b) => a.idx - b.idx)) setsBy.set(s.dayExerciseId, [...(setsBy.get(s.dayExerciseId) ?? []), s]);
  const active = des.filter((de) => setsBy.has(de.id));
  const doneCount = sets.filter((s) => s.done).length;
  const editing = session.status === 'done';

  const liveSugg = (de: DayExercise) => {
    const s = snap?.sugg.get(de.id);
    // Hide once accepted or skipped (weight changed or anchor moved).
    if (!s || de.weight !== s.from || (de.anchor && de.anchor > session.startedAt)) return null;
    return s;
  };

  const finish = async () => {
    const notes = (document.getElementById('session-notes') as HTMLTextAreaElement | null)?.value;
    if (sets.length > 0 && doneCount === 0) {
      if (!confirm('None of the sets are checked off. Mark them all done and finish?')) return;
      await db.sets.where('sessionId').equals(session.id).modify({ done: true });
    }
    timer.stop();
    await finishSession(session.id, notes);
    onClose();
  };

  const discard = async () => {
    if (!confirm(editing ? 'Delete this logged workout?' : 'Discard this workout? Logged sets will be lost.')) return;
    timer.stop();
    await deleteSession(session.id);
    onClose();
  };

  if (program?.offProgram) {
    return (
      <div>
        <button className="btn small ghost" onClick={onClose} aria-label="Back" style={{ marginTop: 4 }}>← Back</button>
        <h1 style={{ marginBottom: 2 }}>{day?.name ?? 'Quick session'}</h1>
        <div className="row wrap muted small">
          <span>Off Program</span>·
          <input
            type="date"
            aria-label="Workout date"
            value={session.date}
            onChange={(e) => e.target.value && db.sessions.update(session.id, { date: e.target.value })}
            style={{ width: 'auto', minHeight: 32, padding: '4px 8px' }}
          />
        </div>
        <div className="card stack" style={{ marginTop: 14 }}>
          <label className="field"><span>Minutes</span>
            <input type="number" inputMode="numeric" defaultValue={session.durationMin ?? ''}
              onBlur={(e) => db.sessions.update(session.id, { durationMin: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </label>
          <label className="field"><span>Notes</span>
            <textarea defaultValue={session.notes ?? ''} onBlur={(e) => db.sessions.update(session.id, { notes: e.target.value })} />
          </label>
          <div className="muted small">Changes save automatically.</div>
        </div>
        <button className="btn ghost danger block" style={{ marginTop: 16 }} onClick={discard}>Delete</button>
      </div>
    );
  }

  return (
    <div>
      <div className="row between" style={{ marginTop: 4 }}>
        <button className="btn small ghost" onClick={onClose} aria-label="Back">← Back</button>
        <span className="pill accent">{doneCount}/{sets.length} done</span>
      </div>
      <h1 style={{ marginBottom: 2 }}>{day?.name ?? 'Workout'}</h1>
      <div className="row wrap muted small">
        <span>{program?.name}</span>·
        <input
          type="date"
          aria-label="Workout date"
          value={session.date}
          onChange={(e) => e.target.value && db.sessions.update(session.id, { date: e.target.value })}
          style={{ width: 'auto', minHeight: 32, padding: '4px 8px' }}
        />
        {program?.restSec ? <span>· {program.restSec}s rest</span> : null}
      </div>

      {groupExercises(active).map((g) => (
        <div key={g.label + g.items[0].id} className={`group${g.items.length > 1 ? '' : ' solo'}`}>
          {g.items.length > 1 && <div className="group-label">SUPERSET {g.label}</div>}
          {g.items.map((de) => {
            const ex = exs.get(de.exerciseId) as Exercise;
            if (ex.kind === 'cardio') {
              return (
                <CardioCard
                  key={de.id}
                  de={de}
                  ex={ex}
                  set={setsBy.get(de.id)?.[0]}
                  distUnit={distanceUnit(settings.units)}
                  sound={settings.restSound}
                  last={snap?.last.get(de.id)}
                />
              );
            }
            return (
              <ExerciseCard
                key={de.id}
                de={de}
                ex={ex}
                sets={setsBy.get(de.id) ?? []}
                units={settings.units}
                restSec={program?.restSec ?? 90}
                sessionId={session.id}
                suggestion={liveSugg(de)}
                last={snap?.last.get(de.id)}
              />
            );
          })}
        </div>
      ))}

      <h2>Notes</h2>
      <textarea id="session-notes" defaultValue={session.notes ?? ''} placeholder="How did it feel?" onBlur={(e) => db.sessions.update(session.id, { notes: e.target.value })} />

      <div className="stack" style={{ marginTop: 16 }}>
        {!editing && <button className="btn primary block" onClick={finish}>Finish workout</button>}
        {editing && <div className="muted small">Finished {session.finishedAt ? formatDate(session.date) : ''}. Changes save automatically.</div>}
        <button className="btn ghost danger block" onClick={discard}>{editing ? 'Delete workout' : 'Discard workout'}</button>
      </div>
    </div>
  );
}
