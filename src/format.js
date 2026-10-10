// Display helpers. Values arrive as exact strings from the server; Number() is used for display only.
const n = v => Number(v || 0);

export const inr = (v, dp = 2) =>
  '₹' + n(v).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const rupees = v => inr(v, 0);

export const short = v => {
  const x = n(v), a = Math.abs(x);
  if (a >= 1e7) return '₹' + (x / 1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return '₹' + (x / 1e5).toFixed(2) + ' L';
  return rupees(x);
};

export const num = v => n(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const pct = (a, b) => (n(b) ? (n(a) / n(b) * 100).toFixed(1) + '%' : '–');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const date = s => { if (!s) return ''; const d = parseISO(String(s).slice(0, 10)); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export const dateLong = s => { if (!s) return ''; const d = parseISO(s); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export const dateShort = s => { const d = parseISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const dateTime = s => {
  if (!s) return '';
  const d = new Date(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
};
export const rangeLabel = (from, to) => (from === to ? dateLong(from) : `${date(from)} to ${date(to)}`);
export const titleCase = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
export const bytes = b => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
