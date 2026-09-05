"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { logActivityClient } from "@/lib/log-activity-client";

type ClientRow = {
  id: number;
  name: string;
  phone: string | null;
  project_name: string;
  status: string;
  progress: number;
  currentStage: string;
};

type ProjectStage = {
  client_id: number;
  stage_order: number;
  stage_name: string;
  status: "pending" | "current" | "completed" | string;
};

function progressFromStages(stages: ProjectStage[]) {
  if (stages.length === 0) return 0;
  const completed = stages.filter((stage) => stage.status === "completed").length;
  return Math.round((completed / stages.length) * 100);
}

function currentStageFromStages(stages: ProjectStage[]) {
  if (stages.length === 0) return "لم تبدأ المراحل";

  const current = stages.find((stage) => stage.status === "current");
  if (current) return current.stage_name;

  const firstPending = stages.find((stage) => stage.status === "pending");
  if (firstPending) return firstPending.stage_name;

  return "تم إكمال جميع المراحل";
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    setMessage("");

    const [clientsResult, stagesResult] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, phone, project_name, status, progress")
        .order("created_at", { ascending: false }),
      supabase
        .from("project_stages")
        .select("client_id, stage_order, stage_name, status")
        .order("stage_order", { ascending: true }),
    ]);

    if (clientsResult.error) {
      console.error(clientsResult.error);
      setMessage(`حدث خطأ: ${clientsResult.error.message}`);
      setLoading(false);
      return;
    }

    if (stagesResult.error) {
      console.error(stagesResult.error);
      setMessage(`تعذر تحميل مراحل المشاريع: ${stagesResult.error.message}`);
      setLoading(false);
      return;
    }

    const allStages = (stagesResult.data ?? []) as ProjectStage[];
    const prepared = (clientsResult.data ?? []).map((client) => {
      const projectStages = allStages.filter(
        (stage) => Number(stage.client_id) === Number(client.id)
      );

      return {
        ...client,
        progress: progressFromStages(projectStages),
        currentStage: currentStageFromStages(projectStages),
      } as ClientRow;
    });

    setClients(prepared);
    setLoading(false);
  }

  async function deleteClient(id: number, name: string) {
    const confirmed = window.confirm(`هل أنت متأكد من حذف العميل: ${name}؟`);
    if (!confirmed) return;

    const { error } = await supabase.from("clients").delete().eq("id", id);

    if (error) {
      console.error(error);
      setMessage(`تعذر حذف العميل: ${error.message}`);
      return;
    }

    await logActivityClient({
      action: "delete",
      entityType: "clients",
      entityId: id,
      description: `حذف العميل ${name}`,
    });

    setClients((currentClients) =>
      currentClients.filter((client) => client.id !== id)
    );

    setMessage("تم حذف العميل بنجاح");
  }

  const stats = useMemo(() => {
    const completed = clients.filter((client) => client.progress >= 100).length;
    const inProgress = clients.filter(
      (client) => client.progress > 0 && client.progress < 100
    ).length;

    return {
      total: clients.length,
      inProgress,
      completed,
    };
  }, [clients]);

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6f8] p-4 sm:p-7">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] bg-[#0b2239] p-5 text-white shadow-xl sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[#d8b56a]">إدارة المشاريع</p>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">قائمة العملاء</h1>
              <p className="mt-2 text-sm text-slate-300">
                متابعة العملاء ومراحل مشاريعهم من مكان واحد
              </p>
            </div>

            <Link
              href="/admin/new-client"
              className="rounded-2xl bg-[#d8b56a] px-6 py-3 text-center text-sm font-black text-[#0b2239] transition hover:brightness-105"
            >
              + إضافة عميل
            </Link>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-bold text-slate-500 sm:text-sm">إجمالي المشاريع</p>
            <p className="mt-2 text-2xl font-black text-[#0b2239]">{stats.total}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-bold text-slate-500 sm:text-sm">قيد التنفيذ</p>
            <p className="mt-2 text-2xl font-black text-[#0b2239]">{stats.inProgress}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-bold text-slate-500 sm:text-sm">مكتملة</p>
            <p className="mt-2 text-2xl font-black text-[#0b2239]">{stats.completed}</p>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-[#d8b56a]/40 bg-[#fffaf0] px-4 py-3 text-center text-sm font-bold text-[#79571c]">
            {message}
          </div>
        )}

        <section className="mt-5 overflow-hidden rounded-[2rem] bg-white shadow-lg">
          {loading ? (
            <p className="p-10 text-center font-bold text-slate-500">
              جاري تحميل العملاء...
            </p>
          ) : clients.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-bold text-slate-500">لا يوجد عملاء حتى الآن</p>
              <Link
                href="/admin/new-client"
                className="mt-4 inline-block rounded-2xl bg-[#d8b56a] px-5 py-3 font-black text-[#0b2239]"
              >
                إضافة أول عميل
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[980px] text-right">
                  <thead className="bg-[#f8fafc] text-sm text-slate-500">
                    <tr>
                      <th className="p-5">العميل</th>
                      <th className="p-5">المشروع</th>
                      <th className="p-5">المرحلة الحالية</th>
                      <th className="p-5">الإنجاز</th>
                      <th className="p-5">الحالة</th>
                      <th className="p-5">الإجراء</th>
                    </tr>
                  </thead>

                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id} className="border-t border-slate-100">
                        <td className="p-5">
                          <p className="font-black text-[#0b2239]">{client.name}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {client.phone || "لا يوجد رقم هاتف"}
                          </p>
                        </td>

                        <td className="p-5 font-bold text-slate-700">
                          {client.project_name}
                        </td>

                        <td className="p-5">
                          <span className="inline-flex rounded-xl bg-[#fff8e8] px-3 py-2 text-sm font-black text-[#8a651d]">
                            {client.currentStage}
                          </span>
                        </td>

                        <td className="p-5">
                          <div className="w-36">
                            <div className="mb-2 flex items-center justify-between text-xs font-black">
                              <span className="text-[#0b2239]">{client.progress}%</span>
                              <span className="text-slate-400">تلقائي</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100">
                              <div
                                className="h-2 rounded-full bg-[#d8b56a]"
                                style={{ width: `${client.progress}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="p-5">
                          <span className="inline-flex rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
                            {client.progress >= 100 ? "مكتمل" : client.status || "قيد التنفيذ"}
                          </span>
                        </td>

                        <td className="p-5">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/client/${client.id}`}
                              className="rounded-xl bg-[#0b2239] px-4 py-2.5 text-sm font-black text-white hover:bg-[#132f4c]"
                            >
                              فتح المشروع
                            </Link>
                            <Link
                              href={`/admin/edit-client/${client.id}`}
                              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
                            >
                              تعديل
                            </Link>
                            <button
                              type="button"
                              onClick={() => deleteClient(client.id, client.name)}
                              className="rounded-xl border border-red-100 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50"
                            >
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="grid gap-3 p-3 md:hidden">
                {clients.map((client) => (
                  <article
                    key={client.id}
                    className="rounded-2xl border border-slate-100 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-black text-[#0b2239]">{client.name}</h2>
                        <p className="mt-1 text-xs text-slate-400">{client.phone || "—"}</p>
                      </div>
                      <span className="rounded-xl bg-[#fff8e8] px-3 py-1.5 text-xs font-black text-[#8a651d]">
                        {client.progress}%
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm">
                      <div>
                        <p className="text-xs font-bold text-slate-400">المشروع</p>
                        <p className="mt-1 font-bold text-slate-700">{client.project_name}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400">المرحلة الحالية</p>
                        <p className="mt-1 font-black text-[#0b2239]">{client.currentStage}</p>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-[#d8b56a]"
                          style={{ width: `${client.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Link
                        href={`/admin/client/${client.id}`}
                        className="flex-1 rounded-xl bg-[#0b2239] px-4 py-3 text-center text-sm font-black text-white"
                      >
                        فتح المشروع
                      </Link>
                      <Link
                        href={`/admin/edit-client/${client.id}`}
                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600"
                      >
                        تعديل
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteClient(client.id, client.name)}
                        className="rounded-xl border border-red-100 px-4 py-3 text-sm font-bold text-red-600"
                      >
                        حذف
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
