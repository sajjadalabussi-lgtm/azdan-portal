"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { logActivityClient } from "@/lib/log-activity-client";

type Client = {
  id: number;
  name: string;
  project_name: string;
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

const notificationTypes = [
  {
    value: "general",
    label: "إشعار عام",
    icon: "🔔",
  },
  {
    value: "payment",
    label: "دفعة",
    icon: "💰",
  },
  {
    value: "file",
    label: "ملف",
    icon: "📄",
  },
  {
    value: "update",
    label: "تحديث مشروع",
    icon: "🏗️",
  },
  {
    value: "progress",
    label: "نسبة الإنجاز",
    icon: "📈",
  },
];

function getNotificationType(type: string) {
  return (
    notificationTypes.find((item) => item.value === type) ??
    notificationTypes[0]
  );
}

export default function ClientNotificationsPage() {
  const params = useParams();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);

  const [notifications, setNotifications] = useState<
    NotificationRecord[]
  >([]);

  const [title, setTitle] = useState("");
  const [messageText, setMessageText] = useState("");
  const [notificationType, setNotificationType] =
    useState("general");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<
    "success" | "error" | ""
  >("");

  const loadData = useCallback(async () => {
    if (!Number.isFinite(clientId) || clientId <= 0) {
      setFeedback("رقم العميل غير صحيح");
      setFeedbackType("error");
      setLoading(false);
      return;
    }

    setLoading(true);
    setFeedback("");
    setFeedbackType("");

    const [clientResult, notificationsResult] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, project_name")
        .eq("id", clientId)
        .single(),

      supabase
        .from("project_notifications")
        .select(
          `
            id,
            client_id,
            title,
            message,
            notification_type,
            is_read,
            created_at,
            read_at
          `
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
    ]);

    if (clientResult.error || !clientResult.data) {
      console.error(clientResult.error);

      setFeedback(
        `تعذر تحميل بيانات العميل: ${
          clientResult.error?.message || "العميل غير موجود"
        }`
      );

      setFeedbackType("error");
      setLoading(false);
      return;
    }

    if (notificationsResult.error) {
      console.error(notificationsResult.error);

      setFeedback(
        `تعذر تحميل الإشعارات: ${notificationsResult.error.message}`
      );

      setFeedbackType("error");
      setLoading(false);
      return;
    }

    setClient(clientResult.data);

    setNotifications(
      (notificationsResult.data as NotificationRecord[] | null) ??
        []
    );

    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function showFeedback(
    text: string,
    type: "success" | "error"
  ) {
    setFeedback(text);
    setFeedbackType(type);
  }

  async function sendNotification(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (sending) {
      return;
    }

    if (!title.trim()) {
      showFeedback("يرجى كتابة عنوان الإشعار", "error");
      return;
    }

    if (!messageText.trim()) {
      showFeedback("يرجى كتابة نص الإشعار", "error");
      return;
    }

    setSending(true);
    setFeedback("");
    setFeedbackType("");

    const { data, error } = await supabase
      .from("project_notifications")
      .insert({
        client_id: clientId,
        title: title.trim(),
        message: messageText.trim(),
        notification_type: notificationType,
        is_read: false,
      })
      .select(
        `
          id,
          client_id,
          title,
          message,
          notification_type,
          is_read,
          created_at,
          read_at
        `
      )
      .single();

    if (error || !data) {
      console.error(error);

      showFeedback(
        `تعذر إرسال الإشعار: ${
          error?.message || "حدث خطأ غير معروف"
        }`,
        "error"
      );

      setSending(false);
      return;
    }

    const insertedNotification = data as NotificationRecord;

    await logActivityClient({
      action: "create",
      entityType: "project_notifications",
      entityId: insertedNotification.id,
      description: `أرسل إشعارًا: ${insertedNotification.title}`,
      newData: insertedNotification,
    });

    setNotifications((currentNotifications) => [
      insertedNotification,
      ...currentNotifications,
    ]);

    setTitle("");
    setMessageText("");
    setNotificationType("general");

    showFeedback("تم إرسال الإشعار للعميل بنجاح ✅", "success");
    setSending(false);
  }

  async function deleteNotification(
    notification: NotificationRecord
  ) {
    if (deletingId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `هل تريد حذف إشعار "${notification.title}" نهائيًا؟`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(notification.id);
    setFeedback("");
    setFeedbackType("");

    const { error } = await supabase
      .from("project_notifications")
      .delete()
      .eq("id", notification.id)
      .eq("client_id", clientId);

    if (error) {
      console.error(error);

      showFeedback(
        `تعذر حذف الإشعار: ${error.message}`,
        "error"
      );

      setDeletingId(null);
      return;
    }

    await logActivityClient({
      action: "delete",
      entityType: "project_notifications",
      entityId: notification.id,
      description: `حذف الإشعار: ${notification.title}`,
      oldData: notification,
    });

    setNotifications((currentNotifications) =>
      currentNotifications.filter(
        (currentNotification) =>
          currentNotification.id !== notification.id
      )
    );

    showFeedback("تم حذف الإشعار بنجاح ✅", "success");
    setDeletingId(null);
  }


  async function deleteAllNotifications() {
    if (deletingAll || notifications.length===0) return;
    if (!window.confirm("هل تريد حذف جميع إشعارات هذا العميل؟")) return;
    setDeletingAll(true);
    setFeedback("");
    const { error } = await supabase
      .from("project_notifications")
      .delete()
      .eq("client_id", clientId);
    if (error) {
      console.error(error);
      showFeedback(`تعذر حذف الإشعارات: ${error.message}`,"error");
      setDeletingAll(false);
      return;
    }
    await logActivityClient({
      action: "delete",
      entityType: "project_notifications",
      entityId: null,
      description: `حذف جميع إشعارات المشروع رقم ${clientId}`,
    });

    setNotifications([]);
    showFeedback("تم حذف جميع الإشعارات بنجاح ✅","success");
    setDeletingAll(false);
  }

  function formatDate(date: string) {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "التاريخ غير متوفر";
    }

    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(parsedDate);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-gray-100"
      >
        <p className="text-gray-600">
          جاري تحميل الإشعارات...
        </p>
      </main>
    );
  }

  if (!client) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-gray-100 px-5"
      >
        <div className="text-center">
          <p className="text-red-600">
            {feedback || "لم يتم العثور على العميل"}
          </p>

          <Link
            href="/admin/clients"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700"
          >
            رجوع للعملاء
          </Link>
        </div>
      </main>
    );
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  const readCount = notifications.length - unreadCount;

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 sm:px-6 sm:py-10"
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-5 rounded-2xl bg-white p-5 shadow sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-gray-500">
              إدارة إشعارات المشروع
            </p>

            <h1 className="mt-1 text-2xl font-bold text-blue-700 sm:text-3xl">
              {client.project_name}
            </h1>

            <p className="mt-2 text-gray-500">
              العميل: {client.name}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/admin/client/${client.id}`}
              className="rounded-lg bg-gray-200 px-4 py-3 text-gray-700 hover:bg-gray-300"
            >
              رجوع للمشروع
            </Link>

            <Link
              href={`/admin/client/${client.id}/finance`}
              className="rounded-lg bg-purple-600 px-4 py-3 text-white hover:bg-purple-700"
            >
              الإدارة المالية
            </Link>

            <Link
              href={`/admin/client/${client.id}/files`}
              className="rounded-lg bg-cyan-600 px-4 py-3 text-white hover:bg-cyan-700"
            >
              ملفات المشروع
            </Link>
          </div>
        </header>

        {feedback && (
          <p
            className={`mb-6 rounded-xl border p-4 text-center ${
              feedbackType === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {feedback}
          </p>
        )}

        <section className="grid gap-5 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              جميع الإشعارات
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-700">
              {notifications.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              غير مقروءة
            </p>

            <p className="mt-2 text-3xl font-bold text-red-600">
              {unreadCount}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              مقروءة
            </p>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {readCount}
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-5 shadow sm:p-6">
          <h2 className="text-2xl font-bold">
            إرسال إشعار جديد
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            سيظهر الإشعار داخل بوابة العميل
          </p>

          <form
            onSubmit={sendNotification}
            className="mt-6 space-y-5"
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label className="mb-2 block font-bold">
                  عنوان الإشعار
                </label>

                <input
                  type="text"
                  required
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  placeholder="مثال: تمت إضافة دفعة جديدة"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block font-bold">
                  نوع الإشعار
                </label>

                <select
                  value={notificationType}
                  onChange={(event) =>
                    setNotificationType(event.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                >
                  {notificationTypes.map((type) => (
                    <option
                      key={type.value}
                      value={type.value}
                    >
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block font-bold">
                نص الإشعار
              </label>

              <textarea
                required
                value={messageText}
                onChange={(event) =>
                  setMessageText(event.target.value)
                }
                rows={5}
                placeholder="اكتب تفاصيل الإشعار الذي سيظهر للعميل..."
                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending
                ? "جاري إرسال الإشعار..."
                : "إرسال الإشعار"}
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-4 shadow sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                سجل الإشعارات
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                جميع الإشعارات المرسلة لهذا العميل
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-500">
                عدد الإشعارات: {notifications.length}
              </span>

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={deleteAllNotifications}
                  disabled={deletingAll || deletingId !== null}
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingAll ? "جاري حذف الكل..." : "حذف جميع الإشعارات"}
                </button>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <p className="mt-6 rounded-xl bg-gray-50 p-8 text-center text-gray-500">
              لا توجد إشعارات مرسلة حتى الآن
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {notifications.map((notification) => {
                const type = getNotificationType(
                  notification.notification_type
                );

                return (
                  <article
                    key={notification.id}
                    className={`rounded-2xl border p-5 ${
                      notification.is_read
                        ? "border-gray-200 bg-gray-50"
                        : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                          {type.icon}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold">
                              {notification.title}
                            </h3>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                notification.is_read
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {notification.is_read
                                ? "مقروء"
                                : "غير مقروء"}
                            </span>
                          </div>

                          <p className="mt-2 text-sm font-bold text-blue-700">
                            {type.label}
                          </p>

                          <p className="mt-3 whitespace-pre-line leading-7 text-gray-700">
                            {notification.message}
                          </p>

                          <p className="mt-3 text-sm text-gray-500">
                            {formatDate(notification.created_at)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          deleteNotification(notification)
                        }
                        disabled={deletingId !== null || deletingAll}
                        className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === notification.id
                          ? "جاري الحذف..."
                          : "حذف الإشعار"}
                      </button>
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