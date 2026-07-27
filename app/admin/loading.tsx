export default function AdminLoading() {
  return (
    <div dir="rtl" className="mx-auto max-w-7xl p-4 sm:p-7">
      <div className="animate-pulse space-y-5">
        <div className="h-32 rounded-3xl bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 rounded-2xl bg-slate-200" />
          ))}
        </div>
        <div className="h-80 rounded-3xl bg-slate-200" />
      </div>
    </div>
  );
}
