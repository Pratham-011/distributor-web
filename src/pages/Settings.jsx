import { useEffect, useState } from 'react';
import { api, download } from '../api.js';
import { useAuth, can, ROLES, ROLE_INFO } from '../auth.jsx';
import DataTable from '../components/DataTable.jsx';
import { Card, Notice, Loading, Badge, Empty } from '../components/ui.jsx';
import { useDates } from '../components/DateBar.jsx';
import { Icon } from '../components/Icons.jsx';
import { num, rangeLabel, dateTime, bytes } from '../format.js';
import { StateSelect, STATE_NAME } from '../states.jsx';

const TYPE_LABEL = { sales: 'Sales Register', purchase: 'Purchase Register', credit_note: 'Credit Note Register', debit_note: 'Debit Note Register', receipt: 'Receipt Book', outstanding: 'Outstanding Debtors', stock: 'Stock Statement', delivery: 'Delivery Report Collection' };

function useLoad(path) {
  const [s, set] = useState({ loading: true });
  const load = () => api(path).then(data => set({ data })).catch(e => set({ error: e.message }));
  useEffect(() => { load(); }, [path]);
  return [s, load];
}

// ------------------------------------------------------------------ Past uploads
export function History() {
  const { user } = useAuth();
  const { refresh } = useDates();
  const [s, load] = useLoad('/uploads');
  const [msg, setMsg] = useState(null);
  const [undoing, setUndoing] = useState(null);
  async function undo(u) {
    if (!window.confirm(`Undo the upload of "${u.file_name}"?\n\nIts data will be taken out of all reports. If it replaced an earlier upload for the same dates, that earlier data comes back.`)) return;
    setUndoing(u.id);
    try {
      const r = await api(`/uploads/${u.id}/undo`, { method: 'POST' });
      setMsg({ tone: 'good', text: r.restored.length ? `Upload undone. The data from ${r.restored.join(', ')} is back in the reports.` : 'Upload undone. Its data has been taken out of the reports.' });
      load(); refresh(true);
    } catch (e) { setMsg({ tone: 'bad', text: e.message }); } finally { setUndoing(null); }
  }
  async function remove(u) {
    const takesOut = u.status !== 'undone' ? '\n\nIts data will be taken out of all reports (and any earlier data it replaced comes back).' : '';
    if (!window.confirm(`Delete "${u.file_name}" for good?${takesOut}\n\nThe original file is removed from storage and cannot be downloaded again. This cannot be reversed.`)) return;
    setUndoing(u.id);
    try {
      const r = await api(`/uploads/${u.id}`, { method: 'DELETE' });
      setMsg({ tone: r.file_removed ? 'good' : 'warn', text: 'Upload deleted.' + (r.restored.length ? ` The data from ${r.restored.join(', ')} is back in the reports.` : '') +
        (r.file_removed ? ' The original file has been deleted from storage.' : ' The original file could not be deleted from storage right now; it will be tried again automatically.') });
      load(); refresh(true);
    } catch (e) { setMsg({ tone: 'bad', text: e.message }); } finally { setUndoing(null); }
  }
  const canUndo = r => r.status === 'active' && (can(user, 'admin') || r.uploaded_by_id === user.id);
  return (
    <>
      <div className="page-head"><div className="grow"><h1>Past uploads</h1><p className="muted">Every file ever uploaded. The original file is kept, so you can download it again any time. Uploaded the wrong file? Click <b>Undo</b> to take it out and bring back the data it replaced. <b>Delete</b> (Admins only) also removes the stored file for good.</p></div></div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {s.error && <Notice tone="bad">{s.error}</Notice>}
      {s.loading ? <Loading /> : s.data && (
        <Card>
          {!s.data.uploads.length ? <Empty title="Nothing uploaded yet" /> : (
            <DataTable stack="wide" fileName="Upload history" rows={s.data.uploads} cols={[
              { key: 'created_at', label: 'Uploaded', render: (v, r) => <><span className="nowrap">{dateTime(v)}</span><span className="sub">by {r.uploaded_by || '—'}</span></>, excel: r => dateTime(r.created_at) },
              { key: 'report_type', label: 'File', render: (v, r) => <>{TYPE_LABEL[v]}<span className="sub" style={{ overflowWrap: 'anywhere' }}>{r.file_name} · {bytes(r.stored_bytes)}</span></>, excel: r => TYPE_LABEL[r.report_type] },
              { key: 'period_from', label: 'For dates', render: (v, r) => v ? rangeLabel(v, r.period_to) : '—', excel: r => rangeLabel(r.period_from, r.period_to) },
              { key: 'row_count', label: 'Rows', num: 1, render: num },
              { key: 'status', label: 'Status', render: (v, r) => v === 'undone' ? <><Badge>Undone</Badge><span className="sub">{r.undone_by ? `by ${r.undone_by}, ` : ''}{dateTime(r.undone_at)}</span></>
                : v === 'replaced' ? <Badge>Replaced by newer</Badge>
                : <>{r.totals_ok ? <Badge tone="good">✓ Totals match</Badge> : <Badge tone="warn">Check</Badge>}{r.warnings > 0 && <span className="sub">{r.warnings} note(s)</span>}</> },
              { key: 'id', label: '', render: (_, r) => (
                <span className="row-actions">
                  <button className="btn small" onClick={() => download(`/uploads/${r.id}/download`, r.file_name).catch(e => setMsg({ tone: 'bad', text: e.message }))}>{Icon.download} File</button>
                  {canUndo(r) && <button className="btn small" disabled={!!undoing} onClick={() => undo(r)}>{Icon.undo} {undoing === r.id ? 'Working…' : 'Undo'}</button>}
                  {can(user, 'admin') && <button className="btn small danger" disabled={!!undoing} onClick={() => remove(r)} aria-label={`Delete ${r.file_name}`}>{Icon.trash} Delete</button>}
                </span>), excel: () => '' },
            ]} />
          )}
        </Card>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Saved file formats
export function Formats() {
  const { user } = useAuth();
  const [s, load] = useLoad('/templates');
  const [meta, setMeta] = useState(null);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api('/uploads/meta').then(setMeta); }, []);

  async function save() {
    try {
      await api('/templates/' + edit.id, { method: 'PATCH', body: { name: edit.name, mapping: edit.mapping, date_format: edit.date_format } });
      setEdit(null); setMsg({ tone: 'good', text: 'Saved. The next upload in this format will use these columns.' }); load();
    } catch (e) { setMsg({ tone: 'bad', text: e.message }); }
  }
  async function remove(t) {
    if (!window.confirm(`Forget the format "${t.name}"? Next time this file is uploaded you will be asked to match the columns again.`)) return;
    await api('/templates/' + t.id, { method: 'DELETE' }); load();
  }
  return (
    <>
      <div className="page-head"><div className="grow"><h1>Saved file formats</h1>
        <p className="muted">When you match columns for a file once, it is saved here. Files with the same columns are then recognised automatically. If your billing software changes its export, you will be asked to match the new columns.</p></div></div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {s.loading || !meta ? <Loading /> : s.error ? <Notice tone="bad">{s.error}</Notice> : !s.data.templates.length ? <Card><Empty title="No saved formats yet">Upload files once and the formats will appear here.</Empty></Card> : (
        s.data.templates.map(t => (
          <Card key={t.id} title={t.name} desc={`${TYPE_LABEL[t.report_type]} · used ${t.times_used} time(s) · last changed ${dateTime(t.updated_at)}${t.created_by ? ' by ' + t.created_by : ''}`}
            actions={edit?.id !== t.id && <span className="row-actions">
              <button className="btn small" onClick={() => setEdit(JSON.parse(JSON.stringify(t)))}>Change</button>
              {can(user, 'admin') && <button className="btn small danger" onClick={() => remove(t)}>Forget</button>}</span>}>
            {edit?.id === t.id ? (
              <>
                <label className="field" style={{ maxWidth: 420 }}><span>Name</span><input type="text" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></label>
                <div className="table-wrap"><table className="map-table"><thead><tr><th>We need</th><th>Column in the file</th></tr></thead><tbody>
                  {meta.fields[t.report_type].map(f => (
                    <tr key={f.key}><td>{f.label}{f.required && <span className="req">*</span>}</td><td>
                      <select value={edit.mapping[f.key] || ''} onChange={e => { const m = { ...edit.mapping }; if (e.target.value) m[f.key] = e.target.value; else delete m[f.key]; setEdit({ ...edit, mapping: m }); }}>
                        <option value="">— Not in this file —</option>{t.headers.map(h => <option key={h}>{h}</option>)}
                      </select></td></tr>))}
                </tbody></table></div>
                <div className="actions" style={{ marginTop: 14 }}><button className="btn primary" onClick={save}>Save changes</button><button className="btn" onClick={() => setEdit(null)}>Cancel</button></div>
              </>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>
                {meta.fields[t.report_type].filter(f => t.mapping[f.key]).map(f => `${f.label} ← “${t.mapping[f.key]}”`).join('  ·  ')}
              </p>
            )}
          </Card>
        ))
      )}
    </>
  );
}

// ------------------------------------------------------------------ Team
export function Team() {
  const { user } = useAuth();
  const [s, load] = useLoad('/users');
  const [inv, setInv] = useState({ email: '', role: 'viewer' });
  const [msg, setMsg] = useState(null);
  const assignable = ROLES.filter(r => user.role === 'owner' || !['admin', 'owner'].includes(r));
  const act = async (fn, ok) => { try { await fn(); setMsg({ tone: 'good', text: ok }); load(); } catch (e) { setMsg({ tone: 'bad', text: e.message }); } };

  return (
    <>
      <div className="page-head"><div className="grow"><h1>Team & access</h1><p className="muted">Add the people who work with you and choose what each person can do.</p></div></div>
      <Business />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {s.data?.seats && <Seats seats={s.data.seats} />}
      <Card title="Add a person" desc={s.data?.seats && s.data.seats.used >= s.data.seats.max
        ? `All ${s.data.seats.max} places are in use. Each extra person is ₹${s.data.seats.extra_price.toLocaleString('en-IN')} a year: ask your software provider to add more.`
        : 'They will create their own password using this email. A code is sent to confirm the email.'}>
        <form className="form-row" onSubmit={async e => {
          e.preventDefault();
          try {
            const r = await api('/users/invite', { method: 'POST', body: inv });
            setMsg({ tone: 'good', text: r.added_existing
              ? `${r.name} already uses Reportly, so they were added straight away. They will see this business in their business switcher after they log in.${r.emailed ? ' We emailed them.' : ''}`
              : r.emailed ? `${inv.email} added, and we emailed them how to join. They open the website, choose "Create an account" and use this email.`
                : `${inv.email} added. Ask them to open this website and choose "Create an account".` });
            setInv({ email: '', role: 'viewer' }); load();
          } catch (x) { setMsg({ tone: 'bad', text: x.message }); }
        }}>
          <label className="field"><span>Email</span><input type="email" required placeholder="name@example.com" value={inv.email} onChange={e => setInv({ ...inv, email: e.target.value })} /></label>
          <label className="field"><span>Access</span><select value={inv.role} onChange={e => setInv({ ...inv, role: e.target.value })}>
            {assignable.map(r => <option key={r} value={r}>{ROLE_INFO[r].label} — {ROLE_INFO[r].about}</option>)}</select></label>
          <button className="btn primary">Add person</button>
        </form>
      </Card>
      {s.loading ? <Loading /> : s.error ? <Notice tone="bad">{s.error}</Notice> : (
        <>
          <Card title="People">
            <DataTable stack exportable={false} rows={s.data.users} cols={[
              { key: 'name', label: 'Name', render: (v, r) => <>{v}{r.id === user.id && ' (you)'}<span className="sub">{r.email}</span></> },
              { key: 'role', label: 'Access', render: (v, r) => r.id === user.id || (v === 'owner' && user.role !== 'owner') ? <b>{ROLE_INFO[v].label}</b> : (
                <select style={{ minWidth: 130, minHeight: 34 }} value={v} aria-label={`Access for ${r.name}`} onChange={e => act(() => api('/users/' + r.id, { method: 'PATCH', body: { role: e.target.value } }), `${r.name} is now ${ROLE_INFO[e.target.value].label}.`)}>
                  {(assignable.includes(v) ? assignable : [v, ...assignable]).map(x => <option key={x} value={x}>{ROLE_INFO[x].label}</option>)}
                </select>) },
              { key: 'last_login_at', label: 'Last login', render: v => v ? dateTime(v) : 'Never' },
              { key: 'signed_in', label: 'Signed in', render: (v, r) => v
                ? <><Badge tone="good">Yes</Badge><span className="sub">{r.device}</span>
                  <button className="btn small" style={{ marginTop: 6 }} onClick={() => window.confirm(`Sign ${r.name} out of their device? They can then log in on another one.`) && act(() => api('/users/' + r.id + '/signout', { method: 'POST' }), `${r.name} was signed out.`)}>Sign out</button></>
                : <span className="muted">No</span>, excel: r => r.signed_in ? 'Yes' : 'No' },
              { key: 'active', label: 'Status', render: (v, r) => r.id === user.id ? <Badge tone="good">Active</Badge> : (
                <button className={'btn small' + (v ? ' danger' : '')} onClick={() => act(() => api('/users/' + r.id, { method: 'PATCH', body: { active: !v } }), v ? `${r.name} can no longer log in.` : `${r.name} can log in again.`)}>
                  {v ? 'Turn off' : 'Turn on'}</button>) },
            ]} />
          </Card>
          {s.data.invites.length > 0 && <Card title="Added, not yet signed up">
            <DataTable stack exportable={false} rows={s.data.invites} cols={[{ key: 'email', label: 'Email' }, { key: 'role', label: 'Access', render: v => ROLE_INFO[v].label },
              { key: 'created_at', label: 'Added', render: dateTime },
              { key: 'id', label: '', render: (id) => <button className="btn small danger" onClick={() => act(() => api('/users/invite/' + id, { method: 'DELETE' }), 'Removed.')}>Remove</button> }]} />
          </Card>}
          <Card title="What each access level can do">
            <table><tbody>{ROLES.map(r => <tr key={r}><td style={{ width: 160 }}><b>{ROLE_INFO[r].label}</b></td><td>{ROLE_INFO[r].about}</td></tr>)}</tbody></table>
          </Card>
        </>
      )}
    </>
  );
}

function Business() {
  const { user, setUser } = useAuth();
  const owner = user.role === 'owner';
  const p = user.profile || {};
  const saved = { name: user.org_name, state_code: user.state_code || '', address: p.address || '', gstin: p.gstin || '', phone: p.phone || '', contact_email: p.contact_email || '' };
  const [v, setV] = useState(saved);
  const [msg, setMsg] = useState(null);
  useEffect(() => { setV(saved); }, [user.org_id]);   // another business was opened
  const set = k => e => setV({ ...v, [k]: e.target.value });
  const changed = Object.keys(saved).some(k => v[k] !== saved[k]);
  async function save(e) {
    e.preventDefault();
    try { setUser((await api('/org', { method: 'PATCH', body: v })).user); setMsg({ tone: 'good', text: 'Business profile saved.' }); }
    catch (e) { setMsg({ tone: 'bad', text: e.message }); }
  }
  return (
    <Card title="Business profile" desc={owner ? 'The GST state is where your business is registered (first two digits of your GSTIN). It is used to check that out-of-state bills charge IGST.' : `GST state: ${STATE_NAME[user.state_code] || 'not set'}. Only the Owner can change these.`}>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {owner ? (
        <form onSubmit={save}>
          <div className="form-row">
            <label className="field"><span>Business name</span><input type="text" required value={v.name} onChange={set('name')} /></label>
            <label className="field"><span>GST state</span><StateSelect required value={v.state_code} onChange={s => setV({ ...v, state_code: s })} /></label>
            <label className="field"><span>GSTIN (optional)</span><input type="text" maxLength="15" placeholder="27ABCDE1234F1Z5" value={v.gstin} onChange={e => setV({ ...v, gstin: e.target.value.toUpperCase() })} /></label>
          </div>
          <div className="form-row">
            <label className="field"><span>Phone (optional)</span><input type="tel" value={v.phone} onChange={set('phone')} /></label>
            <label className="field"><span>Contact email (optional)</span><input type="email" value={v.contact_email} onChange={set('contact_email')} /></label>
          </div>
          <label className="field"><span>Address (optional)</span><textarea rows="2" maxLength="300" value={v.address} onChange={set('address')} /></label>
          <button className="btn primary" disabled={!changed}>Save</button>
        </form>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>{[p.gstin && `GSTIN ${p.gstin}`, p.phone, p.contact_email, p.address].filter(Boolean).join(' · ') || 'No other details added.'}</p>
      )}
    </Card>
  );
}

/** "3 of 3 places used": 1 Owner + 2 users are in every plan; each extra person is bought on top. */
function Seats({ seats }) {
  const full = seats.used >= seats.max;
  return (
    <Card title="People in your plan" desc={`Every plan has 1 Owner and ${seats.included - 1} users. Extra people are ₹${seats.extra_price.toLocaleString('en-IN')} each a year.`}>
      <div className="seat-meter" role="img" aria-label={`${seats.used} of ${seats.max} places used`}>
        {Array.from({ length: seats.max }, (_, i) => <span key={i} className={'seat' + (i < seats.used ? ' used' : '')} />)}
      </div>
      <p style={{ margin: '8px 0 0' }}><b>{seats.used} of {seats.max}</b> places used{seats.extra > 0 && <span className="muted"> · {seats.extra} extra bought</span>}.
        {full && <span style={{ color: 'var(--warn)' }}> All places are in use. To add more people, ask your software provider.</span>}</p>
      <p className="small muted" style={{ margin: '4px 0 0' }}>Each person can use one device at a time. If someone is signed in on a device they no longer have, use <b>Sign out</b> next to their name.</p>
    </Card>
  );
}

// ------------------------------------------------------------------ Activity log
const KINDS = [['', 'Everything'], ['upload', 'Uploads and downloads'], ['login', 'Logins'], ['team', 'Team changes'],
  ['format', 'Saved file formats'], ['business', 'Business details'], ['account', 'Sign-ups']];
const TAG = {
  upload: ['Upload', 'info'], login: ['Login', 'grey'], team: ['Team', 'warn'], format: ['File format', 'grey'],
  business: ['Business', 'warn'], account: ['Sign-up', 'good'],
  'login.failed': ['Failed login', 'bad'], 'login.blocked': ['Blocked: 2nd device', 'warn'], 'team.signed_out': ['Signed out', 'warn'], 'upload.undone': ['Undo', 'warn'], 'upload.deleted': ['Delete', 'bad'], 'upload.downloaded': ['Download', 'grey'],
};
const tagOf = action => TAG[action] || TAG[action.split('.')[0]] || [action, 'grey'];

export function Activity() {
  const [people] = useLoad('/users');
  const [filter, setFilter] = useState({ user: '', kind: '' });
  const [s, setS] = useState({ loading: true, entries: [] });
  const path = before => '/activity?' + new URLSearchParams(Object.entries({ ...filter, before: before || '' }).filter(([, v]) => v));

  useEffect(() => {
    let live = true;
    setS({ loading: true, entries: [] });
    api(path()).then(d => live && setS({ entries: d.entries, more: d.more })).catch(e => live && setS({ entries: [], error: e.message }));
    return () => { live = false; };
  }, [filter.user, filter.kind]);

  function loadMore() {
    setS(x => ({ ...x, loadingMore: true }));
    api(path(s.entries.at(-1).id))
      .then(d => setS(x => ({ entries: [...x.entries, ...d.entries], more: d.more })))
      .catch(e => setS(x => ({ ...x, loadingMore: false, error: e.message })));
  }

  return (
    <>
      <div className="page-head"><div className="grow"><h1>Activity log</h1>
        <p className="muted">Everything done in this account: logins, uploads, undos, downloads, team and setting changes. Newest first.</p></div></div>
      <Card>
        <div className="form-row" style={{ marginBottom: 14 }}>
          <label className="field"><span>Person</span>
            <select value={filter.user} onChange={e => setFilter({ ...filter, user: e.target.value })}>
              <option value="">Everyone</option>
              {people.data?.users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select></label>
          <label className="field"><span>What</span>
            <select value={filter.kind} onChange={e => setFilter({ ...filter, kind: e.target.value })}>
              {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
        </div>
        {s.error && <Notice tone="bad">{s.error}</Notice>}
        {s.loading ? <Loading /> : (
          <>
            <DataTable stack fileName="Activity log" rows={s.entries} empty="Nothing recorded yet." cols={[
              { key: 'created_at', label: 'When', render: dateTime, excel: r => dateTime(r.created_at) },
              { key: 'user_name', label: 'Who', render: v => v || '—' },
              { key: 'action', label: 'Type', render: v => { const [l, tone] = tagOf(v); return <Badge tone={tone}>{l}</Badge>; }, excel: r => tagOf(r.action)[0] },
              { key: 'message', label: 'What happened' },
            ]} />
            {s.more && <div style={{ marginTop: 12 }}><button className="btn" disabled={s.loadingMore} onClick={loadMore}>{s.loadingMore ? 'Loading…' : 'Show older'}</button></div>}
          </>
        )}
      </Card>
    </>
  );
}
