import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, sendForm, watchJob, newJobId } from '../api.js';
import { Icon } from '../components/Icons.jsx';
import { Badge, Notice, Loading } from '../components/ui.jsx';
import { useDates } from '../components/DateBar.jsx';
import { useAuth, can } from '../auth.jsx';
import { inr, num, rangeLabel, dateTime, bytes } from '../format.js';

const DATE_FORMATS = [
  { v: 'DMY', label: 'Day / Month / Year  (31/12/2026)' },
  { v: 'MDY', label: 'Month / Day / Year  (12/31/2026)' },
  { v: 'YMD', label: 'Year - Month - Day  (2026-12-31)' },
];

function Steps({ step }) {
  const s = ['Choose files', 'Check', 'Done'];
  const i = { choose: 0, check: 1, done: 2 }[step];
  return (
    <div className="steps">
      {s.map((t, k) => <div key={t} className={'step' + (k === i ? ' on' : '') + (k < i ? ' done' : '')}><span className="n">{k < i ? '✓' : k + 1}</span>{t}</div>)}
    </div>
  );
}

let nextId = 0;             // each file in the list gets its own id, so removing one never mixes up the others

function tooBigMessage(size, maxMb) {
  return `This file is too big: ${(size / 1048576).toFixed(1)} MB. Each file can be at most ${maxMb} MB. ` +
    'Export a shorter date range from your billing software, or save it as .xlsx (usually much smaller than .xls or .csv), then add it again.';
}

/** "File 2 of 5", a bar for all files and a bar for this file: uploading %, waiting in line, or reading. */
function ProgressPanel({ p, saving }) {
  const done = p.n - 1;
  const fileLabel = p.phase === 'upload' ? `Uploading… ${p.pct}%`
    : p.phase === 'sent' ? 'Sent. Waiting for the server…'
    : p.phase === 'waiting' ? `Waiting in line: ${p.ahead} file${p.ahead === 1 ? '' : 's'} ahead of yours`
      : saving ? 'Saving the rows into your reports…' : 'Reading and checking the file…';
  return (
    <div className={'progress-panel' + (p.phase === 'waiting' ? ' waiting' : '')} role="status" aria-live="polite">
      <div className="pp-top">
        <b>{saving ? 'Saving' : 'Reading'} file {p.n} of {p.of}</b>
        <span className="muted small pp-name">{p.name}</span>
      </div>
      <Bar value={p.phase === 'upload' ? p.pct : null} label={fileLabel} />
      <p className="small" style={{ margin: '6px 0 0' }}>{fileLabel}</p>
      {p.phase === 'waiting' && <p className="small muted" style={{ margin: '2px 0 0' }}>The server reads one file at a time so it never runs out of memory. Yours starts by itself: keep this page open.</p>}
      {p.of > 1 && <>
        <Bar value={Math.round((done / p.of) * 100)} label="All files" thin />
        <p className="small muted" style={{ margin: '4px 0 0' }}>{done} of {p.of} files done</p>
      </>}
    </div>
  );
}
// value 0..100, or null for "working, how long is unknown"
const Bar = ({ value, label, thin }) => (
  <div className={'bar-track' + (thin ? ' thin' : '') + (value == null ? ' busy' : '')} role="progressbar" aria-label={label}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined}>
    <span style={value == null ? undefined : { width: value + '%' }} />
  </div>
);

function fileState(f) {
  if (f.error) return 'error';
  if (!f.report_type) return 'attention';
  if (f.check?.errors) return 'error';
  if (f.needs_mapping) return 'attention';
  return 'ready';
}

export default function Upload() {
  const [meta, setMeta] = useState(null);
  const [step, setStep] = useState('choose');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [over, setOver] = useState(false);
  const [reading, setReading] = useState(null);   // { n, of, name, phase, pct, ahead } while files are being read
  const [saving, setSaving] = useState(null);     // same, while files are being saved
  const [q, setQ] = useState('');
  const input = useRef();
  const { refresh } = useDates();
  const { user } = useAuth();

  useEffect(() => { api('/uploads/meta').then(setMeta).catch(e => setErr(e.message)); }, []);
  // everything removed: back to choosing files
  useEffect(() => { if (step === 'check' && !files.length && !busy) setStep('choose'); }, [step, files.length, busy]);

  const add = list => setFiles(fs => [...fs, ...list.map(f => ({ uid: ++nextId, save_template: true, template_name: f.template?.name || '',
    open: !!f.error || !f.report_type || !!f.check?.errors, ...f }))]);

  // Where a job is on the server, for the progress panel: waiting in line (how many ahead) or being read.
  const follow = (job, set) => watchJob(job, st => set(p => (p && p.job === job && p.phase !== 'upload'
    ? { ...p, phase: st.state === 'waiting' ? 'waiting' : st.state === 'reading' ? 'reading' : p.phase, ahead: st.ahead } : p)));

  // Files are sent one at a time: a big file can't hold up or break the others.
  async function choose(list) {
    if (!list?.length) return;
    const all = [...list], maxMb = meta.max_file_mb || 25;
    setErr(''); setBusy(true); setStep('check');
    add(all.filter(f => f.size > maxMb * 1048576).map(f => ({ file_name: f.name, size: f.size, error: tooBigMessage(f.size, maxMb) })));
    const fine = all.filter(f => f.size <= maxMb * 1048576);
    for (let k = 0; k < fine.length; k++) {
      const file = fine[k], job = newJobId();
      setReading({ job, n: k + 1, of: fine.length, name: file.name, phase: 'upload', pct: 0 });
      const stop = follow(job, setReading);
      const form = new FormData();
      form.append('files', file);
      try {
        const r = await sendForm('/uploads/preview', form, { jobId: job,
          onUpload: pct => setReading(p => (p?.job === job ? { ...p, pct, phase: pct < 100 ? 'upload' : p.phase === 'upload' ? 'sent' : p.phase } : p)) });
        add(r.files);
      } catch (e) {
        add([{ file_name: file.name, size: file.size, error: e.status === 413 ? tooBigMessage(file.size, maxMb) : e.message }]);
      } finally { stop(); }
    }
    setReading(null); setBusy(false);
  }

  const update = (id, patch) => setFiles(fs => fs.map(f => (f.uid === id ? { ...f, ...patch } : f)));
  const byId = id => files.find(f => f.uid === id);

  function remove(id) {
    const f = byId(id);
    if (f?.token) api('/uploads/preview/' + f.token, { method: 'DELETE' }).catch(() => {});
    setFiles(fs => fs.filter(x => x.uid !== id));
  }

  async function undo(id) {
    const f = byId(id);
    if (!window.confirm(`Undo saving "${f.file_name}"?\n\nIts data will be taken out of the reports. If it replaced an earlier upload, that earlier data comes back.`)) return;
    update(id, { undoing: true, saveError: null });
    try {
      const r = await api(`/uploads/${f.result.upload.id}/undo`, { method: 'POST' });
      update(id, { undoing: false, undone: r });
      refresh(true);
    } catch (e) { update(id, { undoing: false, saveError: e.message }); }
  }

  async function destroy(id) {
    const f = byId(id);
    const takesOut = f.undone ? '' : '\n\nIts data will be taken out of the reports (and any earlier data it replaced comes back).';
    if (!window.confirm(`Delete "${f.file_name}" for good?${takesOut}\n\nThe original file is also deleted from storage. This cannot be reversed.`)) return;
    update(id, { undoing: true, saveError: null });
    try {
      const r = await api(`/uploads/${f.result.upload.id}`, { method: 'DELETE' });
      update(id, { undoing: false, deleted: r });
      refresh(true);
    } catch (e) { update(id, { undoing: false, saveError: e.message }); }
  }

  async function recheck(id, changes) {
    const f = { ...byId(id), ...changes };
    // a new header row or file type means new columns: let the server suggest again (and forget accepted corrections)
    const structural = 'header_row' in changes || 'report_type' in changes;
    // accepting corrections doesn't change the columns, so the saved format still applies
    const onlyAccepting = Object.keys(changes).every(k => k === 'accepted');
    const accepted = structural ? [] : f.accepted || [];
    update(id, { ...(structural ? { accepted } : changes), checking: true, queue: null });
    const job = newJobId();
    const stop = watchJob(job, st => update(id, { queue: st.state === 'waiting' ? st.ahead : null }));
    try {
      const body = { header_row: f.header_row, report_type: f.report_type };
      if (!structural) Object.assign(body, { mapping: f.mapping, date_format: f.date_format, accept: accepted });
      const r = await api('/uploads/preview/' + f.token, { method: 'POST', body, headers: { 'X-Job-Id': job } }).finally(stop);
      const before = byId(id);
      update(id, { ...r, checking: false, queue: null, open: true, saveError: null,
        needs_mapping: structural ? r.needs_mapping : onlyAccepting ? !before.template || !!r.check?.errors : true,
        template: structural ? r.template : onlyAccepting ? before.template : null });
    } catch (e) { update(id, { checking: false, queue: null, saveError: e.message }); }
  }

  async function saveAll() {
    setBusy(true);
    const todo = files.filter(f => !f.result && fileState({ ...f, needs_mapping: false }) === 'ready');
    for (const [k, f] of todo.entries()) {
      const job = newJobId();
      setSaving({ job, n: k + 1, of: todo.length, name: f.file_name, phase: 'sent' });
      const stop = follow(job, setSaving);
      update(f.uid, { saving: true });
      try {
        const r = await api('/uploads/commit', { method: 'POST', headers: { 'X-Job-Id': job }, body: {
          token: f.token, report_type: f.report_type, header_row: f.header_row, mapping: f.mapping, date_format: f.date_format,
          save_template: f.save_template, template_name: f.template_name || undefined, accept: f.accepted || [] } });
        update(f.uid, { saving: false, result: r, open: false });
      } catch (e) {
        update(f.uid, { saving: false, saveError: e.message, check: e.data?.issues ? { ...f.check, errors: true, issues: e.data.issues } : f.check, open: true });
      } finally { stop(); }
    }
    setSaving(null);
    setBusy(false);
    refresh(true);
    setStep('done');
  }

  if (!meta) return err ? <Notice tone="bad">{err}</Notice> : <Loading />;
  const savable = files.filter(f => !f.result && fileState({ ...f, needs_mapping: false }) === 'ready');
  const saved = files.filter(f => f.result);
  const typeLabel = f => meta.types.find(t => t.key === f.report_type)?.label || '';
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = files.filter(f => words.every(w => `${f.file_name} ${typeLabel(f)}`.toLowerCase().includes(w)));

  return (
    <>
      <div className="page-head"><div className="grow"><h1>Upload files</h1><p className="muted">Upload the day's Excel files from your billing software. You can choose all of them together.</p></div></div>
      <Steps step={step} />
      {err && <Notice tone="bad">{err}</Notice>}

      {step === 'choose' && (
        <div className={'drop' + (over ? ' over' : '')} onClick={() => input.current.click()} role="button" tabIndex={0}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && input.current.click()}
          onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); choose(e.dataTransfer.files); }}>
          <span style={{ color: 'var(--primary)' }}>{Icon.cloud}</span>
          <h2>Click here to choose files</h2>
          <p className="muted">or drag and drop them here</p>
          <p className="small muted">Sales, Purchase, Credit Note, Debit Note, Receipt Book, Outstanding, Stock Statement · .xls, .xlsx or .csv · up to {meta.max_file_mb || 25} MB each</p>
          <span className="btn primary" style={{ marginTop: 6 }}>Choose files</span>
        </div>
      )}
      <input ref={input} type="file" multiple accept=".xls,.xlsx,.csv" hidden onChange={e => { choose(e.target.files); e.target.value = ''; }} />

      {step !== 'choose' && (
        <>
          {reading && <ProgressPanel p={reading} />}
          {saving && <ProgressPanel p={saving} saving />}
          {step === 'check' && !reading && !saving && (
            <Notice tone="info">
              <p><b>Please look at each file below.</b> Green and yellow files can be saved. Yellow means a new file format: we matched its columns for you — click <b>Check columns</b> if you want to see them. Red files need fixing first. Added a wrong file? Click <b>Remove</b> on it.</p>
            </Notice>
          )}
          {step === 'done' && (
            <Notice tone={saved.length === files.length ? 'good' : 'warn'}>
              <p><b>{saved.length} of {files.length} file{files.length > 1 ? 's' : ''} saved.</b> {saved.length < files.length ? 'Files that were not saved are shown in red below.' : 'Your reports are up to date.'}</p>
            </Notice>
          )}
          {files.length > 1 && (
            <div className="file-tools">
              <label className="search">
                {Icon.search}
                <input type="search" placeholder="Search files by name or type…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search files" />
              </label>
              <span className="small muted">{words.length ? `${shown.length} of ${files.length} files` : `${files.length} files`}</span>
              {step === 'check' && <button className="btn small" disabled={busy} onClick={() => input.current.click()}>{Icon.plus} Add more files</button>}
            </div>
          )}
          {shown.map(f => <FileCard key={f.uid} f={f} meta={meta} busy={busy && !reading} onChange={p => update(f.uid, p)} onRecheck={c => recheck(f.uid, c)}
            onUndo={() => undo(f.uid)} onRemove={() => remove(f.uid)} onDelete={can(user, 'admin') ? () => destroy(f.uid) : null} />)}
          {words.length > 0 && !shown.length && <div className="card"><div className="empty"><h3>No file matches “{q}”</h3>
            <button className="btn small" onClick={() => setQ('')}>Clear search</button></div></div>}
          <div className="actions">
            {step === 'check' && <button className="btn primary big" disabled={busy || !savable.length} onClick={saveAll}>
              {reading ? 'Reading files…' : busy ? 'Saving…' : `Save ${savable.length} ready file${savable.length === 1 ? '' : 's'}`}</button>}
            {step === 'done' && savable.length > 0 && <button className="btn primary big" disabled={busy} onClick={saveAll}>Save remaining {savable.length}</button>}
            {step === 'done' && <Link className="btn primary big" to="/">See today's reports</Link>}
            {step === 'check' && files.length === 1 && <button className="btn big" disabled={busy} onClick={() => input.current.click()}>{Icon.plus} Add more files</button>}
            <button className="btn big" disabled={busy} onClick={() => {
              for (const f of files) if (f.token && !f.result) api('/uploads/preview/' + f.token, { method: 'DELETE' }).catch(() => {});
              setFiles([]); setQ(''); setStep('choose');
            }}>{step === 'done' ? 'Upload more files' : 'Start again'}</button>
          </div>
        </>
      )}
    </>
  );
}

function FileCard({ f, meta, busy, onChange, onRecheck, onUndo, onRemove, onDelete }) {
  const state = f.result ? 'ready' : f.saveError ? 'error' : fileState(f);
  const typeLabel = meta.types.find(t => t.key === f.report_type)?.label;
  const fields = f.report_type ? meta.fields[f.report_type] : [];
  const timer = useRef();
  const setMapping = (key, header) => {
    const mapping = { ...f.mapping };
    if (header) mapping[key] = header; else delete mapping[key];
    // other columns mean other numbers: corrections accepted so far no longer apply
    onChange({ mapping, template: null, accepted: [] });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onRecheck({ mapping, accepted: [] }), 350);
  };
  // ids = corrections to accept; null = take back every accepted correction
  const onAccept = ids => onRecheck({ accepted: ids ? [...new Set([...(f.accepted || []), ...ids])] : [] });

  let status;
  if (f.deleted) status = <Badge tone="bad">Deleted</Badge>;
  else if (f.undone) status = <Badge>Undone</Badge>;
  else if (f.result) status = <Badge tone="good">✓ Saved · {num(f.result.upload.rows)} rows</Badge>;
  else if (f.saving) status = <Badge tone="info">Saving…</Badge>;
  else if (state === 'error') status = <Badge tone="bad">✕ Needs fixing</Badge>;
  else if (state === 'attention' && f.report_type) status = <Badge tone="warn">New format · columns matched for you</Badge>;
  else if (state === 'attention') status = <Badge tone="warn">! Please choose the file type</Badge>;
  else status = <Badge tone="good">✓ Ready to save</Badge>;

  return (
    <div className={'file-card ' + (f.result ? 'ready' : state)}>
      <div className="fc-head">
        <span style={{ color: 'var(--muted)' }}>{Icon.file}</span>
        <div className="grow">
          <h3>{typeLabel || 'Unknown file type'}</h3>
          <div className="small muted">{f.file_name}{f.size ? ` · ${bytes(f.size)}` : ''}
            {f.check?.period?.from && <> · for <b style={{ color: 'var(--text)' }}>{rangeLabel(f.check.period.from, f.check.period.to)}</b></>}</div>
        </div>
        {status}
        {f.result && !f.undone && !f.deleted && <button className="btn small" disabled={f.undoing} onClick={onUndo}>{Icon.undo} {f.undoing ? 'Working…' : 'Undo'}</button>}
        {f.result && !f.deleted && onDelete && <button className="btn small danger" disabled={f.undoing} onClick={onDelete}>{Icon.trash} Delete</button>}
        {!f.error && !f.result && <button className="btn small" onClick={() => onChange({ open: !f.open })}>{f.open ? 'Hide columns' : 'Check columns'}</button>}
        {!f.result && <button className="btn small danger" disabled={busy || f.saving} onClick={onRemove} aria-label={`Remove ${f.file_name}`}
          title="Take this file out of the list. Nothing is saved.">{Icon.close} Remove</button>}
      </div>

      {!f.open && !f.error && !f.result && !f.check?.errors && f.report_type && (
        <div className="fc-body small">
          <span className="muted">{f.template ? `Recognised as your saved format “${f.template.name}”. ` : 'First time we see this format. We matched the columns for you and they will be remembered. '}</span>
          <Summary f={f} />
          {(f.duplicate || f.existing?.length > 0) && <div style={{ marginTop: 6, color: 'var(--warn)' }}>Already uploaded for these dates. Saving will replace the old data.</div>}
        </div>
      )}
      {f.deleted ? (
        <div className="fc-body small">Deleted. Its data is out of the reports
          {f.deleted.restored.length > 0 && <> and the earlier data from {f.deleted.restored.join(', ')} is back</>}.
          {f.deleted.file_removed ? ' The original file has been deleted from storage.' : ' The original file could not be deleted from storage right now; it will be tried again automatically.'}</div>
      ) : f.undone ? (
        <div className="fc-body small">This upload was undone and its data taken out of the reports
          {f.undone.restored.length > 0 ? <>. The earlier data from {f.undone.restored.join(', ')} is back.</> : '.'}</div>
      ) : f.result && <Saved r={f.result} />}

      {f.error && <div className="fc-body"><Notice tone="bad">{f.error}</Notice></div>}
      {f.saveError && <div className="fc-body"><Notice tone="bad">{f.saveError}</Notice></div>}

      {f.open && !f.error && !f.result && (
        <div className="fc-body">
          {f.duplicate && <Notice tone="warn">This exact file was already uploaded on {dateTime(f.duplicate.created_at)}. Saving again will simply replace it.</Notice>}
          {!f.duplicate && f.existing?.length > 0 && <Notice tone="warn">{typeLabel} for these dates was already uploaded ({f.existing.map(e => e.file_name).join(', ')}). Saving will <b>replace</b> the old data, so nothing is counted twice.</Notice>}

          <div className="inline-fields">
            <label className="field"><span>What is this file?</span>
              <select value={f.report_type || ''} onChange={e => onRecheck({ report_type: e.target.value, mapping: undefined })}>
                <option value="" disabled>Choose…</option>
                {meta.types.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select></label>
            <label className="field"><span>Column names are on row</span>
              <select value={f.header_row} onChange={e => onRecheck({ header_row: Number(e.target.value) })}>
                {f.rows_preview?.map(r => <option key={r.row} value={r.row - 1}>Row {r.row}: {r.text.slice(0, 60) || '(empty)'}</option>)}
              </select></label>
            <label className="field"><span>Dates in this file are written as</span>
              <select value={f.date_format} onChange={e => { onChange({ date_format: e.target.value }); onRecheck({ date_format: e.target.value, mapping: f.mapping, accepted: [] }); }}>
                {DATE_FORMATS.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
              </select></label>
          </div>

          {f.report_type && (
            <>
              <h3 style={{ margin: '6px 0 4px' }}>Match the columns</h3>
              <p className="small muted">For each item on the left, choose the column from your file. Items marked <span style={{ color: 'var(--bad)' }}>*</span> are needed. We have filled in our best guess.</p>
              <div className="table-wrap">
                <table className="map-table">
                  <thead><tr><th>We need</th><th>Column in your file</th><th>Example from your file</th></tr></thead>
                  <tbody>
                    {fields.map(fd => (
                      <tr key={fd.key}>
                        <td>{fd.label}{fd.required && <span className="req">*</span>}</td>
                        <td style={{ minWidth: 220 }}>
                          <select value={f.mapping[fd.key] || ''} onChange={e => setMapping(fd.key, e.target.value)} aria-label={fd.label}>
                            <option value="">— Not in this file —</option>
                            {f.headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </td>
                        <td className="ex">{f.mapping[fd.key] ? (f.samples[f.mapping[fd.key]] || []).join('  ·  ') || <span className="muted">(empty)</span> : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 18 }}>
                <h3>Check result {f.checking && <span className="spinner" style={{ width: 16, height: 16, verticalAlign: 'middle', marginLeft: 8 }} />}
                  {f.checking && f.queue != null && <span className="small muted" style={{ fontWeight: 400, marginLeft: 8 }}>waiting in line ({f.queue} ahead)…</span>}</h3>
                {f.check && <CheckResult check={f.check} onAccept={onAccept} busy={f.checking || f.saving} />}
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="check"><input type="checkbox" checked={f.save_template} onChange={e => onChange({ save_template: e.target.checked })} />Remember these columns for next time</label>
                {f.save_template && <input type="text" style={{ maxWidth: 320 }} placeholder={`${typeLabel} format`} value={f.template_name} onChange={e => onChange({ template_name: e.target.value })} aria-label="Name for this format" />}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Summary({ f }) {
  const s = f.check?.stats || {};
  const totalsOk = f.check?.reconciliation?.length && f.check.reconciliation.every(r => r.status !== 'mismatch');
  return <span>{num(s.rows)} rows{s.docs ? ` · ${num(s.docs)} bills` : ''}{s.bills ? ` · ${num(s.bills)} ${f.report_type === 'delivery' ? 'settled ' : ''}bills` : ''}{s.taxable ? ` · Taxable ${inr(s.taxable)}` : ''}{s.amount ? ` · ${inr(s.amount)}` : ''}{s.balance ? ` · Balance ${inr(s.balance)}` : ''}{s.items ? ` · ${num(s.items)} items, ${num(s.stock_qty)} units` : ''}{s.stock_value ? ` · Stock value ${inr(s.stock_value)}` : ''}
    {totalsOk ? ' · ✓ totals match the file' : ''}{f.check?.issues?.filter(i => i.level === 'warning').length ? ` · ${f.check.issues.filter(i => i.level === 'warning').length} note(s)` : ''}</span>;
}

function CheckResult({ check, onAccept, busy }) {
  const rec = check.reconciliation || [];
  const ok = rec.length > 0 && rec.every(r => r.status !== 'mismatch');
  const errors = check.issues.filter(i => i.level === 'error');
  const warns = check.issues.filter(i => i.level !== 'error');
  const allFixes = errors.flatMap(i => i.fixes || []);
  // one "Accept all" at the top when corrections come under more than one heading
  const topAll = allFixes.length > 1 && errors.filter(i => i.fixes).length > 1;
  return (
    <>
      {ok && !errors.length && <Notice tone="good"><p><b>All totals match the file.</b> We added up {rec.length} columns ourselves and they agree with the TOTALS row in your file, to the paisa.</p>
        <p className="small">{rec.map(r => `${r.label}: ${num(r.ours)}`).join(' · ')}</p></Notice>}
      {errors.length > 0 && <Notice tone="bad">
        <p><b>Please fix this before saving:</b>{allFixes.length > 0 && <> We worked out the correct value for {allFixes.length === 1 ? 'the wrong line' : `each of the ${num(allFixes.length)} wrong lines`}. Check {allFixes.length === 1 ? 'it' : 'them'} and click <b>Accept</b>.</>}</p>
        {topAll && <p><button className="btn small primary" disabled={busy} onClick={() => onAccept(allFixes.map(x => x.id))}>✓ Accept all {num(allFixes.length)} corrections</button></p>}
        <ul className="issue-list">{errors.map((i, k) => <IssueItem key={k} i={i} onAccept={onAccept} busy={busy} hideAll={topAll} />)}</ul></Notice>}
      {warns.length > 0 && <Notice tone="warn"><p><b>Good to know</b> (you can still save):</p><ul className="issue-list">{warns.map((i, k) => <IssueItem key={k} i={i} onAccept={onAccept} busy={busy} />)}</ul></Notice>}
    </>
  );
}

const IssueItem = ({ i, onAccept, busy, hideAll }) => (
  <li><div style={{ minWidth: 0, flex: 1 }}>{i.message}{i.count > 0 && <div className="rows">{num(i.count)} row(s) — Excel row {i.rows.slice(0, 12).join(', ')}{i.count > 12 ? ' …' : ''}</div>}
    {i.fixes && onAccept && <Fixes fixes={i.fixes} onAccept={onAccept} busy={busy} hideAll={hideAll} />}
    {i.corrections && onAccept && <Corrections list={i.corrections} onUndo={() => onAccept(null)} busy={busy} />}
  </div></li>
);

/** Suggested corrections for one kind of error, each with what the file says and what it should be. */
function Fixes({ fixes, onAccept, busy, hideAll }) {
  const [all, setAll] = useState(false);
  const list = all ? fixes : fixes.slice(0, 5);
  return (
    <div className="fixes">
      <div className="table-wrap">
        <table className="stack fix-table">
          <thead><tr><th>Excel row</th><th>Bill / item</th><th>Column</th><th className="num">In the file</th><th>Correct value</th><th /></tr></thead>
          <tbody>{list.map(x => (
            <tr key={x.id}>
              <td data-label="Excel row">{x.row}</td>
              <td data-label="Bill / item"><div className="cell">{x.doc_no}{x.item && <span className="sub">{x.item}</span>}</div></td>
              <td data-label="Column">{x.label}</td>
              <td data-label="In the file" className="num"><s className="muted">{x.from}</s></td>
              <td data-label="Correct value" className="why"><div className="cell"><b className="good-text">{x.to}</b><span className="sub">{x.why}</span></div></td>
              <td data-label=""><button className="btn small" disabled={busy} onClick={() => onAccept([x.id])}>✓ Accept</button></td>
            </tr>))}</tbody>
        </table>
      </div>
      <div className="fixes-foot">
        {fixes.length > 1 && !hideAll && <button className="btn small primary" disabled={busy} onClick={() => onAccept(fixes.map(x => x.id))}>✓ Accept all {num(fixes.length)}</button>}
        {fixes.length > 5 && <button className="btn link" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${num(fixes.length)}`}</button>}
      </div>
    </div>
  );
}

function Corrections({ list, onUndo, busy }) {
  return (
    <div className="fixes">
      <ul className="small" style={{ margin: '6px 0', paddingLeft: 18 }}>
        {list.slice(0, 8).map(c => <li key={c.id}>Excel row {c.row} ({c.doc_no}): {c.label} <s className="muted">{c.from}</s> → <b>{c.to}</b></li>)}
        {list.length > 8 && <li>and {num(list.length - 8)} more</li>}
      </ul>
      <button className="btn small" disabled={busy} onClick={onUndo}>{Icon.undo} Take back corrections</button>
    </div>
  );
}

function Saved({ r }) {
  const warns = r.issues.filter(i => i.level === 'warning');
  return (
    <div className="fc-body small">
      Saved for <b>{rangeLabel(r.upload.period.from, r.upload.period.to)}</b> · {num(r.upload.rows)} rows · stored compressed ({bytes(r.upload.size_bytes)} → {bytes(r.upload.stored_bytes)})
      {r.reconciliation.length > 0 && r.reconciliation.every(x => x.status !== 'mismatch') && ' · ✓ totals match'}
      {r.replaced?.length > 0 && <> · replaced earlier upload</>}
      {warns.length > 0 && <ul className="issue-list" style={{ marginTop: 8 }}>{warns.map((i, k) => <IssueItem key={k} i={i} />)}</ul>}
    </div>
  );
}
