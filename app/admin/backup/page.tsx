"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";

type BackupFile = {
  format?: string;
  version?: number;
  generated_at?: string;
  summary?: Record<string, number>;
  tables?: Record<string, unknown[]>;
};

type RestoreResult = {
  message?: string;
  error?: string;
  restored?: Record<string, number>;
  skipped?: Array<{ table: string; reason: string }>;
};

const TABLE_LABELS: Record<string, string> = {
  profiles: "المستخدمون",
  clients: "العملاء والمشاريع",
  project_updates: "تحديثات المشاريع",
  project_images: "صور المشاريع",
  project_files: "ملفات المشاريع",
  project_finances: "البيانات المالية",
  project_payments: "الدفعات",
  project_notifications: "الإشعارات",
  project_tasks: "المهام",
  project_comments: "التعليقات",
  activity_logs: "سجل النشاط",
};

export default function BackupPage() {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [backup, setBackup] = useState<BackupFile | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);

  const totalRows = useMemo(() => {
    if (!backup?.summary) return 0;
    return Object.values(backup.summary).reduce(
      (sum, value) => sum + Number(value || 0),
      0
    );
  }, [backup]);

  function resetStatus() {
    setMessage("");
    setError("");
    setRestoreResult(null);
  }

  async function downloadBackup() {
    setDownloading(true);
    resetStatus();

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
      setDownloading(false);
    }
  }

  async function selectBackupFile(event: ChangeEvent<HTMLInputElement>) {
    resetStatus();
    setBackup(null);
    setConfirmText("");

    const selected = event.target.files?.[0] || null;
    setFile(selected);

    if (!selected) return;

    if (!selected.name.toLowerCase().endsWith(".json")) {
      setError("اختر ملف نسخة احتياطية بصيغة JSON.");
      return;
    }

    if (selected.size > 25 * 1024 * 1024) {
      setError("حجم الملف أكبر من 25MB.");
      return;
    }

    try {
      const text = await selected.text();
      const parsed = JSON.parse(text) as BackupFile;

      if (
        parsed.format !== "azdan-portal-backup" ||
        !parsed.tables ||
        typeof parsed.tables !== "object"
      ) {
        throw new Error("هذا الملف ليس نسخة احتياطية صحيحة لنظام أزدان.");
      }

      setBackup(parsed);
      setMessage("تم فحص الملف بنجاح. راجع التفاصيل قبل الاستعادة.");
    } catch (caughtError) {
      setFile(null);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "تعذر قراءة ملف النسخة الاحتياطية."
      );
    }
  }

  async function restoreBackup() {
    if (!file || !backup) {
      setError("اختر ملف النسخة الاحتياطية أولًا.");
      return;
    }

    if (confirmText.trim().toUpperCase() !== "RESTORE") {
      setError('اكتب كلمة RESTORE داخل خانة التأكيد.');
      return;
    }

    const accepted = window.confirm(
      "سيتم دمج بيانات النسخة مع البيانات الحالية. السجلات المتطابقة ستُحدّث. هل تريد المتابعة؟"
    );

    if (!accepted) return;

    setRestoring(true);
    resetStatus();

    try {
      const text = await file.text();
      const response = await fetch("/api/admin/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: text,
      });

      const result = (await response.json().catch(() => null)) as
        | RestoreResult
        | null;

      if (!response.ok) {
        throw new Error(result?.error || "تعذرت استعادة النسخة الاحتياطية.");
      }

      setRestoreResult(result);
      setMessage(result?.message || "اكتملت الاستعادة بنجاح.");
      setConfirmText("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "تعذرت استعادة النسخة الاحتياطية."
      );
    } finally {
      setRestoring(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-100 px-3 py-6 text-slate-900 sm:px-6 sm:py-10"
    >
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl bg-slate-950 p-5 text-white shadow-xl sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-300">حماية واسترجاع بيانات النظام</p>
              <h1 className="mt-1 text-3xl font-black">النسخ الاحتياطي والاستعادة</h1>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                تنزيل نسخة شاملة أو دمج نسخة سابقة مع قاعدة البيانات الحالية.
              </p>
            </div>

            <Link
              href="/admin"
              className="rounded-xl border border-slate-700 px-5 py-3 text-center font-black hover:bg-slate-900"
            >
              الرجوع للوحة التحكم
            </Link>
          </div>
        </header>

        {message && (
          <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">
            {message}
          </p>
        )}

        {error && (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
            {error}
          </p>
        )}

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <article className="rounded-3xl bg-white p-5 shadow sm:p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl">
              ⬇️
            </div>
            <h2 className="mt-4 text-2xl font-black">إنشاء نسخة احتياطية</h2>
            <p className="mt-3 leading-8 text-slate-600">
              تنزيل ملف JSON يتضمن بيانات المشاريع والمهام والدفعات والتعليقات
              والإشعارات وسجل النشاط.
            </p>

            <button
              type="button"
              onClick={downloadBackup}
              disabled={downloading || restoring}
              className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloading ? "جاري تجهيز النسخة..." : "تنزيل نسخة احتياطية الآن"}
            </button>
          </article>

          <article className="rounded-3xl border border-red-200 bg-white p-5 shadow sm:p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-2xl">
              ♻️
            </div>
            <h2 className="mt-4 text-2xl font-black">استعادة نسخة سابقة</h2>
            <p className="mt-3 leading-8 text-slate-600">
              الاستعادة تعمل بوضع الدمج الآمن: تضيف السجلات المفقودة وتحدّث
              السجلات المتطابقة، ولا تحذف البيانات الحالية.
            </p>

            <label className="mt-5 block">
              <span className="text-sm font-black">ملف النسخة الاحتياطية</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={selectBackupFile}
                disabled={restoring}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm"
              />
            </label>

            {backup && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500">الإصدار</p>
                    <p className="mt-1 font-black">{backup.version || 1}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">إجمالي السجلات</p>
                    <p className="mt-1 font-black">{totalRows}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">تاريخ النسخة</p>
                    <p className="mt-1 text-sm font-black">
                      {backup.generated_at
                        ? new Intl.DateTimeFormat("ar-IQ", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(backup.generated_at))
                        : "غير متوفر"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Object.entries(backup.summary || {}).map(([table, count]) => (
                    <div
                      key={table}
                      className="rounded-xl bg-white p-3 text-sm shadow-sm"
                    >
                      <p className="truncate font-bold text-slate-600">
                        {TABLE_LABELS[table] || table}
                      </p>
                      <p className="mt-1 text-lg font-black">{count}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="mt-5 block">
              <span className="text-sm font-black">
                للتأكيد اكتب RESTORE بالإنجليزية
              </span>
              <input
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                disabled={!backup || restoring}
                placeholder="RESTORE"
                autoComplete="off"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono uppercase outline-none focus:border-red-500 disabled:bg-slate-100"
              />
            </label>

            <button
              type="button"
              onClick={restoreBackup}
              disabled={
                restoring ||
                !backup ||
                confirmText.trim().toUpperCase() !== "RESTORE"
              }
              className="mt-4 w-full rounded-xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {restoring ? "جاري استعادة البيانات..." : "بدء الاستعادة الآمنة"}
            </button>
          </article>
        </section>

        {restoreResult?.restored && (
          <section className="mt-5 rounded-3xl bg-white p-5 shadow sm:p-6">
            <h2 className="text-xl font-black">نتيجة الاستعادة</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(restoreResult.restored).map(([table, count]) => (
                <div key={table} className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-sm font-bold text-emerald-800">
                    {TABLE_LABELS[table] || table}
                  </p>
                  <p className="mt-1 text-2xl font-black text-emerald-700">
                    {count}
                  </p>
                </div>
              ))}
            </div>

            {restoreResult.skipped && restoreResult.skipped.length > 0 && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-black text-amber-900">جداول تم تجاوزها</p>
                <div className="mt-2 space-y-2 text-sm text-amber-800">
                  {restoreResult.skipped.map((item) => (
                    <p key={item.table}>
                      {TABLE_LABELS[item.table] || item.table}: {item.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950 sm:p-6">
          <h2 className="font-black">تنبيهات مهمة</h2>
          <div className="mt-3 space-y-2 text-sm leading-7">
            <p>• أنشئ نسخة جديدة قبل تنفيذ أي استعادة.</p>
            <p>• لا تغلق الصفحة أثناء عملية الاستعادة.</p>
            <p>• الاستعادة لا تنشئ حسابات تسجيل دخول محذوفة من Supabase Auth.</p>
            <p>• ملفات Supabase Storage نفسها لا تدخل داخل ملف JSON؛ تُنسخ روابطها وبياناتها فقط.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
