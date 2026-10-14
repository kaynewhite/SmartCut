const sectionStyle = {
  background: '#0a1020',
  border: '1px solid #1e2a3a',
  borderRadius: 10,
  padding: 16,
  marginTop: 14,
};

export function DetailsSection({ title, children }) {
  return (
    <details style={sectionStyle}>
      <summary style={{ color: '#f0f0f0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{title}</summary>
      <div style={{ marginTop: 12 }}>{children}</div>
    </details>
  );
}

export function DetailsGrid({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ minWidth: 0 }}>
          <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 3 }}>{label}</div>
          <div style={{ color: '#d1d5db', fontSize: 13, overflowWrap: 'anywhere' }}>{value ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}

export function DetailsEmpty({ children = 'No records found.' }) {
  return <div style={{ color: '#6b7280', fontSize: 13, padding: '8px 0' }}>{children}</div>;
}

export const detailRecordStyle = {
  background: '#0f1827',
  borderRadius: 8,
  padding: 12,
  marginTop: 8,
};
