"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type NotificationPreview = {
  id: number;
  client_id: number;
  title: string;
  is_read: boolean;
  created_at: string;
};

type Props = {
  enabled: boolean;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ar-IQ", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminNotificationBell({ enabled }: Props) {
  const [notifications, setNotifications] = useState<NotificationPreview[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  async function loadNotifications() {
    if (!enabled) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("project_notifications")
      .select("id, client_id, title, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    if (!error) {
      setNotifications((data as NotificationPreview[] | null) ?? []);
    } else {
      console.error("تعذر تحميل عداد الإشعارات:", error);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!enabled) return;

    void loadNotifications();

    const channel = supabase
      .channel("admin-global-notification-bell")
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

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      void supabase.removeChannel(channel);
    };
  }, [enabled]);

  if (!enabled) return null;

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  return (
    <div
      ref={wrapperRef}
      dir="rtl"
      className="fixed left-3 top-3 z-[70] print:hidden sm:left-5 sm:top-5"
    >
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          void loadNotifications();
        }}
        aria-label="فتح مركز الإشعارات"
        className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-2xl shadow-lg transition hover:bg-gray-50"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-black text-white">
            {unreadCount > 99 ? "+99" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 w-[calc(100vw-1.5rem)] max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <div>
              <p className="font-black">الإشعارات</p>
              <p className="mt-1 text-xs text-gray-500">
                {unreadCount} غير مقروء
              </p>
            </div>
            <Link
              href="/admin/notifications"
              onClick={() => setOpen(false)}
              className="text-sm font-bold text-blue-700 hover:underline"
            >
              عرض الكل
            </Link>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {loading && notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500">
                جاري التحميل...
              </p>
            ) : notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500">
                لا توجد إشعارات.
              </p>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={`/admin/client/${notification.client_id}/notifications`}
                  onClick={() => setOpen(false)}
                  className={`mb-2 block rounded-xl border p-3 last:mb-0 ${
                    notification.is_read
                      ? "border-gray-100 bg-white"
                      : "border-blue-100 bg-blue-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!notification.is_read && (
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {notification.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {formatDate(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
