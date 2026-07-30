"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProjectFile = { id: number; title: string; description: string | null; category: string; storage_path: string; file_name: string; file_size: number | string; created_at: string; publicUrl: string };
type FileRecord = Omit<ProjectFile, "publicUrl">;

const categories: Record<string, string> = { contract: "العقد", drawing: "المخططات", boq: "جدول الكميات BOQ", invoice: "الفواتير", report: "التقارير", document: "المستندات", other: "أخرى" };

function icon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "📕";
  if (ext === "doc" || ext === "docx") return "📘";
  if (ext === "xls" || ext === "xlsx") return "📗";
  if (ext === "dwg" || ext === "dxf") return "📐";
  if (["jpg", "jpeg", "png", "webp"].includes(ext || "")) return "🖼️";
  return "📄";
}

export default function ClientDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedId = sessionStorage.getItem("azdan_client_id");
    if (!Number.isFinite(clientId) || Number(savedId) !== clientId) {
      router.replace("/client-login");
      return;
    }

    async function loadData() {
      const result = await supabase.from("project_files").select("id, title, description, category, storage_path, file_name, file_size, created_at").eq("client_id", clientId).eq("is_visible_to_client", true).order("created_at", { ascending: false });
      if (result.error) {
        setMessage(result.error.message);
      } else {
        const prepared = ((result.data ?? []) as FileRecord[]).map((file) => ({ ...file, publicUrl: supabase.storage.from("project-files").getPublicUrl(file.storage_path).data.publicUrl }));
        setFiles(prepared);
      }
      setLoading(false);
    }

    loadData();
  }, [clientId, router]);

  function size(value: number | string) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return "الحجم غير متوفر";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f4f6f8] font-black text-[#0b2239]">جاري تحميل المستندات...</main>;

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6f8] px-4 py-6 text-[#10253b] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <button onClick={() => router.push(`/client-portal/${clientId}`)} className="mb-5 rounded-2xl bg-white px-4 py-3 text-sm font-black shadow-sm">→ الرجوع إلى البوابة</button>
        <section className="rounded-[2rem] bg-[#0b2239] p-6 text-white shadow-xl sm:p-8">
          <p className="text-sm font-black text-[#d8b56a]">مستندات المشروع</p>
          <h1 className="mt-2 text-3xl font-black">الملفات المتاحة للعميل</h1>
          <p className="mt-3 text-sm text-slate-300">العقود والمخططات والتقارير وجميع المستندات الخاصة بالمشروع.</p>
        </section>

        {message && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">تعذر تحميل الملفات: {message}</div>}

        {files.length === 0 ? <div className="mt-6 rounded-[2rem] bg-white p-10 text-center shadow-xl"><div className="text-5xl">📂</div><p className="mt-4 text-sm text-slate-500">لا توجد ملفات متاحة للعرض حتى الآن</p></div> : <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{files.map((file) => <article key={file.id} className="flex flex-col rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50"><div className="flex items-start gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f5efe2] text-3xl">{icon(file.file_name)}</div><div className="min-w-0"><h2 className="break-words text-lg font-black text-[#0b2239]">{file.title}</h2><p className="mt-1 text-xs font-black text-[#b48b3c]">{categories[file.category] || "أخرى"}</p><p className="mt-2 truncate text-xs text-slate-400">{file.file_name}</p></div></div>{file.description && <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{file.description}</p>}<p className="mt-4 text-xs text-slate-400">{size(file.file_size)}</p><a href={file.publicUrl} target="_blank" rel="noreferrer" className="mt-5 rounded-2xl bg-[#0b2239] px-5 py-3 text-center text-sm font-black text-white">فتح أو تحميل الملف</a></article>)}</section>}
      </div>
    </main>
  );
}
