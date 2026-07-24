"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";
import { logActivityClient } from "@/lib/log-activity-client";

export default function NewClientPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [projectName, setProjectName] = useState("");
  const [progress, setProgress] = useState("0");
  const [status, setStatus] = useState("قيد التنفيذ");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const { data: createdClient, error } = await supabase.from("clients").insert({
      name,
      phone,
      project_name: projectName,
      progress: Number(progress),
      status,
    }).select("id").single();

    if (error) {
      console.error(error);
      setMessage(`حدث خطأ: ${error.message}`);
      setLoading(false);
      return;
    }

    await logActivityClient({
      action: "create",
      entityType: "clients",
      entityId: createdClient?.id ?? null,
      description: `أضاف العميل ${name.trim()} لمشروع ${projectName.trim()}`,
      newData: { name, phone, project_name: projectName, progress: Number(progress), status },
    });

    setMessage("تمت إضافة العميل بنجاح ✅");

    setName("");
    setPhone("");
    setProjectName("");
    setProgress("0");
    setStatus("قيد التنفيذ");
    setLoading(false);
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-100 px-6 py-10"
    >
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-blue-700">
          إضافة عميل جديد
        </h1>

        <p className="mt-2 text-gray-500">
          أدخل بيانات العميل ومشروعه
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block font-medium text-gray-700">
              اسم العميل
            </label>

            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="مثال: السيد علي"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-700">
              رقم الهاتف
            </label>

            <input
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="07XXXXXXXXX"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-700">
              اسم المشروع
            </label>

            <input
              type="text"
              required
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="مثال: إنشاء منزل السيد علي"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-700">
              نسبة الإنجاز
            </label>

            <input
              type="number"
              min="0"
              max="100"
              required
              value={progress}
              onChange={(event) => setProgress(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-700">
              حالة المشروع
            </label>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option>قيد التنفيذ</option>
              <option>متوقف مؤقتاً</option>
              <option>مكتمل</option>
              <option>بانتظار موافقة العميل</option>
            </select>
          </div>

          {message && (
            <p className="rounded-lg bg-gray-100 p-3 text-center text-gray-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "جاري الحفظ..." : "حفظ العميل"}
          </button>
        </form>
      </div>
    </main>
  );
}