"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { AdminRole } from "@/lib/admin-permissions";
import { roleLabels } from "@/lib/admin-permissions";

type Props = {
  email: string;
  role: AdminRole;
};

export default function AdminSessionBar({ email, role }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleLogout() {
    setLoading(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(`تعذر تسجيل الخروج: ${error.message}`);
      setLoading(false);
      return;
    }

    router.replace("/admin-login");
    router.refresh();
  }

  return (
    <div dir="rtl" className="fixed bottom-4 left-4 z-50 max-w-[calc(100vw-2rem)] print:hidden">
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-black text-blue-700 sm:hidden"
          aria-expanded={expanded}
        >
          {expanded ? "إغلاق" : "الحساب"}
        </button>

        <div className="hidden min-w-0 px-2 sm:block">
          <p className="max-w-48 truncate text-xs font-bold text-slate-500">{email}</p>
          <p className="text-sm font-black text-blue-700">{roleLabels[role]}</p>
        </div>

        <Link
          href="/admin/profile"
          className="hidden rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 sm:block"
        >
          الملف الشخصي
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "جاري الخروج..." : "تسجيل الخروج"}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:hidden">
          <p className="break-all text-xs font-bold text-slate-500">{email}</p>
          <p className="mt-1 text-sm font-black text-blue-700">{roleLabels[role]}</p>
          <Link
            href="/admin/profile"
            onClick={() => setExpanded(false)}
            className="mt-3 block rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-black text-white"
          >
            فتح الملف الشخصي
          </Link>
        </div>
      )}
    </div>
  );
}
