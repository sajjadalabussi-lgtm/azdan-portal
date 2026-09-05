"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ProjectFile = {
  id: number;
  title: string | null;
  description: string | null;
  category: string | null;
  file_name: string;
  created_at: string;
  url: string;
};

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = Number(id);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!Number.isFinite(clientId) || clientId <= 0) {
      router.replace("/client-login");
      return;
    }

    (async () => {
      try {
        const response = await fetch(`/api/client-portal/${clientId}/documents`, {
          cache: "no-store",
        });

        if (response.status === 401 || response.status === 403) {
          router.replace("/client-login");
          return;
        }

        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "تعذر تحميل المستندات");

        setFiles((payload.files ?? []) as ProjectFile[]);
      } catch (loadError) {
        console.error(loadError);
        setError("تعذر تحميل مستندات المشروع حالياً.");
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId, router]);

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => router.push(`/client-portal/${clientId}`)}
          className="mb-4 rounded-xl border bg-white px-4 py-2 font-bold"
        >
          ← رجوع
        </button>

        <h1 className="text-3xl font-black">مستندات المشروع</h1>

        {loading ? (
          <div className="mt-5 rounded-2xl bg-white p-6 text-slate-500">جاري تحميل المستندات...</div>
        ) : error ? (
          <div className="mt-5 rounded-2xl bg-red-50 p-6 font-bold text-red-700">{error}</div>
        ) : files.length === 0 ? (
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
