import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useDates } from './DateBar.jsx';

/** Loads /reports/<name> for the current date range. */
export default function useReport(name, extra = '') {
  const { range } = useDates();
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    if (!range) return;
    let live = true;
    setState(s => ({ ...s, loading: true, error: null }));
    api(`/reports/${name}?from=${range.from}&to=${range.to}${extra}`)
      .then(data => live && setState({ data, error: null, loading: false }))
      .catch(e => live && setState({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
  }, [name, range?.from, range?.to, extra]);
  return state;
}
