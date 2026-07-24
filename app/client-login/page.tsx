"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ClientLoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("clients")
      .select("id")
      .eq("phone", phone.trim())
      .eq("access_code", accessCode.trim())
      .maybeSingle();

    if (error) {
      console.error(error);
      setMessage(`حدث خطأ: ${error.message}`);
      setLoading(false);
      return;
    }

    if (!data) {
      setMessage("رقم الهاتف أو رمز الدخول غير صحيح");
      setLoading(false);
      return;
    }

    sessionStorage.setItem("azdan_client_id", String(data.id));

    router.push(`/client-portal/${data.id}`);
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
          أدخل رقم الهاتف ورمز الدخول لمتابعة مشروعك
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block font-medium text-gray-700">
              رقم الهاتف
            </label>

            <input
              type="text"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="07XXXXXXXXX"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-700">
              رمز الدخول
            </label>

            <input
              type="password"
              required
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="أدخل الرمز الخاص بك"
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