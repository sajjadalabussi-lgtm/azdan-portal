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

type ProjectStage = {
  id: number;
  client_id: number;
  stage_order: number;
  stage_name: string;
  status: "pending" | "current" | "completed";
  progress: number;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
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
  const [projectStages, setProjectStages] = useState<ProjectStage[]>([]);
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
        stagesResult,
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
          .from("project_stages")
          .select(
            "id, client_id, stage_order, stage_name, status, progress, notes, started_at, completed_at"
          )
          .eq("client_id", clientId)
          .order("stage_order", { ascending: true }),

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
      setProjectStages(
        stagesResult.error ? [] : ((stagesResult.data ?? []) as ProjectStage[])
      );
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
        className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-5"
      >
        <div className="w-full max-w-sm rounded-[2rem] border border-white/70 bg-white p-8 text-center shadow-xl shadow-slate-200/70">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0b2239] text-2xl font-black text-[#d8b56a]">
            أ
          </div>
          <div className="mx-auto mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[#d8b56a]" />
          </div>
          <p className="mt-4 font-bold text-[#0b2239]">
            جاري تجهيز بوابة مشروعك...
          </p>
          <p className="mt-1 text-sm text-slate-500">
            يتم تحميل آخر التحديثات والملفات
          </p>
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-5"
      >
        <div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">
            !
          </div>
          <h1 className="mt-5 text-2xl font-black text-[#0b2239]">
            تعذر فتح بوابة المشروع
          </h1>
          <p className="mt-3 text-sm leading-7 text-red-600">
            {message || "لم يتم العثور على المشروع"}
          </p>
          <button
            type="button"
            onClick={logout}
            className="mt-6 w-full rounded-2xl bg-[#0b2239] px-5 py-3.5 font-bold text-white transition hover:bg-[#143552]"
          >
            العودة إلى تسجيل الدخول
          </button>
        </div>
      </main>
    );
  }

  const safeProgress = clampProgress(client.progress);
  const currentStage =
    projectStages.find((stage) => stage.status === "current") ??
    projectStages.find((stage) => stage.status === "pending") ??
    projectStages[projectStages.length - 1] ??
    null;
  const completedStagesCount = projectStages.filter(
    (stage) => stage.status === "completed"
  ).length;

  const totalImages = updates.reduce(
    (total, update) => total + update.images.length,
    0
  );

  const latestUpdate = updates[0] ?? null;
  const heroImage =
    latestUpdate?.images[0]?.publicUrl ||
    updates.find((update) => update.images.length > 0)?.images[0]?.publicUrl ||
    null;

  const recentImages = updates
    .flatMap((update) =>
      update.images.map((image) => ({
        ...image,
        updateTitle: update.title,
        updateDate: update.createdAt,
      }))
    )
    .slice(0, 8);

  const circumference = 2 * Math.PI * 52;
  const progressOffset =
    circumference - (safeProgress / 100) * circumference;

  const navItems = [
    { id: "overview", label: "الرئيسية", icon: "⌂" },
    { id: "stages", label: "المراحل", icon: "🏗" },
    { id: "gallery", label: "الصور", icon: "▧" },
    { id: "files", label: "الملفات", icon: "▤" },
    { id: "finance", label: "الحساب", icon: "◉" },
  ];

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f4f6f8] pb-24 text-[#10253b] selection:bg-[#d8b56a]/30 lg:pb-0"
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#d8b56a]/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#0b2239]/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0b2239] text-lg font-black text-[#d8b56a] shadow-lg shadow-[#0b2239]/20">
              أ
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#0b2239]">
                أزدان للمقاولات العامة
              </p>
              <p className="truncate text-xs text-slate-500">
                بوابة متابعة المشروع
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="#notifications"
              aria-label="الإشعارات"
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg shadow-sm transition hover:-translate-y-0.5"
            >
              🔔
              {unreadNotificationsCount > 0 && (
                <span className="absolute -left-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
                  {unreadNotificationsCount}
                </span>
              )}
            </a>

            <button
              type="button"
              onClick={logout}
              className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 sm:block"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        {message && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 shadow-sm">
            {message}
          </div>
        )}

        <section
          id="overview"
          className="relative overflow-hidden rounded-[2rem] bg-[#0b2239] shadow-2xl shadow-[#0b2239]/20"
        >
          {heroImage ? (
            <img
              src={heroImage}
              alt={client.project_name}
              className="absolute inset-0 h-full w-full object-cover opacity-45"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(216,181,106,0.32),_transparent_38%),linear-gradient(135deg,#0b2239_0%,#163c59_100%)]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#071a2c] via-[#0b2239]/80 to-[#0b2239]/35" />
          <div className="absolute -left-10 -top-12 h-40 w-40 rounded-full border border-[#d8b56a]/30" />
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full border border-[#d8b56a]/15" />

          <div className="relative grid min-h-[510px] content-between gap-8 p-5 sm:min-h-[460px] sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
            <div className="max-w-2xl self-end lg:self-center">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                  مشروعك تحت المتابعة
                </span>
                <span className="rounded-full bg-[#d8b56a] px-3 py-1.5 text-xs font-black text-[#0b2239]">
                  {client.status}
                </span>
              </div>

              <p className="text-sm font-bold text-[#d8b56a]">
                أهلًا بك، {client.name}
              </p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
                {client.project_name}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-200 sm:text-base">
                تابع مراحل التنفيذ والصور والملفات والحساب المالي من مكان واحد،
                بتحديثات مباشرة من إدارة المشروع.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#updates"
                  className="rounded-2xl bg-[#d8b56a] px-5 py-3 text-sm font-black text-[#0b2239] shadow-lg shadow-black/10 transition hover:-translate-y-0.5"
                >
                  عرض آخر التحديثات
                </a>
                <a
                  href="#gallery"
                  className="rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/20"
                >
                  مشاهدة الصور
                </a>
              </div>
            </div>

            <div className="mx-auto flex items-center justify-center lg:mx-0">
              <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-white/10 p-3 backdrop-blur-lg sm:h-52 sm:w-52">
                <svg
                  viewBox="0 0 120 120"
                  className="h-full w-full -rotate-90"
                >
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="#d8b56a"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={progressOffset}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-4xl font-black text-white sm:text-5xl">
                    {safeProgress}%
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#d8b56a]">
                    نسبة الإنجاز
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="-mt-4 grid grid-cols-2 gap-3 px-3 sm:grid-cols-4 sm:gap-4 lg:px-8">
          {[
            {
              label: "التحديثات",
              value: updates.length,
              icon: "🏗️",
              href: "#updates",
            },
            {
              label: "صور المشروع",
              value: totalImages,
              icon: "🖼️",
              href: "#gallery",
            },
            {
              label: "الملفات",
              value: projectFiles.length,
              icon: "📄",
              href: "#files",
            },
            {
              label: "إشعارات جديدة",
              value: unreadNotificationsCount,
              icon: "🔔",
              href: "#notifications",
            },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="group rounded-3xl border border-white bg-white p-4 shadow-xl shadow-slate-200/60 transition hover:-translate-y-1 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-black text-[#0b2239] sm:text-3xl">
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500 sm:text-sm">
                    {item.label}
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f5efe2] text-xl transition group-hover:scale-110">
                  {item.icon}
                </span>
              </div>
            </a>
          ))}
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <div className="rounded-[2rem] border border-white bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-wider text-[#b48b3c]">
                  نظرة سريعة
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#0b2239]">
                  ملخص المشروع
                </h2>
              </div>
              <span className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                {client.status}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#f7f9fb] p-4">
                <p className="text-xs text-slate-500">رقم التواصل</p>
                <p className="mt-2 break-all font-black text-[#0b2239]">
                  {client.phone || "غير مسجل"}
                </p>
              </div>
              <div className="rounded-2xl bg-[#f7f9fb] p-4">
                <p className="text-xs text-slate-500">آخر تحديث</p>
                <p className="mt-2 text-sm font-black text-[#0b2239]">
                  {latestUpdate
                    ? formatDateTime(latestUpdate.createdAt)
                    : "لا يوجد تحديث"}
                </p>
              </div>
              <div className="rounded-2xl bg-[#f7f9fb] p-4">
                <p className="text-xs text-slate-500">نسبة الدفع</p>
                <p className="mt-2 text-xl font-black text-[#0b2239]">
                  {paymentPercentage}%
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-[#0b2239] p-5 text-white">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-bold">تقدم العمل الحالي</span>
                <span className="font-black text-[#d8b56a]">
                  {safeProgress}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-[#d8b56a] transition-all duration-1000"
                  style={{ width: `${safeProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] bg-gradient-to-br from-[#d8b56a] to-[#b98e3d] p-6 text-[#0b2239] shadow-xl shadow-[#d8b56a]/25">
            <p className="text-xs font-black">آخر تحديث بالمشروع</p>
            <h3 className="mt-3 text-2xl font-black">
              {latestUpdate?.title || "بانتظار أول تحديث"}
            </h3>
            <p className="mt-3 line-clamp-4 text-sm leading-7 text-[#0b2239]/80">
              {latestUpdate?.description ||
                "سيظهر هنا أحدث إنجاز أو ملاحظة تضاف من إدارة المشروع."}
            </p>
            {latestUpdate && (
              <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/35 px-4 py-3">
                <span className="text-xs font-bold">إنجاز المرحلة</span>
                <span className="text-lg font-black">
                  {latestUpdate.progress}%
                </span>
              </div>
            )}
          </div>
        </section>


        <section
          id="stages"
          className="mt-8 scroll-mt-24 overflow-hidden rounded-[2rem] border border-white bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-7"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-wider text-[#b48b3c]">
                مسار التنفيذ
              </p>
              <h2 className="mt-1 text-2xl font-black text-[#0b2239] sm:text-3xl">
                مراحل العمل
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                تعرف فورًا على المرحلة المكتملة والحالية والقادمة
              </p>
            </div>

            {projectStages.length > 0 && (
              <div className="rounded-2xl bg-[#f5efe2] px-4 py-3 text-sm font-black text-[#0b2239]">
                {completedStagesCount} من {projectStages.length} مكتملة
              </div>
            )}
          </div>

          {projectStages.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-[#d8b56a]/50 bg-[#fffaf0] p-8 text-center">
              <div className="text-4xl">🏗️</div>
              <p className="mt-3 font-black text-[#0b2239]">
                لم تُجهّز مراحل المشروع بعد
              </p>
              <p className="mt-2 text-sm text-slate-500">
                ستظهر هنا مراحل الحفر والأساس والبناء والسقوف والتسليم.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 overflow-x-auto pb-3">
                <div className="flex min-w-max items-start px-2">
                  {projectStages.map((stage, index) => {
                    const completed = stage.status === "completed";
                    const current = stage.status === "current";
                    const last = index === projectStages.length - 1;

                    return (
                      <div
                        key={stage.id}
                        className="relative flex w-[150px] shrink-0 flex-col items-center text-center sm:w-[180px]"
                      >
                        {!last && (
                          <div
                            className={`absolute right-[50%] top-6 h-1 w-full ${
                              completed ? "bg-emerald-500" : "bg-slate-200"
                            }`}
                          />
                        )}

                        <div
                          className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-4 text-lg font-black shadow-sm ${
                            completed
                              ? "border-emerald-100 bg-emerald-600 text-white"
                              : current
                              ? "border-[#f5e6c4] bg-[#d8b56a] text-[#0b2239] ring-4 ring-[#d8b56a]/20"
                              : "border-slate-100 bg-slate-200 text-slate-500"
                          }`}
                        >
                          {completed ? "✓" : stage.stage_order}
                        </div>

                        <p
                          className={`mt-3 max-w-[145px] text-sm font-black leading-6 ${
                            current
                              ? "text-[#b48b3c]"
                              : completed
                              ? "text-emerald-700"
                              : "text-slate-500"
                          }`}
                        >
                          {stage.stage_name}
                        </p>

                        <span
                          className={`mt-2 rounded-full px-3 py-1 text-[10px] font-black ${
                            completed
                              ? "bg-emerald-50 text-emerald-700"
                              : current
                              ? "bg-[#fff4d9] text-[#9a6f1e]"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {completed
                            ? "مكتملة"
                            : current
                            ? "المرحلة الحالية"
                            : "قادمة"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {currentStage && (
                <div className="mt-5 grid gap-4 rounded-[1.75rem] bg-[#0b2239] p-5 text-white sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
                  <div>
                    <p className="text-xs font-black text-[#d8b56a]">
                      العمل الجاري حاليًا
                    </p>
                    <h3 className="mt-2 text-2xl font-black">
                      {currentStage.stage_name}
                    </h3>
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-300">
                      {currentStage.notes ||
                        "يتم تحديث تفاصيل هذه المرحلة من إدارة المشروع."}
                    </p>
                  </div>

                  <div className="flex h-28 w-28 items-center justify-center rounded-full border-8 border-white/10 bg-white/5 text-center">
                    <div>
                      <p className="text-3xl font-black text-[#d8b56a]">
                        {clampProgress(currentStage.progress)}%
                      </p>
                      <p className="text-[10px] text-slate-300">إنجاز المرحلة</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section
          id="updates"
          className="mt-8 scroll-mt-24 rounded-[2rem] border border-white bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-7"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-wider text-[#b48b3c]">
                مراحل التنفيذ
              </p>
              <h2 className="mt-1 text-2xl font-black text-[#0b2239] sm:text-3xl">
                رحلة المشروع خطوة بخطوة
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                آخر التحديثات مرتبة من الأحدث إلى الأقدم
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">
              {updates.length} تحديث
            </span>
          </div>

          {updates.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <div className="text-4xl">🏗️</div>
              <p className="mt-3 font-bold text-slate-600">
                لا توجد تحديثات للمشروع حتى الآن
              </p>
            </div>
          ) : (
            <div className="mt-7 space-y-5">
              {updates.map((update, index) => {
                const coverImage = update.images[0]?.publicUrl;

                return (
                  <article
                    key={update.id}
                    className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white transition hover:border-[#d8b56a]/60 hover:shadow-lg"
                  >
                    <div className="grid md:grid-cols-[240px_1fr]">
                      <div className="relative min-h-48 overflow-hidden bg-[#eef2f5]">
                        {coverImage ? (
                          <img
                            src={coverImage}
                            alt={update.title}
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0b2239] to-[#234f6f] text-5xl">
                            🏗️
                          </div>
                        )}
                        <div className="absolute right-3 top-3 rounded-full bg-[#d8b56a] px-3 py-1.5 text-xs font-black text-[#0b2239] shadow">
                          المرحلة {updates.length - index}
                        </div>
                      </div>

                      <div className="p-5 sm:p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-xl font-black text-[#0b2239] sm:text-2xl">
                              {update.title}
                            </h3>
                            <p className="mt-2 text-xs font-bold text-slate-400">
                              {formatDateTime(update.createdAt)}
                            </p>
                          </div>
                          <span className="w-fit rounded-full bg-[#eff6fb] px-4 py-2 text-xs font-black text-[#174d70]">
                            الإنجاز {update.progress}%
                          </span>
                        </div>

                        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">
                          {update.description || "لا يوجد وصف لهذا التحديث"}
                        </p>

                        <div className="mt-5">
                          <div className="mb-2 flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-500">
                              تقدم هذه المرحلة
                            </span>
                            <span className="text-[#b48b3c]">
                              {update.progress}%
                            </span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-l from-[#d8b56a] to-[#b98e3d]"
                              style={{ width: `${update.progress}%` }}
                            />
                          </div>
                        </div>

                        {update.images.length > 0 && (
                          <div className="mt-5 flex items-center gap-2 text-xs font-bold text-slate-500">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100">
                              🖼️
                            </span>
                            {update.images.length} صورة مرتبطة بهذه المرحلة
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section
          id="gallery"
          className="mt-8 scroll-mt-24 rounded-[2rem] bg-[#0b2239] p-5 text-white shadow-2xl shadow-[#0b2239]/20 sm:p-7"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-wider text-[#d8b56a]">
                معرض المشروع
              </p>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">
                أحدث صور التنفيذ
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                اضغط على أي صورة لعرضها بالحجم الكامل
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-slate-200">
              {totalImages} صورة
            </span>
          </div>

          {recentImages.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-white/20 bg-white/5 p-10 text-center">
              <div className="text-4xl">📷</div>
              <p className="mt-3 text-sm text-slate-300">
                لا توجد صور مضافة حتى الآن
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {recentImages.map((image, index) => (
                <a
                  key={`${image.id}-${index}`}
                  href={image.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`group relative overflow-hidden rounded-2xl bg-white/10 ${
                    index === 0
                      ? "col-span-2 row-span-2 min-h-72 sm:min-h-80"
                      : "min-h-36 sm:min-h-40"
                  }`}
                >
                  <img
                    src={image.publicUrl}
                    alt={image.updateTitle}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="line-clamp-1 text-xs font-black">
                      {image.updateTitle}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-300">
                      {formatFileDate(image.updateDate)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section
          id="notifications"
          className="mt-8 scroll-mt-24 rounded-[2rem] border border-white bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-7"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-wider text-[#b48b3c]">
                مركز التنبيهات
              </p>
              <h2 className="mt-1 text-2xl font-black text-[#0b2239]">
                الإشعارات
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                آخر التنبيهات المرسلة من إدارة المشروع
              </p>
            </div>

            {unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsAsRead}
                disabled={markingAllRead}
                className="rounded-2xl bg-[#0b2239] px-5 py-3 text-sm font-black text-white transition hover:bg-[#143552] disabled:opacity-50"
              >
                {markingAllRead
                  ? "جاري التحديث..."
                  : "تعليم الكل كمقروء"}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="mt-6 rounded-3xl bg-slate-50 p-10 text-center text-slate-500">
              لا توجد إشعارات حتى الآن
            </div>
          ) : (
            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              {notifications.map((notification) => {
                const type = getNotificationType(
                  notification.notification_type
                );

                return (
                  <article
                    key={notification.id}
                    className={`rounded-3xl border p-4 transition sm:p-5 ${
                      notification.is_read
                        ? "border-slate-200 bg-slate-50"
                        : "border-[#d8b56a]/60 bg-[#fffaf0] shadow-md shadow-[#d8b56a]/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">
                        {type.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-[#0b2239]">
                            {notification.title}
                          </h3>
                          {!notification.is_read && (
                            <span className="rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black text-white">
                              جديد
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs font-bold text-[#b48b3c]">
                          {type.label}
                        </p>
                        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                          {notification.message}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-[11px] text-slate-400">
                            {formatDateTime(notification.created_at)}
                          </p>
                          {!notification.is_read && (
                            <button
                              type="button"
                              onClick={() =>
                                markNotificationAsRead(notification)
                              }
                              disabled={markingNotificationId !== null}
                              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                            >
                              {markingNotificationId === notification.id
                                ? "جاري..."
                                : "تمت القراءة"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section
          id="finance"
          className="mt-8 scroll-mt-24 rounded-[2rem] border border-white bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-7"
        >
          <div>
            <p className="text-xs font-black tracking-wider text-[#b48b3c]">
              الحساب المالي
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#0b2239] sm:text-3xl">
              ملخص العقد والدفعات
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              عرض واضح لقيمة العقد والمدفوع والمتبقي
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "قيمة العقد",
                value: formatMoney(contractAmount),
                icon: "📋",
              },
              {
                label: "إجمالي المدفوع",
                value: formatMoney(totalPaid),
                icon: "✅",
              },
              {
                label: "المبلغ المتبقي",
                value: formatMoney(remainingAmount),
                icon: "⏳",
              },
              {
                label: "نسبة الدفع",
                value: `${paymentPercentage}%`,
                icon: "📊",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-3xl border border-slate-200 bg-[#f8fafb] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-3 break-words text-lg font-black text-[#0b2239]">
                      {item.value}
                    </p>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">
                    {item.icon}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-3xl bg-[#0b2239] p-5 text-white sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-300">
                  تقدم الدفعات المسجلة
                </p>
                <p className="mt-1 text-3xl font-black text-[#d8b56a]">
                  {paymentPercentage}%
                </p>
              </div>
              {overpaidAmount > 0 && (
                <span className="rounded-2xl bg-purple-500/20 px-3 py-2 text-xs font-bold text-purple-200">
                  زيادة: {formatMoney(overpaidAmount)}
                </span>
              )}
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[#d8b56a]"
                style={{ width: `${paymentPercentage}%` }}
              />
            </div>
          </div>

          {finance?.notes && (
            <div className="mt-5 rounded-3xl border border-[#d8b56a]/30 bg-[#fffaf0] p-5">
              <p className="font-black text-[#0b2239]">
                ملاحظات الحساب
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">
                {finance.notes}
              </p>
            </div>
          )}

          <div className="mt-7">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-black text-[#0b2239]">
                سجل الدفعات
              </h3>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
                {payments.length} دفعة
              </span>
            </div>

            {payments.length === 0 ? (
              <p className="mt-4 rounded-3xl bg-slate-50 p-8 text-center text-sm text-slate-500">
                لا توجد دفعات مسجلة حتى الآن
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {payments.map((payment) => (
                  <article
                    key={payment.id}
                    className="flex flex-col gap-3 rounded-3xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-lg font-black text-emerald-700">
                        {formatMoney(toNumber(payment.amount))}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatPaymentDate(payment.payment_date)}
                      </p>
                    </div>
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:max-w-[60%]">
                      {payment.note || "لا توجد ملاحظة"}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section
          id="files"
          className="mt-8 scroll-mt-24 rounded-[2rem] border border-white bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-7"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-wider text-[#b48b3c]">
                مستندات المشروع
              </p>
              <h2 className="mt-1 text-2xl font-black text-[#0b2239] sm:text-3xl">
                الملفات المتاحة
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                العقود والمخططات والتقارير المخصصة للعميل
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500">
              {projectFiles.length} ملف
            </span>
          </div>

          {projectFiles.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <div className="text-4xl">📂</div>
              <p className="mt-3 text-sm text-slate-500">
                لا توجد ملفات متاحة للعرض حتى الآن
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projectFiles.map((file) => (
                <article
                  key={file.id}
                  className="group flex h-full flex-col rounded-[1.75rem] border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-[#d8b56a]/60 hover:shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f5efe2] text-3xl">
                      {getFileIcon(file.file_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-lg font-black text-[#0b2239]">
                        {file.title}
                      </h3>
                      <p className="mt-1 text-xs font-black text-[#b48b3c]">
                        {getCategoryLabel(file.category)}
                      </p>
                      <p
                        className="mt-2 truncate text-xs text-slate-400"
                        title={file.file_name}
                      >
                        {file.file_name}
                      </p>
                    </div>
                  </div>

                  {file.description && (
                    <p className="mt-4 line-clamp-3 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                      {file.description}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                    <span className="rounded-xl bg-slate-50 px-3 py-2">
                      {formatFileSize(file.file_size)}
                    </span>
                    <span className="rounded-xl bg-slate-50 px-3 py-2">
                      {formatFileDate(file.created_at)}
                    </span>
                  </div>

                  <a
                    href={file.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={file.file_name}
                    className="mt-5 block rounded-2xl bg-[#0b2239] px-5 py-3 text-center text-sm font-black text-white transition group-hover:bg-[#d8b56a] group-hover:text-[#0b2239]"
                  >
                    فتح أو تحميل الملف
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-8 overflow-hidden rounded-[2rem] bg-[#071a2c] text-white shadow-xl">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-3">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d8b56a] text-xl font-black text-[#0b2239]">
                  أ
                </div>
                <div>
                  <p className="font-black">أزدان للمقاولات العامة</p>
                  <p className="text-xs text-slate-400">
                    نبني بثقة وننفذ بدقة
                  </p>
                </div>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-7 text-slate-400">
                بوابة رقمية مخصصة لمتابعة تقدم المشروع والصور والملفات
                والحساب المالي بكل وضوح.
              </p>
            </div>

            <div>
              <p className="font-black text-[#d8b56a]">روابط سريعة</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
                {navItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="transition hover:text-[#d8b56a]"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="font-black text-[#d8b56a]">بيانات المشروع</p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>{client.project_name}</p>
                <p>{client.name}</p>
                <p>{client.phone || "رقم التواصل غير مسجل"}</p>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 px-6 py-4 text-center text-xs text-slate-500">
            أزدان للمقاولات العامة — جميع الحقوق محفوظة
          </div>
        </footer>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-50 rounded-[1.6rem] border border-white/70 bg-white/95 p-2 shadow-2xl shadow-slate-900/20 backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 text-center transition active:bg-[#f5efe2]"
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="mt-1 truncate text-[9px] font-black text-[#0b2239]">
                {item.label}
              </span>
            </a>
          ))}
        </div>
      </nav>
    </main>
  );
}
