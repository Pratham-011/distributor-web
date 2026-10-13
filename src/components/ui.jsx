import { useEffect, useRef, useState } from 'react';
import { short, inr, dateTime } from '../format.js';
import { Icon } from './Icons.jsx';
import { useAuth } from '../auth.jsx';
import { STATE_NAME } from '../states.jsx';

/** Letterhead for printed reports: hidden on screen, at the top of the first printed page. */
export function PrintHeader({ title, sub, period }) {
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const stamp = () => setNow(new Date());
    window.addEventListener('beforeprint', stamp);
    return () => window.removeEventListener('beforeprint', stamp);
  }, []);
  return (
    <header className="print-head">
      <div className="ph-top">
        <div>
          <div className="ph-org">{user.org_name}</div>
          {user.state_code && <div className="ph-meta">{STATE_NAME[user.state_code]} · GST state code {user.state_code}</div>}
        </div>
        <div className="ph-right">
          <div className="ph-title">{title}</div>
          {period && <div className="ph-period">{period}</div>}
        </div>
      </div>
      <div className="ph-sub"><span>{sub}</span><span>Printed {dateTime(now)} by {user.name}</span></div>
    </header>
  );
}

/** Opens the print dialog with a file name that says what it is (used when saving as PDF). */
export function printReport(name) {
  const old = document.title;
  document.title = name.replace(/[\\/:*?"<>|]+/g, '-');
  window.print();
  document.title = old;
}

/** Password input with a button to show or hide what was typed. */
export function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input {...props} type={show ? 'text' : 'password'} />
      <button type="button" className="eye" onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} title={show ? 'Hide password' : 'Show password'}>
        {show ? Icon.eyeOff : Icon.eye}
      </button>
    </div>
  );
}

export function Kpi({ label, value, sub, tone, title }) {
  return (
    <div className={'kpi' + (tone ? ' ' + tone : '')} title={title}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Card({ title, desc, actions, children, className = '' }) {
  return (
    <section className={'card ' + className}>
      {(title || actions) && (
        <div className="card-head">
          <div className="grow">{title && <h2>{title}</h2>}{desc && <p>{desc}</p>}</div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const ICO = { info: 'i', good: '✓', warn: '!', bad: '✕' };
export function Notice({ tone = 'info', children }) {
  return <div className={'notice ' + tone} role={tone === 'bad' ? 'alert' : undefined}><span className="ico">{ICO[tone]}</span><div>{children}</div></div>;
}

export const Badge = ({ tone = 'grey', children }) => <span className={'badge ' + tone}>{children}</span>;
export const Loading = ({ text = 'Loading…' }) => <div className="loading"><span className="spinner" />{text}</div>;
/** Grey placeholder shaped like a report (KPI tiles + cards), shown while new dates load. */
export function ReportSkeleton({ kpis = 4, cards = 2, rows = 5 }) {
  const widths = [92, 76, 84, 64, 72, 88, 58];
  return (
    <div className="skeleton" aria-busy="true" role="status">
      <span className="visually-hidden">Loading the report…</span>
      <div className="kpis">
        {Array.from({ length: kpis }, (_, i) => (
          <div className="kpi" key={i}><span className="sk sk-line" style={{ width: '55%' }} /><span className="sk sk-num" /><span className="sk sk-line" style={{ width: '72%' }} /></div>
        ))}
      </div>
      <div className="grid two">
        {Array.from({ length: cards }, (_, i) => (
          <div className="card" key={i}>
            <span className="sk sk-title" />
            {Array.from({ length: rows }, (_, k) => <span key={k} className="sk sk-row" style={{ width: widths[(k + i) % widths.length] + '%' }} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Empty({ title, children }) {
  return <div className="empty"><h3>{title}</h3>{children}</div>;
}

/* Floating tooltip shared by charts */
export function useTip() {
  const [tip, setTip] = useState(null);
  const el = tip && <div className="tip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 290), top: tip.y + 18 }}>{tip.text}</div>;
  const bind = text => ({
    onMouseMove: e => setTip({ x: e.clientX, y: e.clientY, text }),
    onMouseLeave: () => setTip(null),
  });
  return [el, bind];
}

/** Horizontal bars: magnitude by category, one colour. */
export function Bars({ items, value = 'taxable', label = 'name', fmt = short, tipText, limit }) {
  const [tip, bind] = useTip();
  const list = limit ? items.slice(0, limit) : items;
  const max = Math.max(...list.map(i => Number(i[value]) || 0), 1);
  if (!list.length) return <p className="muted">Nothing to show for these dates.</p>;
  return (
    <div className="bars">
      {list.map((i, k) => (
        <div className="bar-row" key={k} {...bind(tipText ? tipText(i) : `${i[label]}: ${inr(i[value])}`)}>
          <span className="name" title={i[label]}>{i[label]}</span>
          <span className="track"><span className="fill" style={{ width: Math.max(Number(i[value]) / max * 100, 0.5) + '%' }} /></span>
          <span className="val">{fmt(i[value])}</span>
        </div>
      ))}
      {tip}
    </div>
  );
}

/** Vertical columns (ageing buckets, day-by-day). `shades` gives an ordinal ramp. */
export function Columns({ items, value, label, fmt = short, tipText, shades }) {
  const [tip, bind] = useTip();
  const max = Math.max(...items.map(i => Number(i[value]) || 0), 1);
  const style = { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` };
  const many = items.length > 12;
  return (
    <div>
      <div className="cols" style={style}>
        {items.map((i, k) => (
          <div className="col" key={k} {...bind(tipText ? tipText(i) : `${i[label]}: ${inr(i[value])}`)}>
            {!many && <span className="v">{fmt(i[value])}</span>}
            <span className="b" style={{ height: (Number(i[value]) / max * 100) + '%', background: shades ? shades[k] : undefined }} />
          </div>
        ))}
      </div>
      <div className="cols-labels" style={style}>
        {items.map((i, k) => <span key={k}>{many && k % Math.ceil(items.length / 10) ? '' : i[label]}</span>)}
      </div>
      {tip}
    </div>
  );
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  const t = useRef();
  useEffect(() => { clearTimeout(t.current); t.current = setTimeout(() => setV(value), ms); return () => clearTimeout(t.current); }, [value, ms]);
  return v;
}
