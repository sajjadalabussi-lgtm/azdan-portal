"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";
import { logActivityClient } from "@/lib/log-activity-client";

export default function NewClientPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [projectName, setProjectName] = useState("");
  const [status, setStatus] = useState("قيد التنفيذ");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanPassword = password;
    const cleanProjectName = projectName.trim();

    if (!cleanName) {
      setMessage("يرجى كتابة اسم العميل");
      return;
    }

    if (!cleanPhone) {
      setMessage("رقم الهاتف مطلوب لتسجيل دخول العميل");
      return;
    }

    if (cleanPassword.length < 6) {
      setMessage("كلمة مرور العميل يجب ألا تقل عن 6 أحرف أو أرقام");
      return;
    }

    if (!cleanProjectName) {
      setMessage("يرجى كتابة اسم المشروع");
      return;
    }


    setLoading(true);
    setMessage("");

    const { data: createdClient, error } = await supabase
      .from("clients")
      .insert({
        name: cleanName,
        phone: cleanPhone,
        project_name: cleanProjectName,
        progress: 0,
        status,
      })
      .select("id")
      .single();

    if (error || !createdClient) {
      console.error(error);
      setMessage(`حدث خطأ: ${error?.message || "تعذر إنشاء العميل"}`);
      setLoading(false);
      return;
    }

    const { error: passwordError } = await supabase.rpc(
      "set_client_password",
      {
        p_client_id: createdClient.id,
        p_password: cleanPassword,
      }
    );

    if (passwordError) {
      console.error(passwordError);

      // لا نترك عميلاً بلا بيانات دخول إذا فشل حفظ كلمة المرور.
      await supabase
        .from("clients")
        .delete()
        .eq("id", createdClient.id);

      setMessage(
        `تعذر حفظ كلمة مرور العميل: ${passwordError.message}. تأكد من تشغيل ملف SQL الخاص بدخول العملاء أولاً.`
      );
      setLoading(false);
      return;
    }

    await logActivityClient({
      action: "create",
      entityType: "clients",
      entityId: createdClient.id,
      description: `أضاف العميل ${cleanName} لمشروع ${cleanProjectName}`,
      newData: {
        name: cleanName,
        phone: cleanPhone,
        project_name: cleanProjectName,
        progress: 0,
        status,
      },
    });

    setMessage("تمت إضافة العميل وبيانات الدخول بنجاح ✅");

    setName("");
    setPhone("");
    setPassword("");
    setProjectName("");
    setStatus("قيد التنفيذ");
    setLoading(false);
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6f8] px-6 py-10">
      <div className="mx-auto max-w-2xl rounded-[2rem] bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-black text-[#0b2239]">
          إضافة عميل جديد
        </h1>

        <p className="mt-2 text-gray-500">
          أدخل بيانات العميل ومشروعه وبيانات الدخول إلى بوابة العميل
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
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#d8b56a]"
              placeholder="مثال: السيد علي"
            />
          </div>

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
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-left outline-none focus:border-[#d8b56a]"
              placeholder="07XXXXXXXXX"
            />

            <p className="mt-2 text-xs text-gray-500">
              يستخدم العميل هذا الرقم لتسجيل الدخول.
            </p>
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-700">
              كلمة مرور العميل
            </label>

            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-left outline-none focus:border-[#d8b56a]"
              placeholder="6 أحرف أو أرقام على الأقل"
            />

            <p className="mt-2 text-xs text-gray-500">
              لا يتم حفظ كلمة المرور كنص ظاهر داخل قاعدة البيانات.
            </p>
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
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#d8b56a]"
              placeholder="مثال: إنشاء منزل السيد علي"
            />
          </div>

          <div className="rounded-2xl border border-[#d8b56a]/30 bg-[#fffaf0] p-4 text-sm font-bold text-[#79571c]">
            نسبة الإنجاز تبدأ من 0% وتُحسب تلقائياً من مراحل المشروع بعد إنشائها.
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-700">
              حالة المشروع
            </label>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#d8b56a]"
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
            className="w-full rounded-2xl bg-[#0b2239] py-3 font-black text-white hover:bg-[#143552] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "جاري الحفظ..." : "حفظ العميل"}
          </button>
        </form>
      </div>
    </main>
  );
}
