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
  progress: number;
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

function calculateOverallProgress(stages: Stage[]) {
  if (stages.length === 0) return 0;
  const completed = stages.filter((stage) => stage.status === "completed").length;
  return Math.round((completed / stages.length) * 100);
}

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

export default function ProjectStagesAdminPage() {
  const params = useParams();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [images, setImages] = useState<StageImage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
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
        .select("id, name, project_name, floors_count, progress")
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

    const loadedStages = (stagesResult.data ?? []) as Stage[];
    const preparedImages = (imagesResult.data ?? []).map((image) => {
      const { data } = supabase.storage
        .from("project-images")
        .getPublicUrl(image.storage_path);
      return { ...image, url: data.publicUrl } as StageImage;
    });

    const automaticProgress = calculateOverallProgress(loadedStages);
    if (Number(clientResult.data.progress) !== automaticProgress) {
      const { error: progressError } = await supabase
        .from("clients")
        .update({ progress: automaticProgress })
        .eq("id", clientId);
      if (progressError) {
        console.error("تعذر مزامنة نسبة الإنجاز التلقائية:", progressError);
      }
    }

    setClient({ ...(clientResult.data as Client), progress: automaticProgress });
    setFloorsCount(Number(clientResult.data.floors_count) || 1);
    setStages(loadedStages);
    setImages(preparedImages);
    setSelectedStageId((current) => {
      if (current && loadedStages.some((stage) => stage.id === current)) return current;
      return (
        loadedStages.find((stage) => stage.status === "current")?.id ??
        loadedStages.find((stage) => stage.status === "pending")?.id ??
        loadedStages[loadedStages.length - 1]?.id ??
        null
      );
    });
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const completedCount = useMemo(
    () => stages.filter((stage) => stage.status === "completed").length,
    [stages]
  );

  const overallProgress = useMemo(() => calculateOverallProgress(stages), [stages]);

  const selectedStage = useMemo(
    () => stages.find((stage) => stage.id === selectedStageId) ?? null,
    [stages, selectedStageId]
  );

  const selectedStageImages = useMemo(
    () => (selectedStage ? images.filter((image) => image.stage_id === selectedStage.id) : []),
    [images, selectedStage]
  );

  async function generateStages() {
    const confirmed =
      stages.length === 0 ||
      window.confirm(
        "إعادة إنشاء المراحل ستحذف المراحل الحالية وتُنشئها من جديد. استخدمها فقط إذا كان عدد الطوابق غير صحيح. هل أنت متأكد؟"
      );
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
        notes: stage.notes?.trim() || null,
        engineer_name: stage.engineer_name?.trim() || null,
      })
      .eq("id", stage.id)
      .eq("client_id", clientId);

    if (error) {
      setMessage(`تعذر حفظ المرحلة: ${error.message}`);
      setSavingId(null);
      return;
    }

    setMessage(`تم حفظ مرحلة «${stage.stage_name}» ✅`);
    setSavingId(null);
    await loadData();
  }

  async function completeStage(stage: Stage) {
    if (stage.status !== "current") {
      setMessage("يمكن إكمال المرحلة الحالية فقط. المراحل القادمة تتفعل تلقائياً بالتسلسل.");
      return;
    }

    if (!window.confirm(`تأكيد اكتمال مرحلة «${stage.stage_name}»؟`)) return;

    setSavingId(stage.id);
    setMessage("");

    const { error } = await supabase.rpc("complete_project_stage", {
      p_stage_id: stage.id,
    });

    if (error) {
      setMessage(`تعذر إكمال المرحلة: ${error.message}`);
      setSavingId(null);
      return;
    }

    setMessage("تم إكمال المرحلة وتفعيل المرحلة التالية تلقائياً ✅");
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
      setMessage(`اختر صور مرحلة «${stage.stage_name}» أولاً`);
      return;
    }

    setUploadingId(stage.id);
    setMessage("");
    let uploaded = 0;

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const extension =
        (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "") || "jpg";
      const filePath = `${clientId}/stages/${stage.id}/${Date.now()}-${index}-${crypto
        .randomUUID()
        .slice(0, 8)}.${extension}`;

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
    setMessage(
      uploaded > 0
        ? `تم رفع ${uploaded} صورة لمرحلة «${stage.stage_name}» ✅`
        : "تعذر رفع الصور، تأكد من صلاحيات التخزين"
    );
    await loadData();
  }

  async function deleteImage(image: StageImage) {
    if (!window.confirm("هل تريد حذف هذه الصورة؟")) return;

    const { error: databaseError } = await supabase
      .from("project_images")
      .delete()
      .eq("id", image.id);

    if (databaseError) {
      setMessage(`تعذر حذف الصورة: ${databaseError.message}`);
      return;
    }

    await supabase.storage.from("project-images").remove([image.storage_path]);
    setMessage("تم حذف الصورة ✅");
    await loadData();
  }

  function updateLocalStage(
    stageId: number,
    changes: Partial<Pick<Stage, "notes" | "engineer_name">>
  ) {
    setStages((current) =>
      current.map((stage) => (stage.id === stageId ? { ...stage, ...changes } : stage))
    );
  }

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f4f6f8] p-5">
        <div className="mx-auto max-w-6xl rounded-3xl bg-white p-8 text-center font-bold text-[#0b2239] shadow-sm">
          جاري تحميل مراحل المشروع...
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6f8] p-4 text-[#0b2239] sm:p-7">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[2rem] bg-[#0b2239] p-5 text-white shadow-xl sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-[#d8b56a]">إدارة التنفيذ</p>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">
                {client?.project_name || "المشروع"}
              </h1>
              <p className="mt-2 text-sm text-slate-300">العميل: {client?.name}</p>
            </div>
            <Link
              href={`/admin/client/${clientId}`}
              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center text-sm font-black transition hover:bg-white/15"
            >
              ← رجوع إلى المشروع
            </Link>
          </div>
        </header>

        {message && (
          <div className="mt-4 rounded-2xl border border-[#d8b56a]/40 bg-[#fffaf0] px-4 py-3 text-sm font-bold text-[#79571c]">
            {message}
          </div>
        )}

        <section className="mt-5 rounded-[2rem] bg-white p-5 shadow-lg shadow-slate-200/60 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black text-[#b48b3c]">نسبة الإنجاز التلقائية</p>
              <div className="mt-1 flex items-end gap-3">
                <span className="text-4xl font-black text-[#0b2239]">{overallProgress}%</span>
                <span className="pb-1 text-xs font-bold text-slate-500">
                  {completedCount} من {stages.length || 0} مراحل مكتملة
                </span>
              </div>
            </div>
            <p className="max-w-md text-xs font-bold leading-6 text-slate-500">
              أنت فقط تُكمل المرحلة الحالية، والنظام يحسب الإنجاز ويُفعّل المرحلة التالية تلقائياً.
            </p>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#d8b56a] transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] bg-white p-5 shadow-lg shadow-slate-200/60 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#b48b3c]">مسار المشروع</p>
              <h2 className="mt-1 text-xl font-black">المراحل</h2>
            </div>
            {stages.length > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500">
                اضغط على أي مرحلة لعرضها
              </span>
            )}
          </div>

          {stages.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="font-black">لم يتم إنشاء مراحل المشروع بعد.</p>
              <p className="mt-2 text-sm text-slate-500">افتح «إعداد المراحل» أسفل الصفحة وأنشئها مرة واحدة.</p>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto pb-2">
              <div className="flex min-w-max items-start px-1">
                {stages.map((stage, index) => {
                  const completed = stage.status === "completed";
                  const current = stage.status === "current";
                  const selected = selectedStageId === stage.id;
                  const isLast = index === stages.length - 1;

                  return (
                    <button
                      type="button"
                      key={stage.id}
                      onClick={() => setSelectedStageId(stage.id)}
                      className="group relative flex w-[135px] shrink-0 flex-col items-center text-center sm:w-[155px]"
                    >
                      {!isLast && (
                        <div
                          className={`absolute right-1/2 top-5 h-1 w-full ${
                            completed ? "bg-emerald-500" : "bg-slate-200"
                          }`}
                        />
                      )}
                      <div
                        className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 text-sm font-black transition ${
                          completed
                            ? "border-emerald-100 bg-emerald-600 text-white"
                            : current
                            ? "border-[#f5e6c4] bg-[#d8b56a] text-[#0b2239]"
                            : "border-slate-100 bg-slate-200 text-slate-500"
                        } ${selected ? "ring-4 ring-[#d8b56a]/25" : ""}`}
                      >
                        {completed ? "✓" : stage.stage_order}
                      </div>
                      <p
                        className={`mt-2 max-w-[130px] text-xs font-black leading-5 ${
                          selected
                            ? "text-[#0b2239]"
                            : current
                            ? "text-[#9a6f1e]"
                            : completed
                            ? "text-emerald-700"
                            : "text-slate-500"
                        }`}
                      >
                        {stage.stage_name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {selectedStage && (
          <section className="mt-5 overflow-hidden rounded-[2rem] bg-white shadow-lg shadow-slate-200/60">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl font-black ${
                      selectedStage.status === "completed"
                        ? "bg-emerald-600 text-white"
                        : selectedStage.status === "current"
                        ? "bg-[#d8b56a] text-[#0b2239]"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {selectedStage.status === "completed" ? "✓" : selectedStage.stage_order}
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#b48b3c]">
                      {selectedStage.status === "current"
                        ? "المرحلة الحالية"
                        : selectedStage.status === "completed"
                        ? "مرحلة مكتملة"
                        : "مرحلة قادمة"}
                    </p>
                    <h2 className="mt-1 text-xl font-black sm:text-2xl">{selectedStage.stage_name}</h2>
                  </div>
                </div>
                <span
                  className={`w-fit rounded-xl px-3 py-2 text-xs font-black ${
                    selectedStage.status === "completed"
                      ? "bg-emerald-50 text-emerald-700"
                      : selectedStage.status === "current"
                      ? "bg-[#fff4d9] text-[#9a6f1e]"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {selectedStage.status === "completed"
                    ? "مكتملة"
                    : selectedStage.status === "current"
                    ? "قيد التنفيذ"
                    : "لم تبدأ"}
                </span>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">حصة المرحلة من الإنجاز</p>
                  <p className="mt-2 text-2xl font-black">
                    {stages.length ? `${Math.round(100 / stages.length)}% تقريباً` : "—"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">تاريخ البدء</p>
                  <p className="mt-2 text-sm font-black">{formatDate(selectedStage.started_at)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2 lg:col-span-1">
                  <p className="text-xs font-bold text-slate-500">تاريخ الإنجاز</p>
                  <p className="mt-2 text-sm font-black">{formatDate(selectedStage.completed_at)}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black text-slate-500">المهندس المشرف</span>
                  <input
                    type="text"
                    value={selectedStage.engineer_name || ""}
                    onChange={(event) =>
                      updateLocalStage(selectedStage.id, { engineer_name: event.target.value })
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none transition focus:border-[#d8b56a]"
                    placeholder="اسم المهندس المشرف"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black text-slate-500">ملاحظات المهندس</span>
                  <textarea
                    value={selectedStage.notes || ""}
                    onChange={(event) =>
                      updateLocalStage(selectedStage.id, { notes: event.target.value })
                    }
                    rows={3}
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#d8b56a]"
                    placeholder="اكتب ما تم إنجازه أو أي ملاحظة تريد أن تظهر للعميل..."
                  />
                </label>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black">صور المرحلة</p>
                    <p className="mt-1 text-xs text-slate-500">الصور المرفوعة هنا تظهر للعميل داخل نفس المرحلة.</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500">
                    {selectedStageImages.length} صورة
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <label>
                    <span className="text-xs font-bold text-slate-500">اختر الصور</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => chooseFiles(selectedStage.id, event)}
                      className="mt-2 block w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-bold text-slate-500">وصف اختياري</span>
                    <input
                      value={imageDescriptions[selectedStage.id] || ""}
                      onChange={(event) =>
                        setImageDescriptions((current) => ({
                          ...current,
                          [selectedStage.id]: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#d8b56a]"
                      placeholder="مثال: صب الأساس"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => uploadStageImages(selectedStage)}
                    disabled={uploadingId !== null}
                    className="rounded-xl bg-[#0b2239] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                  >
                    {uploadingId === selectedStage.id ? "جاري الرفع..." : "رفع الصور"}
                  </button>
                </div>

                {(selectedFiles[selectedStage.id]?.length ?? 0) > 0 && (
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    تم اختيار {selectedFiles[selectedStage.id].length} صورة
                  </p>
                )}

                {selectedStageImages.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {selectedStageImages.map((image) => (
                      <div key={image.id} className="overflow-hidden rounded-xl border bg-white">
                        <a href={image.url} target="_blank" rel="noreferrer">
                          <img
                            src={image.url}
                            alt={image.description || selectedStage.stage_name}
                            className="h-28 w-full object-cover"
                          />
                        </a>
                        <div className="p-2">
                          <p className="line-clamp-2 text-xs text-slate-600">
                            {image.description || "صورة المرحلة"}
                          </p>
                          <button
                            type="button"
                            onClick={() => deleteImage(image)}
                            className="mt-2 text-xs font-black text-red-600"
                          >
                            حذف
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => saveStage(selectedStage)}
                  disabled={savingId !== null}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-[#0b2239] disabled:opacity-50"
                >
                  {savingId === selectedStage.id ? "جاري الحفظ..." : "حفظ الملاحظات"}
                </button>

                {selectedStage.status === "current" && (
                  <button
                    type="button"
                    onClick={() => completeStage(selectedStage)}
                    disabled={savingId !== null}
                    className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white disabled:opacity-50"
                  >
                    اكتملت المرحلة ✓
                  </button>
                )}
              </div>

              {selectedStage.status === "pending" && (
                <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-center text-xs font-bold text-slate-500">
                  هذه المرحلة تتفعل تلقائياً بعد إكمال المرحلة التي قبلها.
                </p>
              )}
            </div>
          </section>
        )}

        <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-black text-slate-600">إعداد المراحل</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="text-xs font-bold text-slate-500">عدد الطوابق</span>
              <select
                value={floorsCount}
                onChange={(event) => setFloorsCount(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[#d8b56a]"
              >
                {[1, 2, 3, 4, 5].map((floor) => (
                  <option key={floor} value={floor}>
                    {floor} {floor === 1 ? "طابق" : "طوابق"}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={generateStages}
              disabled={generating}
              className="rounded-xl bg-[#d8b56a] px-5 py-3 text-sm font-black text-[#0b2239] disabled:opacity-50"
            >
              {generating ? "جاري الإنشاء..." : stages.length > 0 ? "إعادة إنشاء المراحل" : "إنشاء المراحل"}
            </button>
          </div>
          <p className="mt-3 text-xs leading-6 text-red-600">
            لا تستخدم «إعادة إنشاء المراحل» بعد بدء المشروع إلا إذا كنت متأكداً؛ لأنها تعيد بناء قائمة المراحل.
          </p>
        </details>
      </div>
    </main>
  );
}
