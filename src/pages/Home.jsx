import { Link } from 'react-router-dom';
import DateBar, { useDates } from '../components/DateBar.jsx';
import useReport from '../components/useReport.js';
import { SupportInfo, useSupport, hasSupport } from '../components/Support.jsx';
import { Kpi, Card, Notice, Bars, Columns, Badge, ReportSkeleton } from '../components/ui.jsx';
import { useAuth, can } from '../auth.jsx';
import { short, inr, num, pct, date, dateShort, rupees } from '../format.js';

export const AGE_SHADES = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];
const TYPES = [['sales', 'Sales'], ['purchase', 'Purchase'], ['credit_note', 'Credit notes'], ['debit_note', 'Debit notes'], ['receipt', 'Receipts'], ['outstanding', 'Outstanding'], ['stock', 'Stock']];

export default function Home() {
  const { user } = useAuth();
  const { range, dates } = useDates();
  const { data: d, error, loading } = useReport('overview');
  const noData = dates && !dates.days.length;

  return (
    <>
      <div className="page-head">
        <div className="grow"><h1>Hello, {user.name.split(' ')[0]}</h1><p className="muted">Here is how the business is doing.</p></div>
        {can(user, 'writer') && <Link className="btn primary" to="/upload">Upload today's files</Link>}
      </div>
      {noData ? (
        <Card><div className="empty"><h3>No files uploaded yet</h3><p>Start by uploading the day's Excel files from your billing software.</p>
          {can(user, 'writer') ? <Link className="btn primary" to="/upload">Upload files</Link> : <p className="muted">Ask an Uploader or the Owner to upload files.</p>}</div></Card>
      ) : (
        <>
          <DateBar />
          {range && dates && <UploadedFor range={range} dates={dates} />}
          {error && <Notice tone="bad">{error}</Notice>}
          {loading ? <ReportSkeleton /> : d && <Body d={d} />}
        </>
      )}
      <HelpCard />
    </>
  );
}

/** Contact details at the bottom of the dashboard. */
function HelpCard() {
  const s = useSupport();
  return hasSupport(s) ? <Card className="help-card" title="Need help?" desc="Uploads, reports, people or your plan: we are a call away."><SupportInfo /></Card> : null;
}

function UploadedFor({ range, dates }) {
  const inRange = new Set(dates.days.filter(x => x.date >= range.from && x.date <= range.to).flatMap(x => x.types));
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
      <span className="small muted">Files for these dates:</span>
      {TYPES.map(([k, l]) => <Badge key={k} tone={inRange.has(k) ? 'good' : 'grey'}>{inRange.has(k) ? '✓' : '–'} {l}</Badge>)}
    </div>
  );
}

function Body({ d }) {
  const S = d.sales, C = d.credit_note, R = d.receipts, O = d.outstanding;
  return (
    <>
      <div className="kpis">
        <Kpi tone="blue" label="Sales (before GST)" value={short(S.taxable)} sub={`${num(S.docs)} bills · ${num(S.parties)} shops`} title={inr(S.taxable)} />
        <Kpi tone="blue" label="Money received" value={short(R.total)} sub={R.n ? `${num(R.n)} receipts · Cash ${short(R.cash)}` : 'No receipts uploaded for these dates'} title={inr(R.total)} />
        <Kpi tone="blue" label="Money to collect" value={O ? short(O.total) : '–'} sub={O ? `As on ${date(O.as_on)} · ${num(O.parties)} parties` : 'No outstanding file yet'} title={O ? inr(O.total) : ''} />
        <Kpi tone="blue" label="Pending over 8 weeks" value={O ? short(O.over_8) : '–'} sub={O ? `${num(O.over_8_parties)} parties` : ''} title={O ? inr(O.over_8) : ''} />
      </div>
      <div className="kpis">
        <Kpi label="Bill value (with GST)" value={rupees(S.value)} sub={S.docs ? `Average bill ${rupees(Number(S.value) / S.docs)}` : ''} />
        <Kpi label="GST on sales" value={rupees(S.tax)} sub={`CGST ${rupees(S.cgst)} + SGST ${rupees(S.sgst)}`} />
        <Kpi label="Returns from shops" value={rupees(C.taxable)} sub={`${pct(C.taxable, S.taxable)} of sales · net sales ${short(d.net_sales)}`} />
        <Kpi label="Purchases" value={short(d.purchase.taxable)} sub={d.purchase.docs ? `${num(d.purchase.docs)} bills` : 'No purchases for these dates'} title={inr(d.purchase.taxable)} />
      </div>
      <div className="grid two">
        <Card title="Sales by brand" desc="Value before GST" actions={<Link to="/sales" className="btn small">All sales →</Link>}>
          <Bars items={d.brands} tipText={i => `${i.name}: ${inr(i.taxable)} · ${num(i.qty)} units · ${pct(i.taxable, S.taxable)} of sales`} />
        </Card>
        <Card title="Money to collect, by age" desc={O ? `As on ${date(O.as_on)} · weeks since the bill date` : ''} actions={<Link to="/outstanding" className="btn small">Details →</Link>}>
          {O ? <Columns items={O.buckets} value="balance" label="name" shades={AGE_SHADES} tipText={i => `${i.name}: ${inr(i.balance)} · ${num(i.bills)} bills`} />
            : <p className="muted">Upload the Outstanding Debtors file to see this.</p>}
        </Card>
      </div>
      {d.daily.length > 1 && (
        <Card title="Day by day" desc="Sales before GST for each day">
          <Columns items={d.daily.map(x => ({ ...x, label: dateShort(x.date) }))} value="sales" label="label" tipText={i => `${date(i.date)}: sales ${inr(i.sales)} · received ${inr(i.collected)}`} />
        </Card>
      )}
    </>
  );
}
