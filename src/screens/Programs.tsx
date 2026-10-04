import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DayExercise, type Exercise, type ExerciseKind, type Program } from '../db/schema';
import { setScheduleDay } from '../db/actions';
import { useDayLabels, useSchedule, useSettings } from '../db/hooks';
import { targetLabel } from '../components/ExerciseCard';
import { Sheet } from '../components/Sheet';
import { distanceUnit } from '../logic/cardio';

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WD = [1, 2, 3, 4, 5, 6, 0];

/** Active programs first, then Off Program, then archived. */
const rank = (p: Program) => (p.archived ? 2 : p.offProgram ? 1 : 0);

/** Select any training day, grouped by program. */
export function DayPicker({ value, onChange, extra }: {
  value: number | string | null;
  onChange: (dayId: number | null, raw: string) => void;
  extra?: { value: string; label: string }[];
}) {
  const labels = useDayLabels();
  if (!labels) return null;
  const byProgram = new Map<number, { program: Program; days: { id: number; name: string }[] }>();
  const sorted = [...labels.values()].sort(
    (a, b) => rank(a.program) - rank(b.program) || a.program.id - b.program.id || a.day.order - b.day.order,
  );
  for (const { day, program } of sorted) {
    const g = byProgram.get(program.id) ?? { program, days: [] };
    g.days.push({ id: day.id, name: day.name });
    byProgram.set(program.id, g);
  }
  return (
    <select
      value={value ?? ''}
      aria-label="Workout day"
      onChange={(e) => onChange(/^\d+$/.test(e.target.value) ? Number(e.target.value) : null, e.target.value)}
    >
      {!extra && <option value="">Choose a workout…</option>}
      {extra?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      {[...byProgram.values()].map(({ program, days }) => (
        <optgroup key={program.id} label={program.name + (program.archived ? ' (archived)' : '')}>
          {days.map((d) => <option key={d.id} value={d.id}>{d.name} · {program.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function ScheduleEditor() {
  const schedule = useSchedule();
  if (!schedule) return null;
  return (
    <div className="card">
      <ul className="list">
        {WD.map((wd, i) => {
          const p = schedule[wd];
          return (
            <li key={wd} className="row">
              <span style={{ width: 92, flexShrink: 0 }}>{WEEK[i]}</span>
              <div className="grow">
                <DayPicker
                  value={p?.kind === 'workout' ? p.dayId : p?.kind === 'rest' ? 'rest' : 'none'}
                  extra={[{ value: 'rest', label: 'Rest day' }, { value: 'none', label: 'Nothing planned' }]}
                  onChange={(dayId, raw) =>
                    setScheduleDay(wd, dayId ? { kind: 'workout', dayId } : raw === 'rest' ? { kind: 'rest' } : null)
                  }
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Programs() {
  const programs = useLiveQuery(() => db.programs.toArray(), []);
  const [openId, setOpenId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  if (!programs) return null;
  if (openId != null) return <ProgramEditor id={openId} onBack={() => setOpenId(null)} />;

  const visible = programs.filter((p) => showArchived || !p.archived).sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  const addProgram = async () => {
    const id = (await db.programs.add({ name: 'New program', restSec: 90, archived: false } as never)) as number;
    await db.days.add({ programId: id, name: 'Day 1', order: 0 } as never);
    setOpenId(id);
  };

  return (
    <div>
      <h1>Programs</h1>
      <h2 style={{ marginTop: 0 }}>Weekly schedule</h2>
      <ScheduleEditor />

      <div className="row between" style={{ marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>Programs</h2>
        <button className="btn small" onClick={addProgram}>+ New</button>
      </div>
      <div style={{ marginTop: 10 }}>
        {visible.map((p) => <ProgramRow key={p.id} program={p} onOpen={() => setOpenId(p.id)} />)}
      </div>
      <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => setShowArchived(!showArchived)}>
        {showArchived ? 'Hide archived' : `Show archived (${programs.filter((p) => p.archived).length})`}
      </button>
    </div>
  );
}

function ProgramRow({ program, onOpen }: { program: Program; onOpen: () => void }) {
  const days = useLiveQuery(() => db.days.where('programId').equals(program.id).sortBy('order'), [program.id]);
  return (
    <div className="card clickable" onClick={onOpen}>
      <div className="row between">
        <h3>{program.name}</h3>
        {program.archived ? <span className="pill">Archived</span> : <span className="muted">›</span>}
      </div>
      <div className="muted small">{days?.map((d) => d.name).join(' · ')} · {program.restSec}s rest</div>
    </div>
  );
}

function ProgramEditor({ id, onBack }: { id: number; onBack: () => void }) {
  const program = useLiveQuery(() => db.programs.get(id), [id]);
  const days = useLiveQuery(() => db.days.where('programId').equals(id).sortBy('order'), [id]);
  if (!program || !days) return null;

  const addDay = () => db.days.add({ programId: id, name: `Day ${days.length + 1}`, order: days.length } as never);
  const remove = async () => {
    const used = await db.sessions.where('dayId').anyOf(days.map((d) => d.id)).count();
    if (used) {
      alert('This program has logged workouts. Archive it instead so your history stays intact.');
      return;
    }
    if (!confirm(`Delete ${program.name}?`)) return;
    await db.transaction('rw', [db.programs, db.days, db.dayExercises], async () => {
      for (const d of days) await db.dayExercises.where('dayId').equals(d.id).delete();
      await db.days.where('programId').equals(id).delete();
      await db.programs.delete(id);
    });
    onBack();
  };

  return (
    <div>
      <button className="btn small ghost" onClick={onBack} style={{ marginTop: 4 }}>← Programs</button>
      <div className="card stack" style={{ marginTop: 10 }}>
        <label className="field"><span>Name</span>
          <input type="text" defaultValue={program.name} onBlur={(e) => db.programs.update(id, { name: e.target.value.trim() || program.name })} />
        </label>
        {program.offProgram ? (
          <div className="muted small">
            Built-in. Each day here is a quick session type: logging one asks only for the time and notes, and it marks the day complete.
            Rename them or add your own (e.g. Basketball, Yoga).
          </div>
        ) : (
        <div className="grid2">
          <label className="field"><span>Rest between sets (sec)</span>
            <input type="number" inputMode="numeric" defaultValue={program.restSec} onBlur={(e) => db.programs.update(id, { restSec: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
          <label className="field"><span>Status</span>
            <select value={program.archived ? 'archived' : 'active'} onChange={(e) => db.programs.update(id, { archived: e.target.value === 'archived' })}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        )}
        <label className="field"><span>Notes</span>
          <input type="text" defaultValue={program.notes ?? ''} onBlur={(e) => db.programs.update(id, { notes: e.target.value })} />
        </label>
      </div>

      {days.map((d) => <DayEditor key={d.id} dayId={d.id} quick={program.offProgram} />)}

      <div className="stack" style={{ marginTop: 16 }}>
        <button className="btn block" onClick={addDay}>{program.offProgram ? '+ Add quick type' : '+ Add day'}</button>
        {!program.offProgram && <button className="btn ghost danger block" onClick={remove}>Delete program</button>}
      </div>
    </div>
  );
}

function DayEditor({ dayId, quick }: { dayId: number; quick?: boolean }) {
  const settings = useSettings();
  const day = useLiveQuery(() => db.days.get(dayId), [dayId]);
  const rows = useLiveQuery(async () => {
    const des = (await db.dayExercises.where('dayId').equals(dayId).toArray()).sort((a, b) => a.order - b.order);
    const exs = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    return des.map((de) => ({ de, ex: exs.get(de.exerciseId)! }));
  }, [dayId]);
  const [editing, setEditing] = useState<DayExercise | 'new' | 'cardio' | null>(null);
  if (!day || !rows || !settings) return null;

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    await db.transaction('rw', db.dayExercises, async () => {
      await db.dayExercises.update(rows[i].de.id, { order: rows[j].de.order });
      await db.dayExercises.update(rows[j].de.id, { order: rows[i].de.order });
    });
  };
  const removeDay = async () => {
    if (await db.sessions.where('dayId').equals(dayId).count()) return alert('This day has logged workouts and can’t be deleted.');
    if (!confirm(`Delete ${day.name}?`)) return;
    await db.dayExercises.where('dayId').equals(dayId).delete();
    await db.days.delete(dayId);
  };

  if (quick) {
    return (
      <div className="card row" style={{ marginTop: 10 }}>
        <input type="text" aria-label="Quick type name" className="grow" defaultValue={day.name}
          onBlur={(e) => db.days.update(dayId, { name: e.target.value.trim() || day.name })} />
        <button className="btn small ghost danger" onClick={removeDay}>Delete</button>
      </div>
    );
  }

  return (
    <>
      <h2>
        <input type="text" aria-label="Day name" defaultValue={day.name} onBlur={(e) => db.days.update(dayId, { name: e.target.value.trim() || day.name })}
          style={{ fontWeight: 700, background: 'transparent', border: 0, padding: 0, minHeight: 0, fontSize: 18 }} />
      </h2>
      <div className="card">
        <ul className="list">
          {rows.map(({ de, ex }, i) => (
            <li key={de.id} className={`row${de.retired ? ' retired' : ''}`}>
              <span className="muted small" style={{ width: 24 }}>{de.group}</span>
              <div className="grow clickable" onClick={() => setEditing(de)}>
                <h3 style={{ fontSize: 15 }}>{ex.name}</h3>
                <div className="muted small">{targetLabel(ex, de, settings.units)}{de.flagUp ? ' · ↑ next time' : ''}{de.retired ? ' · retired' : ''}</div>
              </div>
              <button className="btn small ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button className="btn small ghost" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down">↓</button>
            </li>
          ))}
        </ul>
        <div className="row between" style={{ marginTop: 8 }}>
          <div className="row">
            <button className="btn small" onClick={() => setEditing('new')}>+ Exercise</button>
            <button className="btn small" onClick={() => setEditing('cardio')}>+ Cardio</button>
          </div>
          <button className="btn small ghost danger" onClick={removeDay}>Delete day</button>
        </div>
      </div>
      {editing && (
        <ExerciseSheet
          dayId={dayId}
          de={editing === 'new' || editing === 'cardio' ? null : editing}
          cardio={editing === 'cardio'}
          nextOrder={rows.length ? Math.max(...rows.map((r) => r.de.order)) + 1 : 0}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function ExerciseSheet({ dayId, de, nextOrder, cardio, onClose }: {
  dayId: number; de: DayExercise | null; nextOrder: number; cardio?: boolean; onClose: () => void;
}) {
  const settings = useSettings();
  const library = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);
  const original = library?.find((e) => e.id === de?.exerciseId);
  const [name, setName] = useState<string | null>(cardio ? 'Outdoor Run' : null);
  const [form, setForm] = useState({
    group: de?.group ?? '', sets: de?.sets ?? 4, target: de?.target ?? 8, weight: de?.weight ?? 0,
    notes: de?.notes ?? '', retired: de?.retired ?? false,
  });
  const [plan, setPlan] = useState({
    distance: de?.distance, durationMin: de?.durationMin,
    useIntervals: !!de?.intervals?.rounds,
    rounds: de?.intervals?.rounds ?? 8, workSec: de?.intervals?.workSec ?? 30, restSec: de?.intervals?.restSec ?? 90,
  });
  const [kind, setKind] = useState<ExerciseKind | null>(cardio ? 'cardio' : null);
  const [increment, setIncrement] = useState<number | null>(null);
  if (!library || !settings) return null;

  const exName = name ?? original?.name ?? '';
  const match = library.find((e) => e.name.toLowerCase() === exName.trim().toLowerCase());
  const exKind = kind ?? match?.kind ?? 'weighted';
  const exInc = increment ?? match?.increment ?? 5;
  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!exName.trim()) return;
    let ex: Exercise | undefined = match;
    if (!ex) {
      const id = (await db.exercises.add({ name: exName.trim(), kind: exKind, increment: exInc } as never)) as number;
      ex = await db.exercises.get(id);
    } else if (ex.kind !== exKind || ex.increment !== exInc) {
      await db.exercises.update(ex.id, { kind: exKind, increment: exInc });
    }
    const data = exKind === 'cardio'
      ? {
          ...form, sets: 1, target: 0, weight: 0, exerciseId: ex!.id, group: form.group.trim(),
          distance: plan.distance || undefined, durationMin: plan.durationMin || undefined,
          intervals: plan.useIntervals ? { rounds: plan.rounds, workSec: plan.workSec, restSec: plan.restSec } : undefined,
        }
      : { ...form, exerciseId: ex!.id, group: form.group.trim() };
    if (de) await db.dayExercises.update(de.id, data);
    else await db.dayExercises.add({ ...data, dayId, order: nextOrder, flagUp: false } as never);
    onClose();
  };
  const remove = async () => {
    if (!de) return;
    if (await db.sets.where('dayExerciseId').equals(de.id).count()) {
      if (!confirm('This exercise has logged sets. Retire it instead to keep history?')) return;
      await db.dayExercises.update(de.id, { retired: true });
    } else {
      if (!confirm('Remove this exercise?')) return;
      await db.dayExercises.delete(de.id);
    }
    onClose();
  };

  return (
    <Sheet onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>{de ? 'Edit exercise' : 'Add exercise'}</h2>
      <div className="stack">
        <label className="field"><span>Exercise</span>
          <input type="text" list="ex-library" value={exName} onChange={(e) => setName(e.target.value)} placeholder={exKind === 'cardio' ? 'e.g. Outdoor Run' : 'e.g. Bench Press'} />
          <datalist id="ex-library">{library.map((e) => <option key={e.id} value={e.name} />)}</datalist>
        </label>
        <div className="grid2">
          <label className="field"><span>Type</span>
            <select value={exKind} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
              <option value="weighted">Weighted</option>
              <option value="bodyweight">Bodyweight</option>
              <option value="timed">Timed</option>
              <option value="circuit">Circuit</option>
              <option value="cardio">Cardio</option>
            </select>
          </label>
          {exKind !== 'cardio' && (
            <label className="field"><span>Increase by</span>
              <input type="number" inputMode="decimal" value={exInc} onChange={(e) => setIncrement(Number(e.target.value))} />
            </label>
          )}
        </div>
        {exKind === 'cardio' ? (
          <>
            <div className="grid2">
              <label className="field"><span>Planned distance ({distanceUnit(settings.units)})</span>
                <input type="number" inputMode="decimal" value={plan.distance ?? ''} placeholder="optional"
                  onChange={(e) => setPlan((p) => ({ ...p, distance: e.target.value === '' ? undefined : Number(e.target.value) }))} />
              </label>
              <label className="field"><span>Planned time (min)</span>
                <input type="number" inputMode="numeric" value={plan.durationMin ?? ''} placeholder="optional"
                  onChange={(e) => setPlan((p) => ({ ...p, durationMin: e.target.value === '' ? undefined : Number(e.target.value) }))} />
              </label>
            </div>
            <label className="row between clickable">
              <span>Intervals (sprints, HIIT)</span>
              <input type="checkbox" className="switch" checked={plan.useIntervals} onChange={(e) => setPlan((p) => ({ ...p, useIntervals: e.target.checked }))} />
            </label>
            {plan.useIntervals && (
              <div className="grid3">
                <label className="field"><span>Rounds</span>
                  <input type="number" inputMode="numeric" value={plan.rounds} onChange={(e) => setPlan((p) => ({ ...p, rounds: Math.max(1, Number(e.target.value) || 1) }))} />
                </label>
                <label className="field"><span>Work (sec)</span>
                  <input type="number" inputMode="numeric" value={plan.workSec} onChange={(e) => setPlan((p) => ({ ...p, workSec: Math.max(1, Number(e.target.value) || 1) }))} />
                </label>
                <label className="field"><span>Rest (sec)</span>
                  <input type="number" inputMode="numeric" value={plan.restSec} onChange={(e) => setPlan((p) => ({ ...p, restSec: Math.max(0, Number(e.target.value) || 0) }))} />
                </label>
              </div>
            )}
          </>
        ) : (
        <div className="grid3">
          <label className="field"><span>{exKind === 'circuit' ? 'Rounds' : 'Sets'}</span>
            <input type="number" inputMode="numeric" value={form.sets} onChange={(e) => set('sets', Number(e.target.value))} />
          </label>
          <label className="field"><span>{exKind === 'timed' ? 'Seconds' : 'Reps'}</span>
            <input type="number" inputMode="numeric" value={form.target} disabled={exKind === 'circuit'} onChange={(e) => set('target', Number(e.target.value))} />
          </label>
          <label className="field"><span>Weight</span>
            <input type="number" inputMode="decimal" value={form.weight} disabled={exKind === 'bodyweight'} onChange={(e) => set('weight', Number(e.target.value))} />
          </label>
        </div>
        )}
        <div className="grid2">
          <label className="field"><span>Superset group</span>
            <input type="text" value={form.group} onChange={(e) => set('group', e.target.value.toUpperCase())} placeholder="A, B1, B2…" />
          </label>
          <label className="field"><span>Status</span>
            <select value={form.retired ? 'retired' : 'active'} onChange={(e) => set('retired', e.target.value === 'retired')}>
              <option value="active">Active</option>
              <option value="retired">Retired</option>
            </select>
          </label>
        </div>
        <label className="field"><span>Notes</span>
          <input type="text" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
        <button className="btn primary block" onClick={save} disabled={!exName.trim()}>Save</button>
        {de && <button className="btn ghost danger block" onClick={remove}>Remove</button>}
      </div>
    </Sheet>
  );
}
