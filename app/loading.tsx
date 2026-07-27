export default function Loading() {
  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
        <p className="mt-4 font-bold text-slate-600">جاري تحميل النظام...</p>
      </div>
    </main>
  );
}
