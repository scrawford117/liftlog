import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PlanEntry } from '../db/schema';
import { setOverride, startSession } from '../db/actions';
import { useDayLabels, useStreakInput } from '../db/hooks';
import { dayStatus } from '../logic/streak';
import { formatDate, parseISODate, toISODate } from '../logic/dates';
import { MonthGrid } from '../components/MonthGrid';
import { DayPicker } from './Programs';
import { QuickLogSheet } from '../components/QuickLogSheet';

const STATUS_PILL: Record<string, [string, string]> = {
  done: ['good', 'Done'],
  rest: ['rest', 'Rest day'],
  missed: ['bad', 'Missed'],
  pending: ['accent', 'Today'],
  future: ['', 'Upcoming'],
  before: ['', 'Before tracking'],
};

export function Calendar({ openSession }: { openSession: (id: number) => void }) {
  const input = useStreakInput();
  const labels = useDayLabels();
  const [month, setMonth] = useState(() => toISODate(new Date()));
  const [selected, setSelected] = useState<string>(() => toISODate(new Date()));
  const [quick, setQuick] = useState<{ dayId: number | null } | null>(null);
  const sessions = useLiveQuery(() => db.sessions.where('date').equals(selected).toArray(), [selected]);
  const override = useLiveQuery(async () => (await db.overrides.get(selected)) ?? null, [selected]);

  if (!input || !labels) return null;

  const shift = (n: number) => {
    const d = parseISODate(month);
    setMonth(toISODate(new Date(d.getFullYear(), d.getMonth() + n, 1)));
  };
  const plan = input.planFor(selected);
  const status = dayStatus(selected, input);
  const [pillCls, pillText] = STATUS_PILL[status];
  const label = (dayId: number) => {
    const l = labels.get(dayId);
    return l ? `${l.day.name} · ${l.program.name}` : 'Unknown';
  };

  const planMode = !override ? 'default' : override.plan === null ? 'none' : override.plan.kind;
  const setPlan = (p: PlanEntry | null | undefined) => setOverride(selected, p);

  return (
    <div>
      <h1>Calendar</h1>
      <div className="card">
        <div className="month-head">
          <button className="btn small ghost" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <strong>{parseISODate(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
          <button className="btn small ghost" onClick={() => shift(1)} aria-label="Next month">›</button>
        </div>
        <MonthGrid month={month} input={input} selected={selected} onSelect={setSelected} />
      </div>

      <h2>{formatDate(selected, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
      <div className="card stack">
        <div className="row between">
          <span>{plan?.kind === 'workout' ? label(plan.dayId) : plan?.kind === 'rest' ? 'Rest' : 'Nothing planned'}</span>
          <span className={`pill ${pillCls}`}>{pillText}</span>
        </div>

        <div>
          <div className="small muted" style={{ marginBottom: 6 }}>Plan for this day</div>
          <div className="seg">
            <button className={planMode === 'default' ? 'on' : ''} onClick={() => setPlan(undefined)}>Weekly</button>
            <button className={planMode === 'rest' ? 'on' : ''} onClick={() => setPlan({ kind: 'rest' })}>Rest</button>
            <button
              className={planMode === 'workout' ? 'on' : ''}
              onClick={() => {
                const first = [...labels.values()].find((l) => !l.program.archived);
                if (first) setPlan({ kind: 'workout', dayId: plan?.kind === 'workout' ? plan.dayId : first.day.id });
              }}
            >Workout</button>
            <button className={planMode === 'none' ? 'on' : ''} onClick={() => setPlan(null)}>None</button>
          </div>
          {planMode === 'workout' && override?.plan?.kind === 'workout' && (
            <div style={{ marginTop: 8 }}>
              <DayPicker value={override.plan.dayId} onChange={(id) => id && setPlan({ kind: 'workout', dayId: id })} />
            </div>
          )}
        </div>

        {sessions && sessions.length > 0 && (
          <ul className="list">
            {sessions.map((s) => (
              <li key={s.id} className="row between clickable" onClick={() => openSession(s.id)}>
                <span>{label(s.dayId)}</span>
                <span className={`pill ${s.status === 'done' ? 'good' : 'accent'}`}>{s.status === 'done' ? 'Logged' : 'In progress'}</span>
              </li>
            ))}
          </ul>
        )}

        {selected <= input.today && plan?.kind === 'workout' && !sessions?.some((s) => s.status === 'done') && (
          <button
            className="btn primary block"
            onClick={async () => labels.get(plan.dayId)?.program.offProgram
              ? setQuick({ dayId: plan.dayId })
              : openSession(await startSession(plan.dayId, selected))}
          >
            Log {labels.get(plan.dayId)?.day.name} for this day
          </button>
        )}
        {selected <= input.today && (
          <button className="btn block" onClick={() => setQuick({ dayId: null })}>Quick log (off program)</button>
        )}
      </div>
      {quick && <QuickLogSheet date={selected} dayId={quick.dayId} onClose={() => setQuick(null)} />}
    </div>
  );
}
