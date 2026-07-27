"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <main dir="rtl" className="flex min-h-[70vh] items-center justify-center p-5">
      <section className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-7 text-center shadow">
        <h1 className="text-2xl font-black text-red-700">تعذر تحميل صفحة الإدارة</h1>
        <p className="mt-3 leading-7 text-slate-600">
          تحقق من الاتصال ثم أعد المحاولة.
        </p>
        {error.digest && (
          <p className="mt-3 rounded-xl bg-slate-100 p-3 font-mono text-xs">
            {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white"
          >
            إعادة المحاولة
          </button>
          <Link href="/admin" className="rounded-xl bg-slate-200 px-5 py-3 font-black">
            لوحة التحكم
          </Link>
        </div>
      </section>
    </main>
  );
}
