import { useEffect, useState } from 'react';
import { db, type DayExercise, type Exercise, type SetLog } from '../db/schema';
import { cardioPlanLabel, formatDuration, formatPace } from '../logic/cardio';
import { formatDate } from '../logic/dates';
import type { SessionSets } from '../logic/progression';
import { IconCheck } from './Icons';
import { IntervalRunner } from './IntervalRunner';

function NumField({ value, onCommit, label, unit, width }: {
  value: number | undefined; onCommit: (n: number | undefined) => void; label: string; unit: string; width?: number;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => setText(value == null ? '' : String(value)), [value]);
  return (
    <label className="unit-input" style={{ width }}>
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={text}
        placeholder="0"
        onFocus={(e) => e.target.select()}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = text.trim() === '' ? undefined : Number(text);
          if (n === undefined || Number.isFinite(n)) onCommit(n);
        }}
      />
      <em>{unit}</em>
    </label>
  );
}

export function CardioCard({ de, ex, set, distUnit, sound, last }: {
  de: DayExercise;
  ex: Exercise;
  set: SetLog | undefined;
  distUnit: string;
  sound: boolean;
  last?: SessionSets;
}) {
  if (!set) return null;
  const dur = set.durationSec ?? 0;
  const mins = Math.floor(dur / 60);
  const secs = Math.round(dur % 60);
  const setDuration = (m: number | undefined, s: number | undefined) =>
    db.sets.update(set.id, { durationSec: (m ?? 0) * 60 + (s ?? 0) });
  const prev = last?.sets[0];

  return (
    <div className="card ex-card">
      <div className="row between">
        <h3>{ex.name}</h3>
        <span className="pill ex-target">{cardioPlanLabel(de, distUnit)}</span>
      </div>
      {de.notes && <div className="muted small">{de.notes}</div>}
      {prev && (
        <div className="muted small" style={{ marginTop: 4 }}>
          Last ({formatDate(last!.session.date, { month: 'short', day: 'numeric' })}):{' '}
          {[prev.distance ? `${prev.distance} ${distUnit}` : '', prev.durationSec ? formatDuration(prev.durationSec) : '',
            prev.distance && prev.durationSec ? formatPace(prev.distance, prev.durationSec, distUnit) : ''].filter(Boolean).join(' · ')}
        </div>
      )}

      {de.intervals?.rounds ? (
        <IntervalRunner
          intervals={de.intervals}
          sound={sound}
          onProgress={(completed) => db.sets.update(set.id, { reps: completed })}
        />
      ) : null}

      <div className="cardio-grid">
        <div>
          <div className="small muted">Distance</div>
          <NumField label="Distance" unit={distUnit} value={set.distance} onCommit={(n) => db.sets.update(set.id, { distance: n })} />
        </div>
        <div>
          <div className="small muted">Time</div>
          <div className="row" style={{ gap: 6 }}>
            <NumField label="Minutes" unit="min" value={mins || undefined} onCommit={(n) => setDuration(n, secs)} />
            <NumField label="Seconds" unit="sec" value={secs || undefined} onCommit={(n) => setDuration(mins, n)} />
          </div>
        </div>
      </div>
      <div className="row between" style={{ marginTop: 10 }}>
        <span className="small muted">
          Pace <strong style={{ color: 'var(--text)' }}>{formatPace(set.distance, set.durationSec, distUnit)}</strong>
          {de.intervals?.rounds ? <> · Intervals <strong style={{ color: 'var(--text)' }}>{set.reps}/{de.intervals.rounds}</strong></> : null}
        </span>
        <button className={`check${set.done ? ' on' : ''}`} onClick={() => db.sets.update(set.id, { done: !set.done })} aria-label={set.done ? 'Mark cardio not done' : 'Mark cardio done'}>
          {set.done ? <IconCheck /> : null}
        </button>
      </div>
    </div>
  );
}
