import { useEffect, useRef, useState } from 'react';
import type { Intervals } from '../db/schema';
import { formatDuration, intervalState, intervalTotalSec } from '../logic/cardio';
import { playTones, unlockAudio } from './alerts';

/**
 * Guided work/rest timer for sprints and other intervals. Beeps on every phase change
 * and counts down the last 3 seconds of each phase.
 */
export function IntervalRunner({ intervals, sound, onProgress }: {
  intervals: Intervals;
  sound: boolean;
  /** Called with rounds completed whenever that changes, and once more when finished. */
  onProgress: (completed: number, elapsedSec: number) => void;
}) {
  // Elapsed time is tracked as (accumulated before the last resume) + (now - resumedAt).
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [banked, setBanked] = useState(0);
  const [now, setNow] = useState(Date.now());
  const last = useRef({ phase: '', round: 0, tick: -1, completed: 0 });

  const running = startedAt != null;
  const elapsed = banked + (running ? (now - startedAt) / 1000 : 0);
  const st = intervalState(intervals, elapsed);
  const total = intervalTotalSec(intervals);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [running]);

  // Sounds and progress callbacks on phase changes.
  useEffect(() => {
    if (!running && st.phase !== 'done') return;
    const l = last.current;
    const secLeft = Math.ceil(st.left);
    if (st.phase !== l.phase || st.round !== l.round) {
      if (l.phase && sound) {
        if (st.phase === 'work') playTones([1319, 1319], 0.15);
        else if (st.phase === 'rest') playTones([660], 0.4);
        else playTones([880, 988, 1319, 1760]);
      }
      l.phase = st.phase;
      l.round = st.round;
      l.tick = -1;
    } else if (st.phase !== 'done' && secLeft <= 3 && secLeft >= 1 && secLeft !== l.tick) {
      if (sound) playTones([440], 0.08, 0, 0.35);
      l.tick = secLeft;
    }
    if (st.completed !== l.completed) {
      l.completed = st.completed;
      onProgress(st.completed, Math.round(elapsed));
    }
    if (st.phase === 'done' && running) {
      setBanked(total);
      setStartedAt(null);
    }
  });

  const start = () => {
    unlockAudio();
    if (st.phase === 'done') {
      setBanked(0);
      last.current = { phase: '', round: 0, tick: -1, completed: 0 };
    }
    setNow(Date.now());
    setStartedAt(Date.now());
  };
  const pause = () => {
    setBanked(elapsed);
    setStartedAt(null);
  };
  const reset = () => {
    setStartedAt(null);
    setBanked(0);
    last.current = { phase: '', round: 0, tick: -1, completed: 0 };
  };

  const idle = !running && banked === 0;
  const label = idle ? 'Ready' : st.phase === 'work' ? 'GO' : st.phase === 'rest' ? 'Rest' : 'Done';

  return (
    <div className={`intervals phase-${idle ? 'idle' : st.phase}`}>
      <div className="row between">
        <span className="iv-label">{label}</span>
        <span className="small">Round {Math.min(st.round, intervals.rounds)} / {intervals.rounds}</span>
      </div>
      <div className="iv-time">{formatDuration(idle ? intervals.workSec : Math.ceil(st.left))}</div>
      <div className="iv-bar"><i style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }} /></div>
      <div className="row" style={{ marginTop: 10 }}>
        {running
          ? <button className="btn grow" onClick={pause}>Pause</button>
          : <button className="btn primary grow" onClick={start}>{idle ? 'Start intervals' : st.phase === 'done' ? 'Restart' : 'Resume'}</button>}
        {!idle && <button className="btn ghost" onClick={reset}>Reset</button>}
      </div>
    </div>
  );
}
