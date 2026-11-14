import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useDates, settleQ, stockQ } from './DateBar.jsx';

// the reports that can be split into settled / unsettled bills (purchases, receipts and stock are not)
const SPLIT = ['overview', 'sales', 'gst', 'returns'];

/** Loads /reports/<name> for the current date range. */
export default function useReport(name, extra = '') {
  const { range, settle } = useDates();
  const split = SPLIT.includes(name) ? settleQ(settle) : name === 'stock/movement' ? stockQ(settle) : '';
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    if (!range) return;
    let live = true;
    setState(s => ({ ...s, loading: true, error: null }));
    api(`/reports/${name}?from=${range.from}&to=${range.to}${extra}${split}`)
      .then(data => live && setState({ data, error: null, loading: false }))
      .catch(e => live && setState({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
  }, [name, range?.from, range?.to, extra, split]);
  return state;
}
