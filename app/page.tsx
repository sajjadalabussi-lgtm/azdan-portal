import Link from "next/link";

export default function Home() {
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-100 flex items-center justify-center p-6"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-xl">
        <h1 className="text-3xl font-bold text-blue-700">
          أزدان للمقاولات العامة
        </h1>

        <p className="mt-4 text-gray-600">
          بوابة متابعة المشاريع
        </p>

        <Link
          href="/login"
          className="mt-7 inline-block rounded-lg bg-blue-600 px-7 py-3 text-white transition hover:bg-blue-700"
        >
          تسجيل الدخول
        </Link>
      </div>
    </main>
  );
}