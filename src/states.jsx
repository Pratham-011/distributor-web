// GST state codes: the first two digits of a GSTIN. Same list as server/src/states.js.
export const STATES = [
  ['01', 'Jammu and Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'],
  ['05', 'Uttarakhand'], ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'],
  ['10', 'Bihar'], ['11', 'Sikkim'], ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'],
  ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'],
  ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'], ['24', 'Gujarat'],
  ['26', 'Dadra and Nagar Haveli and Daman and Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'],
  ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'],
  ['35', 'Andaman and Nicobar Islands'], ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'],
  ['97', 'Other Territory'],
];
export const STATE_NAME = Object.fromEntries(STATES);
export const STATES_BY_NAME = [...STATES].sort((a, b) => a[1].localeCompare(b[1]));

export function StateSelect({ value, onChange, required, ...p }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)} required={required} {...p}>
      <option value="" disabled>Choose the state…</option>
      {STATES_BY_NAME.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
    </select>
  );
}
