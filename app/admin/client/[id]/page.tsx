"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Permission from "@/app/admin/permission";

type Client = {
  id: number;
  name: string;
  phone: string | null;
  project_name: string;
  progress: number;
  status: string;
};

type Stage = {
  id: number;
  stage_order: number;
  stage_name: string;
  status: "pending" | "current" | "completed";
  progress: number;
  notes: string | null;
  engineer_name: string | null;
};


export default function ClientDetailsPage() {
  const params = useParams();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    if (!Number.isFinite(clientId) || clientId <= 0) {
      setMessage("رقم العميل غير صحيح");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const [clientResult, stagesResult] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, phone, project_name, progress, status")
        .eq("id", clientId)
        .single(),
      supabase
        .from("project_stages")
        .select(
          "id, stage_order, stage_name, status, progress, notes, engineer_name"
        )
        .eq("client_id", clientId)
        .order("stage_order", { ascending: true }),
    ]);

    if (clientResult.error || !clientResult.data) {
      setMessage(
        `تعذر تحميل بيانات المشروع: ${
          clientResult.error?.message || "المشروع غير موجود"
        }`
      );
      setLoading(false);
      return;
    }

    if (stagesResult.error) {
      console.error(stagesResult.error);
      setMessage(`تعذر تحميل مراحل المشروع: ${stagesResult.error.message}`);
    }

    setClient(clientResult.data as Client);
    setStages((stagesResult.data ?? []) as Stage[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentStage = useMemo(
    () =>
      stages.find((stage) => stage.status === "current") ||
      [...stages].reverse().find((stage) => stage.status === "completed") ||
      stages[0] ||
      null,
    [stages]
  );

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f4f6f8] p-5"
      >
        <div className="rounded-3xl bg-white px-8 py-6 font-bold text-[#0b2239] shadow-sm">
          جاري تحميل المشروع...
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f4f6f8] p-5"
      >
        <div className="max-w-md rounded-3xl bg-white p-7 text-center shadow-sm">
          <p className="font-bold text-red-600">
            {message || "لم يتم العثور على المشروع"}
          </p>
          <Link
            href="/admin/clients"
            className="mt-5 inline-block rounded-2xl bg-[#0b2239] px-5 py-3 font-bold text-white"
          >
            رجوع للعملاء
          </Link>
        </div>
      </main>
    );
  }

  const completedStages = stages.filter((stage) => stage.status === "completed").length;
  const safeProgress = stages.length > 0
    ? Math.round((completedStages / stages.length) * 100)
    : 0;
  const stageShare = stages.length > 0 ? Math.round(100 / stages.length) : 0;

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6f8] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-[2rem] bg-[#0b2239] p-6 text-white shadow-lg sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[#d8b56a]">إدارة المشروع</p>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">
                {client.project_name}
              </h1>
              <p className="mt-2 text-sm text-slate-300">العميل: {client.name}</p>
            </div>

            <Link
              href="/admin/clients"
              className="rounded-2xl bg-white/10 px-5 py-3 text-center text-sm font-black transition hover:bg-white/15"
            >
              رجوع للعملاء
            </Link>
          </div>
        </header>

        {message && (
          <div className="mt-4 rounded-2xl border border-[#d8b56a]/30 bg-[#fffaf0] px-4 py-3 text-sm font-bold text-[#79571c]">
            {message}
          </div>
        )}

        <section className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-400">رقم الهاتف</p>
            <p className="mt-2 text-lg font-black text-[#0b2239]">
              {client.phone || "غير مسجل"}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-400">حالة المشروع</p>
            <p className="mt-2 text-lg font-black text-[#0b2239]">
              {client.status || "قيد التنفيذ"}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-400">نسبة الإنجاز</p>
                <p className="mt-2 text-2xl font-black text-[#0b2239]">
                  {safeProgress}%
                </p>
              </div>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#d8b56a]"
                style={{ width: `${safeProgress}%` }}
              />
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black text-[#d8b56a]">المرحلة الحالية</p>
              <h2 className="mt-1 text-xl font-black text-[#0b2239]">
                {currentStage?.stage_name || "لم يتم إنشاء مراحل المشروع"}
              </h2>
            </div>
            {currentStage && (
              <div className="rounded-2xl bg-[#fffaf0] px-4 py-2 text-sm font-black text-[#9a6f1e]">
                إكمالها يضيف ≈ {stageShare}%
              </div>
            )}
          </div>

          {currentStage ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#f8fafc] p-4">
                  <p className="text-xs font-bold text-slate-400">المهندس المشرف</p>
                  <p className="mt-1 font-black text-[#0b2239]">
                    {currentStage.engineer_name || "غير محدد"}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#f8fafc] p-4">
                  <p className="text-xs font-bold text-slate-400">ملاحظة المرحلة</p>
                  <p className="mt-1 line-clamp-2 text-sm font-bold text-[#0b2239]">
                    {currentStage.notes || "لا توجد ملاحظات"}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm font-bold text-slate-500">
              ادخل على مراحل المشروع وأنشئ المراحل مرة واحدة.
            </p>
          )}
        </section>

        <section className="mt-5">
          <h2 className="mb-3 text-lg font-black text-[#0b2239]">إدارة المشروع</h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Permission permission="manage_updates">
              <Link
                href={`/admin/client/${client.id}/stages`}
                className="group rounded-3xl bg-[#d8b56a] p-5 text-[#0b2239] shadow-sm transition hover:-translate-y-0.5"
              >
                <div className="text-2xl">🏗️</div>
                <p className="mt-4 font-black">مراحل المشروع</p>
                <p className="mt-1 text-xs font-bold opacity-70">
                  التقدم، الصور والملاحظات
                </p>
              </Link>
            </Permission>

            <Permission permission="manage_finance">
              <Link
                href={`/admin/client/${client.id}/finance`}
                className="rounded-3xl bg-white p-5 text-[#0b2239] shadow-sm transition hover:-translate-y-0.5"
              >
                <div className="text-2xl">💰</div>
                <p className="mt-4 font-black">الحساب والدفعات</p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  المقبوض والمتبقي
                </p>
              </Link>
            </Permission>

            <Permission permission="manage_files">
              <Link
                href={`/admin/client/${client.id}/files`}
                className="rounded-3xl bg-white p-5 text-[#0b2239] shadow-sm transition hover:-translate-y-0.5"
              >
                <div className="text-2xl">📁</div>
                <p className="mt-4 font-black">ملفات المشروع</p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  المخططات والمستندات
                </p>
              </Link>
            </Permission>

            <Permission permission="manage_clients">
              <Link
                href={`/admin/edit-client/${client.id}`}
                className="rounded-3xl bg-white p-5 text-[#0b2239] shadow-sm transition hover:-translate-y-0.5"
              >
                <div className="text-2xl">✏️</div>
                <p className="mt-4 font-black">تعديل المشروع</p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  بيانات العميل والمشروع
                </p>
              </Link>
            </Permission>
          </div>
        </section>
      </div>
    </main>
  );
}
