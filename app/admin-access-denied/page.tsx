"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const permissionLabels: Record<string, string> = {
  view_clients: "عرض العملاء والمشاريع",
  manage_clients: "إضافة وتعديل العملاء",
  manage_updates: "إدارة تحديثات المشروع",
  manage_images: "رفع وإدارة صور المشروع",
  manage_files: "إدارة ملفات المشروع",
  manage_finance: "إدارة الحسابات والدفعات",
  manage_notifications: "إدارة الإشعارات",
  view_reports: "عرض تقارير المشروع",
  manage_users: "إدارة مستخدمي النظام",
};

function Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);

  const reason = searchParams.get("reason");
  const permission = searchParams.get("permission");

  let description = "الحساب لا يمتلك صلاحية صحيحة لدخول هذه الصفحة.";

  if (reason === "inactive") {
    description = "هذا الحساب موقوف حاليًا. راجع مدير النظام لتفعيله.";
  } else if (reason === "profile-error") {
    description = "تعذر قراءة بيانات صلاحية الحساب.";
  } else if (reason === "permission") {
    description = permission
      ? `لا تمتلك صلاحية: ${permissionLabels[permission] || permission}.`
      : "لا تمتلك صلاحية لفتح هذه الصفحة.";
  }

  async function logout() {
    setLoading(true);
    await supabase.auth.signOut();
    router.replace("/admin-login");
    router.refresh();
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-slate-100 px-4"
    >
      <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl">
          🔒
        </div>

        <h1 className="mt-6 text-3xl font-black text-slate-950">
          الدخول غير مسموح
        </h1>

        <p className="mt-3 leading-7 text-slate-600">{description}</p>

        <div className="mt-7 grid gap-3">
          <button
            type="button"
            onClick={() => router.replace("/admin")}
            className="w-full rounded-xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800"
          >
            العودة إلى لوحة الإدارة
          </button>

          <button
            type="button"
            onClick={logout}
            disabled={loading}
            className="w-full rounded-xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "جاري الخروج..." : "تسجيل الخروج"}
          </button>
        </div>
      </section>
    </main>
  );
}

export default function AdminAccessDeniedPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">جاري التحميل...</div>}>
      <Content />
    </Suspense>
  );
}