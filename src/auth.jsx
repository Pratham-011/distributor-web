import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler, setBlockedHandler } from './api.js';

const AuthCtx = createContext(null);
export const ROLES = ['viewer', 'writer', 'admin', 'owner'];
export const ROLE_INFO = {
  viewer: { label: 'Viewer', about: 'Can see reports only' },
  writer: { label: 'Uploader', about: 'Can upload files and see reports' },
  admin: { label: 'Admin', about: 'Can also add people, undo or delete anyone\'s uploads and see the activity log' },
  owner: { label: 'Owner', about: 'Full control of the business account' },
};
export const can = (user, min) => !!user && ROLES.indexOf(user.role) >= ROLES.indexOf(min);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);   // the saved login is being checked but the server can't be reached
  const [blocked, setBlocked] = useState(null);     // { code, error } when the business's portal is paused or expired

  const logout = useCallback(() => { setToken(null); setUser(null); setBlocked(null); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); setBlockedHandler(setBlocked); }, [logout]);
  // The login is kept in this browser (localStorage) until it is rejected by the server.
  // A server that is restarting or a dropped connection must not log the person out: just try again.
  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    let stop = false, timer;
    const check = () => api('/auth/me')
      .then(r => { if (stop) return; setToken(r.token); setUser(r.user); setOffline(false); setReady(true); })
      .catch(e => {
        if (stop) return;
        if (e.data?.code === 'account_paused' || e.data?.code === 'account_expired') { setBlocked(e.data); setReady(true); }
        else if (e.status === 401 || e.status === 403) { setToken(null); setReady(true); }
        else { setOffline(true); timer = setTimeout(check, 3000); }
      });
    check();
    return () => { stop = true; clearTimeout(timer); };
  }, []);

  const signIn = useCallback(({ token, user }) => { setToken(token); setUser(user); }, []);
  // the Log out button: tell the server first so it shows in the activity log
  const signOut = useCallback(() => api('/auth/logout', { method: 'POST' }).catch(() => {}).finally(logout), [logout]);
  const value = useMemo(() => ({ user, ready, offline, blocked, signIn, logout, signOut, setUser }), [user, ready, offline, blocked, signIn, logout, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
