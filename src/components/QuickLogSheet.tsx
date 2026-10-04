import { useState } from 'react';
import { useDayLabels } from '../db/hooks';
import { logQuickSession } from '../db/actions';
import { formatDate } from '../logic/dates';
import { Sheet } from './Sheet';

const PRESETS = [15, 20, 30, 45, 60];

/** Quick off-program log: pick a type, optional time and notes, and the day counts as done. */
export function QuickLogSheet({ date, dayId, onClose }: { date: string; dayId?: number | null; onClose: () => void }) {
  const labels = useDayLabels();
  const [picked, setPicked] = useState<number | null>(dayId ?? null);
  const [minutes, setMinutes] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState('');
  if (!labels) return null;

  const quickDays = [...labels.values()].filter((l) => l.program.offProgram).sort((a, b) => a.day.order - b.day.order);
  const chosen = picked ?? quickDays[0]?.day.id ?? null;

  const save = async () => {
    if (chosen == null) return;
    await logQuickSession(chosen, date, minutes, notes.trim() || undefined);
    onClose();
  };

  return (
    <Sheet onClose={onClose}>
      <h2 style={{ marginTop: 0, marginBottom: 2 }}>Quick log</h2>
      <div className="muted small" style={{ marginBottom: 12 }}>{formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })} · counts toward your streak</div>
      <div className="stack">
        <div className="chips">
          {quickDays.map(({ day }) => (
            <button key={day.id} className={`chip${chosen === day.id ? ' on' : ''}`} onClick={() => setPicked(day.id)}>{day.name}</button>
          ))}
        </div>
        <div>
          <div className="small muted" style={{ marginBottom: 6 }}>How long? (optional)</div>
          <div className="chips">
            {PRESETS.map((m) => (
              <button key={m} className={`chip${minutes === m ? ' on' : ''}`} onClick={() => setMinutes(minutes === m ? undefined : m)}>{m} min</button>
            ))}
            <input
              type="number"
              inputMode="numeric"
              aria-label="Minutes"
              placeholder="Other"
              value={minutes != null && !PRESETS.includes(minutes) ? minutes : ''}
              onChange={(e) => setMinutes(e.target.value === '' ? undefined : Number(e.target.value))}
              style={{ width: 90, minHeight: 38 }}
            />
          </div>
        </div>
        <label className="field"><span>Notes (optional)</span>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 3 rounds of DB complexes, 2 mi jog" />
        </label>
        <button className="btn primary block" onClick={save} disabled={chosen == null}>Mark day complete</button>
        <div className="muted small">Rename these or add your own under Programs → Off Program.</div>
      </div>
    </Sheet>
  );
}
