import { useEffect, useState } from 'react';
import { db, type DayExercise, type Exercise, type SetLog } from '../db/schema';
import { acceptIncrease, skipIncrease } from '../db/actions';
import type { SessionSets, Suggestion } from '../logic/progression';
import { formatDate } from '../logic/dates';
import { IconCheck, IconUp } from './Icons';
import { useRestTimer } from './RestTimer';

export function targetLabel(ex: Exercise, de: Pick<DayExercise, 'sets' | 'target' | 'weight'>, units: string) {
  if (ex.kind === 'circuit') return `${de.sets} rounds${de.weight ? ` · ${de.weight} ${units}` : ''}`;
  const t = ex.kind === 'timed' ? `${de.target}s` : `${de.target}`;
  return `${de.sets}×${t}${de.weight ? ` @ ${de.weight} ${units}` : ''}`;
}

function NumInput({ value, onCommit, unit, label }: { value: number; onCommit: (n: number) => void; unit: string; label: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <span className="unit-input">
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={text}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text);
          if (Number.isFinite(n) && n !== value) onCommit(n);
          else setText(String(value));
        }}
      />
      <em>{unit}</em>
    </span>
  );
}

export function SetRow({ set, ex, units, restSec }: { set: SetLog; ex: Exercise; units: string; restSec: number }) {
  const timer = useRestTimer();
  const toggle = async () => {
    await db.sets.update(set.id, { done: !set.done });
    if (!set.done && restSec > 0) timer.start(restSec);
  };
  const check = (
    <button className={`check${set.done ? ' on' : ''}`} onClick={toggle} aria-label={set.done ? 'Mark set not done' : 'Mark set done'}>
      {set.done ? <IconCheck /> : null}
    </button>
  );

  if (ex.kind === 'circuit') {
    return (
      <div className={`set-row circuit${set.done ? ' done' : ''}`}>
        <span className="idx">{set.idx + 1}</span>
        <span className="muted small">Round {set.idx + 1}{set.weight ? ` · ${set.weight} ${units}` : ''}</span>
        {check}
      </div>
    );
  }
  return (
    <div className={`set-row${set.done ? ' done' : ''}`}>
      <span className="idx">{set.idx + 1}</span>
      {ex.kind === 'bodyweight' ? (
        <span className="muted small" style={{ textAlign: 'center' }}>Bodyweight</span>
      ) : (
        <NumInput label={`Set ${set.idx + 1} weight`} value={set.weight} unit={units} onCommit={(n) => db.sets.update(set.id, { weight: n })} />
      )}
      <NumInput label={`Set ${set.idx + 1} ${ex.kind === 'timed' ? 'seconds' : 'reps'}`} value={set.reps} unit={ex.kind === 'timed' ? 'sec' : 'reps'} onCommit={(n) => db.sets.update(set.id, { reps: n })} />
      {check}
    </div>
  );
}

export function ExerciseCard({ de, ex, sets, units, restSec, sessionId, suggestion, last }: {
  de: DayExercise;
  ex: Exercise;
  sets: SetLog[];
  units: string;
  restSec: number;
  sessionId: number;
  suggestion: Suggestion | null;
  last?: SessionSets;
}) {
  const addSet = async () => {
    const prev = sets[sets.length - 1];
    await db.sets.add({
      sessionId, dayExerciseId: de.id, exerciseId: ex.id, idx: sets.length,
      weight: prev?.weight ?? de.weight, reps: prev?.reps ?? de.target, done: false,
    } as never);
  };
  const removeSet = async () => {
    const lastSet = sets[sets.length - 1];
    if (lastSet) await db.sets.delete(lastSet.id);
  };

  return (
    <div className="card ex-card">
      <div className="row between">
        <h3>{ex.name}</h3>
        <span className="pill ex-target">{targetLabel(ex, de, units)}</span>
      </div>
      {de.notes && <div className="muted small">{de.notes}</div>}
      {ex.kind === 'circuit' && ex.items && (
        <ul className="circuit-items">{ex.items.map((it) => <li key={it}>{it}</li>)}</ul>
      )}
      {last && ex.kind !== 'circuit' && (
        <div className="muted small" style={{ marginTop: 4 }}>
          Last ({formatDate(last.session.date, { month: 'short', day: 'numeric' })}):{' '}
          {last.sets.map((s) => (ex.kind === 'bodyweight' ? `${s.reps}` : `${s.weight}×${s.reps}`)).join(', ')}
        </div>
      )}

      {suggestion && (
        <div className="suggest">
          <span className="grow small">
            {suggestion.reason === 'flag' ? 'Flagged to go up: ' : `${suggestion.clean} clean sessions: `}
            try <strong>{suggestion.to} {units}</strong>
          </span>
          <button className="btn small primary" onClick={() => acceptIncrease(de, suggestion.to, sessionId)}>Go up</button>
          <button className="btn small ghost" onClick={() => skipIncrease(de)}>Not yet</button>
        </div>
      )}

      {sets.map((s) => <SetRow key={s.id} set={s} ex={ex} units={units} restSec={restSec} />)}

      <div className="row between" style={{ marginTop: 10 }}>
        <div className="row">
          <button className="btn small ghost" onClick={addSet}>+ Set</button>
          {sets.length > 0 && <button className="btn small ghost" onClick={removeSet}>− Set</button>}
        </div>
        {de.weight > 0 && !suggestion && (
          <button
            className={`btn small ${de.flagUp ? 'primary' : 'ghost'}`}
            onClick={() => db.dayExercises.update(de.id, { flagUp: !de.flagUp })}
            title="Suggest a weight increase next session"
          >
            <span className="row" style={{ gap: 4 }}><IconUp /> Next time</span>
          </button>
        )}
      </div>
    </div>
  );
}
