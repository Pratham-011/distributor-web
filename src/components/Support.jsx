// Your contact details, as set on the server (SUPPORT_PHONE, SUPPORT_WHATSAPP, SUPPORT_EMAIL, SUPPORT_HOURS).
import { useEffect, useState } from 'react';
import { api } from '../api.js';

let cached = null;
export function useSupport() {
  const [s, setS] = useState(cached);
  useEffect(() => { if (!cached) api('/support').then(d => { cached = d; setS(d); }).catch(() => {}); }, []);
  return s;
}
export const hasSupport = s => !!(s && (s.phone || s.whatsapp || s.email || s.text));

/** Call / WhatsApp / email links. `compact` = one line (login page, small notes). */
export function SupportInfo({ compact }) {
  const s = useSupport();
  if (!hasSupport(s)) return null;
  const items = [
    ...(s.phones?.length ? s.phones : s.phone ? [s.phone] : []).map((p, n) => ({ k: 'phone' + n, href: 'tel:' + p.replace(/[^\d+]/g, ''), label: 'Call', text: p })),
    s.whatsapp && { k: 'wa', href: 'https://wa.me/' + s.whatsapp, label: 'WhatsApp', text: 'Chat with us' },
    s.email && { k: 'mail', href: 'mailto:' + s.email, label: 'Email', text: s.email },
  ].filter(Boolean);
  if (compact) {
    return (
      <span className="support-line">
        {items.map((i, n) => <span key={i.k}>{n > 0 && ' · '}{i.label}: <a href={i.href} target={i.k === 'wa' ? '_blank' : undefined} rel="noreferrer">{i.text}</a></span>)}
        {!items.length && s.text}
      </span>
    );
  }
  return (
    <div className="support-info">
      {items.map(i => (
        <a key={i.k} className="support-item" href={i.href} target={i.k === 'wa' ? '_blank' : undefined} rel="noreferrer">
          <small>{i.label}</small><b>{i.text}</b>
        </a>
      ))}
      {!items.length && s.text && <p style={{ margin: 0 }}>{s.text}</p>}
      {s.hours && <p className="small muted" style={{ margin: '8px 0 0', flexBasis: '100%' }}>Available {s.hours}</p>}
    </div>
  );
}
