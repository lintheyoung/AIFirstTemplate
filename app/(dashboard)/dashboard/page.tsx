const stats = [
  ['Workspaces', '1'],
  ['API keys', '0'],
  ['Files', '0'],
  ['Jobs', '0'],
];

export default function DashboardPage() {
  return (
    <main className="dashboard">
      <h1>Control plane overview</h1>
      <div className="metric-grid">
        {stats.map(([label, value]) => (
          <section className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </section>
        ))}
      </div>
    </main>
  );
}
