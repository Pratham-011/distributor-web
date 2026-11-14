import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';
import { toISO, rangeLabel, date, rupees, num } from '../format.js';

const Ctx = createContext(null);

/** Shared date range for every report page, so switching pages keeps the same dates. */
export function DateProvider({ children }) {
  const [range, setRange] = useState(null);       // { from, to, preset }
  const [dates, setDates] = useState(null);       // { latest, days }
  // which bills the reports count: every bill, only settled ones, or only unsettled ones (kept for the next visit)
  const [settle, setSettleState] = useState(() => { try { const v = localStorage.getItem('dr_settle'); return ['settled', 'unsettled'].includes(v) ? v : 'all'; } catch { return 'all'; } });
  const setSettle = v => { setSettleState(v); try { localStorage.setItem('dr_settle', v); } catch { /* private mode */ } };
  // jump=true after an upload: show the newest uploaded day, unless the person picked their own dates
  const refresh = (jump = false) => api('/reports/dates').then(d => {
    setDates(d);
    setRange(r => (!r || (jump && r.preset !== 'custom') ? initial(d) : r));
  }).catch(() => setRange(r => r || presets(null).today));
  useEffect(() => { refresh(); }, []);
  return <Ctx.Provider value={{ range, setRange, dates, refresh, settle, setSettle }}>{children}</Ctx.Provider>;
}
export const useDates = () => useContext(Ctx);
/** "&settle=settled" for report calls ("" when every bill is shown). */
export const settleQ = settle => (settle === 'settled' || settle === 'unsettled' ? `&settle=${settle}` : '');
// stock counts goods in hand: every bill, or settled bills only ("unsettled" has no meaning there)
export const STOCK_CHOICES = [['all', 'All bills'], ['settled', 'Settled only']];
export const stockQ = settle => (settle === 'settled' ? '&settle=settled' : '');

const SETTLE = [['all', 'All bills'], ['settled', 'Settled'], ['unsettled', 'Unsettled']];
/**
 * Choose which bills the page counts. A bill is settled when it is in a Delivery Report Collection file that was uploaded.
 * `summary` also shows how many bills of the chosen dates are on each side.
 */
export function SettleFilter({ summary = true, note, choices = SETTLE }) {
  const { range, settle, setSettle } = useDates();
  const current = choices.some(([k]) => k === settle) ? settle : 'all';
  const [s, setS] = useState(null);
  useEffect(() => {
    if (!summary || !range) return undefined;
    let live = true;
    setS(null);
    api(`/reports/settlement?from=${range.from}&to=${range.to}`).then(d => live && setS(d)).catch(() => {});
    return () => { live = false; };
  }, [summary, range?.from, range?.to]);
  return (
    <div className="no-print settle-bar">
      <div className="datebar" role="group" aria-label="Which bills">
        <span className="small muted settle-label">Bills:</span>
        {choices.map(([k, l]) => <button key={k} className={'chip' + (current === k ? ' on' : '')} aria-pressed={current === k} onClick={() => setSettle(k)}>{l}</button>)}
      </div>
      {summary && s && (s.has_files ? (
        <div className="settle-sum small muted">
          Sales bills on these dates: <b>{num(s.sales.settled.bills)}</b> settled ({rupees(s.sales.settled.taxable)}) · <b>{num(s.sales.unsettled.bills)}</b> unsettled ({rupees(s.sales.unsettled.taxable)}).
          {' '}Settled = bills found in the Delivery Report Collection files you uploaded ({num(s.settled_bills)} bills{s.latest_load ? `, latest load ${date(s.latest_load)}` : ''}).{note ? <> {note}</> : null}
        </div>
      ) : (
        <div className="settle-sum small muted">No Delivery Report Collection has been uploaded yet, so every bill shows as unsettled. Upload it under <b>Upload files</b> to split the bills.</div>
      ))}
    </div>
  );
}

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

export default function DateBar({ hint, settle = true, settleNote }) {
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
      {settle && <SettleFilter note={settleNote} />}
    </div>
  );
}
