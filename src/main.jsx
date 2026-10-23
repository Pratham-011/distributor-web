import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import { AuthProvider, useAuth, can } from './auth.jsx';
import { DateProvider } from './components/DateBar.jsx';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import { Login, Register, Forgot } from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import Upload from './pages/Upload.jsx';
import { Sales, Gst, Returns, Purchases, Collections, Outstanding, Stock } from './pages/Reports.jsx';
import { History, Formats, Team, Activity } from './pages/Settings.jsx';
import Platform from './pages/Platform.jsx';
import { Icon } from './components/Icons.jsx';

/** Shown instead of the app when the business's portal is paused or its subscription has ended. */
function Blocked({ info }) {
  const { logout } = useAuth();
  return (
    <div className="auth-wrap">
      <div className="auth">
        <div className="logo">{Icon.logo}</div>
        <h1>{info.code === 'account_expired' ? 'Subscription ended' : 'Portal paused'}</h1>
        <p className="muted">{info.error}</p>
        <p className="small muted">Your data is safe and will be there when the portal is turned back on.</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => window.location.reload()}>Try again</button>
          <button className="btn" onClick={logout}>Log out</button>
        </div>
      </div>
    </div>
  );
}

function Need({ min, children }) {
  const { user } = useAuth();
  return can(user, min) ? children : <Navigate to="/" replace />;
}

function App() {
  const { user, ready, offline, blocked } = useAuth();
  // a free Render server can take about a minute to wake up; say so instead of spinning silently
  if (!ready) return <Loading text={offline ? 'Cannot reach the server yet. If it was asleep it takes up to a minute to start. Trying again…' : 'Loading…'} />;
  if (blocked) return <Blocked info={blocked} />;
  if (!user) return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="*" element={<Login />} />
    </Routes>
  );
  return (
    <DateProvider key={user.id}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="upload" element={<Need min="writer"><Upload /></Need>} />
          <Route path="sales" element={<Sales />} />
          <Route path="gst" element={<Gst />} />
          <Route path="returns" element={<Returns />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="collections" element={<Collections />} />
          <Route path="outstanding" element={<Outstanding />} />
          <Route path="stock" element={<Stock />} />
          <Route path="history" element={<History />} />
          <Route path="formats" element={<Need min="writer"><Formats /></Need>} />
          <Route path="team" element={<Need min="admin"><Team /></Need>} />
          <Route path="activity" element={<Need min="admin"><Activity /></Need>} />
          <Route path="platform" element={user.platform_admin ? <Platform /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DateProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider><App /></AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
