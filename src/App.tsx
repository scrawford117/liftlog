import { useEffect, useState } from 'react';
import { useActiveSessionId } from './db/hooks';
import { seedIfEmpty } from './db/seed';
import { RestTimerBar, RestTimerProvider, useRestTimer } from './components/RestTimer';
import { IconCalendar, IconChart, IconGear, IconList, IconToday } from './components/Icons';
import { Today } from './screens/Today';
import { Workout } from './screens/Workout';
import { Calendar } from './screens/Calendar';
import { Programs } from './screens/Programs';
import { Progress } from './screens/Progress';
import { Settings } from './screens/Settings';

type Tab = 'today' | 'calendar' | 'programs' | 'progress' | 'settings';
const TABS: { id: Tab; label: string; icon: () => React.JSX.Element }[] = [
  { id: 'today', label: 'Today', icon: IconToday },
  { id: 'calendar', label: 'Calendar', icon: IconCalendar },
  { id: 'programs', label: 'Programs', icon: IconList },
  { id: 'progress', label: 'Progress', icon: IconChart },
  { id: 'settings', label: 'Settings', icon: IconGear },
];

function Shell() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [openSession, setOpenSession] = useState<number | null>(null);
  const activeId = useActiveSessionId();
  const { timer } = useRestTimer();

  useEffect(() => { seedIfEmpty().then(() => setReady(true)); }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [tab, openSession]);

  if (!ready || activeId === undefined) return null;

  const open = (id: number) => setOpenSession(id);
  let screen;
  if (openSession != null) screen = <Workout sessionId={openSession} onClose={() => setOpenSession(null)} />;
  else if (tab === 'today') screen = <Today activeSessionId={activeId} openSession={open} />;
  else if (tab === 'calendar') screen = <Calendar openSession={open} />;
  else if (tab === 'programs') screen = <Programs />;
  else if (tab === 'progress') screen = <Progress openSession={open} />;
  else screen = <Settings />;

  return (
    <>
      <main className={`app${timer ? ' with-timer' : ''}`}>{screen}</main>
      <RestTimerBar />
      <nav className="tabs">
        <div>
          {TABS.map((t) => (
            <button key={t.id} className={`tab${tab === t.id && openSession == null ? ' active' : ''}`} onClick={() => { setOpenSession(null); setTab(t.id); }}>
              <t.icon />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

export default function App() {
  return (
    <RestTimerProvider>
      <Shell />
    </RestTimerProvider>
  );
}
