"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Stage = {
  id: number;
  stage_name: string;
  status: string;
  progress: number;
  notes: string | null;
  engineer_name: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type Img = {
  id: number;
  storage_path: string;
  description: string | null;
  publicUrl: string;
};

export default function Page() {
  const params = useParams<{ id: string; stageId: string }>();
  const router = useRouter();
  const clientId = Number(params.id);
  const stageId = Number(params.stageId);
  const [stage, setStage] = useState<Stage | null>(null);
  const [images, setImages] = useState<Img[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedId = sessionStorage.getItem("azdan_client_id");
    if (Number(savedId) !== clientId) {
      router.replace("/client-login");
      return;
    }

    (async () => {
      const [stageResult, imagesResult] = await Promise.all([
        supabase
          .from("project_stages")
          .select(
            "id, stage_name, status, progress, notes, engineer_name, started_at, completed_at"
          )
          .eq("id", stageId)
          .eq("client_id", clientId)
          .single(),
        supabase
          .from("project_images")
          .select("id, storage_path, description")
          .eq("client_id", clientId)
          .eq("stage_id", stageId)
          .order("created_at", { ascending: false }),
      ]);

      if (!stageResult.error) setStage(stageResult.data as Stage);
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

  if (loading) {
    return (
      <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-100">
        جاري التحميل...
      </main>
    );
  }

  if (!stage) {
    return (
      <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-100">
        المرحلة غير موجودة
      </main>
    );
  }

  const formatDate = (date: string | null) =>
    date
      ? new Intl.DateTimeFormat("ar-IQ", { dateStyle: "long" }).format(new Date(date))
      : "غير محدد";

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => router.back()}
          className="mb-4 rounded-xl border bg-white px-4 py-2 font-bold"
        >
          ← رجوع
        </button>

        <section className="rounded-[2rem] bg-[#0b2239] p-6 text-white">
          <p className="text-sm font-black text-[#d8b56a]">تفاصيل المرحلة</p>
          <h1 className="mt-2 text-3xl font-black">{stage.stage_name}</h1>
          <p className="mt-4 text-sm font-bold text-slate-300">
            إنجاز المشروع الكلي يُحسب تلقائياً من عدد المراحل المكتملة.
          </p>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs text-slate-500">الحالة</p>
            <b>
              {stage.status === "completed"
                ? "مكتملة"
                : stage.status === "current"
                ? "قيد التنفيذ"
                : "لم تبدأ"}
            </b>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs text-slate-500">المهندس المشرف</p>
            <b>{stage.engineer_name || "غير محدد"}</b>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs text-slate-500">تاريخ البدء</p>
            <b>{formatDate(stage.started_at)}</b>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs text-slate-500">تاريخ الإنجاز</p>
            <b>{formatDate(stage.completed_at)}</b>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] bg-white p-6">
          <h2 className="text-xl font-black">ملاحظات المهندس</h2>
          <p className="mt-3 whitespace-pre-wrap leading-8 text-slate-600">
            {stage.notes || "لا توجد ملاحظات لهذه المرحلة."}
          </p>
        </section>

        <section className="mt-5 rounded-[2rem] bg-white p-6">
          <h2 className="text-xl font-black">صور المرحلة</h2>
          {images.length === 0 ? (
            <p className="mt-4 text-slate-500">لا توجد صور مضافة لهذه المرحلة.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              {images.map((image) => (
                <a key={image.id} href={image.publicUrl} target="_blank" rel="noreferrer">
                  <img
                    src={image.publicUrl}
                    alt={image.description || "صورة المرحلة"}
                    className="aspect-square w-full rounded-2xl object-cover"
                  />
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
