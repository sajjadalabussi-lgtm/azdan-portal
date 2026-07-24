import Link from "next/link";

export default function NotFound() {
  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-100 px-5">
      <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
        <p className="text-6xl font-black text-blue-700">404</p>
        <h1 className="mt-4 text-2xl font-black text-slate-900">الصفحة غير موجودة</h1>
        <p className="mt-3 text-slate-600">قد يكون الرابط قديمًا أو غير صحيح.</p>
        <Link href="/admin" className="mt-7 inline-block rounded-xl bg-slate-900 px-6 py-3 font-bold text-white hover:bg-slate-800">
          الرجوع إلى لوحة التحكم
        </Link>
      </section>
    </main>
  );
}
