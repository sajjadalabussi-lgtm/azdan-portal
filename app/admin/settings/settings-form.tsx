"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

type SystemSettings = {
  id: number;
  company_name: string;
  phone: string;
  email: string;
  address: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  updated_at?: string | null;
};

const INITIAL_SETTINGS: SystemSettings = {
  id: 1,
  company_name: "شركة أزدان للمقاولات العامة",
  phone: "",
  email: "",
  address: "",
  logo_url: "/logo.png",
  primary_color: "#2563eb",
  secondary_color: "#0f172a",
};

export default function SettingsForm() {
  const [settings, setSettings] = useState<SystemSettings>(INITIAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/admin/settings", { cache: "no-store" });
        const payload = (await response.json()) as {
          settings?: SystemSettings;
          error?: string;
        };

        if (!response.ok || !payload.settings) {
          throw new Error(payload.error || "تعذر تحميل الإعدادات.");
        }

        setSettings({ ...INITIAL_SETTINGS, ...payload.settings });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "تعذر تحميل الإعدادات.");
      } finally {
        setLoading(false);
      }
    }

    void loadSettings();
  }, []);

  function updateField<Key extends keyof SystemSettings>(
    key: Key,
    value: SystemSettings[Key]
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const payload = (await response.json()) as {
        settings?: SystemSettings;
        message?: string;
        error?: string;
      };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error || "تعذر حفظ الإعدادات.");
      }

      setSettings({ ...INITIAL_SETTINGS, ...payload.settings });
      setMessage(payload.message || "تم حفظ الإعدادات بنجاح.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر حفظ الإعدادات.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="rounded-2xl bg-white p-10 text-center text-gray-500 shadow">
        جاري تحميل إعدادات النظام...
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <section className="rounded-2xl bg-white p-5 shadow sm:p-7">
        <h2 className="text-xl font-bold">بيانات الشركة</h2>
        <p className="mt-1 text-sm text-gray-500">
          المعلومات الأساسية التي ستُستخدم لاحقًا في التقارير والواجهات.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-bold">اسم الشركة</span>
            <input
              required
              value={settings.company_name}
              onChange={(event) => updateField("company_name", event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold">رقم الهاتف</span>
            <input
              value={settings.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              dir="ltr"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold">البريد الإلكتروني</span>
            <input
              type="email"
              value={settings.email}
              onChange={(event) => updateField("email", event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              dir="ltr"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-bold">عنوان الشركة</span>
            <textarea
              rows={3}
              value={settings.address}
              onChange={(event) => updateField("address", event.target.value)}
              className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-bold">رابط الشعار</span>
            <input
              value={settings.logo_url}
              onChange={(event) => updateField("logo_url", event.target.value)}
              placeholder="/logo.png أو رابط https"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              dir="ltr"
            />
          </label>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-6">
          <h2 className="text-xl font-bold">ألوان الهوية</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="rounded-xl border border-gray-200 p-4">
              <span className="mb-3 block text-sm font-bold">اللون الرئيسي</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.primary_color}
                  onChange={(event) => updateField("primary_color", event.target.value)}
                  className="h-12 w-16 cursor-pointer rounded border-0 bg-transparent"
                />
                <input
                  value={settings.primary_color}
                  onChange={(event) => updateField("primary_color", event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2"
                  dir="ltr"
                />
              </div>
            </label>

            <label className="rounded-xl border border-gray-200 p-4">
              <span className="mb-3 block text-sm font-bold">اللون الثانوي</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.secondary_color}
                  onChange={(event) => updateField("secondary_color", event.target.value)}
                  className="h-12 w-16 cursor-pointer rounded border-0 bg-transparent"
                />
                <input
                  value={settings.secondary_color}
                  onChange={(event) => updateField("secondary_color", event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2"
                  dir="ltr"
                />
              </div>
            </label>
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
            {message}
          </p>
        )}

        <button
          disabled={saving}
          className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "جاري الحفظ..." : "حفظ إعدادات النظام"}
        </button>
      </section>

      <aside className="h-fit rounded-2xl bg-white p-5 shadow sm:p-6 xl:sticky xl:top-6">
        <p className="text-sm font-bold text-gray-500">معاينة الهوية</p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
          <div
            className="flex min-h-40 flex-col items-center justify-center p-6 text-center text-white"
            style={{ background: settings.secondary_color }}
          >
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-white p-2 shadow">
              <Image
                src={settings.logo_url || "/logo.png"}
                alt="شعار الشركة"
                fill
                sizes="80px"
                className="object-contain p-2"
                unoptimized
              />
            </div>
            <h3 className="mt-4 text-xl font-bold">{settings.company_name}</h3>
            <p className="mt-1 text-sm opacity-80">بوابة إدارة المشاريع</p>
          </div>
          <div className="p-5">
            <button
              type="button"
              className="w-full rounded-xl px-4 py-3 font-bold text-white"
              style={{ background: settings.primary_color }}
            >
              زر باللون الرئيسي
            </button>
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              {settings.phone && <p>الهاتف: {settings.phone}</p>}
              {settings.email && <p dir="ltr" className="text-right">{settings.email}</p>}
              {settings.address && <p>{settings.address}</p>}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs leading-6 text-gray-500">
          هذه الصفحة تحفظ الهوية في قاعدة البيانات. تطبيقها على كل صفحات النظام يكون في مرحلة التلميع النهائية.
        </p>
      </aside>
    </form>
  );
}
