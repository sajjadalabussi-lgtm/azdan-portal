"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.75 5.75c0 8.56 6.94 15.5 15.5 15.5h.75a2.25 2.25 0 0 0 2.25-2.25v-1.37c0-.52-.36-.97-.86-1.09l-4.43-1.1a1.13 1.13 0 0 0-1.15.42l-.97 1.3a1.12 1.12 0 0 1-1.28.36 12.04 12.04 0 0 1-6.08-6.08 1.12 1.12 0 0 1 .36-1.28l1.3-.97c.36-.27.52-.72.42-1.15L7.46 3.61A1.12 1.12 0 0 0 6.37 2.75H5A2.25 2.25 0 0 0 2.75 5v.75Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3m-10.25 0h11.5A1.75 1.75 0 0 1 19.5 11.75v7.5A1.75 1.75 0 0 1 17.75 21H6.25A1.75 1.75 0 0 1 4.5 19.25v-7.5A1.75 1.75 0 0 1 6.25 10Z" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.67a2 2 0 0 0 2.73 2.73M9.88 4.25A10.4 10.4 0 0 1 12 4c5.5 0 9 4.8 9 8 0 1.25-.54 2.72-1.53 4.05M6.23 6.23C4.15 7.62 3 9.85 3 12c0 3.2 3.5 8 9 8 1.4 0 2.67-.31 3.8-.82" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.75 12S6.25 5.5 12 5.5 21.25 12 21.25 12 17.75 18.5 12 18.5 2.75 12 2.75 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export default function ClientLoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    const cleanPhone = phone.trim();

    if (!cleanPhone || !password) {
      setMessage("أدخل رقم الهاتف وكلمة المرور");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.rpc("verify_client_login_session", {
      p_phone: cleanPhone,
      p_password: password,
    });

    if (error) {
      console.error(error);
      setMessage("تعذر تسجيل الدخول حالياً. حاول مرة أخرى بعد قليل.");
      setLoading(false);
      return;
    }

    const result = data as { client_id?: number | string | null; token?: string | null } | null;
    const clientId = Number(result?.client_id);
    const token = String(result?.token || "");

    if (!Number.isFinite(clientId) || clientId <= 0 || !token) {
      setMessage("رقم الهاتف أو كلمة المرور غير صحيحة");
      setLoading(false);
      return;
    }

    sessionStorage.setItem("azdan_client_id", String(clientId));
    sessionStorage.setItem("azdan_client_token", token);
    router.push(`/client-portal/${clientId}`);
  }

  return (
    <main
      dir="rtl"
      className="relative min-h-[100dvh] overflow-hidden bg-[#f5f4f0] text-[#0b2239]"
    >
      {/* خلفية هندسية هادئة بنفس هوية أزدان */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#0b2239]/[0.055]" />
        <div className="absolute -left-28 bottom-[-7rem] h-80 w-80 rounded-full bg-[#d8b56a]/[0.12]" />
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(11,34,57,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(11,34,57,.055) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,.65), transparent 62%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <section className="w-full max-w-[440px] overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_24px_70px_rgba(11,34,57,0.12)] backdrop-blur-sm">
          {/* رأس الصفحة */}
          <div className="relative bg-[#0b2239] px-6 pb-8 pt-7 text-white sm:px-8">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#d8b56a]" />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.12em] text-[#d8b56a]">
                  AZDAN GENERAL CONTRACTING
                </p>
                <h1 className="mt-2 text-[28px] font-black leading-tight sm:text-[30px]">
                  بوابة عملاء أزدان
                </h1>
              </div>

              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-inner">
                <div className="flex h-8 items-end gap-1">
                  <span className="h-5 w-2 rounded-sm bg-[#d8b56a]" />
                  <span className="h-8 w-2 rounded-sm bg-white" />
                  <span className="h-6 w-2 rounded-sm bg-[#d8b56a]" />
                </div>
              </div>
            </div>

            <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">
              تابع مراحل التنفيذ، صور المشروع، وآخر التحديثات من مكان واحد.
            </p>
          </div>

          {/* الفورم */}
          <div className="px-6 py-7 sm:px-8 sm:py-8">
            <div className="mb-6 flex items-center gap-3 rounded-2xl bg-[#f7f4eb] px-4 py-3 text-xs text-[#5c6876]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#d8b56a]" />
              استخدم رقم الهاتف وكلمة المرور المستلمة من إدارة أزدان.
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="client-phone" className="mb-2 block text-sm font-bold text-[#0b2239]">
                  رقم الهاتف
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7b8793]">
                    <PhoneIcon />
                  </span>
                  <input
                    id="client-phone"
                    type="tel"
                    inputMode="tel"
                    required
                    dir="ltr"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="07XXXXXXXXX"
                    className="h-14 w-full rounded-2xl border border-[#d8dde3] bg-white pr-12 pl-4 text-left text-base font-medium text-[#0b2239] outline-none transition placeholder:text-[#9aa3ad] focus:border-[#d8b56a] focus:ring-4 focus:ring-[#d8b56a]/15"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="client-password" className="mb-2 block text-sm font-bold text-[#0b2239]">
                  كلمة المرور
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7b8793]">
                    <LockIcon />
                  </span>
                  <input
                    id="client-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="أدخل كلمة المرور"
                    className="h-14 w-full rounded-2xl border border-[#d8dde3] bg-white pr-12 pl-12 text-base font-medium text-[#0b2239] outline-none transition placeholder:text-[#9aa3ad] focus:border-[#d8b56a] focus:ring-4 focus:ring-[#d8b56a]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#7b8793] transition hover:bg-[#f3f5f7] hover:text-[#0b2239]"
                  >
                    <EyeIcon hidden={!showPassword} />
                  </button>
                </div>
              </div>

              {message && (
                <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0b2239] px-5 text-base font-bold text-white shadow-[0_10px_24px_rgba(11,34,57,0.20)] transition hover:bg-[#12314f] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    جاري تسجيل الدخول...
                  </>
                ) : (
                  <>
                    دخول إلى مشروعي
                    <span className="text-[#d8b56a]">←</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 border-t border-[#eef0f2] pt-5 text-center">
              <p className="text-xs leading-5 text-[#7a8490]">
                واجهتك مشكلة في الدخول؟ تواصل مع إدارة أزدان للحصول على بيانات الدخول.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
