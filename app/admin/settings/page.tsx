import Link from "next/link";

import SettingsForm from "./settings-form";

export default function SettingsPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-6 shadow sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-500">إدارة هوية النظام</p>
            <h1 className="mt-1 text-3xl font-bold text-blue-700">إعدادات النظام</h1>
            <p className="mt-2 text-gray-500">اسم الشركة وبيانات الاتصال والشعار والألوان.</p>
          </div>

          <Link
            href="/admin"
            className="rounded-xl bg-slate-900 px-5 py-3 text-center font-bold text-white hover:bg-slate-800"
          >
            الرجوع للوحة التحكم
          </Link>
        </header>

        <SettingsForm />
      </div>
    </main>
  );
}
