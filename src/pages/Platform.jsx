// Platform admin (for the people who run this software): every business, its space and use,
// subscription, renewals and payments, and pausing a portal.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import DataTable from '../components/DataTable.jsx';
import { Kpi, Card, Notice, Badge, ReportSkeleton } from '../components/ui.jsx';
import { inr, num, date, dateShort, dateTime, bytes } from '../format.js';
import { Icon } from '../components/Icons.jsx';

const PERIODS = [['monthly', 'Monthly'], ['quarterly', 'Every 3 months'], ['half_yearly', 'Every 6 months'], ['yearly', 'Yearly'], ['custom', 'Custom']];
const PER = { monthly: '/month', quarterly: '/3 months', half_yearly: '/6 months', yearly: '/year', custom: '' };
const STATE = {
  active: ['Active', 'good'], expiring: ['Ending soon', 'warn'], expired: ['Turned off: period over', 'bad'], overdue: ['Period over (still on)', 'warn'],
  paused: ['Paused', 'bad'], no_plan: ['No plan set', 'grey'],
};
const FILTERS = [['all', 'All'], ['active', 'Active'], ['expiring', 'Ending in 7 days'], ['expired', 'Turned off'], ['overdue', 'Overdue'], ['paused', 'Paused'], ['no_plan', 'No plan']];
const hours = m => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim() : `${m} min`);
const kb = b => (b ? bytes(b) : '0 KB');

export default function Platform() {
  const [s, setS] = useState({ loading: true });
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const load = () => api('/platform/orgs').then(data => setS({ data })).catch(e => setS({ error: e.message }));
  useEffect(() => { load(); }, []);
  const d = s.data;
  if (s.loading) return <><Head /><ReportSkeleton kpis={6} /></>;
  if (s.error) return <><Head /><Notice tone="bad">{s.error}</Notice></>;
  const T = d.totals;
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = d.orgs.filter(o => (filter === 'all' || o.state === filter) && words.every(w => `${o.name} ${o.plan_name || ''}`.toLowerCase().includes(w)));
  return (
    <>
      <Head />
      <div className="kpis k3">
        <Kpi tone="blue" label="Businesses" value={num(T.businesses)} sub={`${num(T.active)} working · ${num(T.paused)} paused · ${num(T.expired)} turned off`} />
        <Kpi label="Ending in 7 days" value={num(T.expiring)} sub="subscriptions to renew soon" />
        <Kpi label="Monthly revenue" value={inr(T.monthly_revenue, 0)} sub="from working businesses' plans, per month" />
        <Kpi label="Users" value={num(T.users)} sub="across all businesses" />
        <Kpi label="Database size" value={kb(T.db_bytes)} sub="whole database (Supabase)" />
        <Kpi label="File storage" value={kb(T.file_bytes)} sub="original files, compressed" />
      </div>
      <Card className="platform-orgs" title="Businesses" desc={<span className="no-print">Click a business to see its users, data and payments, change its plan, renew or pause it.</span>}>
        <div className="form-row no-print" style={{ marginBottom: 12 }}>
          <div className="datebar" role="group" aria-label="Show" style={{ flex: '1 1 100%' }}>
            {FILTERS.map(([k, l]) => <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}
              {k !== 'all' && <span className="muted"> {d.orgs.filter(o => o.state === k).length}</span>}</button>)}
          </div>
          <label className="field search-field"><span>Search</span>
            <input type="search" placeholder="Business or plan name" value={q} onChange={e => setQ(e.target.value)} /></label>
        </div>
        <DataTable stack="wide" fileName="Businesses" rows={list} empty="No business matches." rowKey={o => o.id}
          expand={o => <OrgPanel org={o} today={d.today} onChange={load} />}
          cols={[
            { key: 'name', label: 'Business', render: (v, o) => <>{v}<span className="sub">since {date(o.created_at)}</span></> },
            { key: 'state', label: 'Status', render: (v, o) => <><Badge tone={STATE[v][1]}>{STATE[v][0]}</Badge>{v === 'paused' && o.status_reason && <span className="sub">{o.status_reason}</span>}</>,
              excel: o => STATE[o.state][0] },
            { key: 'plan_price', label: 'Plan', num: 1, sortValue: o => Number(o.plan_price || 0), excel: o => o.plan_price,
              render: (v, o) => o.plan_name || v ? <>{o.plan_name || 'Plan'}<span className="sub nowrap">{v ? inr(v, 0) + (PER[o.billing_period] || '') : '—'}</span>{o.setup_fee ? <span className="sub nowrap">setup {inr(o.setup_fee, 0)}</span> : null}</> : '—' },
            { key: 'paid_until', label: 'Paid until', render: (v, o) => v ? <><span className="nowrap">{date(v)}</span>
              <span className="sub">{o.days_left < 0 ? `ended ${-o.days_left} day${o.days_left === -1 ? '' : 's'} ago` : o.days_left === 0 ? 'ends today' : `${o.days_left} days left`}</span></> : '—' },
            { key: 'users', label: 'Users', num: 1, render: (v, o) => <>{num(v)}<span className="sub nowrap">{o.used_30} active</span></> },
            { key: 'minutes_30', label: 'Use (30 days)', num: 1, excel: o => o.minutes_30,
              render: (v, o) => <><span className="nowrap">{hours(v)}</span><span className="sub nowrap">{o.days_used_30} day{o.days_used_30 === 1 ? '' : 's'}{o.last_seen ? ` · ${dateShort(String(o.last_seen).slice(0, 10))}` : ''}</span></> },
            { key: 'db_bytes', label: 'Data', num: 1, excel: o => o.db_bytes,
              render: (v, o) => <><span className="nowrap">{kb(v)}</span><span className="sub nowrap">files {kb(o.file_bytes)}</span><span className="sub nowrap">{num(o.uploads)} upload{o.uploads === 1 ? '' : 's'}</span></> },
          ]} />
      </Card>
    </>
  );
}

const Head = () => (
  <div className="page-head"><div className="grow"><h1>Platform admin</h1>
    <p className="muted">Every business using the software: how much space and time it uses, its subscription, and whether its portal is on.</p></div></div>
);

/** One business: plan, renew, payments, pause, users and data. */
function OrgPanel({ org, today, onChange }) {
  const [s, setS] = useState({ loading: true });
  const [msg, setMsg] = useState(null);
  const [f, setF] = useState(() => ({
    plan_name: org.plan_name || '', plan_price: org.plan_price ?? '', billing_period: org.billing_period || 'yearly', setup_fee: org.setup_fee ?? '',
    period_start: org.period_start || '', paid_until: org.paid_until || '', auto_off: org.auto_off !== false, billing_notes: '',
  }));
  const [renew, setRenew] = useState({ periods: 1, amount: '', paid_on: today, note: '' });
  const [pay, setPay] = useState({ kind: 'setup', amount: '', paid_on: today, note: '' });
  const [reason, setReason] = useState('');
  const load = () => api(`/platform/orgs/${org.id}`).then(data => setS({ data })).catch(e => setS({ error: e.message }));
  useEffect(() => { load(); }, [org.id]);
  const act = async (fn, ok) => {
    setMsg(null);
    try { const r = await fn(); setMsg({ tone: 'good', text: typeof ok === 'function' ? ok(r) : ok }); load(); onChange(); }
    catch (e) { setMsg({ tone: 'bad', text: e.message }); }
  };
  const set = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const d = s.data;
  return (
    <div className="detail-panel platform-panel">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="grid two">
        <section className="pp-box">
          <h3>Subscription</h3>
          <form onSubmit={e => { e.preventDefault(); act(() => api(`/platform/orgs/${org.id}`, { method: 'PATCH', body: f }), 'Plan saved.'); }}>
            <div className="inline-fields">
              <label className="field"><span>Plan name</span><input type="text" value={f.plan_name} onChange={set('plan_name')} placeholder="e.g. Standard" /></label>
              <label className="field"><span>Price per period (₹)</span><input type="text" inputMode="decimal" value={f.plan_price} onChange={set('plan_price')} placeholder="14999" /></label>
              <label className="field"><span>Billing period</span><select value={f.billing_period} onChange={set('billing_period')}>
                {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="field"><span>One-time setup fee (₹)</span><input type="text" inputMode="decimal" value={f.setup_fee} onChange={set('setup_fee')} placeholder="7500" /></label>
              <label className="field"><span>Period start</span><input type="date" value={f.period_start} onChange={set('period_start')} /></label>
              <label className="field"><span>Paid until</span><input type="date" value={f.paid_until} onChange={set('paid_until')} />
                <small>Leave empty for no end date.</small></label>
            </div>
            <label className="check" style={{ margin: '2px 0 12px' }}><input type="checkbox" checked={f.auto_off} onChange={set('auto_off')} />
              Turn the portal off automatically the day after "paid until"</label>
            <button className="btn primary">Save plan</button>
          </form>
        </section>
        <section className="pp-box">
          <h3>Renew</h3>
          <p className="small muted" style={{ marginTop: 0 }}>Extends "paid until" by whole periods
            {org.paid_until && org.paid_until >= today ? ` from ${date(org.paid_until)}` : ' from today'} and records the payment.</p>
          <form className="inline-fields" onSubmit={e => { e.preventDefault(); act(() => api(`/platform/orgs/${org.id}/renew`, { method: 'POST', body: renew }), r => `Renewed: paid until ${date(r.paid_until)}.`); }}>
            <label className="field"><span>Periods</span><input type="text" inputMode="numeric" value={renew.periods} onChange={e => setRenew({ ...renew, periods: e.target.value })} /></label>
            <label className="field"><span>Amount received (₹)</span><input type="text" inputMode="decimal" value={renew.amount} onChange={e => setRenew({ ...renew, amount: e.target.value })}
              placeholder={org.plan_price ? String(Number(org.plan_price) * (Number(renew.periods) || 1)) : ''} /></label>
            <label className="field"><span>Paid on</span><input type="date" value={renew.paid_on} onChange={e => setRenew({ ...renew, paid_on: e.target.value })} /></label>
            <label className="field"><span>Note</span><input type="text" value={renew.note} onChange={e => setRenew({ ...renew, note: e.target.value })} placeholder="UPI ref, cheque no." /></label>
            <div className="field" style={{ alignSelf: 'end' }}><button className="btn primary" disabled={!org.billing_period || org.billing_period === 'custom'}>Renew</button></div>
          </form>
          <h3 style={{ marginTop: 6 }}>Portal</h3>
          {org.state === 'paused' ? (
            <div className="form-row"><p className="small" style={{ margin: 0, flex: '1 1 240px' }}>Paused{org.status_reason ? `: ${org.status_reason}` : ''}. Its users see a "portal paused" screen with your contact number.</p>
              <button className="btn primary" onClick={() => act(() => api(`/platform/orgs/${org.id}/resume`, { method: 'POST' }), 'Portal turned back on.')}>Turn portal back on</button></div>
          ) : (
            <form className="form-row" onSubmit={e => { e.preventDefault(); if (window.confirm(`Pause the portal for ${org.name}?\n\nAll its users are stopped until you turn it back on. Their data is kept.`)) act(() => api(`/platform/orgs/${org.id}/pause`, { method: 'POST', body: { reason } }), 'Portal paused.'); }}>
              <label className="field"><span>Reason (shown to them)</span><input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. payment pending" /></label>
              <button className="btn danger">Pause portal</button>
            </form>
          )}
        </section>
      </div>
      {s.loading ? <span className="sk sk-row" style={{ width: '70%' }} /> : s.error ? <Notice tone="bad">{s.error}</Notice> : <>
        <h3 className="pp-h">Users ({d.users.length})</h3>
        <DataTable stack="wide" scroll={false} fileName={`${org.name} users`} rows={d.users} empty="No users."
          cols={[
            { key: 'name', label: 'Name', render: (v, u) => <>{v}<span className="sub">{u.email}</span></> },
            { key: 'role', label: 'Access', render: (v, u) => <>{v}{!u.active && <span className="sub">turned off</span>}</> },
            { key: 'last_login_at', label: 'Last login', render: v => v ? dateTime(v) : 'Never' },
            { key: 'last_seen_at', label: 'Last active', render: v => v ? dateTime(v) : '—' },
            { key: 'minutes_30', label: 'Time (30 days)', num: 1, render: (v, u) => <>{hours(v)}<span className="sub">{u.days_30} day{u.days_30 === 1 ? '' : 's'}</span></> },
            { key: 'minutes_all', label: 'Time (all)', num: 1, render: hours },
          ]} />
        <div className="grid two" style={{ marginTop: 12 }}>
          <div>
            <h3 className="pp-h">Data</h3>
            <DataTable scroll={false} exportable={false} fileName={`${org.name} data`} rows={d.data} footer={{ name: 'Total', rows: d.data.reduce((a, x) => a + x.rows, 0), bytes: d.data.reduce((a, x) => a + x.bytes, 0) }}
              cols={[{ key: 'name', label: 'What' }, { key: 'rows', label: 'Rows', num: 1, render: num }, { key: 'bytes', label: 'Size (about)', num: 1, render: kb }]} />
          </div>
          <div>
            <h3 className="pp-h">Payments</h3>
            <form className="inline-fields" onSubmit={e => { e.preventDefault(); act(() => api(`/platform/orgs/${org.id}/payments`, { method: 'POST', body: pay }), 'Payment recorded.'); }}>
              <label className="field"><span>Type</span><select value={pay.kind} onChange={e => setPay({ ...pay, kind: e.target.value })}>
                <option value="setup">Setup fee</option><option value="subscription">Subscription</option><option value="other">Other</option></select></label>
              <label className="field"><span>Amount (₹)</span><input type="text" inputMode="decimal" required value={pay.amount} onChange={e => setPay({ ...pay, amount: e.target.value })}
                placeholder={pay.kind === 'setup' && org.setup_fee ? String(Number(org.setup_fee)) : ''} /></label>
              <label className="field"><span>Paid on</span><input type="date" value={pay.paid_on} onChange={e => setPay({ ...pay, paid_on: e.target.value })} /></label>
              <div className="field" style={{ alignSelf: 'end' }}><button className="btn">Add payment</button></div>
            </form>
            <DataTable scroll={false} fileName={`${org.name} payments`} rows={d.payments} empty="No payments recorded yet."
              footer={{ paid_on: 'Total', amount: d.payments.reduce((a, p) => a + Number(p.amount), 0) }}
              cols={[
                { key: 'paid_on', label: 'Date', render: v => <span className="nowrap">{date(v)}</span> },
                { key: 'kind', label: 'For', render: (v, p) => <>{v === 'setup' ? 'Setup fee' : v === 'subscription' ? 'Subscription' : 'Other'}
                  {p.period_from && <span className="sub">{date(p.period_from)} – {date(p.period_to)}</span>}{p.note && <span className="sub">{p.note}</span>}</> },
                { key: 'amount', label: 'Amount', num: 1, render: v => inr(v) },
                { key: 'id', label: '', render: id => <button className="btn small danger icon-only" aria-label="Delete this payment record" title="Delete this payment record" onClick={() => window.confirm('Delete this payment record?') && act(() => api(`/platform/orgs/${org.id}/payments/${id}`, { method: 'DELETE' }), 'Payment record deleted.')}>{Icon.trash}</button>, excel: () => '' },
              ]} />
          </div>
        </div>
      </>}
    </div>
  );
}
