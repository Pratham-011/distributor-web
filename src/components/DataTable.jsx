import { useMemo, useState } from 'react';
import { Icon } from './Icons.jsx';

/**
 * cols: [{ key, label, num?, render?(value,row), excel?(row), excelOnly? }]  excelOnly: in the Excel download, not on screen
 * Sorting by clicking a column; "Download Excel" exports exactly what is shown.
 * stack: when the table's box is narrow, each row becomes a small card (label: value) instead of a
 * sideways-scrolling table. stack="wide" switches earlier, for tables with many columns.
 * scroll: long tables get a fixed height and scroll inside (turn off for a table that is already inside a scrolling box).
 * expand(row): makes rows open on click, showing what it returns underneath; rowKey(row) keeps the open row through sorting.
 */
const SCROLL_AFTER = 10;   // rows; about what fits the box height in styles.css (--scroll-box)
export default function DataTable({ cols, rows, footer, fileName = 'report', empty = 'Nothing to show for these dates.', exportable = true, stack = false, scroll = true, expand, rowKey = r => JSON.stringify(r) }) {
  const [sort, setSort] = useState(null);
  const [open, setOpen] = useState(null);
  const allCols = cols;
  cols = cols.filter(c => !c.excelOnly);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const c = allCols.find(x => x.key === sort.key);
    const val = r => (c.sortValue ? c.sortValue(r) : r[c.key]);
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      const d = c.num ? Number(x || 0) - Number(y || 0) : String(x ?? '').localeCompare(String(y ?? ''));
      return sort.dir === 'asc' ? d : -d;
    });
  }, [rows, sort, allCols]);

  async function exportExcel() {
    const XLSX = await import('xlsx');
    const data = sorted.map(r => Object.fromEntries(allCols.map(c => {
      const v = c.excel ? c.excel(r) : r[c.key];
      return [c.label, c.num && v !== null && v !== '' && !isNaN(Number(v)) ? Number(v) : v];
    })));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, fileName.replace(/[^\w\- ]+/g, '') + '.xlsx');
  }

  if (!rows.length) return <p className="muted">{empty}</p>;
  const long = scroll && rows.length > SCROLL_AFTER;
  // an opened row shows its own (scrolling) details, so the table itself stops scrolling while one is open
  const boxed = scroll && open === null;
  return (
    <>
      {/* long tables scroll inside their own box (header and total row stay in view); printing shows every row */}
      <div className={'table-wrap' + (boxed ? ' scroll' : '')} {...(long && boxed ? { tabIndex: 0, role: 'region', 'aria-label': `${fileName}, ${rows.length} rows, scrolls` } : {})}>
        <table className={[stack && 'stack', stack === 'wide' && 'wide', expand && 'expandable'].filter(Boolean).join(' ') || undefined}>
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
            {sorted.map((r, i) => {
              const k = expand ? rowKey(r) : i, isOpen = expand && open === k;
              const toggle = () => setOpen(isOpen ? null : k);
              return [
                <tr key={k} className={isOpen ? 'open' : undefined} onClick={expand ? toggle : undefined}>{cols.map((c, j) => {
                  let v = c.render ? c.render(r[c.key], r) : r[c.key];
                  // the first cell is the button that opens the row (keyboard and screen readers)
                  if (expand && j === 0) v = <button type="button" className="row-open" aria-expanded={isOpen} onClick={e => { e.stopPropagation(); toggle(); }}><span className="chev" aria-hidden="true">›</span><span>{v}</span></button>;
                  return <td key={c.key} className={c.num ? 'num' : ''} data-label={c.label}>{stack ? <div className="cell">{v}</div> : v}</td>;
                })}</tr>,
                isOpen && <tr key={k + ':open'} className="row-detail"><td colSpan={cols.length} data-label="">{expand(r)}</td></tr>,
              ];
            })}
          </tbody>
          {footer && (
            <tfoot><tr>{cols.map((c, i) => <td key={c.key} className={c.num ? 'num' : ''}>{footer[c.key] === undefined ? '' : (c.render && i ? c.render(footer[c.key], footer) : footer[c.key])}</td>)}</tr></tfoot>
          )}
        </table>
      </div>
      {(exportable || long) && (
        <div className="table-tools no-print" style={{ marginTop: 10 }}>
          {exportable && <button className="btn small" onClick={exportExcel}>{Icon.download} Download Excel</button>}
          {long && <span className="small muted">{rows.length.toLocaleString('en-IN')} rows · scroll the table to see all</span>}
        </div>
      )}
    </>
  );
}
