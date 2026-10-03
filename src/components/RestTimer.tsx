import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface Timer { endsAt: number; total: number }
interface Ctx { timer: Timer | null; start: (seconds: number) => void; adjust: (delta: number) => void; stop: () => void }

const TimerCtx = createContext<Ctx>({ timer: null, start: () => {}, adjust: () => {}, stop: () => {} });
export const useRestTimer = () => useContext(TimerCtx);

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [timer, setTimer] = useState<Timer | null>(null);
  const ctx: Ctx = {
    timer,
    start: (s) => setTimer({ endsAt: Date.now() + s * 1000, total: s }),
    adjust: (d) => setTimer((t) => (t ? { endsAt: t.endsAt + d * 1000, total: Math.max(1, t.total + d) } : t)),
    stop: () => setTimer(null),
  };
  return <TimerCtx.Provider value={ctx}>{children}</TimerCtx.Provider>;
}

export function RestTimerBar() {
  const { timer, adjust, stop } = useRestTimer();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer]);

  const left = timer ? Math.round((timer.endsAt - now) / 1000) : 1;
  const over = left <= 0;
  useEffect(() => {
    if (over) navigator.vibrate?.([200, 100, 200]);
  }, [over]);

  if (!timer) return null;
  const abs = Math.abs(left);
  const label = `${over ? '+' : ''}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
  const pct = Math.min(100, Math.max(0, (1 - left / timer.total) * 100));

  return (
    <div className={`timer${over ? ' over' : ''}`} role="timer" aria-live="off">
      <div>
        <span className="time">{label}</span>
        <span className="bar"><i style={{ width: `${pct}%` }} /></span>
        <button onClick={() => adjust(-15)}>−15</button>
        <button onClick={() => adjust(15)}>+15</button>
        <button onClick={stop} aria-label="Dismiss rest timer">✕</button>
      </div>
    </div>
  );
}
