"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { canAccess } from "@/lib/admin-permissions";
import { useAdminRole } from "../role-provider";

type Client = { id: number; name: string; project_name: string; progress: number; status: string };
type Update = { id: number; client_id: number; title: string; progress: number; created_at: string };
type Payment = { id: number; client_id: number; amount: number | string; payment_date: string; note: string | null };
type Notification = { id: number; client_id: number; title: string; message: string; notification_type: string; is_read: boolean; created_at: string };
type SearchItem = { key: string; type: "client" | "update" | "payment" | "notification"; title: string; subtitle: string; href: string; searchable: string };

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatMoney(value: number | string) {
  return `${new Intl.NumberFormat("ar-IQ").format(toNumber(value))} د.ع`;
}

export default function AdminOverviewPage() {
  const { role } = useAdminRole();
  const [clients, setClients] = useState<Client[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const canManageClients = canAccess(role, "manage_clients");
  const canManageUpdates = canAccess(role, "manage_updates");
  const canManageFinance = canAccess(role, "manage_finance");
  const canManageNotifications = canAccess(role, "manage_notifications");
  const canViewReports = canAccess(role, "view_reports");
  const canViewActivity = canAccess(role, "view_activity");

  useEffect(() => {
    async function loadOverview() {
      setLoading(true);
      setMessage("");

      const [clientsResult, updatesResult, paymentsResult, notificationsResult] = await Promise.all([
        supabase.from("clients").select("id, name, project_name, progress, status").order("id", { ascending: false }),
        canManageUpdates
          ? supabase.from("project_updates").select("id, client_id, title, progress, created_at").order("created_at", { ascending: false }).limit(100)
          : Promise.resolve({ data: [], error: null }),
        canManageFinance
          ? supabase.from("project_payments").select("id, client_id, amount, payment_date, note").order("payment_date", { ascending: false }).limit(100)
          : Promise.resolve({ data: [], error: null }),
        canManageNotifications
          ? supabase.from("project_notifications").select("id, client_id, title, message, notification_type, is_read, created_at").order("created_at", { ascending: false }).limit(100)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const firstError = clientsResult.error || updatesResult.error || paymentsResult.error || notificationsResult.error;
      if (firstError) {
        console.error(firstError);
        setMessage(`تعذر تحميل مركز الإدارة: ${firstError.message}`);
      }

      setClients((clientsResult.data as Client[] | null) ?? []);
      setUpdates((updatesResult.data as Update[] | null) ?? []);
      setPayments((paymentsResult.data as Payment[] | null) ?? []);
      setNotifications((notificationsResult.data as Notification[] | null) ?? []);
      setLoading(false);
    }

    void loadOverview();
  }, [canManageFinance, canManageNotifications, canManageUpdates]);

  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);

  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = clients.map((client) => ({
      key: `client-${client.id}`,
      type: "client",
      title: client.project_name,
      subtitle: `العميل: ${client.name} • الإنجاز ${client.progress}% • ${client.status}`,
      href: `/admin/client/${client.id}`,
      searchable: `${client.name} ${client.project_name} ${client.status}`.toLowerCase(),
    }));

    updates.forEach((update) => {
      const client = clientMap.get(update.client_id);
      items.push({
        key: `update-${update.id}`,
        type: "update",
        title: update.title,
        subtitle: `${client?.project_name || "مشروع غير معروف"} • ${update.progress}%`,
        href: `/admin/client/${update.client_id}`,
        searchable: `${update.title} ${client?.name || ""} ${client?.project_name || ""}`.toLowerCase(),
      });
    });

    payments.forEach((payment) => {
      const client = clientMap.get(payment.client_id);
      items.push({
        key: `payment-${payment.id}`,
        type: "payment",
        title: `دفعة ${formatMoney(payment.amount)}`,
        subtitle: `${client?.project_name || "مشروع غير معروف"} • ${payment.note || "بدون ملاحظة"}`,
        href: `/admin/client/${payment.client_id}/finance`,
        searchable: `${payment.amount} ${payment.note || ""} ${client?.name || ""} ${client?.project_name || ""}`.toLowerCase(),
      });
    });

    notifications.forEach((notification) => {
      const client = clientMap.get(notification.client_id);
      items.push({
        key: `notification-${notification.id}`,
        type: "notification",
        title: notification.title,
        subtitle: `${client?.project_name || "مشروع غير معروف"} • ${notification.message}`,
        href: `/admin/client/${notification.client_id}/notifications`,
        searchable: `${notification.title} ${notification.message} ${client?.name || ""} ${client?.project_name || ""}`.toLowerCase(),
      });
    });

    return items;
  }, [clientMap, clients, notifications, payments, updates]);

  const filteredResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return searchItems.filter((item) => item.searchable.includes(normalized)).slice(0, 20);
  }, [query, searchItems]);

  const unreadNotifications = notifications.filter((item) => !item.is_read);
  const recentNotifications = notifications.slice(0, 6);
  const activeProjects = clients.filter((item) => item.status === "قيد التنفيذ");
  const nearlyComplete = clients
    .filter((item) => Number(item.progress) >= 75 && Number(item.progress) < 100)
    .sort((a, b) => Number(b.progress) - Number(a.progress))
    .slice(0, 5);

  const typeLabel: Record<SearchItem["type"], string> = {
    client: "مشروع",
    update: "تحديث",
    payment: "دفعة",
    notification: "إشعار",
  };

  return (
    <main dir="rtl" className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-gray-500">الوصول السريع</p>
              <h1 className="mt-1 text-3xl font-bold text-blue-700">مركز الإدارة</h1>
              <p className="mt-2 text-gray-500">بحث عام، إشعارات، اختصارات، ومتابعة المشاريع المهمة.</p>
            </div>
            <Link href="/admin" className="rounded-xl bg-slate-900 px-5 py-3 text-center font-bold text-white hover:bg-slate-800">الرجوع للوحة التحكم</Link>
          </div>

          <div className="mt-6">
            <label className="mb-2 block font-bold">البحث العام داخل النظام</label>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="اكتب اسم العميل، المشروع، التحديث، الدفعة أو الإشعار..." className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500" />
          </div>

          {query.trim() && (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              {filteredResults.length === 0 ? (
                <p className="p-5 text-center text-gray-500">لا توجد نتائج مطابقة.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredResults.map((item) => (
                    <Link key={item.key} href={item.href} className="flex flex-col gap-2 p-4 hover:bg-blue-50 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold">{item.title}</p>
                        <p className="mt-1 text-sm text-gray-500">{item.subtitle}</p>
                      </div>
                      <span className="w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">{typeLabel[item.type]}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>

        {message && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{message}</p>}

        {loading ? (
          <p className="mt-6 rounded-2xl bg-white p-10 text-center text-gray-500 shadow">جاري تحميل مركز الإدارة...</p>
        ) : (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-white p-5 shadow"><p className="text-sm text-gray-500">المشاريع الكلية</p><p className="mt-2 text-3xl font-bold text-blue-700">{clients.length}</p></div>
              <div className="rounded-2xl bg-white p-5 shadow"><p className="text-sm text-gray-500">قيد التنفيذ</p><p className="mt-2 text-3xl font-bold text-green-600">{activeProjects.length}</p></div>
              <div className="rounded-2xl bg-white p-5 shadow"><p className="text-sm text-gray-500">إشعارات غير مقروءة</p><p className="mt-2 text-3xl font-bold text-red-600">{canManageNotifications ? unreadNotifications.length : "—"}</p></div>
              <div className="rounded-2xl bg-white p-5 shadow"><p className="text-sm text-gray-500">نتائج قابلة للبحث</p><p className="mt-2 text-3xl font-bold text-purple-600">{searchItems.length}</p></div>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Link href="/admin/clients" className="rounded-2xl bg-blue-600 p-5 text-white shadow hover:bg-blue-700"><p className="text-lg font-bold">العملاء والمشاريع</p><p className="mt-2 text-sm text-blue-100">فتح القائمة الكاملة</p></Link>
              {canManageClients && <Link href="/admin/new-client" className="rounded-2xl bg-green-600 p-5 text-white shadow hover:bg-green-700"><p className="text-lg font-bold">إضافة عميل</p><p className="mt-2 text-sm text-green-100">إنشاء مشروع جديد</p></Link>}
              {canViewReports && <Link href="/admin/reports" className="rounded-2xl bg-amber-600 p-5 text-white shadow hover:bg-amber-700"><p className="text-lg font-bold">التقارير</p><p className="mt-2 text-sm text-amber-100">الإحصائيات والملخص المالي</p></Link>}
              {canViewActivity && <Link href="/admin/activity" className="rounded-2xl bg-indigo-600 p-5 text-white shadow hover:bg-indigo-700"><p className="text-lg font-bold">سجل النشاطات</p><p className="mt-2 text-sm text-indigo-100">متابعة آخر العمليات</p></Link>}
            </section>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <section className="rounded-2xl bg-white p-6 shadow">
                <h2 className="text-2xl font-bold">مشاريع قاربت على الإنجاز</h2>
                <p className="mt-1 text-sm text-gray-500">المشاريع بين 75% و99%.</p>
                {nearlyComplete.length === 0 ? (
                  <p className="mt-5 rounded-xl bg-gray-50 p-6 text-center text-gray-500">لا توجد مشاريع ضمن هذه المرحلة.</p>
                ) : (
                  <div className="mt-5 space-y-4">
                    {nearlyComplete.map((client) => (
                      <Link key={client.id} href={`/admin/client/${client.id}`} className="block rounded-xl border border-gray-200 p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between gap-3">
                          <div><p className="font-bold">{client.project_name}</p><p className="mt-1 text-sm text-gray-500">{client.name}</p></div>
                          <span className="font-bold text-green-700">{client.progress}%</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-green-600" style={{ width: `${Math.min(Math.max(client.progress, 0), 100)}%` }} /></div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              {canManageNotifications && (
                <section className="rounded-2xl bg-white p-6 shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div><h2 className="text-2xl font-bold">مركز الإشعارات</h2><p className="mt-1 text-sm text-gray-500">آخر الإشعارات المرسلة للعملاء.</p></div>
                    <span className="rounded-full bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{unreadNotifications.length} غير مقروء</span>
                  </div>
                  {recentNotifications.length === 0 ? (
                    <p className="mt-5 rounded-xl bg-gray-50 p-6 text-center text-gray-500">لا توجد إشعارات.</p>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {recentNotifications.map((notification) => {
                        const client = clientMap.get(notification.client_id);
                        return (
                          <Link key={notification.id} href={`/admin/client/${notification.client_id}/notifications`} className="block rounded-xl border border-gray-200 p-4 hover:bg-gray-50">
                            <div className="flex items-start justify-between gap-3">
                              <div><p className="font-bold">{notification.title}</p><p className="mt-1 text-sm text-gray-500">{client?.project_name || "مشروع غير معروف"}</p><p className="mt-2 line-clamp-2 text-sm text-gray-600">{notification.message}</p></div>
                              {!notification.is_read && <span className="h-3 w-3 shrink-0 rounded-full bg-red-500" title="غير مقروء" />}
                            </div>
                            <p className="mt-2 text-xs text-gray-400">{formatDate(notification.created_at)}</p>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
