"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (user) {
        router.replace("/admin");
        router.refresh();
        return;
      }

      setCheckingSession(false);
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setMessage("أدخل البريد الإلكتروني وكلمة المرور");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(
        error.message === "Invalid login credentials"
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
          : `تعذر تسجيل الدخول: ${error.message}`
      );
      setLoading(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  if (checkingSession) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-100"
      >
        <p className="font-bold text-slate-600">جاري التحقق من الجلسة...</p>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.35),_transparent_42%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.18),_transparent_38%)]" />

      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white p-7 shadow-2xl sm:p-9">
        <div className="text-center">
          <img
            src="/logo.png"
            alt="شعار أزدان"
            className="mx-auto h-24 w-24 rounded-2xl object-contain"
          />

          <h1 className="mt-5 text-3xl font-black text-slate-950">
            إدارة أزدان
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            سجّل الدخول للوصول إلى لوحة إدارة المشاريع
          </p>
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-bold text-slate-700"
            >
              البريد الإلكتروني
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@azdan.iq"
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-left outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              dir="ltr"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-bold text-slate-700"
            >
              كلمة المرور
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-left outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              dir="ltr"
            />
          </div>

          {message && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-700 px-5 py-3.5 font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <p className="mt-7 text-center text-xs text-slate-400">
          أزدان للمقاولات العامة — نظام إدارة المشاريع
        </p>
      </section>
    </main>
  );
}
