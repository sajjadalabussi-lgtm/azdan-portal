"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Client = {
  id: number;
  name: string;
  phone: string | null;
  project_name: string;
  progress: number;
  status: string;
};

type UpdateImage = {
  id: number;
  name: string;
  path: string;
  publicUrl: string;
};

type ProjectUpdate = {
  id: number;
  title: string;
  description: string | null;
  progress: number;
  createdAt: string;
  images: UpdateImage[];
};

type UpdateRecord = {
  id: number;
  title: string;
  description: string | null;
  progress: number;
  created_at: string;
};

type ImageRecord = {
  id: number;
  update_id: number | null;
  storage_path: string;
};

type FinanceRecord = {
  contract_amount: number | string;
  currency: string;
  notes: string | null;
};

type PaymentRecord = {
  id: number;
  amount: number | string;
  payment_date: string;
  note: string | null;
  created_at: string;
};

type ProjectFile = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  storage_path: string;
  file_name: string;
  file_size: number | string;
  file_type: string | null;
  created_at: string;
  publicUrl: string;
};

type ProjectFileRecord = Omit<ProjectFile, "publicUrl">;

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

const fileCategories = [
  { value: "contract", label: "العقد" },
  { value: "drawing", label: "المخططات" },
  { value: "boq", label: "جدول الكميات BOQ" },
  { value: "invoice", label: "الفواتير" },
  { value: "report", label: "التقارير" },
  { value: "document", label: "المستندات" },
  { value: "other", label: "أخرى" },
];

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

function toNumber(value: number | string | null | undefined) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function clampProgress(value: number) {
  return Math.min(Math.max(Number(value) || 0, 0), 100);
}

function getFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex === -1) {
    return "";
  }

  return fileName
    .slice(lastDotIndex + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getFileIcon(fileName: string) {
  const extension = getFileExtension(fileName);

  if (extension === "pdf") return "📕";

  if (extension === "doc" || extension === "docx") {
    return "📘";
  }

  if (extension === "xls" || extension === "xlsx") {
    return "📗";
  }

  if (extension === "dwg" || extension === "dxf") {
    return "📐";
  }

  if (
    extension === "jpg" ||
    extension === "jpeg" ||
    extension === "png" ||
    extension === "webp"
  ) {
    return "🖼️";
  }

  if (extension === "zip" || extension === "rar") {
    return "🗜️";
  }

  return "📄";
}

function getCategoryLabel(category: string) {
  return (
    fileCategories.find((item) => item.value === category)?.label ||
    "أخرى"
  );
}

function getNotificationType(type: string) {
  return (
    notificationTypes.find((item) => item.value === type) ??
    notificationTypes[0]
  );
}

export default function ClientPortalPage() {
  const params = useParams();
  const router = useRouter();

  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [finance, setFinance] = useState<FinanceRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);

  const [notifications, setNotifications] = useState<
    NotificationRecord[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [markingNotificationId, setMarkingNotificationId] =
    useState<number | null>(null);

  const [markingAllRead, setMarkingAllRead] = useState(false);

  useEffect(() => {
    const savedId = sessionStorage.getItem("azdan_client_id");

    if (!Number.isFinite(clientId) || clientId <= 0) {
      router.replace("/client-login");
      return;
    }

    if (!savedId || Number(savedId) !== clientId) {
      router.replace("/client-login");
      return;
    }

    async function loadData() {
      setLoading(true);
      setMessage("");

      const [
        clientResult,
        updatesResult,
        imagesResult,
        financeResult,
        paymentsResult,
        filesResult,
        notificationsResult,
      ] = await Promise.all([
        supabase
          .from("clients")
          .select(
            "id, name, phone, project_name, progress, status"
          )
          .eq("id", clientId)
          .single(),

        supabase
          .from("project_updates")
          .select(
            "id, title, description, progress, created_at"
          )
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),

        supabase
          .from("project_images")
          .select("id, update_id, storage_path")
          .eq("client_id", clientId)
          .not("update_id", "is", null),

        supabase
          .from("project_finances")
          .select("contract_amount, currency, notes")
          .eq("client_id", clientId)
          .maybeSingle(),

        supabase
          .from("project_payments")
          .select(
            "id, amount, payment_date, note, created_at"
          )
          .eq("client_id", clientId)
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false }),

        supabase
          .from("project_files")
          .select(
            `
              id,
              title,
              description,
              category,
              storage_path,
              file_name,
              file_size,
              file_type,
              created_at
            `
          )
          .eq("client_id", clientId)
          .eq("is_visible_to_client", true)
          .order("created_at", { ascending: false }),

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

        setMessage(
          `تعذر تحميل بيانات المشروع: ${
            clientResult.error?.message || "المشروع غير موجود"
          }`
        );

        setLoading(false);
        return;
      }

      if (updatesResult.error) {
        console.error(updatesResult.error);

        setMessage(
          `تعذر تحميل تحديثات المشروع: ${updatesResult.error.message}`
        );

        setLoading(false);
        return;
      }

      if (imagesResult.error) {
        console.error(imagesResult.error);

        setMessage(
          `تعذر تحميل صور التحديثات: ${imagesResult.error.message}`
        );

        setLoading(false);
        return;
      }

      if (financeResult.error) {
        console.error(financeResult.error);

        setMessage(
          `تعذر تحميل الحساب المالي: ${financeResult.error.message}`
        );

        setLoading(false);
        return;
      }

      if (paymentsResult.error) {
        console.error(paymentsResult.error);

        setMessage(
          `تعذر تحميل سجل الدفعات: ${paymentsResult.error.message}`
        );

        setLoading(false);
        return;
      }

      if (filesResult.error) {
        console.error(filesResult.error);

        setMessage(
          `تعذر تحميل ملفات المشروع: ${filesResult.error.message}`
        );

        setLoading(false);
        return;
      }

      if (notificationsResult.error) {
        console.error(notificationsResult.error);

        setMessage(
          `تعذر تحميل الإشعارات: ${notificationsResult.error.message}`
        );

        setLoading(false);
        return;
      }

      const updateRecords =
        (updatesResult.data as UpdateRecord[] | null) ?? [];

      const imageRecords =
        (imagesResult.data as ImageRecord[] | null) ?? [];

      const preparedUpdates: ProjectUpdate[] = updateRecords.map(
        (updateRecord) => {
          const updateImages: UpdateImage[] = imageRecords
            .filter(
              (imageRecord) =>
                Number(imageRecord.update_id) === updateRecord.id
            )
            .map((imageRecord) => {
              const { data } = supabase.storage
                .from("project-images")
                .getPublicUrl(imageRecord.storage_path);

              return {
                id: imageRecord.id,
                name:
                  imageRecord.storage_path.split("/").pop() ||
                  imageRecord.storage_path,
                path: imageRecord.storage_path,
                publicUrl: data.publicUrl,
              };
            });

          return {
            id: updateRecord.id,
            title: updateRecord.title,
            description: updateRecord.description,
            progress: clampProgress(updateRecord.progress),
            createdAt: updateRecord.created_at,
            images: updateImages,
          };
        }
      );

      const preparedFiles: ProjectFile[] = (
        (filesResult.data as ProjectFileRecord[] | null) ?? []
      ).map((fileRecord) => {
        const { data } = supabase.storage
          .from("project-files")
          .getPublicUrl(fileRecord.storage_path);

        return {
          ...fileRecord,
          publicUrl: data.publicUrl,
        };
      });

      setClient(clientResult.data);
      setUpdates(preparedUpdates);
      setFinance(financeResult.data as FinanceRecord | null);

      setPayments(
        (paymentsResult.data as PaymentRecord[] | null) ?? []
      );

      setProjectFiles(preparedFiles);

      setNotifications(
        (notificationsResult.data as NotificationRecord[] | null) ??
          []
      );

      setLoading(false);
    }

    loadData();
  }, [clientId, router]);

  const contractAmount = toNumber(finance?.contract_amount);

  const totalPaid = useMemo(
    () =>
      payments.reduce(
        (total, payment) => total + toNumber(payment.amount),
        0
      ),
    [payments]
  );

  const remainingAmount = Math.max(contractAmount - totalPaid, 0);

  const overpaidAmount = Math.max(totalPaid - contractAmount, 0);

  const paymentPercentage =
    contractAmount > 0
      ? Math.min(
          Math.max(
            Math.round((totalPaid / contractAmount) * 100),
            0
          ),
          100
        )
      : 0;

  const unreadNotificationsCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  function logout() {
    sessionStorage.removeItem("azdan_client_id");
    router.replace("/client-login");
  }

  async function markNotificationAsRead(
    notification: NotificationRecord
  ) {
    if (
      notification.is_read ||
      markingNotificationId !== null
    ) {
      return;
    }

    setMarkingNotificationId(notification.id);
    setMessage("");

    const readAt = new Date().toISOString();

    const { error } = await supabase
      .from("project_notifications")
      .update({
        is_read: true,
        read_at: readAt,
      })
      .eq("id", notification.id)
      .eq("client_id", clientId);

    if (error) {
      console.error(error);
      setMessage(`تعذر تحديث الإشعار: ${error.message}`);
      setMarkingNotificationId(null);
      return;
    }

    setNotifications((currentNotifications) =>
      currentNotifications.map((currentNotification) =>
        currentNotification.id === notification.id
          ? {
              ...currentNotification,
              is_read: true,
              read_at: readAt,
            }
          : currentNotification
      )
    );

    setMarkingNotificationId(null);
  }

  async function markAllNotificationsAsRead() {
    if (markingAllRead || unreadNotificationsCount === 0) {
      return;
    }

    setMarkingAllRead(true);
    setMessage("");

    const readAt = new Date().toISOString();

    const { error } = await supabase
      .from("project_notifications")
      .update({
        is_read: true,
        read_at: readAt,
      })
      .eq("client_id", clientId)
      .eq("is_read", false);

    if (error) {
      console.error(error);
      setMessage(`تعذر تحديث الإشعارات: ${error.message}`);
      setMarkingAllRead(false);
      return;
    }

    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.is_read
          ? notification
          : {
              ...notification,
              is_read: true,
              read_at: readAt,
            }
      )
    );

    setMarkingAllRead(false);
  }

  function formatDateTime(date: string) {
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

  function formatPaymentDate(date: string) {
    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return "التاريخ غير متوفر";
    }

    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(parsedDate);
  }

  function formatFileDate(date: string) {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "التاريخ غير متوفر";
    }

    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(parsedDate);
  }

  function formatFileSize(value: number | string) {
    const bytes = Number(value);

    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "الحجم غير متوفر";
    }

    if (bytes < 1024) {
      return `${bytes} بايت`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(
      bytes /
      (1024 * 1024 * 1024)
    ).toFixed(1)} GB`;
  }

  function formatMoney(value: number) {
    const formatted = new Intl.NumberFormat("ar-IQ", {
      maximumFractionDigits: 2,
    }).format(value);

    const selectedCurrency = finance?.currency || "IQD";

    if (selectedCurrency === "IQD") {
      return `${formatted} د.ع`;
    }

    if (selectedCurrency === "USD") {
      return `${formatted} $`;
    }

    return `${formatted} ${selectedCurrency}`;
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-gray-100"
      >
        <p className="text-gray-600">
          جاري تحميل مشروعك...
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
            {message || "لم يتم العثور على المشروع"}
          </p>

          <button
            type="button"
            onClick={logout}
            className="mt-4 rounded-lg bg-blue-600 px-5 py-3 text-white"
          >
            العودة إلى تسجيل الدخول
          </button>
        </div>
      </main>
    );
  }

  const safeProgress = clampProgress(client.progress);

  const totalImages = updates.reduce(
    (total, update) => total + update.images.length,
    0
  );

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 sm:px-5"
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-6 shadow sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-gray-500">
                أهلًا بك، {client.name}
              </p>

              {unreadNotificationsCount > 0 && (
                <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                  {unreadNotificationsCount} إشعار جديد
                </span>
              )}
            </div>

            <h1 className="mt-1 text-2xl font-bold text-blue-700 sm:text-3xl">
              {client.project_name}
            </h1>

            <p className="mt-2 text-gray-500">
              تابع نسبة الإنجاز ومراحل تنفيذ المشروع
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-lg bg-gray-200 px-5 py-3 text-gray-700 hover:bg-gray-300"
          >
            تسجيل الخروج
          </button>
        </header>

        {message && (
          <p className="mb-6 rounded-lg bg-amber-50 p-4 text-amber-700">
            {message}
          </p>
        )}

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              حالة المشروع
            </p>

            <p className="mt-2 text-xl font-bold text-green-600">
              {client.status}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              نسبة الإنجاز
            </p>

            <p className="mt-2 text-4xl font-bold text-blue-700">
              {safeProgress}%
            </p>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${safeProgress}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              رقم التواصل
            </p>

            <p className="mt-2 text-xl font-bold">
              {client.phone || "غير مسجل"}
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-5 shadow sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold">
                  🔔 الإشعارات
                </h2>

                {unreadNotificationsCount > 0 && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">
                    {unreadNotificationsCount} غير مقروء
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-gray-500">
                آخر التنبيهات والتحديثات المرسلة من إدارة المشروع
              </p>
            </div>

            {unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsAsRead}
                disabled={markingAllRead}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {markingAllRead
                  ? "جاري التحديث..."
                  : "تعليم الكل كمقروء"}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="mt-6 rounded-xl bg-gray-50 p-8 text-center text-gray-500">
              لا توجد إشعارات حتى الآن
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
                    className={`rounded-2xl border p-5 transition ${
                      notification.is_read
                        ? "border-gray-200 bg-gray-50"
                        : "border-blue-300 bg-blue-50 shadow-sm"
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

                            {!notification.is_read && (
                              <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                                جديد
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm font-bold text-blue-700">
                            {type.label}
                          </p>

                          <p className="mt-3 whitespace-pre-line leading-7 text-gray-700">
                            {notification.message}
                          </p>

                          <p className="mt-3 text-sm text-gray-500">
                            {formatDateTime(
                              notification.created_at
                            )}
                          </p>
                        </div>
                      </div>

                      {!notification.is_read && (
                        <button
                          type="button"
                          onClick={() =>
                            markNotificationAsRead(notification)
                          }
                          disabled={
                            markingNotificationId !== null
                          }
                          className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {markingNotificationId ===
                          notification.id
                            ? "جاري التحديث..."
                            : "تعليم كمقروء"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-white p-5 shadow sm:p-6">
          <div>
            <h2 className="text-2xl font-bold">
              الحساب المالي
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              ملخص قيمة العقد والدفعات المسجلة للمشروع
            </p>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-blue-50 p-5">
              <p className="text-sm text-blue-700">
                قيمة العقد
              </p>

              <p className="mt-2 text-xl font-bold text-blue-900">
                {formatMoney(contractAmount)}
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-5">
              <p className="text-sm text-green-700">
                إجمالي المدفوع
              </p>

              <p className="mt-2 text-xl font-bold text-green-800">
                {formatMoney(totalPaid)}
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 p-5">
              <p className="text-sm text-amber-700">
                المبلغ المتبقي
              </p>

              <p className="mt-2 text-xl font-bold text-amber-800">
                {formatMoney(remainingAmount)}
              </p>

              {overpaidAmount > 0 && (
                <p className="mt-2 text-xs font-bold text-purple-700">
                  زيادة مدفوعة: {formatMoney(overpaidAmount)}
                </p>
              )}
            </div>

            <div className="rounded-xl bg-gray-50 p-5">
              <div className="flex justify-between">
                <p className="text-sm text-gray-600">
                  نسبة الدفع
                </p>

                <p className="font-bold text-blue-700">
                  {paymentPercentage}%
                </p>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-green-600"
                  style={{ width: `${paymentPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {finance?.notes && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-bold">
                ملاحظات الحساب
              </p>

              <p className="mt-2 whitespace-pre-line leading-7 text-gray-600">
                {finance.notes}
              </p>
            </div>
          )}

          <div className="mt-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xl font-bold">
                سجل الدفعات
              </h3>

              <span className="text-sm text-gray-500">
                عدد الدفعات: {payments.length}
              </span>
            </div>

            {payments.length === 0 ? (
              <p className="mt-5 rounded-xl bg-gray-50 p-6 text-center text-gray-500">
                لا توجد دفعات مسجلة حتى الآن
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50 text-right">
                      <th className="p-4">التاريخ</th>
                      <th className="p-4">المبلغ</th>
                      <th className="p-4">الملاحظة</th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-gray-100"
                      >
                        <td className="p-4">
                          {formatPaymentDate(
                            payment.payment_date
                          )}
                        </td>

                        <td className="p-4 font-bold text-green-700">
                          {formatMoney(toNumber(payment.amount))}
                        </td>

                        <td className="p-4 text-gray-600">
                          {payment.note || "لا توجد ملاحظة"}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr className="bg-green-50 font-bold">
                      <td className="p-4">
                        الإجمالي
                      </td>

                      <td className="p-4 text-green-700">
                        {formatMoney(totalPaid)}
                      </td>

                      <td className="p-4" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-5 shadow sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                ملفات المشروع
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                العقود والمخططات والمستندات المرفوعة للمشروع
              </p>
            </div>

            <span className="text-sm text-gray-500">
              عدد الملفات: {projectFiles.length}
            </span>
          </div>

          {projectFiles.length === 0 ? (
            <p className="mt-6 rounded-xl bg-gray-50 p-8 text-center text-gray-500">
              لا توجد ملفات متاحة للعرض حتى الآن
            </p>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {projectFiles.map((file) => (
                <article
                  key={file.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-3xl">
                      {getFileIcon(file.file_name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-lg font-bold">
                        {file.title}
                      </h3>

                      <p className="mt-2 text-sm font-bold text-cyan-700">
                        {getCategoryLabel(file.category)}
                      </p>

                      <p
                        className="mt-2 truncate text-sm text-gray-500"
                        title={file.file_name}
                      >
                        {file.file_name}
                      </p>
                    </div>
                  </div>

                  {file.description && (
                    <p className="mt-4 whitespace-pre-line rounded-xl bg-gray-50 p-4 leading-7 text-gray-600">
                      {file.description}
                    </p>
                  )}

                  <div className="mt-4 grid gap-2 text-sm text-gray-500 sm:grid-cols-2">
                    <p>
                      الحجم: {formatFileSize(file.file_size)}
                    </p>

                    <p>
                      تاريخ الرفع:{" "}
                      {formatFileDate(file.created_at)}
                    </p>
                  </div>

                  <a
                    href={file.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={file.file_name}
                    className="mt-5 block rounded-xl bg-cyan-600 px-5 py-3 text-center font-bold text-white hover:bg-cyan-700"
                  >
                    فتح أو تحميل الملف
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl bg-white p-5 shadow sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                مراحل تنفيذ المشروع
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                آخر تحديثات المشروع مرتبة من الأحدث إلى الأقدم
              </p>
            </div>

            <div className="text-sm text-gray-500">
              {updates.length} تحديث — {totalImages} صورة
            </div>
          </div>

          {updates.length === 0 ? (
            <p className="mt-8 rounded-xl bg-gray-50 p-8 text-center text-gray-500">
              لا توجد تحديثات للمشروع حتى الآن
            </p>
          ) : (
            <div className="relative mt-8">
              <div className="absolute bottom-0 right-5 top-0 hidden w-0.5 bg-blue-100 sm:block" />

              <div className="space-y-8">
                {updates.map((update, index) => (
                  <article
                    key={update.id}
                    className="relative sm:pr-16"
                  >
                    <div className="absolute right-0 top-5 hidden h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-blue-600 text-sm font-bold text-white shadow sm:flex">
                      {updates.length - index}
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                      <div className="border-b border-gray-100 p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 sm:text-2xl">
                              {update.title}
                            </h3>

                            <p className="mt-2 text-sm text-gray-500">
                              {formatDateTime(update.createdAt)}
                            </p>
                          </div>

                          <span className="shrink-0 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                            الإنجاز: {update.progress}%
                          </span>
                        </div>

                        {update.description && (
                          <p className="mt-4 whitespace-pre-line leading-7 text-gray-700">
                            {update.description}
                          </p>
                        )}

                        <div className="mt-5">
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="text-gray-500">
                              نسبة الإنجاز وقت التحديث
                            </span>

                            <span className="font-bold text-blue-700">
                              {update.progress}%
                            </span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{
                                width: `${update.progress}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <h4 className="font-bold">
                            صور المرحلة
                          </h4>

                          <span className="text-sm text-gray-500">
                            {update.images.length} صورة
                          </span>
                        </div>

                        {update.images.length === 0 ? (
                          <p className="rounded-lg bg-gray-50 p-5 text-center text-gray-500">
                            لا توجد صور مرتبطة بهذا التحديث
                          </p>
                        ) : (
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {update.images.map((image) => (
                              <a
                                key={image.id}
                                href={image.publicUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="group overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                              >
                                <div className="overflow-hidden">
                                  <img
                                    src={image.publicUrl}
                                    alt={update.title}
                                    loading="lazy"
                                    className="h-64 w-full object-cover transition duration-300 group-hover:scale-105"
                                  />
                                </div>

                                <p
                                  className="truncate p-3 text-xs text-gray-500"
                                  title={image.name}
                                >
                                  {image.name}
                                </p>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        <footer className="mt-8 text-center text-sm text-gray-500">
          أزدان للمقاولات العامة — متابعة وتنفيذ المشاريع
        </footer>
      </div>
    </main>
  );
}