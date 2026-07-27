"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="m-0 bg-slate-950 font-sans">
        <main className="flex min-h-screen items-center justify-center p-5">
          <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center">
            <h1 className="text-3xl font-black text-slate-950">تعذر تشغيل النظام</h1>
            <p className="mt-4 leading-8 text-slate-600">
              حدث خطأ عام أثناء تحميل التطبيق. أعد المحاولة بعد لحظات.
            </p>
            <button
              onClick={reset}
              className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-black text-white"
            >
              إعادة التشغيل
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
