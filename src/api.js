const BASE = import.meta.env.VITE_API_URL || '/api';
const KEY = 'dr_token';

export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = t => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* private mode */ } };

let onUnauthorized = () => {};
export const setUnauthorizedHandler = fn => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(status, data) { super(data?.error || 'Something went wrong. Please try again.'); this.status = status; this.data = data; }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
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
