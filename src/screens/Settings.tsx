import { useRef, useState } from 'react';
import { useSettings } from '../db/hooks';
import { updateSettings } from '../db/actions';
import { downloadText, exportJSON, importJSON } from '../db/backup';
import { seed } from '../db/seed';
import { today } from '../logic/dates';

export function Settings() {
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  if (!settings) return null;

  const doExport = async () => {
    downloadText(`liftlog-backup-${today()}.json`, await exportJSON());
    setMsg('Backup downloaded.');
  };
  const doImport = async (file: File) => {
    if (!confirm('Replace everything in the app with this backup?')) return;
    try {
      await importJSON(await file.text());
      setMsg('Backup restored.');
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };
  const reset = async () => {
    if (!confirm('Erase all workouts and reload the original programs from your notes? Export a backup first if you want to keep anything.')) return;
    await seed();
    setMsg('Reset to the original programs.');
  };

  return (
    <div>
      <h1>Settings</h1>
      <div className="card stack">
        <label className="field"><span>Units</span>
          <div className="seg">
            {(['lb', 'kg'] as const).map((u) => (
              <button key={u} className={settings.units === u ? 'on' : ''} onClick={() => updateSettings({ units: u })}>{u}</button>
            ))}
          </div>
        </label>
        <label className="field"><span>Clean sessions before suggesting more weight</span>
          <input type="number" inputMode="numeric" min={1} value={settings.threshold} onChange={(e) => updateSettings({ threshold: Math.max(1, Number(e.target.value) || 1) })} />
        </label>
        <label className="field"><span>Count streaks from</span>
          <input type="date" value={settings.streakStart} onChange={(e) => updateSettings({ streakStart: e.target.value })} />
        </label>
        <div className="muted small">
          A day keeps your streak alive if you finish a workout or it’s a planned rest day. A clean session means every set done at the working weight and target reps. Per-exercise increments are set in Programs.
        </div>
      </div>

      <h2>Backup</h2>
      <div className="card stack">
        <div className="muted small">Your data lives only on this device. Export a backup now and then, and use it to move to a new phone.</div>
        <div className="grid2">
          <button className="btn" onClick={doExport}>Export JSON</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Import JSON</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
        {msg && <div className="small">{msg}</div>}
      </div>

      <h2>Danger zone</h2>
      <div className="card">
        <button className="btn ghost danger block" onClick={reset}>Reset to original programs</button>
      </div>
    </div>
  );
}
