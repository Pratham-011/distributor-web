import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';
import { toISO, rangeLabel } from '../format.js';

const Ctx = createContext(null);

/** Shared date range for every report page, so switching pages keeps the same dates. */
export function DateProvider({ children }) {
  const [range, setRange] = useState(null);       // { from, to, preset }
  const [dates, setDates] = useState(null);       // { latest, days }
  // jump=true after an upload: show the newest uploaded day, unless the person picked their own dates
  const refresh = (jump = false) => api('/reports/dates').then(d => {
    setDates(d);
    setRange(r => (!r || (jump && r.preset !== 'custom') ? initial(d) : r));
  }).catch(() => setRange(r => r || presets(null).today));
  useEffect(() => { refresh(); }, []);
  return <Ctx.Provider value={{ range, setRange, dates, refresh }}>{children}</Ctx.Provider>;
}
export const useDates = () => useContext(Ctx);

function initial(d) {
  const latest = d.latest?.sales || d.days?.[0]?.date;
  return latest ? { from: latest, to: latest, preset: 'latest' } : presets(null).today;
}

function presets(latest) {
  const t = new Date();
  const y = new Date(t); y.setDate(t.getDate() - 1);
  const mStart = new Date(t.getFullYear(), t.getMonth(), 1);
  const lmStart = new Date(t.getFullYear(), t.getMonth() - 1, 1);
  const lmEnd = new Date(t.getFullYear(), t.getMonth(), 0);
  const out = {
    today: { from: toISO(t), to: toISO(t), preset: 'today', label: 'Today' },
    yesterday: { from: toISO(y), to: toISO(y), preset: 'yesterday', label: 'Yesterday' },
    month: { from: toISO(mStart), to: toISO(t), preset: 'month', label: 'This month' },
    lastmonth: { from: toISO(lmStart), to: toISO(lmEnd), preset: 'lastmonth', label: 'Last month' },
  };
  if (latest) out.latest = { from: latest, to: latest, preset: 'latest', label: 'Last uploaded day' };
  return out;
}

export default function DateBar({ hint }) {
  const { range, setRange, dates } = useDates();
  const [custom, setCustom] = useState(false);
  if (!range) return null;
  const p = presets(dates?.latest?.sales || dates?.days?.[0]?.date);
  const order = ['latest', 'today', 'yesterday', 'month', 'lastmonth'].filter(k => p[k]);
  return (
    <div className="no-print">
      <div className="datebar" role="group" aria-label="Choose dates">
        {order.map(k => (
          <button key={k} className={'chip' + (range.preset === k && !custom ? ' on' : '')} onClick={() => { setCustom(false); setRange(p[k]); }}>{p[k].label}</button>
        ))}
        <button className={'chip' + (custom || range.preset === 'custom' ? ' on' : '')} onClick={() => setCustom(true)}>Choose dates</button>
        {(custom || range.preset === 'custom') && (
          <span className="custom">
            <input type="date" aria-label="From date" value={range.from} max={range.to} onChange={e => e.target.value && setRange({ ...range, from: e.target.value, preset: 'custom' })} />
            <span className="muted">to</span>
            <input type="date" aria-label="To date" value={range.to} min={range.from} onChange={e => e.target.value && setRange({ ...range, to: e.target.value, preset: 'custom' })} />
          </span>
        )}
      </div>
      <div className="showing">Showing: <b>{rangeLabel(range.from, range.to)}</b>{hint ? <> · {hint}</> : null}</div>
    </div>
  );
}
