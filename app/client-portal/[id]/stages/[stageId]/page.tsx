"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Client = {
  id: number;
  name: string;
  project_name: string;
};

type Stage = {
  id: number;
  stage_order: number;
  stage_name: string;
  status: "pending" | "current" | "completed";
  progress: number;
  notes: string | null;
  engineer_name: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type StageNav = Pick<Stage, "id" | "stage_order" | "stage_name" | "status">;

type Img = {
  id: number;
  storage_path: string;
  description: string | null;
  publicUrl: string;
};

function formatDate(date: string | null) {
  if (!date) return "غير محدد";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "غير محدد";
  return new Intl.DateTimeFormat("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

export default function Page() {
  const params = useParams<{ id: string; stageId: string }>();
  const router = useRouter();
  const clientId = Number(params.id);
  const stageId = Number(params.stageId);

  const [client, setClient] = useState<Client | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [stages, setStages] = useState<StageNav[]>([]);
  const [images, setImages] = useState<Img[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedId = sessionStorage.getItem("azdan_client_id");
    if (Number(savedId) !== clientId) {
      router.replace("/client-login");
      return;
    }

    (async () => {
      const [clientResult, stageResult, stagesResult, imagesResult] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, project_name")
          .eq("id", clientId)
          .single(),
        supabase
          .from("project_stages")
          .select(
            "id, stage_order, stage_name, status, progress, notes, engineer_name, started_at, completed_at"
          )
          .eq("id", stageId)
          .eq("client_id", clientId)
          .single(),
        supabase
          .from("project_stages")
          .select("id, stage_order, stage_name, status")
          .eq("client_id", clientId)
          .order("stage_order", { ascending: true }),
        supabase
          .from("project_images")
          .select("id, storage_path, description")
          .eq("client_id", clientId)
          .eq("stage_id", stageId)
          .order("created_at", { ascending: false }),
      ]);

      if (!clientResult.error) setClient(clientResult.data as Client);
      if (!stageResult.error) setStage(stageResult.data as Stage);
      if (!stagesResult.error) setStages((stagesResult.data ?? []) as StageNav[]);
      if (!imagesResult.error) {
        setImages(
          (imagesResult.data ?? []).map((image) => ({
            ...image,
            publicUrl: supabase.storage
              .from("project-images")
              .getPublicUrl(image.storage_path).data.publicUrl,
          })) as Img[]
        );
      }

      setLoading(false);
    })();
  }, [clientId, stageId, router]);

  const completedCount = useMemo(
    () => stages.filter((item) => item.status === "completed").length,
    [stages]
  );

  const overallProgress = stages.length
    ? Math.round((completedCount / stages.length) * 100)
    : 0;

  const stageIndex = stages.findIndex((item) => item.id === stageId);
  const previousStage = stageIndex > 0 ? stages[stageIndex - 1] : null;
  const nextStage = stageIndex >= 0 && stageIndex < stages.length - 1 ? stages[stageIndex + 1] : null;

  if (loading) {
    return (
      <main dir="rtl" className="grid min-h-screen place-items-center bg-[#f4f6f8] px-5">
        <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 text-center font-black text-[#0b2239] shadow-xl">
          جاري تحميل المرحلة...
        </div>
      </main>
    );
  }

  if (!stage) {
    return (
      <main dir="rtl" className="grid min-h-screen place-items-center bg-[#f4f6f8] px-5">
        <div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-black text-[#0b2239]">المرحلة غير موجودة</h1>
          <Link
            href={`/client-portal/${clientId}`}
            className="mt-5 inline-block rounded-2xl bg-[#0b2239] px-5 py-3 font-black text-white"
          >
            العودة إلى المشروع
          </Link>
        </div>
      </main>
    );
  }

  const statusText =
    stage.status === "completed"
      ? "مكتملة"
      : stage.status === "current"
      ? "قيد التنفيذ"
      : "لم تبدأ";

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6f8] p-4 pb-10 text-[#0b2239] sm:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            href={`/client-portal/${clientId}`}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 shadow-sm"
          >
            ← رجوع إلى المشروع
          </Link>
          <span className="text-xs font-bold text-slate-400">بوابة عملاء أزدان</span>
        </div>

        <section className="overflow-hidden rounded-[2rem] bg-[#0b2239] p-5 text-white shadow-xl shadow-[#0b2239]/15 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black text-[#d8b56a]">{client?.project_name || "مشروعك"}</p>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">{stage.stage_name}</h1>
              <p className="mt-2 text-sm text-slate-300">
                المرحلة {stage.stage_order} من {stages.length || "—"}
              </p>
            </div>
            <div className="flex items-end gap-4">
              <div>
                <p className="text-[11px] font-bold text-slate-300">إنجاز المشروع</p>
                <p className="mt-1 text-3xl font-black text-[#d8b56a]">{overallProgress}%</p>
              </div>
              <span
                className={`rounded-xl px-3 py-2 text-xs font-black ${
                  stage.status === "completed"
                    ? "bg-emerald-500/20 text-emerald-200"
                    : stage.status === "current"
                    ? "bg-[#d8b56a] text-[#0b2239]"
                    : "bg-white/10 text-slate-300"
                }`}
              >
                {statusText}
              </span>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-[#d8b56a]"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">المهندس المشرف</p>
            <p className="mt-2 text-sm font-black">{stage.engineer_name || "غير محدد"}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">تاريخ البدء</p>
            <p className="mt-2 text-sm font-black">{formatDate(stage.started_at)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">تاريخ الإنجاز</p>
            <p className="mt-2 text-sm font-black">{formatDate(stage.completed_at)}</p>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] bg-white p-5 shadow-lg shadow-slate-200/60 sm:p-6">
          <p className="text-xs font-black text-[#b48b3c]">ملاحظة المهندس</p>
          <h2 className="mt-1 text-xl font-black">آخر تفاصيل المرحلة</h2>
          <p className="mt-4 whitespace-pre-wrap leading-8 text-slate-600">
            {stage.notes || "لا توجد ملاحظات مضافة لهذه المرحلة حالياً."}
          </p>
        </section>

        <section className="mt-5 rounded-[2rem] bg-white p-5 shadow-lg shadow-slate-200/60 sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#b48b3c]">توثيق التنفيذ</p>
              <h2 className="mt-1 text-xl font-black">صور المرحلة</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500">
              {images.length} صورة
            </span>
          </div>

          {images.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              لا توجد صور مضافة لهذه المرحلة بعد.
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
              {images.map((image) => (
                <a
                  key={image.id}
                  href={image.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-2xl bg-slate-100"
                >
                  <img
                    src={image.publicUrl}
                    alt={image.description || "صورة المرحلة"}
                    className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  {image.description && (
                    <p className="bg-white px-3 py-2 text-xs font-bold text-slate-600">
                      {image.description}
                    </p>
                  )}
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="mt-5 flex items-center justify-between gap-3">
          {previousStage ? (
            <Link
              href={`/client-portal/${clientId}/stages/${previousStage.id}`}
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 shadow-sm"
            >
              <span className="block text-[10px] font-bold text-slate-400">المرحلة السابقة</span>
              <span className="mt-1 block truncate">{previousStage.stage_name}</span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}

          {nextStage ? (
            <Link
              href={`/client-portal/${clientId}/stages/${nextStage.id}`}
              className="min-w-0 flex-1 rounded-2xl bg-[#0b2239] px-4 py-3 text-sm font-black text-white shadow-sm"
            >
              <span className="block text-[10px] font-bold text-slate-300">المرحلة التالية</span>
              <span className="mt-1 block truncate">{nextStage.stage_name}</span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
        </section>
      </div>
    </main>
  );
}
