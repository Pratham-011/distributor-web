import { useState } from 'react';
import DateBar, { useDates } from '../components/DateBar.jsx';
import useReport from '../components/useReport.js';
import DataTable from '../components/DataTable.jsx';
import { Kpi, Card, Notice, Loading, Bars, Columns, Empty } from '../components/ui.jsx';
import { Icon } from '../components/Icons.jsx';
import { api } from '../api.js';
import { useDebounced } from '../components/ui.jsx';
import { AGE_SHADES } from './Home.jsx';
import { short, inr, num, pct, date, dateShort, rupees, titleCase } from '../format.js';
import { useEffect } from 'react';

const money = v => inr(v);
const Head = ({ title, sub }) => (
  <div className="page-head">
    <div className="grow"><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
    <button className="btn no-print" onClick={() => window.print()}>{Icon.print} Print</button>
  </div>
);
function Frame({ title, sub, name, children, hint }) {
  const r = useReport(name);
  return (
    <>
      <Head title={title} sub={sub} />
      <DateBar hint={hint} />
      {r.error && <Notice tone="bad">{r.error}</Notice>}
      {r.loading && !r.data ? <Loading /> : r.data && children(r.data)}
    </>
  );
}
function Nothing({ what, type }) {
  const { dates, setRange } = useDates();
  const last = type && dates?.latest?.[type];
  return (
    <Card><Empty title={`No ${what} for these dates`}>
      <p>{last ? `The latest ${what} uploaded are for ${date(last)}.` : 'Choose other dates above, or upload the file for these dates.'}</p>
      {last && <button className="btn primary" onClick={() => setRange({ from: last, to: last, preset: 'custom' })}>Show {date(last)}</button>}
    </Empty></Card>
  );
}
const nothing = (what, type) => <Nothing what={what} type={type} />;

// ------------------------------------------------------------------ Sales
export function Sales() {
  return (
    <Frame title="Sales" sub="From the Sales Register" name="sales">
      {d => !d.totals.lines ? nothing('sales', 'sales') : (
        <>
          <div className="kpis">
            <Kpi tone="blue" label="Sales (before GST)" value={rupees(d.totals.taxable)} sub={`${num(d.totals.qty)} units`} />
            <Kpi label="Bill value (with GST)" value={rupees(d.totals.value)} sub={`Round-off ${inr(d.round_off)}`} />
            <Kpi label="GST" value={rupees(d.totals.tax)} sub={`Discount given ${inr(d.totals.discount)}`} />
            <Kpi label="Bills" value={num(d.totals.docs)} sub={`${num(d.totals.parties)} shops · avg ${rupees(Number(d.totals.value) / d.totals.docs)}`} />
          </div>
          {d.daily.length > 1 && <Card title="Day by day" desc="Sales before GST">
            <Columns items={d.daily.map(x => ({ ...x, label: dateShort(x.date) }))} value="taxable" label="label" tipText={i => `${date(i.date)}: ${inr(i.taxable)} · ${i.invoices} bills`} /></Card>}
          <div className="grid two" style={{ marginTop: d.daily.length > 1 ? 16 : 0 }}>
            <Card title="Brand-wise sales" desc="Click a column name to sort">
              <DataTable fileName="Brand-wise sales" rows={d.brands} footer={{ name: 'Total', qty: d.totals.qty, taxable: d.totals.taxable }}
                cols={[{ key: 'name', label: 'Brand' }, { key: 'qty', label: 'Units', num: 1, render: num },
                  { key: 'taxable', label: 'Sales', num: 1, render: money }, { key: 'share', label: 'Share', num: 1, render: (_, r) => r.name === 'Total' ? '100%' : pct(r.taxable, d.totals.taxable), excel: r => pct(r.taxable, d.totals.taxable) }]} />
            </Card>
            <Card title="Sales by brand"><Bars items={d.brands} tipText={i => `${i.name}: ${inr(i.taxable)} · ${num(i.qty)} units`} /></Card>
            <Card title="Top shops" desc="Shops that bought the most">
              <DataTable fileName="Top shops" rows={d.parties}
                cols={[{ key: 'name', label: 'Shop', render: (v, r) => <>{v}<span className="sub">Code {r.code}</span></> },
                  { key: 'bills', label: 'Bills', num: 1 }, { key: 'qty', label: 'Units', num: 1, render: num }, { key: 'taxable', label: 'Sales', num: 1, render: money }]} />
            </Card>
            <Card title="Top items" desc="Best-selling SKUs">
              <DataTable fileName="Top items" rows={d.skus}
                cols={[{ key: 'name', label: 'Item', render: (v, r) => <>{v}<span className="sub">{r.brand}</span></> },
                  { key: 'qty', label: 'Units', num: 1, render: num }, { key: 'taxable', label: 'Sales', num: 1, render: money }]} />
            </Card>
            <Card title="Bill series" desc="Split by the letters at the start of the bill number">
              <DataTable fileName="Bill series" rows={d.series} cols={[{ key: 'name', label: 'Series' }, { key: 'invoices', label: 'Bills', num: 1 },
                { key: 'taxable', label: 'Sales', num: 1, render: money }, { key: 'avg', label: 'Average bill', num: 1, render: (_, r) => money(Number(r.taxable) / r.invoices), excel: r => (Number(r.taxable) / r.invoices).toFixed(2) }]} />
            </Card>
            <Card title="Registered (B2B) and unregistered (B2C)">
              <DataTable fileName="B2B B2C" rows={d.b2b} cols={[{ key: 'name', label: 'Type' }, { key: 'invoices', label: 'Bills', num: 1 },
                { key: 'taxable', label: 'Sales', num: 1, render: money }, { key: 'tax', label: 'GST', num: 1, render: money }]} />
            </Card>
          </div>
        </>
      )}
    </Frame>
  );
}

// ------------------------------------------------------------------ GST
export function Gst() {
  return (
    <Frame title="GST" sub="Tax on sales and purchases for the chosen dates" name="gst">
      {d => (
        <>
          <Notice tone="info"><p>This is a working view for the dates you choose. For your monthly return, choose <b>Last month</b> or <b>This month</b> above once all files for the month are uploaded.</p></Notice>
          {d.no_gstin.invoices > 0 && <Notice tone="warn"><p><b>{num(d.no_gstin.invoices)} sales bills</b> ({inr(d.no_gstin.taxable)}) are marked Registered (B2B) but have no GSTIN. Please fix these parties in the billing software before filing GSTR-1.</p></Notice>}
          <Card title="GST position">
            <div className="grid two">
              <div className="card" style={{ background: '#fafbfc' }}>
                <h3>Tax on sales (output)</h3>
                <Line l="GST on sales" v={inr(d.sales.tax)} />
                <Line l="Less: GST on credit notes (returns from shops)" v={'− ' + inr(d.credit_note.tax)} />
                <Line l="Net output tax" v={inr(d.net_output)} bold />
              </div>
              <div className="card" style={{ background: '#fafbfc', marginTop: 0 }}>
                <h3>Tax on purchases (input credit)</h3>
                <Line l="GST on purchases" v={inr(d.purchase.tax)} />
                <Line l="Less: GST on debit notes (returns to company)" v={'− ' + inr(d.debit_note.tax)} />
                <Line l="Net input tax credit" v={inr(d.net_input)} bold />
              </div>
            </div>
            <div className="notice info" style={{ marginTop: 16, marginBottom: 0, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center', fontSize: 15.5 }}>
              <span>{Number(d.position) < 0 ? 'Extra input credit (carried forward)' : 'GST to pay'}</span>
              <b style={{ fontSize: 20 }}>{inr(Math.abs(Number(d.position)))}</b>
            </div>
          </Card>
          <Card title="HSN-wise summary of sales" desc="As needed in GSTR-1 Table 12">
            <DataTable fileName="HSN summary" rows={d.hsn}
              footer={{ hsn: 'Total', qty: d.sales.qty, taxable: d.sales.taxable, cgst: d.sales.cgst, sgst: d.sales.sgst, igst: d.sales.igst, tax: d.sales.tax }}
              cols={[{ key: 'hsn', label: 'HSN' }, { key: 'brands', label: 'Brands', render: v => <span className="muted">{v}</span> },
                { key: 'qty', label: 'Units', num: 1, render: num }, { key: 'taxable', label: 'Taxable value', num: 1, render: money },
                { key: 'cgst', label: 'CGST', num: 1, render: money }, { key: 'sgst', label: 'SGST', num: 1, render: money },
                { key: 'igst', label: 'IGST', num: 1, render: money }, { key: 'tax', label: 'Total tax', num: 1, render: money }]} />
          </Card>
          <Card title="Rate-wise summary of sales">
            <DataTable fileName="GST rate summary" rows={d.rates} cols={[{ key: 'rate', label: 'GST rate', render: v => Number(v) + '%' },
              { key: 'taxable', label: 'Taxable value', num: 1, render: money }, { key: 'cgst', label: 'CGST', num: 1, render: money },
              { key: 'sgst', label: 'SGST', num: 1, render: money }, { key: 'igst', label: 'IGST', num: 1, render: money }, { key: 'cess', label: 'Cess', num: 1, render: money }]} />
          </Card>
        </>
      )}
    </Frame>
  );
}
const Line = ({ l, v, bold }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 14.5, borderTop: bold ? '1px solid var(--line-strong)' : 0, marginTop: bold ? 6 : 0, fontWeight: bold ? 700 : 400 }}>
    <span>{l}</span><span className="nowrap">{v}</span>
  </div>
);

// ------------------------------------------------------------------ Returns
export function Returns() {
  return (
    <Frame title="Returns" sub="Goods returned by shops (credit notes) and sent back to the company (debit notes)" name="returns">
      {d => (!d.credit_note.lines && !d.debit_note.lines) ? nothing('returns', 'credit_note') : (
        <>
          <div className="kpis">
            <Kpi tone="blue" label="Returns from shops" value={inr(d.credit_note.value)} sub={`${num(d.credit_note.docs)} credit notes · ${num(d.credit_note.qty)} units`} />
            <Kpi label="Returns as % of sales" value={pct(d.credit_note.taxable, d.sales_taxable)} sub="Before GST" />
            <Kpi tone="blue" label="Sent back to company" value={inr(d.debit_note.value)} sub={`${num(d.debit_note.docs)} debit notes · ${num(d.debit_note.qty)} units`} />
          </div>
          <div className="grid two">
            <Card title="Credit notes to shops">
              <DataTable fileName="Credit notes" rows={d.cn_list} footer={{ doc_no: 'Total', lines: d.credit_note.lines, value: d.credit_note.value }}
                cols={[{ key: 'doc_no', label: 'Note no.' }, { key: 'party', label: 'Shop', render: (v, r) => <>{v}<span className="sub">{date(r.date)}</span></> },
                  { key: 'type', label: 'Type', render: titleCase }, { key: 'lines', label: 'Items', num: 1 }, { key: 'value', label: 'Value', num: 1, render: money }]} />
            </Card>
            <Card title="Why goods came back">
              <DataTable fileName="Return types" rows={d.cn_types} cols={[{ key: 'name', label: 'Type', render: titleCase }, { key: 'notes', label: 'Notes', num: 1 },
                { key: 'taxable', label: 'Value', num: 1, render: money }, { key: 'tax', label: 'GST', num: 1, render: money }]} />
              <h3 style={{ marginTop: 20 }}>Returned brands</h3>
              <Bars items={d.cn_brands} fmt={rupees} />
            </Card>
            <Card title="Sent back to company, by brand" desc="Damage / expiry returns on debit notes">
              <Bars items={d.dn_brands} limit={12} tipText={i => `${i.name}: ${inr(i.taxable)} · ${num(i.qty)} units`} />
            </Card>
            <Card title="Most items sent back">
              <DataTable fileName="Debit note items" rows={d.dn_skus} cols={[{ key: 'name', label: 'Item' }, { key: 'qty', label: 'Units', num: 1, render: num }, { key: 'taxable', label: 'Value', num: 1, render: money }]} />
            </Card>
          </div>
        </>
      )}
    </Frame>
  );
}

// ------------------------------------------------------------------ Purchases
export function Purchases() {
  return (
    <Frame title="Purchases" sub="Stock bought from the company" name="purchases">
      {d => !d.totals.lines ? nothing('purchases', 'purchase') : (
        <>
          <div className="kpis">
            <Kpi tone="blue" label="Purchase value (with GST)" value={rupees(d.totals.value)} sub={`${num(d.totals.docs)} bills`} />
            <Kpi label="Before GST" value={rupees(d.totals.taxable)} sub={`${num(d.totals.qty)} units`} />
            <Kpi label="GST paid (input credit)" value={rupees(d.totals.tax)} />
          </div>
          <div className="grid two">
            <Card title="Bills received">
              <DataTable fileName="Purchase bills" rows={d.bills} footer={{ doc_no: 'Total', lines: d.totals.lines, taxable: d.totals.taxable, value: d.totals.value }}
                cols={[{ key: 'doc_no', label: 'Voucher', render: (v, r) => <>{v}<span className="sub">{date(r.date)}</span></> },
                  { key: 'bill_no', label: 'Company bill', render: (v, r) => <>{v}<span className="sub">{date(r.bill_date)}</span></> },
                  { key: 'lines', label: 'Items', num: 1 }, { key: 'taxable', label: 'Before GST', num: 1, render: money }, { key: 'value', label: 'Bill value', num: 1, render: money }]} />
            </Card>
            <Card title="Purchases by brand"><Bars items={d.brands} limit={14} tipText={i => `${i.name}: ${inr(i.taxable)} · ${num(i.qty)} units`} /></Card>
          </div>
        </>
      )}
    </Frame>
  );
}

// ------------------------------------------------------------------ Collections
export function Collections() {
  return (
    <Frame title="Money received" sub="From the Receipt Book" name="collections">
      {d => !d.totals.n ? nothing('receipts', 'receipt') : (
        <>
          <div className="kpis">
            <Kpi tone="blue" label="Total received" value={inr(d.totals.total)} sub={`${num(d.totals.n)} receipts`} />
            {d.modes.map(m => <Kpi key={m.name} label={m.name} value={rupees(m.amount)} sub={`${num(m.n)} receipts · ${pct(m.amount, d.totals.total)}`} />)}
          </div>
          <div className="grid two">
            <Card title="Collected by" desc="“Office counter” means paid at the office">
              <Bars items={d.people} value="amount" fmt={rupees} tipText={i => `${i.name}: ${inr(i.amount)} · ${i.n} receipts`} />
            </Card>
            <Card title="Shops that paid the most">
              <DataTable fileName="Top paying shops" rows={d.parties} cols={[{ key: 'name', label: 'Shop' }, { key: 'n', label: 'Receipts', num: 1 }, { key: 'amount', label: 'Amount', num: 1, render: money }]} />
            </Card>
          </div>
          <Card title="Cheques" desc="Cheques received, with bank and cheque date">
            <DataTable fileName="Cheques" rows={d.cheques} footer={{ v_no: 'Total', amount: d.cheque_total }} empty="No cheques for these dates."
              cols={[{ key: 'v_no', label: 'Receipt' }, { key: 'party_name', label: 'Shop' }, { key: 'bank', label: 'Bank', render: titleCase },
                { key: 'cheque_no', label: 'Cheque no.' }, { key: 'cheque_date', label: 'Cheque date', render: date }, { key: 'amount', label: 'Amount', num: 1, render: money }]} />
          </Card>
          <Card title="Where the money went">
            <DataTable fileName="Accounts" rows={d.accounts} cols={[{ key: 'name', label: 'Account' }, { key: 'n', label: 'Receipts', num: 1 }, { key: 'amount', label: 'Amount', num: 1, render: money }]} />
          </Card>
        </>
      )}
    </Frame>
  );
}

// ------------------------------------------------------------------ Outstanding
export function Outstanding() {
  const [asOn, setAsOn] = useState('');
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    setState(s => ({ ...s, loading: true }));
    api('/reports/outstanding' + (asOn ? `?as_on=${asOn}` : '')).then(data => setState({ data })).catch(e => setState({ error: e.message }));
  }, [asOn]);
  const d = state.data;
  return (
    <>
      <Head title="Money to collect" sub="From the Outstanding Debtors statement" />
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      {state.loading && !d ? <Loading /> : !d?.summary ? nothing('outstanding statement') : (
        <>
          <div className="datebar no-print" style={{ marginBottom: 16 }}>
            <label className="small muted" htmlFor="ason">Statement as on</label>
            <select id="ason" style={{ width: 'auto', minWidth: 200 }} value={d.as_on} onChange={e => setAsOn(e.target.value)}>
              {d.snapshots.map(s => <option key={s} value={s}>{date(s)}</option>)}
            </select>
          </div>
          <div className="kpis">
            <Kpi tone="blue" label="Total to collect" value={short(d.summary.total)} sub={`${num(d.summary.bills)} bills · ${num(d.summary.parties)} parties`} title={inr(d.summary.total)} />
            <Kpi label="Older than 4 weeks" value={short(d.summary.over_4)} sub={`${pct(d.summary.over_4, d.summary.total)} of total`} title={inr(d.summary.over_4)} />
            <Kpi label="Older than 8 weeks" value={short(d.summary.over_8)} sub={`${num(d.summary.over_8_parties)} parties`} title={inr(d.summary.over_8)} />
          </div>
          <PartySearch asOn={d.as_on} />
          <div className="grid two" style={{ marginTop: 16 }}>
            <Card title="By age" desc="Weeks since the bill date">
              <Columns items={d.summary.buckets} value="balance" label="name" shades={AGE_SHADES} tipText={i => `${i.name}: ${inr(i.balance)} · ${num(i.bills)} bills`} />
              <div style={{ height: 16 }} />
              <DataTable fileName="Outstanding by age" exportable={false} rows={d.summary.buckets} footer={{ name: 'Total', bills: d.summary.bills, balance: d.summary.total }}
                cols={[{ key: 'name', label: 'Age' }, { key: 'bills', label: 'Bills', num: 1, render: num }, { key: 'balance', label: 'Amount', num: 1, render: money },
                  { key: 'share', label: 'Share', num: 1, render: (_, r) => r.name === 'Total' ? '100%' : pct(r.balance, d.summary.total) }]} />
            </Card>
            <Card title="Parties who owe the most">
              <DataTable fileName="Top debtors" rows={d.parties}
                cols={[{ key: 'name', label: 'Party', render: (v, r) => <>{v}<span className="sub">{titleCase(r.salesman)}</span></> },
                  { key: 'bills', label: 'Bills', num: 1 }, { key: 'oldest', label: 'Oldest', num: 1, render: v => v + ' wk' }, { key: 'balance', label: 'Amount', num: 1, render: money }]} />
            </Card>
          </div>
          <Card title="Salesman-wise" desc="Who needs to collect how much, and how old it is">
            <DataTable fileName="Salesman-wise outstanding" rows={d.salesmen}
              footer={Object.assign({ name: 'Total', bills: d.summary.bills, total: d.summary.total }, ...d.summary.buckets.map((b, k) => ({ ['b' + (k + 1)]: b.balance })))}
              cols={[{ key: 'name', label: 'Salesman', render: titleCase }, { key: 'bills', label: 'Bills', num: 1 },
                ...d.summary.buckets.map((b, k) => ({ key: 'b' + (k + 1), label: b.name, num: 1, render: rupees })),
                { key: 'total', label: 'Total', num: 1, render: v => <b>{rupees(v)}</b> }]} />
          </Card>
          <Card title="Oldest bills not yet paid">
            <DataTable fileName="Oldest bills" rows={d.oldest} cols={[{ key: 'date', label: 'Bill date', render: date }, { key: 'bill_no', label: 'Bill no.' },
              { key: 'party_name', label: 'Party' }, { key: 'salesman', label: 'Salesman', render: titleCase }, { key: 'age_weeks', label: 'Age', num: 1, render: v => v + ' wk' },
              { key: 'balance', label: 'Amount', num: 1, render: money }]} />
          </Card>
        </>
      )}
    </>
  );
}

function PartySearch({ asOn }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 350);
  const [res, setRes] = useState(null);
  useEffect(() => {
    if (dq.trim().length < 2) { setRes(null); return; }
    api(`/reports/outstanding/search?as_on=${asOn}&q=${encodeURIComponent(dq.trim())}`).then(setRes).catch(() => setRes({ bills: [] }));
  }, [dq, asOn]);
  const total = res?.bills.reduce((a, b) => a + Math.round(Number(b.balance) * 100), 0) / 100;
  return (
    <Card title="Find a party" desc="Type a shop name, party code or bill number">
      <input type="search" placeholder="e.g. Golden Sweets" value={q} onChange={e => setQ(e.target.value)} aria-label="Search party" />
      {res && (res.bills.length ? (
        <div style={{ marginTop: 14 }}>
          <p><b>{res.bills.length} bill(s)</b> · total due <b>{inr(total)}</b></p>
          <DataTable fileName={`Outstanding ${q}`} rows={res.bills} cols={[{ key: 'party_name', label: 'Party' }, { key: 'date', label: 'Bill date', render: date },
            { key: 'bill_no', label: 'Bill no.' }, { key: 'bill_amount', label: 'Bill', num: 1, render: money }, { key: 'received', label: 'Paid', num: 1, render: money },
            { key: 'balance', label: 'Due', num: 1, render: money }, { key: 'age_weeks', label: 'Age', num: 1, render: v => v + ' wk' }]} />
        </div>
      ) : <p className="muted" style={{ marginTop: 12 }}>No bills found for “{q}”.</p>)}
    </Card>
  );
}
