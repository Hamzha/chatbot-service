export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
      <p className="mt-2 text-slate-600">Welcome to your dashboard.</p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6">
          <h2 className="text-sm font-medium text-slate-500">Web Scraper</h2>
          <p className="mt-2 text-3xl font-semibold text-slate-900">Ready</p>
          <p className="mt-1 text-sm text-slate-500">Scrape and crawl websites</p>
        </div>
      </div>
    </div>
  );
}
