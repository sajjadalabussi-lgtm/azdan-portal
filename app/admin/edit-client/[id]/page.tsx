"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { logActivityClient } from "@/lib/log-activity-client";

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();

  const id = Number(params.id);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [projectName, setProjectName] = useState("");
  const [progress, setProgress] = useState("0");
  const [status, setStatus] = useState("قيد التنفيذ");

  const [originalProgress, setOriginalProgress] = useState(0);
  const [originalStatus, setOriginalStatus] = useState("قيد التنفيذ");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadClient() {
      if (!Number.isFinite(id) || id <= 0) {
        setMessage("رقم العميل غير صحيح");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone, project_name, progress, status")
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error(error);
        setMessage(
          `حدث خطأ: ${error?.message || "لم يتم العثور على العميل"}`
        );
        setLoading(false);
        return;
      }

      const loadedProgress = Math.min(
        Math.max(Number(data.progress) || 0, 0),
        100
      );

      const loadedStatus = data.status ?? "قيد التنفيذ";

      setName(data.name ?? "");
      setPhone(data.phone ?? "");
      setProjectName(data.project_name ?? "");
      setProgress(String(loadedProgress));
      setStatus(loadedStatus);

      setOriginalProgress(loadedProgress);
      setOriginalStatus(loadedStatus);

      setLoading(false);
    }

    loadClient();
  }, [id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanProjectName = projectName.trim();
    const numericProgress = Number(progress);

    if (!cleanName) {
      setMessage("يرجى كتابة اسم العميل");
      return;
    }

    if (!cleanProjectName) {
      setMessage("يرجى كتابة اسم المشروع");
      return;
    }

    if (
      !Number.isFinite(numericProgress) ||
      numericProgress < 0 ||
      numericProgress > 100
    ) {
      setMessage("نسبة الإنجاز يجب أن تكون بين 0 و100");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("clients")
      .update({
        name: cleanName,
        phone: cleanPhone || null,
        project_name: cleanProjectName,
        progress: numericProgress,
        status,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      setMessage(`تعذر حفظ التعديلات: ${error.message}`);
      setSaving(false);
      return;
    }

    await logActivityClient({
      action: "update",
      entityType: "clients",
      entityId: id,
      description: `عدّل بيانات العميل ${cleanName}`,
      oldData: { progress: originalProgress, status: originalStatus },
      newData: { name: cleanName, phone: cleanPhone || null, project_name: cleanProjectName, progress: numericProgress, status },
    });

    const notifications = [];

    if (numericProgress !== originalProgress) {
      notifications.push({
        client_id: id,
        title: "تم تحديث نسبة الإنجاز",
        message: `تم تحديث نسبة إنجاز المشروع من ${originalProgress}% إلى ${numericProgress}%.`,
        notification_type: "progress",
        is_read: false,
      });
    }

    if (status !== originalStatus) {
      notifications.push({
        client_id: id,
        title: "تم تحديث حالة المشروع",
        message: `تم تغيير حالة المشروع من "${originalStatus}" إلى "${status}".`,
        notification_type: "update",
        is_read: false,
      });
    }

    if (notifications.length > 0) {
      const { error: notificationError } = await supabase
        .from("project_notifications")
        .insert(notifications);

      if (notificationError) {
        console.error(
          "تم حفظ بيانات العميل، لكن تعذر إنشاء الإشعار:",
          notificationError
        );
      }
    }

    router.push("/admin/clients");
    router.refresh();
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-gray-100"
      >
        <p className="text-gray-600">جاري تحميل بيانات العميل...</p>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-gray-100 px-6 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-blue-700">
          تعديل بيانات العميل
        </h1>

        <p className="mt-2 text-gray-500">
          عند تغيير حالة المشروع أو نسبة الإنجاز سيصل إشعار تلقائي للعميل
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block font-medium text-gray-700">
              اسم العميل
            </label>

            <input
              required
              value={name}
              disabled={saving}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-700">
              رقم الهاتف
            </label>

            <input
              value={phone}
              disabled={saving}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-700">
              اسم المشروع
            </label>

            <input
              required
              value={projectName}
              disabled={saving}
              onChange={(event) => setProjectName(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60"
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
              step="1"
              required
              value={progress}
              disabled={saving}
              onChange={(event) => setProgress(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60"
            />

            {Number(progress) !== originalProgress && (
              <p className="mt-2 text-sm text-blue-700">
                النسبة السابقة: {originalProgress}% — النسبة الجديدة:{" "}
                {progress || "0"}%
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block font-medium text-gray-700">
              حالة المشروع
            </label>

            <select
              value={status}
              disabled={saving}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60"
            >
              <option>قيد التنفيذ</option>
              <option>متوقف مؤقتاً</option>
              <option>مكتمل</option>
              <option>بانتظار موافقة العميل</option>
            </select>

            {status !== originalStatus && (
              <p className="mt-2 text-sm text-blue-700">
                الحالة السابقة: {originalStatus} — الحالة الجديدة: {status}
              </p>
            )}
          </div>

          {message && (
            <p className="rounded-lg bg-red-50 p-3 text-red-700">
              {message}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 py-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>

            <Link
              href="/admin/clients"
              className={`rounded-lg bg-gray-200 px-6 py-3 text-gray-700 ${
                saving ? "pointer-events-none opacity-60" : "hover:bg-gray-300"
              }`}
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}