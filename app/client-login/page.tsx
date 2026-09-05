"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ClientLoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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

    const { data, error } = await supabase.rpc(
      "verify_client_login",
      {
        p_phone: cleanPhone,
        p_password: password,
      }
    );

    if (error) {
      console.error(error);
      setMessage(
        "تعذر تسجيل الدخول حالياً. تأكد من إعداد دخول العملاء في Supabase."
      );
      setLoading(false);
      return;
    }

    const clientId = Number(data);

    if (!Number.isFinite(clientId) || clientId <= 0) {
      setMessage("رقم الهاتف أو كلمة المرور غير صحيحة");
      setLoading(false);
      return;
    }

    sessionStorage.setItem("azdan_client_id", String(clientId));

    router.push(`/client-portal/${clientId}`);
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-gray-100 px-6 text-gray-900"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-center text-3xl font-bold text-blue-700">
          بوابة عملاء أزدان
        </h1>

        <p className="mt-2 text-center text-gray-500">
          أدخل رقم الهاتف وكلمة المرور لمتابعة مشروعك
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block font-medium text-gray-700">
              رقم الهاتف
            </label>

            <input
              type="text"
              required
              dir="ltr"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="07XXXXXXXXX"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-left text-black outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-700">
              كلمة المرور
            </label>

            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="أدخل كلمة المرور"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black outline-none focus:border-blue-500"
            />
          </div>

          {message && (
            <p className="rounded-lg bg-red-50 p-3 text-center text-red-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "جاري تسجيل الدخول..." : "دخول"}
          </button>
        </form>
      </div>
    </main>
  );
}
