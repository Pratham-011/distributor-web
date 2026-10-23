import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, can, ROLE_INFO } from '../auth.jsx';
import { Icon } from './Icons.jsx';
import { Notice } from './ui.jsx';
import { date } from '../format.js';

const NAV = [
  { group: null, items: [
    { to: '/', label: 'Home', icon: Icon.home, end: true },
    { to: '/upload', label: 'Upload files', icon: Icon.upload, min: 'writer' },
  ] },
  { group: 'Reports', items: [
    { to: '/sales', label: 'Sales', icon: Icon.sales },
    { to: '/collections', label: 'Money received', icon: Icon.money },
    { to: '/outstanding', label: 'Money to collect', icon: Icon.clock },
    { to: '/stock', label: 'Stock', icon: Icon.box },
    { to: '/gst', label: 'GST', icon: Icon.gst },
    { to: '/returns', label: 'Returns', icon: Icon.returns },
    { to: '/purchases', label: 'Purchases', icon: Icon.purchase },
  ] },
  { group: 'Settings', items: [
    { to: '/history', label: 'Past uploads', icon: Icon.history },
    { to: '/formats', label: 'Saved file formats', icon: Icon.formats, min: 'writer' },
    { to: '/team', label: 'Team & access', icon: Icon.team, min: 'admin' },
    { to: '/activity', label: 'Activity log', icon: Icon.activity, min: 'admin' },
  ] },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const close = () => setOpen(false);
  return (
    <div className="app">
      <aside className={'side' + (open ? ' open' : '')} aria-label="Main menu">
        <div className="brand"><span className="logo">{Icon.logo}</span><div><b>{user.org_name}</b><small>Daily reports</small></div></div>
        {[...NAV, ...(user.platform_admin ? [{ group: 'Software owner', items: [{ to: '/platform', label: 'Platform admin', icon: Icon.team }] }] : [])].map((g, i) => (
          <nav className="nav" key={i}>
            {g.group && <div className="nav-group">{g.group}</div>}
            {g.items.filter(it => !it.min || can(user, it.min)).map(it => (
              <NavLink key={it.to} to={it.to} end={it.end} onClick={close}>{it.icon}{it.label}</NavLink>
            ))}
          </nav>
        ))}
      </aside>
      {open && <div className="scrim" onClick={close} />}
      <div className="main">
        <header className="topbar">
          <button className="btn small menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">{Icon.menu}</button>
          <div className="spacer" />
          <div className="who"><b>{user.name}</b><small>{ROLE_INFO[user.role].label} · {user.email}</small></div>
          <button className="btn small" onClick={signOut} title="Log out">{Icon.logout}<span className="hide-sm">Log out</span></button>
        </header>
        <main className="content" key={loc.pathname}>
          {user.subscription && ['owner', 'admin'].includes(user.role) && user.subscription.days_left <= 7 && (
            <Notice tone="warn">{user.subscription.days_left < 0
              ? <>Your subscription ended on <b>{date(user.subscription.paid_until)}</b>. Please renew to keep using the portal.</>
              : <>Your subscription ends on <b>{date(user.subscription.paid_until)}</b> ({user.subscription.days_left === 0 ? 'today' : `in ${user.subscription.days_left} day${user.subscription.days_left === 1 ? '' : 's'}`}). Please renew so your team can keep using the portal.</>}</Notice>
          )}
          {!user.state_code && user.role === 'owner' && loc.pathname !== '/team' && (
            <Notice tone="warn">Please choose the state your business is GST-registered in, so out-of-state bills are checked correctly. <Link to="/team">Set it in Team &amp; access</Link></Notice>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
