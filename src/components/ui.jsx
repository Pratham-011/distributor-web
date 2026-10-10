import { useEffect, useRef, useState } from 'react';
import { short, inr } from '../format.js';
import { Icon } from './Icons.jsx';

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
