"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  engineer_name: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type StageImageRecord = {
  id: number;
  stage_id: number | null;
  storage_path: string;
  description: string | null;
  created_at: string;
};

type StageImage = StageImageRecord & {
  publicUrl: string;
};

type NotificationRecord = {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
};

function formatDate(date: string | null) {
  if (!date) return "غير محدد";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "غير محدد";

  return new Intl.DateTimeFormat("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

function formatDateTime(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("ar-IQ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function notificationIcon(type: string) {
  if (type === "payment") return "💰";
  if (type === "file") return "📄";
  if (type === "progress") return "📈";
  if (type === "update") return "🏗️";
  return "🔔";
}

export default function ClientPortalPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [images, setImages] = useState<StageImage[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!Number.isFinite(clientId) || clientId <= 0) {
      router.replace("/client-login");
      return;
    }

    async function loadData() {
      setLoading(true);
      setMessage("");

      try {
        const response = await fetch(`/api/client-portal/${clientId}/snapshot`, {
          cache: "no-store",
        });

        if (response.status === 401 || response.status === 403) {
          router.replace("/client-login");
          return;
        }

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "تعذر تحميل المشروع");
        }

        setClient(payload.client as Client);
        setStages((payload.stages ?? []) as ProjectStage[]);
        setImages((payload.images ?? []) as StageImage[]);
        setNotifications((payload.notifications ?? []) as NotificationRecord[]);
      } catch (error) {
        console.error(error);
        setMessage(
          error instanceof Error ? error.message : "تعذر تحميل المشروع حالياً"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [clientId, router]);

  const completedStages = useMemo(
    () => stages.filter((stage) => stage.status === "completed").length,
    [stages]
  );

  const projectProgress = useMemo(
    () =>
      stages.length > 0
        ? Math.round((completedStages / stages.length) * 100)
        : 0,
    [completedStages, stages.length]
  );

  const activeStage = useMemo(
    () =>
      stages.find((stage) => stage.status === "current") ??
      stages.find((stage) => stage.status === "pending") ??
      null,
    [stages]
  );

  const displayStage = useMemo(
    () => activeStage ?? stages[stages.length - 1] ?? null,
    [activeStage, stages]
  );

  const displayStageImages = useMemo(
    () =>
      displayStage
        ? images.filter((image) => image.stage_id === displayStage.id).slice(0, 4)
        : [],
    [displayStage, images]
  );

  const latestActivity = notifications[0] ?? null;
  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  async function logout() {
    try {
      await fetch("/api/client-portal/logout", { method: "POST" });
    } finally {
      router.replace("/client-login");
    }
  }

  async function openNotifications() {
    const nextState = !showNotifications;
    setShowNotifications(nextState);

    if (!nextState || unreadCount === 0) return;

    try {
      const response = await fetch(`/api/client-portal/${clientId}/notifications/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });

      if (response.status === 401 || response.status === 403) {
        router.replace("/client-login");
        return;
      }

      if (response.ok) {
        setNotifications((current) =>
          current.map((notification) => ({ ...notification, is_read: true }))
        );
      }
    } catch (error) {
      console.error(error);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="grid min-h-screen place-items-center bg-[#f4f6f8] px-5"
      >
        <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 text-center shadow-xl shadow-slate-200/70">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0b2239] text-xl font-black text-[#d8b56a]">
            أ
          </div>
          <p className="mt-5 font-black text-[#0b2239]">جاري تحميل مشروعك...</p>
          <div className="mx-auto mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[#d8b56a]" />
          </div>
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <main
        dir="rtl"
        className="grid min-h-screen place-items-center bg-[#f4f6f8] px-5"
      >
        <div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <h1 className="text-2xl font-black text-[#0b2239]">تعذر فتح المشروع</h1>
          <p className="mt-3 text-sm leading-7 text-red-600">
            {message || "المشروع غير موجود"}
          </p>
          <button
            onClick={logout}
            className="mt-6 w-full rounded-2xl bg-[#0b2239] px-5 py-3 font-black text-white"
          >
            العودة إلى تسجيل الدخول
          </button>
        </div>
      </main>
    );
  }

  const projectFinished = stages.length > 0 && completedStages === stages.length;

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f4f6f8] pb-24 text-[#10253b] lg:pb-10"
    >
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0b2239] text-lg font-black text-[#d8b56a]">
              أ
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#0b2239]">
                أزدان للمقاولات العامة
              </p>
              <p className="truncate text-xs text-slate-500">بوابة العميل</p>
            </div>
          </div>

          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={openNotifications}
              aria-label="الإشعارات"
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -left-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-600 sm:px-4 sm:text-sm"
            >
              خروج
            </button>

            {showNotifications && (
              <div className="absolute left-0 top-14 z-50 w-[min(92vw,380px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="border-b border-slate-100 px-5 py-4">
                  <p className="font-black text-[#0b2239]">الإشعارات</p>
                </div>
                <div className="max-h-[420px] overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <p className="p-6 text-center text-sm text-slate-500">
                      لا توجد إشعارات
                    </p>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="flex gap-3 rounded-2xl p-3 hover:bg-slate-50"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5efe2]">
                          {notificationIcon(notification.notification_type)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-[#0b2239]">
                            {notification.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {formatDateTime(notification.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        {message && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {message}
          </div>
        )}

        <section className="overflow-hidden rounded-[2rem] bg-[#0b2239] p-5 text-white shadow-xl shadow-[#0b2239]/15 sm:p-7">
          <div className="grid gap-5 lg:grid-cols-[1fr_290px] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#d8b56a] px-3 py-1 text-xs font-black text-[#0b2239]">
                  {projectFinished ? "مكتمل" : client.status}
                </span>
                <span className="text-xs font-bold text-slate-300">
                  أهلاً، {client.name}
                </span>
              </div>

              <h1 className="mt-3 text-2xl font-black leading-tight sm:text-4xl">
                {client.project_name}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="text-slate-300">المرحلة الحالية:</span>
                <span className="rounded-xl bg-white/10 px-3 py-1.5 font-black text-[#f3d998]">
                  {projectFinished
                    ? "تم إنجاز جميع المراحل"
                    : displayStage?.stage_name || "لم تبدأ المراحل بعد"}
                </span>
              </div>
            </div>

            <div className="rounded-3xl bg-white/10 p-4">
              <div className="flex items-end justify-between">
                <span className="text-xs font-bold text-slate-300">الإنجاز الكلي</span>
                <span className="text-3xl font-black text-[#d8b56a]">
                  {projectProgress}%
                </span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-[#d8b56a] transition-all duration-700"
                  style={{ width: `${projectProgress}%` }}
                />
              </div>
              <p className="mt-3 text-[11px] text-slate-300">
                {completedStages} من {stages.length || 0} مراحل مكتملة
              </p>
            </div>
          </div>
        </section>

        {latestActivity && (
          <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#d8b56a]/25 bg-[#fffaf0] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-[#a77a28]">آخر نشاط</p>
              <p className="mt-1 truncate text-sm font-black text-[#0b2239]">
                {latestActivity.title}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                {latestActivity.message}
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-bold text-slate-400">
              {formatDateTime(latestActivity.created_at)}
            </span>
          </section>
        )}

        <section
          id="stages"
          className="mt-6 rounded-[2rem] bg-white p-5 shadow-lg shadow-slate-200/60 sm:p-6"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black text-[#b48b3c]">مسار التنفيذ</p>
              <h2 className="mt-1 text-xl font-black text-[#0b2239] sm:text-2xl">
                مراحل المشروع
              </h2>
            </div>
            {stages.length > 0 && (
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                {completedStages}/{stages.length}
              </span>
            )}
          </div>

          {stages.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center text-sm text-slate-500">
              لم تتم إضافة مراحل المشروع بعد.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto pb-2">
              <div className="flex min-w-max items-start px-1">
                {stages.map((stage, index) => {
                  const completed = stage.status === "completed";
                  const current = stage.status === "current";
                  const isLast = index === stages.length - 1;

                  return (
                    <Link
                      key={stage.id}
                      href={`/client-portal/${clientId}/stages/${stage.id}`}
                      className="group relative flex w-[132px] shrink-0 flex-col items-center text-center sm:w-[155px]"
                    >
                      {!isLast && (
                        <div
                          className={`absolute right-1/2 top-5 h-1 w-full ${
                            completed ? "bg-emerald-500" : "bg-slate-200"
                          }`}
                        />
                      )}

                      <div
                        className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 text-sm font-black transition group-hover:scale-105 ${
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
                        className={`mt-2 max-w-[125px] text-xs font-black leading-5 ${
                          current
                            ? "text-[#9a6f1e]"
                            : completed
                            ? "text-emerald-700"
                            : "text-slate-500"
                        }`}
                      >
                        {stage.stage_name}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {displayStage && (
          <section
            id="current-stage"
            className="mt-6 overflow-hidden rounded-[2rem] bg-white shadow-lg shadow-slate-200/60"
          >
            <div className="flex flex-col gap-4 bg-[#0b2239] px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-xs font-black text-[#d8b56a]">
                  {projectFinished ? "آخر مرحلة" : "المرحلة الحالية"}
                </p>
                <h2 className="mt-1 text-2xl font-black">{displayStage.stage_name}</h2>
              </div>
              <Link
                href={`/client-portal/${clientId}/stages/${displayStage.id}`}
                className="w-fit rounded-xl bg-white/10 px-4 py-2 text-xs font-black"
              >
                تفاصيل المرحلة
              </Link>
            </div>

            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_.9fr]">
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[11px] text-slate-500">المهندس المشرف</p>
                    <p className="mt-2 text-sm font-black text-[#0b2239]">
                      {displayStage.engineer_name || "غير محدد"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[11px] text-slate-500">تاريخ البدء</p>
                    <p className="mt-2 text-sm font-black text-[#0b2239]">
                      {formatDate(displayStage.started_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-slate-100 p-4">
                  <p className="text-xs font-black text-[#b48b3c]">ملاحظة المهندس</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">
                    {displayStage.notes ||
                      "لا توجد ملاحظات مضافة لهذه المرحلة حالياً."}
                  </p>
                </div>

                {displayStage.completed_at && (
                  <p className="mt-3 text-xs font-bold text-emerald-700">
                    اكتملت بتاريخ {formatDate(displayStage.completed_at)}
                  </p>
                )}
              </div>

              <div id="photos">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-[#0b2239]">آخر صور المرحلة</p>
                  {displayStageImages.length > 0 && (
                    <Link
                      href={`/client-portal/${clientId}/stages/${displayStage.id}`}
                      className="text-xs font-black text-[#b48b3c]"
                    >
                      عرض الكل
                    </Link>
                  )}
                </div>

                {displayStageImages.length === 0 ? (
                  <div className="mt-3 grid min-h-40 place-items-center rounded-2xl bg-slate-50 px-4 text-center text-sm text-slate-500">
                    لا توجد صور لهذه المرحلة بعد
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {displayStageImages.map((image, index) => (
                      <a
                        key={image.id}
                        href={image.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`overflow-hidden rounded-2xl bg-slate-100 ${
                          index === 0 && displayStageImages.length >= 3
                            ? "row-span-2"
                            : ""
                        }`}
                      >
                        <img
                          src={image.publicUrl}
                          alt={image.description || displayStage.stage_name}
                          className="h-full min-h-28 w-full object-cover transition hover:scale-105"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3">
          <Link
            href={`/client-portal/${clientId}/documents`}
            className="rounded-[1.5rem] bg-white p-5 shadow-lg shadow-slate-200/60 transition hover:-translate-y-0.5"
          >
            <span className="text-2xl">📄</span>
            <p className="mt-3 font-black text-[#0b2239]">ملفات المشروع</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              العقود والمخططات والمستندات
            </p>
          </Link>

          <Link
            href={`/client-portal/${clientId}/finance`}
            className="rounded-[1.5rem] bg-white p-5 shadow-lg shadow-slate-200/60 transition hover:-translate-y-0.5"
          >
            <span className="text-2xl">💰</span>
            <p className="mt-3 font-black text-[#0b2239]">الحساب المالي</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              العقد والدفعات والإضافات والمتبقي
            </p>
          </Link>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          <a
            href="#"
            className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-[#0b2239]"
          >
            <span>⌂</span>
            <span className="text-[10px] font-black">الرئيسية</span>
          </a>
          <a
            href="#stages"
            className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-slate-500"
          >
            <span>🏗️</span>
            <span className="text-[10px] font-bold">المراحل</span>
          </a>
          <Link
            href={`/client-portal/${clientId}/documents`}
            className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-slate-500"
          >
            <span>📄</span>
            <span className="text-[10px] font-bold">الملفات</span>
          </Link>
          <Link
            href={`/client-portal/${clientId}/finance`}
            className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-slate-500"
          >
            <span>💰</span>
            <span className="text-[10px] font-bold">الحساب</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
