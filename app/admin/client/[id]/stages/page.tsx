"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Client = {
  id: number;
  name: string;
  project_name: string;
  floors_count: number;
};

type Stage = {
  id: number;
  client_id: number;
  stage_order: number;
  stage_name: string;
  status: "pending" | "current" | "completed";
  progress: number;
  notes: string | null;
  engineer_name: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type StageImage = {
  id: number;
  stage_id: number;
  storage_path: string;
  description: string | null;
  url: string;
};

function clampProgress(value: number) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

export default function ProjectStagesAdminPage() {
  const params = useParams();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [images, setImages] = useState<StageImage[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Record<number, File[]>>({});
  const [imageDescriptions, setImageDescriptions] = useState<Record<number, string>>({});
  const [floorsCount, setFloorsCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    if (!Number.isFinite(clientId) || clientId <= 0) {
      setMessage("رقم المشروع غير صحيح");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const [clientResult, stagesResult, imagesResult] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, project_name, floors_count")
        .eq("id", clientId)
        .single(),
      supabase
        .from("project_stages")
        .select(
          "id, client_id, stage_order, stage_name, status, progress, notes, engineer_name, started_at, completed_at"
        )
        .eq("client_id", clientId)
        .order("stage_order", { ascending: true }),
      supabase
        .from("project_images")
        .select("id, stage_id, storage_path, description")
        .eq("client_id", clientId)
        .not("stage_id", "is", null)
        .order("created_at", { ascending: false }),
    ]);

    if (clientResult.error || !clientResult.data) {
      setMessage(`تعذر تحميل المشروع: ${clientResult.error?.message || "المشروع غير موجود"}`);
      setLoading(false);
      return;
    }

    if (stagesResult.error) {
      setMessage(`تعذر تحميل المراحل: ${stagesResult.error.message}`);
      setLoading(false);
      return;
    }

    if (imagesResult.error) {
      setMessage(`تعذر تحميل صور المراحل: ${imagesResult.error.message}`);
      setLoading(false);
      return;
    }

    const preparedImages = (imagesResult.data ?? []).map((image) => {
      const { data } = supabase.storage
        .from("project-images")
        .getPublicUrl(image.storage_path);

      return { ...image, url: data.publicUrl } as StageImage;
    });

    setClient(clientResult.data as Client);
    setFloorsCount(Number(clientResult.data.floors_count) || 1);
    setStages((stagesResult.data ?? []) as Stage[]);
    setImages(preparedImages);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const completedCount = useMemo(
    () => stages.filter((stage) => stage.status === "completed").length,
    [stages]
  );

  async function generateStages() {
    const confirmed = stages.length === 0 || window.confirm("إعادة التوليد ستحذف المراحل الحالية وتُنشئها من جديد. هل أنت متأكد؟");
    if (!confirmed) return;

    setGenerating(true);
    setMessage("");

    const { error } = await supabase.rpc("generate_project_stages", {
      p_client_id: clientId,
      p_floors_count: floorsCount,
    });

    if (error) {
      setMessage(`تعذر إنشاء المراحل: ${error.message}`);
      setGenerating(false);
      return;
    }

    setMessage("تم إنشاء مراحل المشروع بنجاح ✅");
    setGenerating(false);
    await loadData();
  }

  async function saveStage(stage: Stage) {
    setSavingId(stage.id);
    setMessage("");

    const { error } = await supabase
      .from("project_stages")
      .update({
        progress: clampProgress(stage.progress),
        notes: stage.notes?.trim() || null,
        engineer_name: stage.engineer_name?.trim() || null,
        status: stage.status,
        started_at: stage.status === "current" && !stage.started_at ? new Date().toISOString() : stage.started_at,
      })
      .eq("id", stage.id)
      .eq("client_id", clientId);

    if (error) {
      setMessage(`تعذر حفظ المرحلة: ${error.message}`);
      setSavingId(null);
      return;
    }

    setMessage(`تم حفظ مرحلة "${stage.stage_name}" ✅`);
    setSavingId(null);
    await loadData();
  }

  async function completeStage(stage: Stage) {
    if (!window.confirm(`هل اكتملت مرحلة "${stage.stage_name}"؟`)) return;

    setSavingId(stage.id);
    setMessage("");

    const { error } = await supabase.rpc("complete_project_stage", { p_stage_id: stage.id });

    if (error) {
      setMessage(`تعذر إكمال المرحلة: ${error.message}`);
      setSavingId(null);
      return;
    }

    setMessage("اكتملت المرحلة وتم الانتقال تلقائيًا إلى المرحلة التالية ✅");
    setSavingId(null);
    await loadData();
  }

  function chooseFiles(stageId: number, event: ChangeEvent<HTMLInputElement>) {
    setSelectedFiles((current) => ({
      ...current,
      [stageId]: Array.from(event.target.files ?? []),
    }));
  }

  async function uploadStageImages(stage: Stage) {
    const files = selectedFiles[stage.id] ?? [];
    if (files.length === 0) {
      setMessage(`اختر صور مرحلة "${stage.stage_name}" أولاً`);
      return;
    }

    setUploadingId(stage.id);
    setMessage("");
    let uploaded = 0;

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const extension = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "") || "jpg";
      const filePath = `${clientId}/stages/${stage.id}/${Date.now()}-${index}-${crypto.randomUUID().slice(0, 8)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("project-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) continue;

      const { error: insertError } = await supabase.from("project_images").insert({
        client_id: clientId,
        stage_id: stage.id,
        storage_path: filePath,
        description: imageDescriptions[stage.id]?.trim() || stage.stage_name,
      });

      if (insertError) {
        await supabase.storage.from("project-images").remove([filePath]);
        continue;
      }

      uploaded += 1;
    }

    setUploadingId(null);
    setSelectedFiles((current) => ({ ...current, [stage.id]: [] }));
    setImageDescriptions((current) => ({ ...current, [stage.id]: "" }));
    setMessage(uploaded > 0 ? `تم رفع ${uploaded} صورة لمرحلة "${stage.stage_name}" ✅` : "تعذر رفع الصور، تأكد من تنفيذ ملف SQL وصلاحيات التخزين");
    await loadData();
  }

  async function deleteImage(image: StageImage) {
    if (!window.confirm("هل تريد حذف هذه الصورة؟")) return;

    const { error: databaseError } = await supabase.from("project_images").delete().eq("id", image.id);
    if (databaseError) {
      setMessage(`تعذر حذف الصورة: ${databaseError.message}`);
      return;
    }

    await supabase.storage.from("project-images").remove([image.storage_path]);
    setMessage("تم حذف الصورة ✅");
    await loadData();
  }

  function updateLocalStage(stageId: number, changes: Partial<Pick<Stage, "progress" | "notes" | "engineer_name" | "status">>) {
    setStages((current) => current.map((stage) => stage.id === stageId ? { ...stage, ...changes } : stage));
  }

  if (loading) {
    return <main dir="rtl" className="min-h-screen bg-slate-100 p-5"><div className="mx-auto max-w-6xl rounded-3xl bg-white p-8 text-center">جاري تحميل مراحل المشروع...</div></main>;
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6f8] p-4 sm:p-7">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 rounded-[2rem] bg-[#0b2239] p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-[#d8b56a]">إدارة مراحل المشروع</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">{client?.project_name || "المشروع"}</h1>
            <p className="mt-2 text-sm text-slate-300">العميل: {client?.name}</p>
          </div>
          <Link href={`/admin/client/${clientId}`} className="rounded-2xl bg-white/10 px-5 py-3 text-center text-sm font-black">العودة للمشروع</Link>
        </div>

        {message && <div className="mt-5 rounded-2xl border border-[#d8b56a]/40 bg-[#fffaf0] px-4 py-3 text-sm font-bold text-[#79571c]">{message}</div>}

        <section className="mt-5 rounded-[2rem] bg-white p-5 shadow-lg sm:p-7">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="text-sm font-black text-[#0b2239]">عدد الطوابق</span>
              <select value={floorsCount} onChange={(event) => setFloorsCount(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[#d8b56a]">
                {[1, 2, 3, 4, 5].map((floor) => <option key={floor} value={floor}>{floor} {floor === 1 ? "طابق" : "طوابق"}</option>)}
              </select>
            </label>
            <button type="button" onClick={generateStages} disabled={generating} className="rounded-2xl bg-[#d8b56a] px-6 py-3 font-black text-[#0b2239] disabled:opacity-50">
              {generating ? "جاري الإنشاء..." : stages.length > 0 ? "إعادة توليد المراحل" : "إنشاء مراحل المشروع"}
            </button>
          </div>
          {stages.length > 0 && <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-black text-[#0b2239]">اكتمل {completedCount} من أصل {stages.length} مراحل</div>}
        </section>

        <section className="mt-5 space-y-4">
          {stages.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center"><div className="text-5xl">🏗️</div><p className="mt-4 font-black text-[#0b2239]">اضغط «إنشاء مراحل المشروع»</p></div>
          ) : stages.map((stage) => {
            const stageImages = images.filter((image) => image.stage_id === stage.id);
            return (
              <article key={stage.id} className={`rounded-[2rem] border bg-white p-5 shadow-md sm:p-6 ${stage.status === "current" ? "border-[#d8b56a] ring-4 ring-[#d8b56a]/10" : stage.status === "completed" ? "border-emerald-200" : "border-slate-200"}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full font-black ${stage.status === "completed" ? "bg-emerald-600 text-white" : stage.status === "current" ? "bg-[#d8b56a] text-[#0b2239]" : "bg-slate-200 text-slate-500"}`}>{stage.status === "completed" ? "✓" : stage.stage_order}</div>
                    <div><h2 className="text-lg font-black text-[#0b2239]">{stage.stage_name}</h2><p className="mt-1 text-xs font-bold text-slate-500">{stage.status === "completed" ? "مكتملة" : stage.status === "current" ? "المرحلة الحالية" : "قادمة"}</p></div>
                  </div>
                  <select value={stage.status} onChange={(event) => updateLocalStage(stage.id, { status: event.target.value as Stage["status"] })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"><option value="pending">قادمة</option><option value="current">حالية</option><option value="completed">مكتملة</option></select>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label><span className="text-xs font-black text-slate-500">اسم المهندس المشرف</span><input type="text" value={stage.engineer_name || ""} onChange={(event) => updateLocalStage(stage.id, { engineer_name: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-[#d8b56a]" placeholder="مثال: المهندس أحمد محمد" /></label>
                  <label><span className="text-xs font-black text-slate-500">نسبة المرحلة</span><div className="mt-2 flex items-center gap-2"><input type="number" min={0} max={100} value={stage.progress} onChange={(event) => updateLocalStage(stage.id, { progress: clampProgress(Number(event.target.value)) })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-black" /><span className="font-black">%</span></div></label>
                </div>

                <label className="mt-4 block"><span className="text-xs font-black text-slate-500">ملاحظات المهندس</span><textarea value={stage.notes || ""} onChange={(event) => updateLocalStage(stage.id, { notes: event.target.value })} rows={3} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#d8b56a]" placeholder="اكتب تفاصيل العمل المنجز في هذه المرحلة..." /></label>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#d8b56a]" style={{ width: `${clampProgress(stage.progress)}%` }} /></div>

                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <h3 className="font-black text-[#0b2239]">صور المرحلة</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                    <label><span className="text-xs font-bold text-slate-500">اختر الصور</span><input type="file" accept="image/*" multiple onChange={(event) => chooseFiles(stage.id, event)} className="mt-2 block w-full rounded-xl border border-slate-200 bg-white p-2 text-sm" /></label>
                    <label><span className="text-xs font-bold text-slate-500">وصف الصور</span><input value={imageDescriptions[stage.id] || ""} onChange={(event) => setImageDescriptions((current) => ({ ...current, [stage.id]: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" placeholder="مثال: صب أساس المرحلة" /></label>
                    <button type="button" onClick={() => uploadStageImages(stage)} disabled={uploadingId !== null} className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{uploadingId === stage.id ? "جاري الرفع..." : "رفع الصور"}</button>
                  </div>
                  {(selectedFiles[stage.id]?.length ?? 0) > 0 && <p className="mt-2 text-xs font-bold text-slate-500">تم اختيار {selectedFiles[stage.id].length} صورة</p>}

                  {stageImages.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{stageImages.map((image) => <div key={image.id} className="overflow-hidden rounded-xl border bg-white"><img src={image.url} alt={image.description || stage.stage_name} className="h-28 w-full object-cover" /><div className="p-2"><p className="line-clamp-2 text-xs text-slate-600">{image.description || "صورة المرحلة"}</p><button type="button" onClick={() => deleteImage(image)} className="mt-2 text-xs font-black text-red-600">حذف الصورة</button></div></div>)}</div>}
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => saveStage(stage)} disabled={savingId !== null} className="rounded-2xl bg-[#0b2239] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{savingId === stage.id ? "جاري الحفظ..." : "حفظ التعديلات"}</button>
                  {stage.status !== "completed" && <button type="button" onClick={() => completeStage(stage)} disabled={savingId !== null} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">اكتملت المرحلة ✓</button>}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
