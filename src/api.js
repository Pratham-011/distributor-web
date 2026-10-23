const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const KEY = 'dr_token';

export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = t => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* private mode */ } };

let onUnauthorized = () => {};
export const setUnauthorizedHandler = fn => { onUnauthorized = fn; };
// the business's portal is paused or its subscription ended (the server says why)
let onBlocked = () => {};
export const setBlockedHandler = fn => { onBlocked = fn; };
const BLOCKED = ['account_paused', 'account_expired'];

export class ApiError extends Error {
  constructor(status, data) { super(data?.error || 'Something went wrong. Please try again.'); this.status = status; this.data = data; }
}

export async function api(path, { method = 'GET', body, form, headers: extra } = {}) {
  const headers = { ...extra };
  const t = getToken();
  if (t) headers.Authorization = 'Bearer ' + t;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, { error: 'Cannot reach the server. Please check the internet connection.' });
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
  if (BLOCKED.includes(data.code) && path !== '/auth/login') onBlocked(data);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export async function download(path, fileName) {
  const res = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + getToken() } });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---- uploads with progress ----
// Each upload / check / save carries an id; the server says where that job is in its line (see /uploads/progress).
export const newJobId = () => {
  try { return crypto.randomUUID(); } catch { return 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); }
};

/** POSTs a form (files) and reports how much has been sent: onUpload(0..100). Same result and errors as api(). */
export function sendForm(path, form, { jobId, onUpload } = {}) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', BASE + path);
    const t = getToken();
    if (t) x.setRequestHeader('Authorization', 'Bearer ' + t);
    if (jobId) x.setRequestHeader('X-Job-Id', jobId);
    x.upload.onprogress = e => e.lengthComputable && onUpload?.(Math.round((e.loaded / e.total) * 100));
    x.upload.onload = () => onUpload?.(100);
    x.onerror = () => reject(new ApiError(0, { error: 'Cannot reach the server. Please check the internet connection.' }));
    x.onload = () => {
      let data = {};
      try { data = JSON.parse(x.responseText); } catch { /* not JSON */ }
      if (x.status === 401) onUnauthorized();
      if (BLOCKED.includes(data.code)) onBlocked(data);
      if (x.status >= 200 && x.status < 300) resolve(data); else reject(new ApiError(x.status, data));
    };
    x.send(form);
  });
}

/** Asks every 0.7 s where a job is ({ state: 'waiting' | 'reading' | 'unknown', ahead }). Returns a stop function. */
export function watchJob(jobId, onState) {
  let stopped = false;
  const tick = () => api('/uploads/progress/' + jobId).then(s => !stopped && onState(s)).catch(() => {})
    .finally(() => { if (!stopped) timer = setTimeout(tick, 700); });
  let timer = setTimeout(tick, 300);
  return () => { stopped = true; clearTimeout(timer); };
}
