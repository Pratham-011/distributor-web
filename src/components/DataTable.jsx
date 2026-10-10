import { useMemo, useState } from 'react';
import { Icon } from './Icons.jsx';

/**
 * cols: [{ key, label, num?, render?(value,row), excel?(row) }]
 * Sorting by clicking a column; "Download Excel" exports exactly what is shown.
 * stack: when the table's box is narrow, each row becomes a small card (label: value) instead of a
 * sideways-scrolling table. stack="wide" switches earlier, for tables with many columns.
 */
export default function DataTable({ cols, rows, footer, fileName = 'report', empty = 'Nothing to show for these dates.', exportable = true, stack = false }) {
  const [sort, setSort] = useState(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const c = cols.find(x => x.key === sort.key);
    const val = r => (c.sortValue ? c.sortValue(r) : r[c.key]);
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      const d = c.num ? Number(x || 0) - Number(y || 0) : String(x ?? '').localeCompare(String(y ?? ''));
      return sort.dir === 'asc' ? d : -d;
    });
  }, [rows, sort, cols]);

  async function exportExcel() {
    const XLSX = await import('xlsx');
    const data = sorted.map(r => Object.fromEntries(cols.map(c => {
      const v = c.excel ? c.excel(r) : r[c.key];
      return [c.label, c.num && v !== null && v !== '' && !isNaN(Number(v)) ? Number(v) : v];
    })));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, fileName.replace(/[^\w\- ]+/g, '') + '.xlsx');
  }

  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <>
      <div className="table-wrap">
        <table className={stack ? 'stack' + (stack === 'wide' ? ' wide' : '') : undefined}>
          <thead>
            <tr>
              {cols.map(c => (
                c.label ? (
                  <th key={c.key} className={'sortable' + (c.num ? ' num' : '')} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => setSort(s => ({ key: c.key, dir: s?.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))}>
                    {c.label}<span className="arrow">{sort?.key === c.key ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </th>
                ) : <th key={c.key} />

              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i}>{cols.map(c => (
                <td key={c.key} className={c.num ? 'num' : ''} data-label={c.label}>
                  {stack ? <div className="cell">{c.render ? c.render(r[c.key], r) : r[c.key]}</div> : c.render ? c.render(r[c.key], r) : r[c.key]}
                </td>))}</tr>
            ))}
          </tbody>
          {footer && (
            <tfoot><tr>{cols.map((c, i) => <td key={c.key} className={c.num ? 'num' : ''}>{footer[c.key] === undefined ? '' : (c.render && i ? c.render(footer[c.key], footer) : footer[c.key])}</td>)}</tr></tfoot>
          )}
        </table>
      </div>
      {exportable && (
        <div className="table-tools no-print" style={{ marginTop: 12 }}>
          <button className="btn small" onClick={exportExcel}>{Icon.download} Download Excel</button>
        </div>
      )}
    </>
  );
}
