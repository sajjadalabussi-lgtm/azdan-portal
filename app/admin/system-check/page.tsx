"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

type Result = {
  status?: string;
  timestamp?: string;
  checks?: Check[];
  error?: string;
};

export default function SystemCheckPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);

  async function runCheck() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/system-check", {
        cache: "no-store",
      });
      const data = (await response.json()) as Result;
      setResult(data);
    } catch {
      setResult({ error: "تعذر الاتصال بخدمة فحص النظام." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runCheck();
  }, []);

  const passed = result?.checks?.filter((item) => item.ok).length || 0;
  const total = result?.checks?.length || 0;

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 px-3 py-6 sm:px-6 sm:py-9">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <p className="text-sm text-slate-300">فحص الجاهزية والإعدادات</p>
          <h1 className="mt-1 text-3xl font-black">حالة النظام</h1>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={runCheck}
              disabled={loading}
              className="rounded-xl bg-amber-500 px-5 py-3 font-black text-slate-950 disabled:opacity-60"
            >
              {loading ? "جاري الفحص..." : "إعادة الفحص"}
            </button>
            <Link href="/admin" className="rounded-xl border border-slate-700 px-5 py-3 font-black">
              لوحة التحكم
            </Link>
          </div>
        </header>

        {result?.error && (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
            {result.error}
          </p>
        )}

        <section className="mt-5 rounded-3xl bg-white p-5 shadow sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">نتيجة الفحص</h2>
              <p className="mt-1 text-sm text-slate-500">
                {total ? `${passed} من ${total} فحوصات ناجحة` : "بانتظار النتيجة"}
              </p>
            </div>
            <span className={`rounded-full px-4 py-2 text-sm font-black ${
              total > 0 && passed === total
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-800"
            }`}>
              {total > 0 && passed === total ? "جاهز" : "يحتاج مراجعة"}
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {(result?.checks || []).map((check) => (
              <article
                key={check.name}
                className={`rounded-2xl border p-4 ${
                  check.ok
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{check.ok ? "✅" : "❌"}</span>
                  <div>
                    <h3 className="font-black">{check.name}</h3>
                    <p className="mt-1 break-words text-sm text-slate-600">{check.detail}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
