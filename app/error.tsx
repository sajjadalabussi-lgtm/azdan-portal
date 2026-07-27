"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-100 p-5">
      <section className="w-full max-w-xl rounded-3xl bg-white p-7 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-3xl">
          !
        </div>
        <h1 className="mt-5 text-2xl font-black text-slate-900">حدث خطأ غير متوقع</h1>
        <p className="mt-3 leading-7 text-slate-600">
          لم نتمكن من إكمال العملية. أعد المحاولة، وإذا تكرر الخطأ أرسل رقم التتبع إلى مدير النظام.
        </p>
        {error.digest && (
          <p className="mt-3 rounded-xl bg-slate-100 p-3 font-mono text-xs text-slate-600">
            رقم التتبع: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-black text-white hover:bg-blue-500"
        >
          إعادة المحاولة
        </button>
      </section>
    </main>
  );
}
