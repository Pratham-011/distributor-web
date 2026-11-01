import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth, can } from '../auth.jsx';
import { Card, Badge, Notice } from '../components/ui.jsx';
import { SupportInfo } from '../components/Support.jsx';
import { StateSelect } from '../states.jsx';
import { date, dateTime } from '../format.js';

const STATUS = { new: ['Sent', 'info'], in_progress: ['Being handled', 'warn'], done: ['Done', 'good'], rejected: ['Not possible', 'bad'] };
const KIND = { add_business: 'Add another business', add_user: 'Add more people', support: 'Help / support', bug: 'Report a problem', other: 'Something else' };

export default function Support() {
  const { user } = useAuth();
  const sub = user.subscription;
  const [list, setList] = useState(null);
  const load = () => api('/requests').then(d => setList(d.requests)).catch(() => setList([]));
  useEffect(() => { load(); }, [user.org_id]);
  return (
    <>
      <div className="page-head"><div className="grow"><h1>Help & support</h1><p className="muted">Call us, or send a request below and we will get back to you.</p></div></div>
      <Card title="Contact us"><SupportInfo /></Card>
      <RequestForm onSent={load} />
      {list && list.length > 0 && (
        <Card title="Your requests" desc="What you have sent us, and where it stands.">
          <ul className="request-list">
            {list.map(r => (
              <li key={r.id}>
                <div><b>{r.subject}</b> <Badge tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge></div>
                <small className="muted">{KIND[r.kind]} · {dateTime(r.created_at)}{r.requested_by ? ` · ${r.requested_by}` : ''}</small>
                {r.message && <p className="small" style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{r.message}</p>}
                {r.admin_note && <p className="small" style={{ margin: '4px 0 0' }}><b>Reply:</b> {r.admin_note}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {sub && (
        <Card title="Your plan" desc="Tell us your business name when you contact us.">
          <p style={{ margin: 0 }}>
            <b>{user.org_name}</b> · {sub.trial ? <Badge tone="info">Free trial</Badge> : <Badge tone="good">Subscription</Badge>}{' '}
            {sub.days_left < 0 ? <>ended on <b>{date(sub.paid_until)}</b></> : <>runs until <b>{date(sub.paid_until)}</b> ({sub.days_left} day{sub.days_left === 1 ? '' : 's'} left)</>}
          </p>
        </Card>
      )}
      <Card title="Before you contact us">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>A file will not upload? Tell us the file name and what the red message says.</li>
          <li>Cannot log in on a new device? Each person can use one device at a time. Log out on the old one, or ask your Owner to press <b>Sign out</b> next to your name in <b>Team &amp; access</b>.</li>
          <li>Need more people or another business? Send a request above.</li>
        </ul>
      </Card>
    </>
  );
}

/** One form for everything a customer can ask for. Sent to the support inbox and shown to the platform admin. */
function RequestForm({ onSent }) {
  const { user } = useAuth();
  const kinds = [
    ['support', 'Help / support'], ['bug', 'Report a problem'],
    ...(can(user, 'admin') ? [['add_user', 'Add more people']] : []),
    ...(user.role === 'owner' ? [['add_business', 'Add another business']] : []),
    ['other', 'Something else'],
  ];
  const blank = { kind: 'support', message: '', how_many: 1, business_name: '', state_code: '', login: 'same', owner_name: '', owner_email: '' };
  const [v, setV] = useState(blank);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = k => e => setV({ ...v, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setMsg(null); setBusy(true);
    const payload = v.kind === 'add_business'
      ? { business_name: v.business_name, state_code: v.state_code, login: v.login, owner_name: v.owner_name, owner_email: v.owner_email }
      : v.kind === 'add_user' ? { how_many: v.how_many } : {};
    try {
      const r = await api('/requests', { method: 'POST', body: { kind: v.kind, message: v.message, payload } });
      setMsg({ tone: 'good', text: r.emailed ? 'Request sent. We have emailed our team and will get back to you soon.' : 'Request saved. Our team can see it and will get back to you soon. You can also call us.' });
      setV(blank); onSent();
    } catch (x) { setMsg({ tone: 'bad', text: x.message }); } finally { setBusy(false); }
  }
  return (
    <Card title="Send a request" desc="Ask for another business, more people, help, or tell us about a problem.">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <form onSubmit={submit}>
        <div className="form-row">
          <label className="field"><span>What do you need?</span><select value={v.kind} onChange={set('kind')}>{kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {v.kind === 'add_user' && <label className="field" style={{ maxWidth: 150 }}><span>How many more people?</span><input type="number" min="1" max="100" required value={v.how_many} onChange={set('how_many')} /></label>}
        </div>
        {v.kind === 'add_business' && (
          <>
            <div className="form-row">
              <label className="field"><span>New business name</span><input type="text" required value={v.business_name} onChange={set('business_name')} /></label>
              <label className="field"><span>GST state</span><StateSelect required value={v.state_code} onChange={s => setV({ ...v, state_code: s })} /></label>
            </div>
            <fieldset className="choice">
              <legend>Who will use the new business?</legend>
              <label><input type="radio" name="login" checked={v.login === 'same'} onChange={() => setV({ ...v, login: 'same' })} /> <span><b>Me, with my current login</b><small>You switch between your businesses from the menu. One email and password for all of them.</small></span></label>
              <label><input type="radio" name="login" checked={v.login === 'new'} onChange={() => setV({ ...v, login: 'new' })} /> <span><b>A different person, with their own login</b><small>They become the Owner of the new business and cannot see your other businesses.</small></span></label>
            </fieldset>
            {v.login === 'new' && (
              <div className="form-row">
                <label className="field"><span>Their name</span><input type="text" required value={v.owner_name} onChange={set('owner_name')} /></label>
                <label className="field"><span>Their email</span><input type="email" required value={v.owner_email} onChange={set('owner_email')} /></label>
              </div>
            )}
          </>
        )}
        <label className="field"><span>{['add_business', 'add_user'].includes(v.kind) ? 'Anything else we should know (optional)' : 'Tell us what you need'}</span>
          <textarea rows="4" required={!['add_business', 'add_user'].includes(v.kind)} maxLength="4000" value={v.message} onChange={set('message')}
            placeholder={v.kind === 'bug' ? 'What did you do, what did you expect, and what happened instead? Include the file name if it is about an upload.' : ''} /></label>
        <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
      </form>
    </Card>
  );
}
