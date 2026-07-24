"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (username === "ali" && password === "1234") {
      router.push("/dashboard");
      return;
    }

    setError("اسم المستخدم أو كلمة المرور غير صحيحة");
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-gray-100 p-6"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-center text-3xl font-bold text-blue-700">
          تسجيل الدخول
        </h1>

        <p className="mt-2 text-center text-gray-500">
          بوابة عملاء أزدان
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              اسم المستخدم
            </label>

            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="أدخل اسم المستخدم"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-right outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              كلمة المرور
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="أدخل كلمة المرور"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-right outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <p className="text-center text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700"
          >
            دخول
          </button>
        </form>
      </div>
    </main>
  );
}