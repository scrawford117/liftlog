import { addDays, parseISODate, toISODate } from '../logic/dates';
import { dayStatus, type StreakInput } from '../logic/streak';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function MonthGrid({ month, input, selected, onSelect }: {
  /** Any date inside the month to show. */
  month: string;
  input: StreakInput;
  selected?: string;
  onSelect: (date: string) => void;
}) {
  const m = parseISODate(month);
  const first = toISODate(new Date(m.getFullYear(), m.getMonth(), 1));
  const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const lead = (parseISODate(first).getDay() + 6) % 7; // Monday-first

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(<div key={`b${i}`} className="cell blank" />);
  for (let i = 0; i < daysInMonth; i++) {
    const d = addDays(first, i);
    const s = dayStatus(d, input);
    const plan = input.planFor(d);
    const cls = ['cell'];
    if (s === 'done' || s === 'missed' || s === 'pending' || s === 'rest') cls.push(s);
    else if (s === 'future' && plan?.kind === 'rest') cls.push('rest');
    else if (s === 'future' && plan?.kind === 'workout') cls.push('planned');
    if (d === input.today) cls.push('today');
    if (d === selected) cls.push('selected');
    cells.push(
      <button key={d} className={cls.join(' ')} onClick={() => onSelect(d)} aria-label={`${d} ${s}`}>
        {i + 1}
        <span className="dot" />
      </button>,
    );
  }

  return (
    <>
      <div className="month">
        {DOW.map((d, i) => <div key={i} className="dow">{d}</div>)}
        {cells}
      </div>
      <div className="legend">
        <span><i style={{ background: 'var(--good)' }} />Done</span>
        <span><i style={{ background: 'var(--rest)' }} />Rest</span>
        <span><i style={{ background: 'var(--bad)' }} />Missed</span>
        <span><i style={{ background: 'var(--accent)', borderRadius: '50%' }} />Planned</span>
      </div>
    </>
  );
}
