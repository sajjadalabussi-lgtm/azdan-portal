"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Client = {
  id: number;
  name: string;
  phone: string | null;
  project_name: string;
  progress: number;
  status: string;
};

type NotificationRecord = {
  id: number;
  client_id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
};

function clampProgress(value: number) {
  return Math.min(Math.max(Number(value) || 0, 0), 100);
}

function notificationIcon(type: string) {
  if (type === "payment") return "💰";
  if (type === "file") return "📄";
  if (type === "update") return "🏗️";
  if (type === "progress") return "📈";
  return "🔔";
}

export default function ClientPortalPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  useEffect(() => {
    const savedId = sessionStorage.getItem("azdan_client_id");

    if (!Number.isFinite(clientId) || clientId <= 0 || Number(savedId) !== clientId) {
      router.replace("/client-login");
      return;
    }

    async function loadData() {
      setLoading(true);
      setMessage("");

      const [clientResult, notificationsResult] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, phone, project_name, progress, status")
          .eq("id", clientId)
          .single(),
        supabase
          .from("project_notifications")
          .select("id, client_id, title, message, notification_type, is_read, created_at, read_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (clientResult.error || !clientResult.data) {
        setMessage(clientResult.error?.message || "تعذر تحميل المشروع");
        setLoading(false);
        return;
      }

      setClient(clientResult.data as Client);
      setNotifications(
        notificationsResult.error
          ? []
          : ((notificationsResult.data ?? []) as NotificationRecord[])
      );
      setLoading(false);
    }

    loadData();
  }, [clientId, router]);

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  function logout() {
    sessionStorage.removeItem("azdan_client_id");
    router.replace("/client-login");
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  }

  async function markAllAsRead() {
    if (markingAllRead || unreadCount === 0) return;
    setMarkingAllRead(true);
    const readAt = new Date().toISOString();

    const { error } = await supabase
      .from("project_notifications")
      .update({ is_read: true, read_at: readAt })
      .eq("client_id", clientId)
      .eq("is_read", false);

    if (!error) {
      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true, read_at: readAt }))
      );
    } else {
      setMessage(`تعذر تحديث الإشعارات: ${error.message}`);
    }

    setMarkingAllRead(false);
  }

  if (loading) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-5">
        <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0b2239] text-2xl font-black text-[#d8b56a]">أ</div>
          <p className="mt-5 font-black text-[#0b2239]">جاري تجهيز بوابة مشروعك...</p>
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-5">
        <div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <h1 className="text-2xl font-black text-[#0b2239]">تعذر فتح بوابة المشروع</h1>
          <p className="mt-3 text-sm text-red-600">{message}</p>
          <button onClick={logout} className="mt-6 w-full rounded-2xl bg-[#0b2239] px-5 py-3.5 font-bold text-white">العودة لتسجيل الدخول</button>
        </div>
      </main>
    );
  }

  const progress = clampProgress(client.progress);

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6f8] text-[#10253b]">
      <header className="sticky top-0 z-50 border-b border-white/70 bg-white/95 backdrop-blur-xl">
        <div className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0b2239] text-lg font-black text-[#d8b56a]">أ</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#0b2239]">أزدان للمقاولات العامة</p>
              <p className="truncate text-xs text-slate-500">بوابة متابعة المشروع</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNotificationsOpen((open) => !open)}
              aria-label="الإشعارات"
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg shadow-sm"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -left-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">{unreadCount}</span>
              )}
            </button>
            <button type="button" onClick={logout} className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 sm:block">تسجيل الخروج</button>
          </div>

          {notificationsOpen && (
            <div className="absolute left-4 top-[68px] z-50 w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl sm:left-6">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="font-black text-[#0b2239]">الإشعارات</h2>
                  <p className="text-xs text-slate-500">{unreadCount} غير مقروء</p>
                </div>
                <button onClick={markAllAsRead} disabled={markingAllRead || unreadCount === 0} className="text-xs font-black text-[#b48b3c] disabled:opacity-40">
                  {markingAllRead ? "جاري التحديث..." : "تحديد الكل كمقروء"}
                </button>
              </div>
              <div className="max-h-[420px] overflow-y-auto p-3">
                {notifications.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">لا توجد إشعارات</p>
                ) : (
                  notifications.map((item) => (
                    <article key={item.id} className={`mb-2 rounded-2xl p-4 ${item.is_read ? "bg-slate-50" : "bg-[#fff8e8]"}`}>
                      <div className="flex gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">{notificationIcon(item.notification_type)}</span>
                        <div className="min-w-0">
                          <p className="font-black text-[#0b2239]">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>
                          <p className="mt-2 text-[10px] text-slate-400">{formatDate(item.created_at)}</p>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
        {message && <div className="mb-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{message}</div>}

        <section className="overflow-hidden rounded-[2rem] bg-[#0b2239] p-6 text-white shadow-2xl sm:p-9">
          <p className="text-sm font-black text-[#d8b56a]">أهلًا بك، {client.name}</p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">{client.project_name}</h1>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold">{client.status}</span>
            <span className="rounded-full bg-[#d8b56a] px-4 py-2 text-sm font-black text-[#0b2239]">نسبة الإنجاز {progress}%</span>
          </div>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[#d8b56a]" style={{ width: `${progress}%` }} />
          </div>
        </section>

        <section className="mt-7 grid gap-5 md:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push(`/client-portal/${clientId}/finance`)}
            className="group rounded-[2rem] border border-white bg-white p-6 text-right shadow-xl shadow-slate-200/60 transition hover:-translate-y-1 hover:border-[#d8b56a] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black text-[#b48b3c]">الحساب المالي</p>
                <h2 className="mt-2 text-2xl font-black text-[#0b2239]">الحساب وسجل الدفعات</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">اضغط لعرض مبلغ العقد، المبالغ المدفوعة، المتبقي، وسجل جميع الدفعات.</p>
              </div>
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#f5efe2] text-3xl">💰</span>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-black text-[#0b2239]">
              <span>فتح الحساب المالي</span><span className="transition group-hover:-translate-x-1">←</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push(`/client-portal/${clientId}/documents`)}
            className="group rounded-[2rem] border border-white bg-white p-6 text-right shadow-xl shadow-slate-200/60 transition hover:-translate-y-1 hover:border-[#d8b56a] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black text-[#b48b3c]">مستندات المشروع</p>
                <h2 className="mt-2 text-2xl font-black text-[#0b2239]">ملفات ومستندات المشروع</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">اضغط لفتح صفحة العقود والمخططات والتقارير والملفات المتاحة لك.</p>
              </div>
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#f5efe2] text-3xl">📂</span>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-black text-[#0b2239]">
              <span>فتح مستندات المشروع</span><span className="transition group-hover:-translate-x-1">←</span>
            </div>
          </button>
        </section>
      </div>
    </main>
  );
}
