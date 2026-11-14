// Platform admin (for the people who run this software): every business with its space, people, time online and
// activity; subscriptions, seats and linked companies; money (payments, expenses, profit); pricing rules.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import DataTable from '../components/DataTable.jsx';
import { Kpi, Card, Notice, Badge, Bars, Columns, ReportSkeleton } from '../components/ui.jsx';
import { inr, num, date, dateShort, dateTime, bytes } from '../format.js';
import { Icon } from '../components/Icons.jsx';
import { StateSelect, STATE_NAME } from '../states.jsx';

const PERIODS = [['monthly', 'Monthly'], ['quarterly', 'Every 3 months'], ['half_yearly', 'Every 6 months'], ['yearly', 'Annual (1 year)'], ['custom', 'Custom']];
const PER = { monthly: '/month', quarterly: '/3 months', half_yearly: '/6 months', yearly: '/year', custom: '' };
const STATE = {
  active: ['Active', 'good'], trial: ['Trial', 'info'], expiring: ['Ending soon', 'warn'], expired: ['Turned off: period over', 'bad'], overdue: ['Period over (still on)', 'warn'],
  paused: ['Paused', 'bad'], no_plan: ['No plan set', 'grey'],
};
const FILTERS = [['all', 'All'], ['active', 'Active'], ['trial', 'Trial'], ['expiring', 'Ending in 7 days'], ['expired', 'Turned off'], ['overdue', 'Overdue'], ['paused', 'Paused'], ['no_plan', 'No plan']];
const KIND = { setup: 'Setup fee', subscription: 'Subscription', extra_user: 'Extra users', extra_company: 'Extra company', other: 'Other' };
const CATS = { hosting: 'Hosting', database: 'Database', domain: 'Domain', email: 'Email', support: 'Support', marketing: 'Marketing', tools: 'Tools', salary: 'Salary', other: 'Other' };
const hours = m => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim() : `${m} min`);
const kb = b => (b ? bytes(b) : '0 KB');
const monthName = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
const ACT_TONE = a => (a.startsWith('login.failed') || a === 'login.blocked' ? 'bad' : a.startsWith('upload') ? 'info' : a.startsWith('team') || a.startsWith('business') ? 'warn' : a.startsWith('account') ? 'good' : 'grey');
const Dot = ({ on }) => <i className={'dot' + (on ? ' on' : '')} title={on ? 'Online now' : 'Not online'} />;

// whole months per period; "custom" has no automatic end date
const MONTHS_OF = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 };
/** Last day of a period that starts on `start`: one year from 1 Nov 2026 ends on 31 Oct 2027. */
function endOf(start, months) {
  const [y, m, d] = start.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return new Date(t.getTime() - 86400000).toISOString().slice(0, 10);
}

const TABS = [['orgs', 'Businesses'], ['requests', 'Requests'], ['money', 'Money'], ['activity', 'Activity'], ['pricing', 'Pricing']];

export default function Platform() {
  const [tab, setTab] = useState('orgs');
  const [open, setOpen] = useState(0);          // requests nobody has handled yet
  useEffect(() => { api('/platform/requests').then(d => setOpen(d.counts.new || 0)).catch(() => {}); }, [tab]);
  return (
    <>
      <div className="page-head"><div className="grow"><h1>Platform admin</h1>
        <p className="muted">Everyone using the software: space, people, time online and activity, subscriptions, money and prices.</p></div></div>
      <div className="datebar" role="tablist" aria-label="Platform admin sections" style={{ marginBottom: 16 }}>
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}{k === 'requests' && open > 0 && <span className="count"> {open}</span>}</button>)}
      </div>
      {tab === 'orgs' && <Businesses />}
      {tab === 'requests' && <Requests onChange={() => api('/platform/requests').then(d => setOpen(d.counts.new || 0)).catch(() => {})} />}
      {tab === 'money' && <Money />}
      {tab === 'activity' && <Card title="Latest activity in every business" desc="Logins, uploads, team changes and more, newest first."><ActivityFeed path="/platform/activity" showOrg /></Card>}
      {tab === 'pricing' && <Pricing />}
    </>
  );
}

// ------------------------------------------------------------------ businesses
function Businesses() {
  const [s, setS] = useState({ loading: true });
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const load = () => api('/platform/orgs').then(data => setS({ data })).catch(e => setS({ error: e.message }));
  useEffect(() => { load(); }, []);
  const d = s.data;
  if (s.loading) return <ReportSkeleton kpis={6} />;
  if (s.error) return <Notice tone="bad">{s.error}</Notice>;
  const T = d.totals;
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = d.orgs.filter(o => (filter === 'all' || o.state === filter) && words.every(w => `${o.name} ${o.plan_name || ''}`.toLowerCase().includes(w)));
  return (
    <>
      <div className="kpis k3">
        <Kpi tone="blue" label="Businesses" value={num(T.businesses)} sub={`${num(T.active)} working (${num(T.trial)} on trial) · ${num(T.paused)} paused · ${num(T.expired)} turned off`} />
        <Kpi label="Online now" value={num(T.online)} sub="people active in the last 5 minutes" />
        <Kpi label="Ending in 7 days" value={num(T.expiring)} sub="subscriptions to renew soon" />
        <Kpi label="Monthly revenue" value={inr(T.monthly_revenue, 0)} sub="plans of working businesses, per month" />
        <Kpi label="Users" value={num(T.users)} sub="across all businesses" />
        <Kpi label="Space used" value={kb(T.db_bytes)} sub={`rows of all businesses (sum of the Data column) + indexes, accounts and system ${kb(T.db_other_bytes)} = whole database ${kb(T.db_total_bytes)} · uploaded files ${kb(T.file_bytes)}`} />
      </div>
      <Card className="platform-orgs" title="Businesses" desc={<span className="no-print">Click a business to see its people, activity, data and payments, change its plan, add users, renew or pause it.</span>}>
        <div className="form-row no-print" style={{ marginBottom: 12 }}>
          <div className="datebar" role="group" aria-label="Show" style={{ flex: '1 1 100%' }}>
            {FILTERS.map(([k, l]) => <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}
              {k !== 'all' && <span className="muted"> {d.orgs.filter(o => o.state === k).length}</span>}</button>)}
          </div>
          <label className="field search-field"><span>Search</span>
            <input type="search" placeholder="Business or plan name" value={q} onChange={e => setQ(e.target.value)} /></label>
        </div>
        <DataTable stack="wide" fileName="Businesses" rows={list} empty="No business matches." rowKey={o => o.id}
          expand={o => <OrgPanel org={o} orgs={d.orgs} settings={d.settings} today={d.today} onChange={load} />}
          cols={[
            { key: 'name', label: 'Business', render: (v, o) => <>{v}<span className="sub">{o.parent_name ? `extra company of ${o.parent_name}` : `since ${date(o.created_at)}`}</span></>, excel: o => o.name },
            { key: 'state', label: 'Status', render: (v, o) => <><Badge tone={STATE[v][1]}>{STATE[v][0]}</Badge>{v === 'paused' && o.status_reason && <span className="sub">{o.status_reason}</span>}</>, excel: o => STATE[o.state][0] },
            { key: 'plan_price', label: 'Plan', num: 1, sortValue: o => Number(o.plan_price || 0), excel: o => o.plan_price,
              render: (v, o) => o.plan_name || v ? <>{o.plan_name || 'Plan'}<span className="sub nowrap">{v ? inr(v, 0) + (PER[o.billing_period] || '') : '—'}</span>{o.setup_fee ? <span className="sub nowrap">setup {inr(o.setup_fee, 0)}</span> : null}</> : '—' },
            { key: 'paid_until', label: 'Paid until', render: (v, o) => v ? <><span className="nowrap">{date(v)}</span>
              <span className="sub">{o.days_left < 0 ? `ended ${-o.days_left} day${o.days_left === -1 ? '' : 's'} ago` : o.days_left === 0 ? 'ends today' : `${o.days_left} days left`}</span></> : '—' },
            { key: 'seats_used', label: 'People', num: 1, excel: o => `${o.seats_used}/${o.seats_max}`,
              render: (v, o) => <><span className="nowrap"><Dot on={o.online > 0} />{v} of {o.seats_max}</span><span className="sub nowrap">{o.online} online · {o.used_30} active</span></> },
            { key: 'minutes_30', label: 'Use (30 days)', num: 1, excel: o => o.minutes_30,
              render: (v, o) => <><span className="nowrap">{hours(v)}</span><span className="sub nowrap">{o.days_used_30} day{o.days_used_30 === 1 ? '' : 's'}{o.last_seen ? ` · ${dateShort(String(o.last_seen).slice(0, 10))}` : ''}</span></> },
            { key: 'db_bytes', label: 'Data', num: 1, excel: o => o.db_bytes,
              render: (v, o) => <><span className="nowrap">{kb(v)}</span><span className="sub nowrap">files {kb(o.file_bytes)}</span><span className="sub nowrap">{num(o.uploads)} upload{o.uploads === 1 ? '' : 's'}</span></> },
          ]} />
      </Card>
    </>
  );
}

/** One business: plan, seats, companies, renew, pause, people, activity, sign-ins, data and payments. */
function OrgPanel({ org, orgs, settings, today, onChange }) {
  const [s, setS] = useState({ loading: true });
  const [msg, setMsg] = useState(null);
  const [f, setF] = useState(() => ({
    plan_name: org.plan_name || '', plan_price: org.plan_price ?? '', billing_period: org.billing_period || 'yearly', setup_fee: org.setup_fee ?? '',
    period_start: org.period_start || '', paid_until: org.paid_until || '', auto_off: org.auto_off !== false, extra_users: org.extra_users ?? 0,
  }));
  const [renew, setRenew] = useState({ periods: 1, amount: '', paid_on: today, note: '' });
  const [pay, setPay] = useState({ kind: 'setup', amount: '', paid_on: today, note: '' });
  const [seats, setSeats] = useState({ add: 1, amount: '' });
  const [child, setChild] = useState('');
  const [reason, setReason] = useState('');
  const [more, setMore] = useState('');
  const load = () => api(`/platform/orgs/${org.id}`).then(data => setS({ data })).catch(e => setS({ error: e.message }));
  useEffect(() => { load(); }, [org.id]);
  const act = async (fn, ok) => {
    setMsg(null);
    try { const r = await fn(); setMsg({ tone: 'good', text: typeof ok === 'function' ? ok(r) : ok }); load(); onChange(); }
    catch (e) { setMsg({ tone: 'bad', text: e.message }); }
  };
  const set = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  // choosing a period or a start date sets "paid until" by itself (you can still change it by hand)
  const plan = patch => setF(cur => {
    const n = { ...cur, ...patch };
    if (!n.period_start && MONTHS_OF[n.billing_period]) n.period_start = today;
    if (n.period_start && MONTHS_OF[n.billing_period]) n.paid_until = endOf(n.period_start, MONTHS_OF[n.billing_period]);
    return n;
  });
  // changes that happen on the server (renew, more days) must also update the form, or "Save plan" would put the old date back
  const extend = days => act(async () => {
    const r = await api(`/platform/orgs/${org.id}/extend`, { method: 'POST', body: { days } });
    setF(c => ({ ...c, paid_until: r.paid_until })); setMore('');
    return r;
  }, r => `${days} days added: now ends on ${date(r.paid_until)}.`);
  const d = s.data;
  const candidates = orgs.filter(o => o.id !== org.id && !o.parent_org_id && !org.parent_org_id);
  const seatPrice = settings.extra_user_price;
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
              <label className="field"><span>Billing period</span><select value={f.billing_period} onChange={e => plan({ billing_period: e.target.value })}>
                {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="field"><span>One-time setup fee (₹)</span><input type="text" inputMode="decimal" value={f.setup_fee} onChange={set('setup_fee')} placeholder="7500" /></label>
              <label className="field"><span>Period start</span><input type="date" value={f.period_start} onChange={e => plan({ period_start: e.target.value })} /></label>
              <label className="field"><span>Paid until</span><input type="date" value={f.paid_until} onChange={set('paid_until')} /><small>{MONTHS_OF[f.billing_period] ? 'Set automatically from the period and start date. You can change it.' : 'Leave empty for no end date.'}</small></label>
            </div>
            <label className="check" style={{ margin: '2px 0 12px' }}><input type="checkbox" checked={f.auto_off} onChange={set('auto_off')} />
              Turn the portal off automatically the day after "paid until"</label>
            <button className="btn primary">Save plan</button>
          </form>
          <h3 style={{ marginTop: 16 }}>{org.trial ? 'Extend the free trial' : 'Give more days'}</h3>
          <p className="small muted" style={{ marginTop: 0 }}>Adds days {org.paid_until && org.paid_until >= today ? `after ${date(org.paid_until)}` : 'from today'}. No payment is recorded.</p>
          <div className="form-row">
            {[7, 15, 30].map(n => <button key={n} type="button" className="btn small" onClick={() => extend(n)}>+{n} days</button>)}
            <label className="field" style={{ maxWidth: 110, flex: '0 1 110px' }}><span>Other</span><input type="text" inputMode="numeric" value={more} onChange={e => setMore(e.target.value)} placeholder="days" /></label>
            <button type="button" className="btn small" disabled={!(Number(more) >= 1)} onClick={() => extend(Number(more))}>Add</button>
          </div>
        </section>
        <section className="pp-box">
          <h3>Renew</h3>
          <p className="small muted" style={{ marginTop: 0 }}>Extends "paid until" by whole periods{org.paid_until && org.paid_until >= today ? ` from ${date(org.paid_until)}` : ' from today'} and records the payment.</p>
          <form className="inline-fields" onSubmit={e => { e.preventDefault(); act(async () => { const r = await api(`/platform/orgs/${org.id}/renew`, { method: 'POST', body: renew }); setF(c => ({ ...c, paid_until: r.paid_until, period_start: c.period_start || r.period_from })); return r; }, r => `Renewed: paid until ${date(r.paid_until)}.`); }}>
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
          <DeleteBusiness org={org} linked={d?.linked || []} onDone={onChange} />
        </section>
      </div>

      <div className="grid two" style={{ marginTop: 12 }}>
        <section className="pp-box">
          <h3>People: {org.seats_used} of {org.seats_max} places used</h3>
          <p className="small muted" style={{ marginTop: 0 }}>Plan: 1 Owner + {settings.included_users} users{org.extra_users ? ` + ${org.extra_users} extra` : ''}. Each extra person is ₹{num(seatPrice)}.</p>
          <form className="inline-fields" onSubmit={e => { e.preventDefault(); act(() => api(`/platform/orgs/${org.id}/seats`, { method: 'POST', body: seats }), r => `Added. This business now has ${r.extra_users} extra user${r.extra_users === 1 ? '' : 's'}.`); }}>
            <label className="field"><span>Add extra users</span><input type="text" inputMode="numeric" value={seats.add} onChange={e => setSeats({ ...seats, add: e.target.value })} /></label>
            <label className="field"><span>Amount received (₹)</span><input type="text" inputMode="decimal" value={seats.amount} onChange={e => setSeats({ ...seats, amount: e.target.value })} placeholder={String(seatPrice * (Number(seats.add) || 1))} /></label>
            <div className="field" style={{ alignSelf: 'end' }}><button className="btn primary">Add and record payment</button></div>
          </form>
        </section>
        <section className="pp-box">
          <h3>Companies</h3>
          {org.parent_org_id ? <p className="small" style={{ margin: 0 }}>This is an extra company of <b>{org.parent_name}</b>. Billing is on the main company.</p> : <>
            <p className="small muted" style={{ marginTop: 0 }}>A second company has its own login and its own data. Link it here to bill it with this customer (₹{num(settings.extra_company_price)} each).</p>
            {d?.linked?.length > 0 && <ul className="small" style={{ margin: '0 0 8px', paddingLeft: 18 }}>{d.linked.map(c => (
              <li key={c.id}>{c.name} <button className="btn link" onClick={() => window.confirm(`Unlink ${c.name}?`) && act(() => api(`/platform/orgs/${org.id}/link-company/${c.id}`, { method: 'DELETE' }), 'Unlinked.')}>unlink</button></li>))}</ul>}
            <form className="form-row" onSubmit={e => { e.preventDefault(); act(() => api(`/platform/orgs/${org.id}/link-company`, { method: 'POST', body: { child_id: child } }), 'Company linked and ₹' + num(settings.extra_company_price) + ' recorded.'); setChild(''); }}>
              <label className="field"><span>Link another company</span><select value={child} onChange={e => setChild(e.target.value)} required>
                <option value="" disabled>Choose a business…</option>{candidates.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
              <button className="btn" disabled={!child}>Link and record payment</button>
            </form></>}
          <NewCompany org={org} settings={settings} d={d} act={act} />
        </section>
      </div>

      {s.loading ? <span className="sk sk-row" style={{ width: '70%' }} /> : s.error ? <Notice tone="bad">{s.error}</Notice> : <>
        <h3 className="pp-h">People ({d.users.length})</h3>
        <DataTable stack="wide" scroll={false} fileName={`${org.name} people`} rows={d.users} empty="No users."
          cols={[
            { key: 'name', label: 'Name', render: (v, u) => <><Dot on={u.online} />{v}<span className="sub">{u.email}</span></>, excel: u => u.name },
            { key: 'role', label: 'Access', render: (v, u) => <>{v}{!u.active && <span className="sub">turned off</span>}</> },
            { key: 'signed_in', label: 'Signed in', render: (v, u) => v ? <>{u.online ? 'Online now' : 'Yes'}<span className="sub">{u.device}</span></> : <span className="muted">No</span>, excel: u => (u.signed_in ? u.device : 'No') },
            { key: 'last_seen_at', label: 'Last active', render: v => v ? dateTime(v) : '—' },
            { key: 'minutes_30', label: 'Time (30 days)', num: 1, render: (v, u) => <>{hours(v)}<span className="sub">{u.days_30} day{u.days_30 === 1 ? '' : 's'}</span></> },
            { key: 'minutes_all', label: 'Time (all)', num: 1, render: hours },
            { key: 'id', label: '', excel: () => '', render: (id, u) => u.signed_in
              ? <button className="btn small" onClick={() => window.confirm(`Sign ${u.name} out of their device?`) && act(() => api(`/platform/orgs/${org.id}/users/${id}/signout`, { method: 'POST' }), `${u.name} was signed out.`)}>Sign out</button> : null },
          ]} />

        {d.daily.length > 1 && <>
          <h3 className="pp-h">Time online, last 30 days</h3>
          <Columns items={d.daily.map(x => ({ ...x, label: dateShort(x.day) }))} value="minutes" label="label" fmt={m => hours(Number(m))}
            tipText={x => `${date(x.day)}: ${hours(x.minutes)} · ${x.users} person${x.users === 1 ? '' : 's'}`} />
        </>}

        <h3 className="pp-h">Activity</h3>
        <ActivityFeed path={`/platform/orgs/${org.id}/activity`} people={d.users} />

        <h3 className="pp-h">Sign-ins</h3>
        <DataTable stack="wide" fileName={`${org.name} sign-ins`} rows={d.sessions} empty="No sign-ins yet."
          cols={[
            { key: 'created_at', label: 'Signed in', render: v => <span className="nowrap">{dateTime(v)}</span>, excel: s => dateTime(s.created_at) },
            { key: 'name', label: 'Person', render: (v, x) => <>{v}<span className="sub">{x.email}</span></>, excel: x => x.name },
            { key: 'device', label: 'Device' }, { key: 'ip', label: 'IP address', render: v => v || '—' },
            { key: 'last_seen_at', label: 'Last seen', render: v => <span className="nowrap">{dateTime(v)}</span>, excel: s => dateTime(s.last_seen_at) },
            { key: 'revoked_at', label: 'Ended', render: (v, x) => v ? <>{dateTime(v)}<span className="sub">{{ logout: 'logged out', other_device: 'other device', admin: 'signed out by admin', password: 'password changed', access_off: 'access turned off', expired: 'expired' }[x.revoked_why] || x.revoked_why}</span></> : <Badge tone="good">Active</Badge>, excel: x => x.revoked_at ? dateTime(x.revoked_at) : 'Active' },
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
                {Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="field"><span>Amount (₹)</span><input type="text" inputMode="decimal" required value={pay.amount} onChange={e => setPay({ ...pay, amount: e.target.value })}
                placeholder={pay.kind === 'setup' && org.setup_fee ? String(Number(org.setup_fee)) : ''} /></label>
              <label className="field"><span>Paid on</span><input type="date" value={pay.paid_on} onChange={e => setPay({ ...pay, paid_on: e.target.value })} /></label>
              <div className="field" style={{ alignSelf: 'end' }}><button className="btn">Add payment</button></div>
            </form>
            <DataTable scroll={false} fileName={`${org.name} payments`} rows={d.payments} empty="No payments recorded yet."
              footer={{ paid_on: 'Total', amount: d.payments.reduce((a, p) => a + Number(p.amount), 0) }}
              cols={[
                { key: 'paid_on', label: 'Date', render: v => <span className="nowrap">{date(v)}</span> },
                { key: 'kind', label: 'For', render: (v, p) => <>{KIND[v] || v}{p.period_from && <span className="sub">{date(p.period_from)} – {date(p.period_to)}</span>}{p.note && <span className="sub">{p.note}</span>}</>, excel: p => KIND[p.kind] },
                { key: 'amount', label: 'Amount', num: 1, render: v => inr(v) },
                { key: 'id', label: '', render: id => <button className="btn small danger icon-only" aria-label="Delete this payment record" title="Delete this payment record" onClick={() => window.confirm('Delete this payment record?') && act(() => api(`/platform/orgs/${org.id}/payments/${id}`, { method: 'DELETE' }), 'Payment record deleted.')}>{Icon.trash}</button>, excel: () => '' },
              ]} />
          </div>
        </div>
      </>}
    </div>
  );
}

/** Activity list (one business, or all of them): filter by kind or person, "Show older" for more. */
function ActivityFeed({ path, showOrg, people }) {
  const [kind, setKind] = useState('');
  const [user, setUser] = useState('');
  const [s, setS] = useState({ loading: true, entries: [] });
  const url = before => path + '?' + new URLSearchParams(Object.entries({ kind, user, before: before || '' }).filter(([, v]) => v));
  useEffect(() => {
    let live = true;
    setS({ loading: true, entries: [] });
    api(url()).then(d => live && setS({ entries: d.entries, more: d.more })).catch(e => live && setS({ entries: [], error: e.message }));
    return () => { live = false; };
  }, [path, kind, user]);
  const older = () => api(url(s.entries.at(-1).id)).then(d => setS(x => ({ entries: [...x.entries, ...d.entries], more: d.more }))).catch(e => setS(x => ({ ...x, error: e.message })));
  return (
    <>
      <div className="form-row no-print" style={{ marginBottom: 10 }}>
        <label className="field"><span>What</span><select value={kind} onChange={e => setKind(e.target.value)}>
          {[['', 'Everything'], ['login', 'Logins'], ['upload', 'Uploads'], ['team', 'Team changes'], ['business', 'Business changes'], ['format', 'File formats'], ['account', 'Sign-ups']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        {people && <label className="field"><span>Person</span><select value={user} onChange={e => setUser(e.target.value)}>
          <option value="">Everyone</option>{people.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}
      </div>
      {s.error && <Notice tone="bad">{s.error}</Notice>}
      {s.loading ? <span className="sk sk-row" style={{ width: '70%' }} /> : (
        <>
          <DataTable stack="wide" fileName="Activity" rows={s.entries} empty="Nothing recorded yet."
            cols={[
              { key: 'created_at', label: 'When', render: v => <span className="nowrap">{dateTime(v)}</span>, excel: e => dateTime(e.created_at) },
              ...(showOrg ? [{ key: 'org_name', label: 'Business' }] : []),
              { key: 'user_name', label: 'Who', render: v => v || '—' },
              { key: 'action', label: 'Type', render: v => <Badge tone={ACT_TONE(v)}>{v.split('.')[0]}</Badge>, excel: e => e.action },
              { key: 'message', label: 'What happened', render: (v, e) => <>{v}{e.ip && <span className="sub">from {e.ip}</span>}</>, excel: e => e.message },
            ]} />
          {s.more && <div style={{ marginTop: 10 }}><button className="btn small" onClick={older}>Show older</button></div>}
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------ money
function Money() {
  const [months, setMonths] = useState(12);
  const [s, setS] = useState({ loading: true });
  const [x, setX] = useState({ loading: true });
  const [f, setF] = useState({ spent_on: new Date().toLocaleDateString('en-CA'), category: 'hosting', vendor: '', amount: '', repeat: '', ends_on: '', note: '' });
  const [msg, setMsg] = useState(null);
  const load = () => {
    api(`/platform/finance?months=${months}`).then(data => setS({ data })).catch(e => setS({ error: e.message }));
    api('/platform/expenses').then(data => setX({ data })).catch(e => setX({ error: e.message }));
  };
  useEffect(() => { load(); }, [months]);
  const d = s.data;
  const add = async e => {
    e.preventDefault(); setMsg(null);
    try { await api('/platform/expenses', { method: 'POST', body: f }); setMsg({ tone: 'good', text: 'Expense added.' }); setF({ ...f, amount: '', vendor: '', note: '' }); load(); }
    catch (err) { setMsg({ tone: 'bad', text: err.message }); }
  };
  if (s.loading && !d) return <ReportSkeleton kpis={3} />;
  if (s.error) return <Notice tone="bad">{s.error}</Notice>;
  const T = d.totals;
  return (
    <>
      <div className="form-row no-print" style={{ marginBottom: 12 }}>
        <label className="field"><span>Show the last</span><select value={months} onChange={e => setMonths(Number(e.target.value))}>
          {[3, 6, 12, 24].map(m => <option key={m} value={m}>{m} months</option>)}</select></label>
      </div>
      <div className="kpis k3">
        <Kpi tone="blue" label="Money received" value={inr(T.revenue, 0)} sub={Object.entries(T.by_kind).map(([k, v]) => `${KIND[k] || k} ${inr(v, 0)}`).join(' · ') || 'No payments recorded yet'} />
        <Kpi label="Expenses" value={inr(T.expenses, 0)} sub={Object.entries(T.by_category).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${CATS[k] || k} ${inr(v, 0)}`).join(' · ') || 'No expenses recorded yet'} />
        <Kpi label="Profit" value={inr(T.profit, 0)} sub={T.revenue ? `${Math.round(T.profit / T.revenue * 100)}% of money received` : 'Add payments and expenses'} />
      </div>
      <Card title="Month by month" desc="Money received (payments you recorded) against expenses. Cash basis: each amount counts in the month it was paid.">
        <DataTable fileName="Profit by month" rows={[...d.months].reverse()} scroll={false}
          footer={{ month: 'Total', revenue: T.revenue, expenses: T.expenses, profit: T.profit }}
          cols={[
            { key: 'month', label: 'Month', render: monthName, excel: r => r.month },
            { key: 'revenue', label: 'Received', num: 1, render: v => inr(v, 0) },
            { key: 'expenses', label: 'Expenses', num: 1, render: v => inr(v, 0) },
            { key: 'profit', label: 'Profit', num: 1, render: v => <b style={{ color: v < 0 ? 'var(--bad)' : 'var(--good)' }}>{inr(v, 0)}</b> },
          ]} />
      </Card>
      <div className="grid two" style={{ marginTop: 14 }}>
        <Card title="Where the money went"><Bars items={Object.entries(T.by_category).map(([k, v]) => ({ name: CATS[k] || k, v })).sort((a, b) => b.v - a.v)} value="v" fmt={v => inr(v, 0)} /></Card>
        <Card title="Biggest customers"><Bars items={d.top_customers.map(c => ({ name: c.name, v: c.revenue }))} value="v" fmt={v => inr(v, 0)} /></Card>
      </div>
      <AllPayments />
      <Card title="Expenses" desc="Hosting, database, domain, email, support and so on. A monthly expense counts every month until its end date." className="expenses-card">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <form className="inline-fields" onSubmit={add}>
          <label className="field"><span>Date</span><input type="date" required value={f.spent_on} onChange={e => setF({ ...f, spent_on: e.target.value })} /></label>
          <label className="field"><span>Category</span><select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{Object.entries(CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="field"><span>Paid to</span><input type="text" value={f.vendor} onChange={e => setF({ ...f, vendor: e.target.value })} placeholder="Render, Supabase…" /></label>
          <label className="field"><span>Amount (₹)</span><input type="text" inputMode="decimal" required value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></label>
          <label className="field"><span>How often</span><select value={f.repeat} onChange={e => setF({ ...f, repeat: e.target.value })}><option value="">Once</option><option value="monthly">Every month</option></select></label>
          {f.repeat && <label className="field"><span>Until (optional)</span><input type="date" value={f.ends_on} onChange={e => setF({ ...f, ends_on: e.target.value })} /></label>}
          <label className="field"><span>Note</span><input type="text" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></label>
          <div className="field" style={{ alignSelf: 'end' }}><button className="btn primary">Add expense</button></div>
        </form>
        {x.data && <DataTable stack="wide" fileName="Expenses" rows={x.data.expenses} empty="No expenses yet."
          cols={[
            { key: 'spent_on', label: 'Date', render: v => <span className="nowrap">{date(v)}</span>, excel: e => e.spent_on },
            { key: 'category', label: 'Category', render: v => CATS[v] || v, excel: e => CATS[e.category] },
            { key: 'vendor', label: 'Paid to', render: (v, e) => <>{v || '—'}{e.note && <span className="sub">{e.note}</span>}</> },
            { key: 'repeat', label: 'How often', render: (v, e) => v ? <>Every month<span className="sub">{e.ends_on ? `until ${date(e.ends_on)}` : 'ongoing'}</span></> : 'Once', excel: e => e.repeat ? 'Monthly' : 'Once' },
            { key: 'amount', label: 'Amount', num: 1, render: v => inr(v) },
            { key: 'id', label: '', excel: () => '', render: id => <button className="btn small danger icon-only" aria-label="Delete this expense" title="Delete this expense" onClick={async () => { if (window.confirm('Delete this expense?')) { await api('/platform/expenses/' + id, { method: 'DELETE' }); load(); } }}>{Icon.trash}</button> },
          ]} />}
      </Card>
    </>
  );
}

/** Every payment from every business: the revenue side of the books. */
function AllPayments() {
  const [s, setS] = useState({ loading: true });
  const [kind, setKind] = useState('');
  useEffect(() => { api('/platform/payments').then(d => setS({ list: d.payments })).catch(e => setS({ error: e.message })); }, []);
  if (s.error) return <Notice tone="bad">{s.error}</Notice>;
  if (!s.list) return null;
  const rows = s.list.filter(p => !kind || p.kind === kind);
  const total = rows.reduce((a, p) => a + Number(p.amount), 0);
  return (
    <Card title="Money received" desc="Every payment you recorded, from every business. Record payments in a business's panel (Renew, Add extra users, Payments)." className="payments-card">
      <div className="datebar no-print" role="group" aria-label="Show" style={{ marginBottom: 10 }}>
        {[['', 'All'], ...Object.entries(KIND)].map(([k, l]) => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      <DataTable stack="wide" fileName="Payments received" rows={rows} empty="No payments recorded yet." footer={{ paid_on: 'Total', amount: total }}
        cols={[
          { key: 'paid_on', label: 'Date', render: v => <span className="nowrap">{date(v)}</span>, excel: p => p.paid_on },
          { key: 'org_name', label: 'Business' },
          { key: 'kind', label: 'For', render: (v, p) => <>{KIND[v] || v}{p.period_from && <span className="sub">{date(p.period_from)} – {date(p.period_to)}</span>}{p.note && <span className="sub">{p.note}</span>}</>, excel: p => KIND[p.kind] },
          { key: 'amount', label: 'Amount', num: 1, render: v => inr(v) },
        ]} />
    </Card>
  );
}

// ------------------------------------------------------------------ pricing rules
function Pricing() {
  const [s, setS] = useState({ loading: true });
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api('/platform/settings').then(d => { setS({ data: d }); setF(d.settings); }).catch(e => setS({ error: e.message })); }, []);
  if (s.error) return <Notice tone="bad">{s.error}</Notice>;
  if (!f) return <ReportSkeleton kpis={3} />;
  const save = async e => {
    e.preventDefault(); setMsg(null);
    try { const r = await api('/platform/settings', { method: 'PUT', body: f }); setF(r.settings); setMsg({ tone: 'good', text: 'Pricing rules saved. They apply from now on.' }); }
    catch (err) { setMsg({ tone: 'bad', text: err.message }); }
  };
  const set = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <Card title="Pricing rules" desc="What every plan includes and what extras cost. Changing these does not change what customers have already paid.">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <form className="inline-fields" onSubmit={save}>
        <label className="field"><span>Users included (besides the Owner)</span><input type="text" inputMode="numeric" value={f.included_users} onChange={set('included_users')} />
          <small>Today: 1 Owner + {f.included_users} users = {1 + Number(f.included_users || 0)} people in every plan.</small></label>
        <label className="field"><span>Each extra user (₹ a year)</span><input type="text" inputMode="decimal" value={f.extra_user_price} onChange={set('extra_user_price')} /></label>
        <label className="field"><span>Each extra company (₹ a year)</span><input type="text" inputMode="decimal" value={f.extra_company_price} onChange={set('extra_company_price')} /></label>
        <div className="field" style={{ alignSelf: 'end' }}><button className="btn primary">Save</button></div>
      </form>
      <p className="small muted" style={{ marginBottom: 0 }}>These amounts are filled in for you when you add extra users or link a company, and you can still change them each time. A business cannot add people beyond its places until you add them here.</p>
    </Card>
  );
}

// ------------------------------------------------------------------ deleting a business
/** Deletes the business and everything it has, after the admin types its name. Cannot be undone. */
function DeleteBusiness({ org, linked, onDone }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [withKids, setWithKids] = useState(false);
  const [state, setState] = useState({});
  if (org.id === user.org_id) return null;     // your own business can't be deleted from here
  async function go(e) {
    e.preventDefault();
    const also = withKids && linked.length ? ` and its extra companies (${linked.map(c => c.name).join(', ')})` : '';
    if (!window.confirm(`Delete "${org.name}"${also} for good?\n\nThis cannot be undone.`)) return;
    setState({ busy: true });
    try {
      const r = await api(`/platform/orgs/${org.id}`, { method: 'DELETE', body: { confirm: name, with_companies: withKids } });
      setState({ done: `Deleted "${r.deleted.name}"${r.companies_deleted.length ? ` and ${r.companies_deleted.join(', ')}` : ''}: ${r.deleted.users} people, ${r.deleted.uploads} uploads and all their data.` });
      onDone();
    } catch (x) { setState({ error: x.message }); }
  }
  return (
    <div className="danger-zone">
      <h3 style={{ marginTop: 14 }}>Delete this business</h3>
      {state.done && <Notice tone="good">{state.done}</Notice>}
      {!open ? (
        <button type="button" className="btn danger small" onClick={() => setOpen(true)}>Delete business and all its data…</button>
      ) : (
        <form onSubmit={go}>
          <p className="small" style={{ marginTop: 0 }}>This removes <b>everything</b> of {org.name} from the database and storage: its people and their logins, every upload and its original file, all report data, saved formats, payments, requests and its activity log. It <b>cannot be undone</b>. To keep the data, pause the portal instead.</p>
          {linked.length > 0 && (
            <label className="check" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={withKids} onChange={e => setWithKids(e.target.checked)} />
              <span>Also delete its extra companies: <b>{linked.map(c => c.name).join(', ')}</b>. If not ticked, they stay as businesses of their own.</span>
            </label>
          )}
          {state.error && <Notice tone="bad">{state.error}</Notice>}
          <div className="form-row">
            <label className="field"><span>Type the business name to confirm: <b>{org.name}</b></span>
              <input type="text" value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label>
            <div className="field" style={{ alignSelf: 'end', flexDirection: 'row', gap: 8, display: 'flex' }}>
              <button className="btn danger" disabled={name.trim() !== org.name.trim() || state.busy}>{state.busy ? 'Deleting…' : 'Delete for good'}</button>
              <button type="button" className="btn" onClick={() => { setOpen(false); setName(''); setState({}); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ another business for a customer
/** Creates a new business billed with this customer; its Owner is the same login or a new person. */
function NewCompany({ org, settings, d, act }) {
  const owners = (d?.users || []).filter(u => u.role === 'owner' && u.active);
  const blank = { name: '', state_code: '', login: 'same', from_user_id: '', owner_name: '', owner_email: '', amount: '' };
  const [v, setV] = useState(blank);
  const set = k => e => setV({ ...v, [k]: e.target.value });
  const go = e => {
    e.preventDefault();
    act(async () => { const r = await api(`/platform/orgs/${org.id}/new-company`, { method: 'POST', body: { ...v, from_user_id: v.from_user_id || owners[0]?.id } }); setV(blank); return r; },
      r => r.needs_signup ? `Business created. ${r.owner} must open the website and choose "Create an account" with that email to become its Owner.` : `Business created. ${r.owner} can open it from the business switcher.`);
  };
  return (
    <details style={{ marginTop: 12 }}>
      <summary><b>Create a new business for this customer</b></summary>
      <form onSubmit={go} style={{ marginTop: 8 }}>
        <div className="form-row">
          <label className="field"><span>Business name</span><input type="text" required value={v.name} onChange={set('name')} /></label>
          <label className="field"><span>GST state</span><StateSelect required value={v.state_code} onChange={s => setV({ ...v, state_code: s })} /></label>
        </div>
        <div className="form-row">
          <label className="field"><span>Owner of the new business</span><select value={v.login} onChange={set('login')}>
            <option value="same">An existing person here (same login, switch between businesses)</option>
            <option value="new">A different person (their own login)</option></select></label>
          {v.login === 'same' && owners.length > 1 && <label className="field"><span>Which owner</span><select value={v.from_user_id || owners[0].id} onChange={set('from_user_id')}>
            {owners.map(o => <option key={o.id} value={o.id}>{o.name} ({o.email})</option>)}</select></label>}
          {v.login === 'new' && <label className="field"><span>Their email</span><input type="email" required value={v.owner_email} onChange={set('owner_email')} /></label>}
          <label className="field"><span>Charge (₹)</span><input type="text" inputMode="decimal" value={v.amount} onChange={set('amount')} placeholder={String(settings.extra_company_price)} /></label>
        </div>
        <button className="btn primary">Create business and record payment</button>
      </form>
    </details>
  );
}

// ------------------------------------------------------------------ requests
const R_STATUS = { new: ['New', 'bad'], in_progress: ['In progress', 'warn'], done: ['Done', 'good'], rejected: ['Declined', 'grey'] };
const R_FILTERS = [['', 'All'], ['new', 'New'], ['in_progress', 'In progress'], ['done', 'Done'], ['rejected', 'Declined']];

function Requests({ onChange }) {
  const [status, setStatus] = useState('new');
  const [s, setS] = useState({ loading: true });
  const [msg, setMsg] = useState(null);
  const load = () => api('/platform/requests' + (status ? `?status=${status}` : '')).then(data => setS({ data })).catch(e => setS({ error: e.message }));
  useEffect(() => { load(); }, [status]);
  const run = async (fn, ok) => { setMsg(null); try { await fn(); setMsg({ tone: 'good', text: ok }); load(); onChange(); } catch (e) { setMsg({ tone: 'bad', text: e.message }); } };
  if (s.error) return <Notice tone="bad">{s.error}</Notice>;
  const c = s.data?.counts || {};
  return (
    <Card title="Requests from customers" desc="Everything customers ask for. Each one is also emailed to your support inbox.">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="datebar" role="group" aria-label="Show" style={{ marginBottom: 10 }}>
        {R_FILTERS.map(([k, l]) => <button key={k} className={'chip' + (status === k ? ' on' : '')} onClick={() => setStatus(k)}>{l}{k && c[k] ? <span className="muted"> {c[k]}</span> : null}</button>)}
      </div>
      {!s.data ? <ReportSkeleton /> : s.data.requests.length === 0 ? <p className="muted">Nothing here.</p> : (
        <ul className="request-list">
          {s.data.requests.map(r => <RequestRow key={r.id} r={r} kinds={s.data.kinds} run={run} />)}
        </ul>
      )}
    </Card>
  );
}

function RequestRow({ r, kinds, run }) {
  const [note, setNote] = useState(r.admin_note || '');
  const p = r.payload || {};
  const setStatus = (status, ok) => run(() => api(`/platform/requests/${r.id}`, { method: 'PATCH', body: { status, admin_note: note } }), ok);
  const createBusiness = () => window.confirm(`Create "${p.business_name}" for ${r.org_name}? The extra-company charge will be recorded.`) && run(
    () => api(`/platform/orgs/${r.org_id}/new-company`, { method: 'POST', body: { name: p.business_name, state_code: p.state_code, login: p.login, owner_name: p.owner_name, owner_email: p.owner_email, from_user_id: r.requested_user_id, request_id: r.id } }),
    p.login === 'new' ? `Business created. ${p.owner_email} must create an account with that email to become its Owner.` : 'Business created. The Owner can open it from the business switcher.');
  return (
    <li>
      <div><b>{r.subject}</b> <Badge tone={R_STATUS[r.status][1]}>{R_STATUS[r.status][0]}</Badge>{!r.emailed && <Badge tone="grey">not emailed</Badge>}</div>
      <small className="muted">{kinds[r.kind]} · {r.org_name} · {r.requested_by || 'unknown'}{r.requested_email ? ` <${r.requested_email}>` : ''}{r.org_phone ? ` · ${r.org_phone}` : ''} · {dateTime(r.created_at)}</small>
      {r.kind === 'add_business' && <p className="small" style={{ margin: '4px 0 0' }}>New business <b>{p.business_name}</b> ({STATE_NAME[p.state_code] || p.state_code}) · {p.login === 'new' ? <>new login: <b>{p.owner_name}</b> {p.owner_email}</> : 'same login as the requester'}</p>}
      {r.kind === 'add_user' && <p className="small" style={{ margin: '4px 0 0' }}>Wants <b>{p.how_many}</b> more {p.how_many === 1 ? 'person' : 'people'}. Add them in this business's panel under Businesses.</p>}
      {r.message && <p className="small" style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{r.message}</p>}
      <div className="form-row" style={{ marginTop: 8 }}>
        <label className="field"><span>Reply shown to the customer (optional)</span><input type="text" maxLength="1000" value={note} onChange={e => setNote(e.target.value)} /></label>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {r.kind === 'add_business' && ['new', 'in_progress'].includes(r.status) && <button className="btn primary small" onClick={createBusiness}>Create this business</button>}
        {r.status !== 'in_progress' && <button className="btn small" onClick={() => setStatus('in_progress', 'Marked as in progress.')}>In progress</button>}
        {r.status !== 'done' && <button className="btn small" onClick={() => setStatus('done', 'Marked as done.')}>Done</button>}
        {r.status !== 'rejected' && <button className="btn small danger" onClick={() => setStatus('rejected', 'Declined.')}>Decline</button>}
        {r.status !== 'new' && <button className="btn small" onClick={() => setStatus('new', 'Reopened.')}>Reopen</button>}
        <button className="btn small" onClick={() => setStatus(null, 'Reply saved.')}>Save reply</button>
      </div>
    </li>
  );
}
