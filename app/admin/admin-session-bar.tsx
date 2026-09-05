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
    <div
      dir="rtl"
      className="fixed inset-x-3 bottom-3 z-50 print:hidden sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-[calc(100vw-2rem)]"
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-2 rounded-2xl border border-white/60 bg-white/95 p-2 shadow-xl shadow-slate-300/30 backdrop-blur sm:w-auto sm:max-w-none">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="min-w-20 rounded-xl bg-[#f5e6c4] px-3 py-2.5 text-xs font-black text-[#0b2239] sm:hidden"
          aria-expanded={expanded}
        >
          {expanded ? "إغلاق" : "الحساب"}
        </button>

        <div className="hidden min-w-0 px-2 sm:block">
          <p className="max-w-48 truncate text-xs font-bold text-slate-400">{email}</p>
          <p className="text-sm font-black text-[#0b2239]">{roleLabels[role]}</p>
        </div>

        <Link
          href="/admin/profile"
          className="hidden rounded-xl bg-[#f4f6f8] px-4 py-2.5 text-sm font-black text-[#0b2239] transition hover:bg-[#f5e6c4] sm:block"
        >
          الملف الشخصي
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          className="min-w-28 rounded-xl bg-[#0b2239] px-4 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "جاري الخروج..." : "تسجيل الخروج"}
        </button>
      </div>

      {expanded && (
        <div className="mx-auto mt-2 w-full max-w-md rounded-2xl border border-white/60 bg-white p-3 shadow-xl sm:hidden">
          <p className="break-all text-xs font-bold text-slate-400">{email}</p>
          <p className="mt-1 text-sm font-black text-[#0b2239]">{roleLabels[role]}</p>
          <Link
            href="/admin/profile"
            onClick={() => setExpanded(false)}
            className="mt-3 block rounded-xl bg-[#d8b56a] px-4 py-3 text-center text-sm font-black text-[#0b2239]"
          >
            فتح الملف الشخصي
          </Link>
        </div>
      )}
    </div>
  );
}
