"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { logActivityClient } from "@/lib/log-activity-client";

type Client = {
  id: number;
  name: string;
  phone: string | null;
  project_name: string;
  progress: number;
  status: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage(`حدث خطأ: ${error.message}`);
      setLoading(false);
      return;
    }

    setClients(data ?? []);
    setLoading(false);
  }

  async function deleteClient(id: number, name: string) {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف العميل: ${name}؟`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", id);

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

  return (
    <main dir="rtl" className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-700">
              قائمة العملاء
            </h1>

            <p className="mt-2 text-gray-500">
              جميع العملاء والمشاريع المسجلة
            </p>
          </div>

          <Link
            href="/admin/new-client"
            className="rounded-lg bg-blue-600 px-5 py-3 text-center text-white hover:bg-blue-700"
          >
            إضافة عميل
          </Link>
        </div>

        {message && (
          <p className="mb-4 rounded-lg bg-white p-3 text-center text-gray-700 shadow">
            {message}
          </p>
        )}

        <div className="overflow-x-auto rounded-2xl bg-white shadow">
          {loading ? (
            <p className="p-8 text-center text-gray-500">
              جاري تحميل العملاء...
            </p>
          ) : clients.length === 0 ? (
            <p className="p-8 text-center text-gray-500">
              لا يوجد عملاء حتى الآن
            </p>
          ) : (
            <table className="w-full min-w-[950px] text-right">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-4">اسم العميل</th>
                  <th className="p-4">رقم الهاتف</th>
                  <th className="p-4">اسم المشروع</th>
                  <th className="p-4">نسبة الإنجاز</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4">الإجراءات</th>
                </tr>
              </thead>

              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-t">
                    <td className="p-4 font-medium">{client.name}</td>

                    <td className="p-4">
                      {client.phone || "—"}
                    </td>

                    <td className="p-4">
                      {client.project_name}
                    </td>

                    <td className="p-4">
                      <div className="w-40">
                        <div className="mb-1 text-sm">
                          {client.progress}%
                        </div>

                        <div className="h-2 rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-blue-600"
                            style={{
                              width: `${Math.min(
                                Math.max(client.progress, 0),
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      {client.status}
                    </td>

                    <td className="p-4">
                      <div className="flex gap-2">

                        <Link
                          href={`/admin/client/${client.id}`}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                        >
                          عرض
                        </Link>

                        <Link
                          href={`/admin/edit-client/${client.id}`}
                          className="rounded-lg bg-amber-500 px-4 py-2 text-white hover:bg-amber-600"
                        >
                          تعديل
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            deleteClient(client.id, client.name)
                          }
                          className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                        >
                          حذف
                        </button>

                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}