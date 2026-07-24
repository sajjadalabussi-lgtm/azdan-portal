"use client";

import Link from "next/link";
import { useState } from "react";

export default function BackupPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function downloadBackup() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/backup", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(result?.error || "تعذر إنشاء النسخة الاحتياطية.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename =
        filenameMatch?.[1] ||
        `azdan-backup-${new Date().toISOString().slice(0, 10)}.json`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setMessage("تم إنشاء النسخة الاحتياطية وتنزيلها بنجاح.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "تعذر إنشاء النسخة الاحتياطية."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 sm:px-6 sm:py-10"
    >
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-500">حماية بيانات النظام</p>
            <h1 className="mt-1 text-3xl font-bold text-blue-700">
              النسخ الاحتياطي
            </h1>
            <p className="mt-2 text-gray-500">
              تنزيل نسخة JSON من بيانات العملاء والمشاريع والدفعات والسجلات.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-xl bg-slate-900 px-5 py-3 text-center font-bold text-white hover:bg-slate-800"
          >
            الرجوع للوحة التحكم
          </Link>
        </header>

        <section className="mt-6 grid gap-5 md:grid-cols-3">
          <article className="rounded-2xl bg-white p-6 shadow md:col-span-2">
            <h2 className="text-xl font-bold">إنشاء نسخة جديدة</h2>
            <p className="mt-3 leading-8 text-gray-600">
              الملف يتضمن الجداول الأساسية، ويُحفظ على جهازك فقط. احتفظ به في
              مكان آمن ولا ترسله لأي شخص لأنه قد يحتوي على معلومات العملاء.
            </p>

            <button
              type="button"
              onClick={downloadBackup}
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "جاري تجهيز النسخة..." : "تنزيل نسخة احتياطية الآن"}
            </button>

            {message && (
              <p className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
                {message}
              </p>
            )}

            {error && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                {error}
              </p>
            )}
          </article>

          <aside className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-bold">إرشادات مهمة</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-gray-600">
              <p>أنشئ نسخة بعد أي تحديث كبير للنظام.</p>
              <p>احتفظ بنسختين: واحدة على الجهاز وأخرى على تخزين آمن.</p>
              <p>الاستعادة ليست تلقائية لحماية البيانات من الاستبدال الخطأ.</p>
            </div>
          </aside>
        </section>

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h2 className="font-bold">ملاحظة عن الاستعادة</h2>
          <p className="mt-2 leading-7">
            استعادة البيانات عملية حساسة وقد تستبدل سجلات حالية؛ لذلك تُجرى من
            Supabase بعد فحص ملف النسخة، وليس بزر مباشر داخل الموقع.
          </p>
        </section>
      </div>
    </main>
  );
}
