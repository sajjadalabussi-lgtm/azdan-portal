"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type NotificationRecord = {
  id: number;
  client_id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
};

type ClientRecord = {
  id: number;
  name: string;
  project_name: string;
};

type FilterValue = "all" | "unread" | "read";

const typeLabels: Record<string, string> = {
  general: "عام",
  update: "تحديث مشروع",
  progress: "نسبة الإنجاز",
  payment: "دفعة مالية",
  file: "ملف",
  images: "صور",
  task: "مهمة",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("ar-IQ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function GlobalNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [typeFilter, setTypeFilter] = useState("all");

  async function loadNotifications() {
    setLoading(true);
    setMessage("");

    const [notificationsResult, clientsResult] = await Promise.all([
      supabase
        .from("project_notifications")
        .select(
          "id, client_id, title, message, notification_type, is_read, created_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("id, name, project_name")
        .order("id", { ascending: false }),
    ]);

    const firstError = notificationsResult.error || clientsResult.error;
    if (firstError) {
      console.error(firstError);
      setMessage(`تعذر تحميل الإشعارات: ${firstError.message}`);
      setLoading(false);
      return;
    }

    setNotifications(
      (notificationsResult.data as NotificationRecord[] | null) ?? []
    );
    setClients((clientsResult.data as ClientRecord[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadNotifications();

    const channel = supabase
      .channel("admin-global-notifications-page")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_notifications",
        },
        () => {
          void loadNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const clientMap = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients]
  );

  const availableTypes = useMemo(
    () =>
      Array.from(
        new Set(notifications.map((notification) => notification.notification_type))
      ).filter(Boolean),
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return notifications.filter((notification) => {
      const client = clientMap.get(notification.client_id);
      const matchesStatus =
        filter === "all" ||
        (filter === "unread" && !notification.is_read) ||
        (filter === "read" && notification.is_read);
      const matchesType =
        typeFilter === "all" || notification.notification_type === typeFilter;
      const searchable = `${notification.title} ${notification.message} ${
        client?.name ?? ""
      } ${client?.project_name ?? ""}`.toLowerCase();

      return (
        matchesStatus &&
        matchesType &&
        (!normalizedQuery || searchable.includes(normalizedQuery))
      );
    });
  }, [clientMap, filter, notifications, query, typeFilter]);

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;
  const readCount = notifications.length - unreadCount;

  async function markOne(notification: NotificationRecord, isRead: boolean) {
    setWorking(true);
    setMessage("");

    const { error } = await supabase
      .from("project_notifications")
      .update({ is_read: isRead })
      .eq("id", notification.id);

    if (error) {
      console.error(error);
      setMessage(`تعذر تحديث الإشعار: ${error.message}`);
      setWorking(false);
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, is_read: isRead } : item
      )
    );
    setWorking(false);
  }

  async function markAllAsRead() {
    if (unreadCount === 0 || working) return;

    setWorking(true);
    setMessage("");

    const { error } = await supabase
      .from("project_notifications")
      .update({ is_read: true })
      .eq("is_read", false);

    if (error) {
      console.error(error);
      setMessage(`تعذر تحديد الكل كمقروء: ${error.message}`);
      setWorking(false);
      return;
    }

    setNotifications((current) =>
      current.map((notification) => ({ ...notification, is_read: true }))
    );
    setMessage("تم تحديد جميع الإشعارات كمقروءة ✅");
    setWorking(false);
  }

  async function deleteNotification(notification: NotificationRecord) {
    if (
      !window.confirm(`هل تريد حذف إشعار «${notification.title}» نهائيًا؟`)
    ) {
      return;
    }

    setWorking(true);
    setMessage("");

    const { error } = await supabase
      .from("project_notifications")
      .delete()
      .eq("id", notification.id);

    if (error) {
      console.error(error);
      setMessage(`تعذر حذف الإشعار: ${error.message}`);
      setWorking(false);
      return;
    }

    setNotifications((current) =>
      current.filter((item) => item.id !== notification.id)
    );
    setWorking(false);
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-gray-100 px-3 pb-32 pt-5 text-gray-900 sm:px-6 sm:py-10"
    >
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl bg-white p-4 shadow sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-gray-500">كل المشاريع في مكان واحد</p>
              <h1 className="mt-1 text-2xl font-bold text-blue-700 sm:text-4xl">
                مركز الإشعارات العام
              </h1>
              <p className="mt-2 text-sm text-gray-500 sm:text-base">
                متابعة إشعارات المشاريع والدفعات والملفات والتحديثات.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                disabled={working || unreadCount === 0}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                تحديد الكل كمقروء
              </button>
              <Link
                href="/admin"
                className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white hover:bg-slate-800"
              >
                لوحة التحكم
              </Link>
            </div>
          </div>
        </header>

        {message && (
          <p className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800">
            {message}
          </p>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <article className="rounded-2xl bg-white p-4 shadow sm:p-5">
            <p className="text-sm text-gray-500">جميع الإشعارات</p>
            <p className="mt-2 text-3xl font-black">{notifications.length}</p>
          </article>
          <article className="rounded-2xl bg-white p-4 shadow sm:p-5">
            <p className="text-sm text-gray-500">غير مقروءة</p>
            <p className="mt-2 text-3xl font-black text-red-600">
              {unreadCount}
            </p>
          </article>
          <article className="rounded-2xl bg-white p-4 shadow sm:p-5">
            <p className="text-sm text-gray-500">مقروءة</p>
            <p className="mt-2 text-3xl font-black text-green-600">
              {readCount}
            </p>
          </article>
          <article className="rounded-2xl bg-white p-4 shadow sm:p-5">
            <p className="text-sm text-gray-500">المشاريع المرتبطة</p>
            <p className="mt-2 text-3xl font-black text-blue-700">
              {new Set(notifications.map((item) => item.client_id)).size}
            </p>
          </article>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-4 shadow sm:p-6">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث بالعنوان أو المشروع أو اسم العميل..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
            />

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as FilterValue)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="all">كل الحالات</option>
              <option value="unread">غير مقروءة</option>
              <option value="read">مقروءة</option>
            </select>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="all">كل الأنواع</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {typeLabels[type] ?? type}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="mt-6">
          {loading ? (
            <p className="rounded-2xl bg-white p-10 text-center font-bold text-gray-500 shadow">
              جاري تحميل الإشعارات...
            </p>
          ) : filteredNotifications.length === 0 ? (
            <p className="rounded-2xl bg-white p-10 text-center font-bold text-gray-500 shadow">
              لا توجد إشعارات مطابقة.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => {
                const client = clientMap.get(notification.client_id);

                return (
                  <article
                    key={notification.id}
                    className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
                      notification.is_read
                        ? "border-gray-200 bg-white"
                        : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {!notification.is_read && (
                            <span className="h-3 w-3 rounded-full bg-red-500" />
                          )}
                          <h2 className="break-words text-lg font-bold sm:text-xl">
                            {notification.title}
                          </h2>
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                            {typeLabels[notification.notification_type] ??
                              notification.notification_type}
                          </span>
                        </div>

                        <p className="mt-2 font-bold text-blue-700">
                          {client?.project_name ?? "مشروع غير معروف"}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          العميل: {client?.name ?? "غير معروف"}
                        </p>
                        <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-gray-700 sm:text-base">
                          {notification.message}
                        </p>
                        <p className="mt-3 text-xs text-gray-400">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 lg:w-52 lg:grid-cols-1">
                        <Link
                          href={`/admin/client/${notification.client_id}/notifications`}
                          className="rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white hover:bg-slate-800 sm:text-sm"
                        >
                          فتح المشروع
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            void markOne(notification, !notification.is_read)
                          }
                          disabled={working}
                          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 sm:text-sm"
                        >
                          {notification.is_read ? "غير مقروء" : "مقروء"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteNotification(notification)}
                          disabled={working}
                          className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 sm:text-sm"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
