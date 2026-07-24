"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

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
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="fixed bottom-5 left-5 z-50 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:bg-red-700 disabled:opacity-60 print:hidden"
    >
      {loading ? "جاري الخروج..." : "تسجيل الخروج"}
    </button>
  );
}
