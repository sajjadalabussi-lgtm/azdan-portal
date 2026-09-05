"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = Number(id);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedId = sessionStorage.getItem("azdan_client_id");
    if (Number(savedId) !== clientId) {
      router.replace("/client-login");
      return;
    }

    supabase
      .from("project_files")
      .select("id,title,description,category,storage_path,file_name,created_at")
      .eq("client_id", clientId)
      .eq("is_visible_to_client", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setFiles(
          (data ?? []).map((file) => ({
            ...file,
            url: supabase.storage.from("project-files").getPublicUrl(file.storage_path).data.publicUrl,
          }))
        );
        setLoading(false);
      });
  }, [clientId, router]);

  if (loading) {
    return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-100">جاري التحميل...</main>;
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => router.back()} className="mb-4 rounded-xl border bg-white px-4 py-2 font-bold">← رجوع</button>
        <h1 className="text-3xl font-black">مستندات المشروع</h1>
        {files.length === 0 ? (
          <div className="mt-5 rounded-2xl bg-white p-6 text-slate-500">لا توجد مستندات متاحة حاليًا.</div>
        ) : (
          <div className="mt-5 grid gap-3">
            {files.map((file) => (
              <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5"
              >
                <div>
                  <b>{file.title || file.file_name}</b>
                  <p className="mt-1 text-sm text-slate-500">{file.description || file.file_name}</p>
                </div>
                <span className="text-2xl">📄</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
