"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { roleLabels, type AdminRole } from "@/lib/admin-permissions";

type Props = {
  userId: string;
  email: string;
  initialFullName: string;
  role: AdminRole;
  createdAt: string | null;
  lastSignInAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "غير متوفر";
  return new Intl.DateTimeFormat("ar-IQ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ProfileForm({
  userId,
  email,
  initialFullName,
  role,
  createdAt,
  lastSignInAt,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [fullName, setFullName] = useState(initialFullName);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMessage, setNameMessage] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const cleanName = fullName.trim();

    if (cleanName.length < 2) {
      setNameMessage("اكتب اسمًا صحيحًا من حرفين على الأقل.");
      return;
    }

    setNameLoading(true);
    setNameMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: cleanName, updated_at: new Date().toISOString() })
      .eq("id", userId);

    setNameLoading(false);
    setNameMessage(error ? `تعذر حفظ الاسم: ${error.message}` : "تم حفظ الاسم بنجاح.");
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordMessage("");

    if (password.length < 8) {
      setPasswordMessage("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordMessage("كلمتا المرور غير متطابقتين.");
      return;
    }

    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPasswordLoading(false);

    if (error) {
      setPasswordMessage(`تعذر تغيير كلمة المرور: ${error.message}`);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setPasswordMessage("تم تغيير كلمة المرور بنجاح.");
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-500">الحساب والأمان</p>
            <h1 className="mt-1 text-3xl font-black text-blue-700">الملف الشخصي</h1>
            <p className="mt-2 text-sm text-slate-500">حدّث اسمك أو غيّر كلمة المرور بأمان.</p>
          </div>
          <Link
            href="/admin"
            className="rounded-xl bg-slate-900 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-slate-700"
          >
            الرجوع للوحة التحكم
          </Link>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard label="البريد الإلكتروني" value={email || "غير متوفر"} />
          <InfoCard label="الدور" value={roleLabels[role]} />
          <InfoCard label="تاريخ إنشاء الحساب" value={formatDate(createdAt)} />
          <InfoCard label="آخر تسجيل دخول" value={formatDate(lastSignInAt)} />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={saveProfile} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-900">البيانات الشخصية</h2>
            <p className="mt-1 text-sm text-slate-500">الاسم يظهر في سجل النشاطات وإدارة المستخدمين.</p>

            <label className="mt-6 block text-sm font-black text-slate-700">الاسم الكامل</label>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={100}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="اكتب الاسم الكامل"
            />

            {nameMessage && (
              <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${nameMessage.includes("بنجاح") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {nameMessage}
              </p>
            )}

            <button
              disabled={nameLoading}
              className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-3 font-black text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {nameLoading ? "جاري الحفظ..." : "حفظ الاسم"}
            </button>
          </form>

          <form onSubmit={changePassword} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-900">تغيير كلمة المرور</h2>
            <p className="mt-1 text-sm text-slate-500">استخدم كلمة مرور قوية لا تقل عن 8 أحرف.</p>

            <label className="mt-6 block text-sm font-black text-slate-700">كلمة المرور الجديدة</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />

            <label className="mt-4 block text-sm font-black text-slate-700">تأكيد كلمة المرور</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />

            {passwordMessage && (
              <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${passwordMessage.includes("بنجاح") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {passwordMessage}
              </p>
            )}

            <button
              disabled={passwordLoading}
              className="mt-6 w-full rounded-2xl bg-slate-900 px-5 py-3 font-black text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {passwordLoading ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-900">{value}</p>
    </article>
  );
}
