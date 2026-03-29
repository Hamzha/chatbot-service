export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Overview</h1>
      <p className="mt-2 text-zinc-600">Welcome to your dashboard.</p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-500">Web Scraper</h2>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">Ready</p>
          <p className="mt-1 text-sm text-zinc-500">Scrape and crawl websites</p>
        </div>
      </div>
    </div>
  );
}
