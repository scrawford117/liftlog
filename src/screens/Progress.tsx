import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../db/schema';
import { useDayLabels, useSettings } from '../db/hooks';
import { e1rm } from '../logic/progression';
import { addDays, formatDate, today, weekStart } from '../logic/dates';
import { distanceUnit, formatDuration, paceSec } from '../logic/cardio';

const axis = { stroke: 'var(--muted)', fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13 };

export function Progress({ openSession }: { openSession: (id: number) => void }) {
  const settings = useSettings();
  const labels = useDayLabels();
  const data = useLiveQuery(async () => {
    const sessions = (await db.sessions.where('status').equals('done').toArray()).sort((a, b) => b.date.localeCompare(a.date));
    const doneIds = new Set(sessions.map((s) => s.id));
    const sets = (await db.sets.toArray()).filter((s) => doneIds.has(s.sessionId) && s.done);
    const exercises = await db.exercises.toArray();
    return { sessions, sets, exercises };
  }, []);
  const [exId, setExId] = useState<number | null>(null);

  if (!data || !settings || !labels) return null;
  const { sessions, sets, exercises } = data;
  const units = settings.units;
  const dateOf = new Map(sessions.map((s) => [s.id, s.date]));

  const logged = exercises.filter((e) => e.kind !== 'circuit' && sets.some((s) => s.exerciseId === e.id)).sort((a, b) => a.name.localeCompare(b.name));
  const current = logged.find((e) => e.id === exId) ?? logged[0];

  // Per-session top weight and best e1RM for the selected exercise.
  const series = new Map<string, { date: string; top: number; e1rm: number; reps: number; distance: number; durationSec: number; pace?: number }>();
  for (const s of sets) {
    if (!current || s.exerciseId !== current.id) continue;
    const date = dateOf.get(s.sessionId)!;
    const p = series.get(date) ?? { date, top: 0, e1rm: 0, reps: 0, distance: 0, durationSec: 0 };
    p.distance += s.distance ?? 0;
    p.durationSec += s.durationSec ?? 0;
    p.top = Math.max(p.top, current.kind === 'bodyweight' ? 0 : s.weight);
    p.e1rm = Math.max(p.e1rm, e1rm(s.weight, s.reps));
    p.reps = Math.max(p.reps, s.reps);
    series.set(date, p);
  }
  const points = [...series.values()].sort((a, b) => a.date.localeCompare(b.date)).map((p) => {
    const pace = paceSec(p.distance, p.durationSec);
    return { ...p, pace: pace ? Math.round((pace / 60) * 100) / 100 : undefined, minutes: Math.round(p.durationSec / 60), label: formatDate(p.date, { month: 'short', day: 'numeric' }) };
  });
  const isLoad = current && current.kind === 'weighted';
  const isCardio = current && current.kind === 'cardio';
  const dist = distanceUnit(units);

  // Cardio bests per type, and this week's totals.
  const cardioBests = logged
    .filter((e) => e.kind === 'cardio')
    .map((e) => {
      const mine = sets.filter((s) => s.exerciseId === e.id);
      const longest = mine.reduce((m, s) => Math.max(m, s.distance ?? 0), 0);
      const paces = mine.map((s) => paceSec(s.distance, s.durationSec)).filter((x): x is number => x != null);
      return { ex: e, longest, bestPace: paces.length ? Math.min(...paces) : null, count: mine.length };
    });
  const wk = weekStart(today());
  const weekCardio = sets.filter((s) => s.distance != null || s.durationSec != null).filter((s) => weekStart(dateOf.get(s.sessionId)!) === wk);
  const weekDist = weekCardio.reduce((t, s) => t + (s.distance ?? 0), 0);
  const weekTime = weekCardio.reduce((t, s) => t + (s.durationSec ?? 0), 0);

  // PRs across all weighted exercises.
  const prs = logged
    .filter((e) => e.kind === 'weighted')
    .map((e) => {
      let best = { weight: 0, reps: 0, date: '', e: 0 };
      for (const s of sets) if (s.exerciseId === e.id && e1rm(s.weight, s.reps) > best.e) best = { weight: s.weight, reps: s.reps, date: dateOf.get(s.sessionId)!, e: e1rm(s.weight, s.reps) };
      return { ex: e, ...best };
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  // Weekly volume, last 12 weeks.
  const thisWeek = weekStart(today());
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(thisWeek, (i - 11) * 7));
  const vol = new Map(weeks.map((w) => [w, 0]));
  for (const s of sets) {
    const w = weekStart(dateOf.get(s.sessionId)!);
    if (vol.has(w)) vol.set(w, vol.get(w)! + s.weight * s.reps);
  }
  const volume = weeks.map((w) => ({ label: formatDate(w, { month: 'numeric', day: 'numeric' }), volume: vol.get(w)! }));

  return (
    <div>
      <h1>Progress</h1>
      {logged.length === 0 ? (
        <div className="card empty">Finish a workout and your charts and PRs will show up here.</div>
      ) : (
        <>
          <div className="card">
            <select value={current?.id ?? ''} onChange={(e) => setExId(Number(e.target.value))} aria-label="Exercise">
              {logged.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <div className="chart" style={{ marginTop: 12 }}>
              <ResponsiveContainer>
                <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis yAxisId="left" {...axis} width={40} domain={['auto', 'auto']} />
                  {isCardio && <YAxis yAxisId="right" orientation="right" {...axis} width={40} domain={['auto', 'auto']} reversed />}
                  <Tooltip contentStyle={tooltipStyle} />
                  {isCardio ? (
                    <>
                      <Line yAxisId="left" type="monotone" dataKey={points.some((p) => p.distance) ? 'distance' : 'minutes'} name={points.some((p) => p.distance) ? `Distance (${dist})` : 'Minutes'} stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line yAxisId="right" type="monotone" dataKey="pace" name={`Pace (min/${dist})`} stroke="var(--rest)" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} connectNulls />
                    </>
                  ) : isLoad ? (
                    <>
                      <Line yAxisId="left" type="monotone" dataKey="top" name={`Top set (${units})`} stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line yAxisId="left" type="monotone" dataKey="e1rm" name={`Est. 1RM (${units})`} stroke="var(--rest)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                    </>
                  ) : (
                    <Line yAxisId="left" type="monotone" dataKey={current?.kind === 'timed' && points.some((p) => p.top) ? 'top' : 'reps'} name={current?.kind === 'timed' ? 'Weight' : 'Best reps'} stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {isCardio && (
              <div className="legend">
                <span><i style={{ background: 'var(--accent)' }} />{points.some((p) => p.distance) ? 'Distance' : 'Minutes'}</span>
                <span><i style={{ background: 'var(--rest)' }} />Pace (right axis, faster is higher)</span>
              </div>
            )}
            {isLoad && (
              <div className="legend">
                <span><i style={{ background: 'var(--accent)' }} />Top set</span>
                <span><i style={{ background: 'var(--rest)' }} />Estimated 1RM</span>
              </div>
            )}
          </div>

          {cardioBests.length > 0 && (
            <>
              <h2>Cardio</h2>
              <div className="card">
                <div className="row between small" style={{ marginBottom: 6 }}>
                  <span className="muted">This week</span>
                  <strong>{Math.round(weekDist * 100) / 100} {dist} · {formatDuration(weekTime)}</strong>
                </div>
                <ul className="list">
                  {cardioBests.map((b) => (
                    <li key={b.ex.id} className="row between">
                      <span className="grow">{b.ex.name}<div className="muted small">{b.count} logged</div></span>
                      <span style={{ textAlign: 'right' }}>
                        <strong>{b.longest ? `${b.longest} ${dist}` : '—'}</strong>
                        <div className="muted small">{b.bestPace ? `best ${formatDuration(b.bestPace)} /${dist}` : 'longest'}</div>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {prs.length > 0 && <h2>Personal records</h2>}
          {prs.length > 0 && <div className="card">
            <ul className="list">
              {prs.map((p) => (
                <li key={p.ex.id} className="row between">
                  <span className="grow">{p.ex.name}<div className="muted small">{formatDate(p.date)}</div></span>
                  <span style={{ textAlign: 'right' }}><strong>{p.weight} × {p.reps}</strong><div className="muted small">≈ {p.e} {units} 1RM</div></span>
                </li>
              ))}
            </ul>
          </div>}

          {volume.some((v) => v.volume > 0) && <h2>Weekly volume</h2>}
          {volume.some((v) => v.volume > 0) && <div className="card">
            <div className="chart" style={{ height: 160 }}>
              <ResponsiveContainer>
                <BarChart data={volume} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" {...axis} interval={1} />
                  <YAxis {...axis} width={44} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => [`${Number(v).toLocaleString()} ${units}`, 'Volume']} />
                  <Bar dataKey="volume" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="muted small">Weight × reps for all completed sets.</div>
          </div>}
        </>
      )}

      <h2>History</h2>
      <div className="card">
        {sessions.length === 0 ? <div className="muted">No workouts logged yet.</div> : (
          <ul className="list">
            {sessions.slice(0, 30).map((s) => {
              const l = labels.get(s.dayId);
              return (
                <li key={s.id} className="row between clickable" onClick={() => openSession(s.id)}>
                  <span className="grow">{l?.day.name} <span className="muted small">· {l?.program.name}</span></span>
                  <span className="muted small">{formatDate(s.date)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
