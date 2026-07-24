"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TaskStatus = "لم تبدأ" | "قيد التنفيذ" | "مكتملة" | "متوقفة";
type TaskPriority = "منخفضة" | "متوسطة" | "عالية" | "عاجلة";

type CalendarTask = {
  id: number;
  client_id: number;
  title: string;
  assigned_to: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  client: {
    name: string;
    project_name: string;
  } | null;
};

const WEEK_DAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const MONTH_NAMES = [
  "كانون الثاني",
  "شباط",
  "آذار",
  "نيسان",
  "أيار",
  "حزيران",
  "تموز",
  "آب",
  "أيلول",
  "تشرين الأول",
  "تشرين الثاني",
  "كانون الأول",
];

function clampProgress(value: number) {
  return Math.min(Math.max(Number(value) || 0, 0), 100);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value: string | null) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null) {
  const date = parseDate(value);

  if (!date) return "غير محدد";

  return new Intl.DateTimeFormat("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function isOverdue(task: CalendarTask) {
  if (!task.due_date || task.status === "مكتملة") return false;

  const dueDate = new Date(`${task.due_date}T23:59:59`);
  return dueDate.getTime() < Date.now();
}

function priorityClasses(priority: TaskPriority) {
  if (priority === "عاجلة") return "bg-red-100 text-red-700";
  if (priority === "عالية") return "bg-orange-100 text-orange-700";
  if (priority === "متوسطة") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-700";
}

function statusClasses(status: TaskStatus) {
  if (status === "مكتملة") return "bg-emerald-100 text-emerald-700";
  if (status === "قيد التنفيذ") return "bg-blue-100 text-blue-700";
  if (status === "متوقفة") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
}

export default function TasksCalendarPage() {
  const today = useMemo(() => new Date(), []);

  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"الكل" | TaskStatus>("الكل");
  const [selectedDate, setSelectedDate] = useState<string | null>(
    toDateKey(today)
  );

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("project_tasks")
      .select(
        `
          id,
          client_id,
          title,
          assigned_to,
          priority,
          status,
          progress,
          start_date,
          due_date,
          client:clients (
            name,
            project_name
          )
        `
      )
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error) {
      console.error(error);
      setMessage(`تعذر تحميل تقويم المهام: ${error.message}`);
      setLoading(false);
      return;
    }

    const normalizedTasks = ((data ?? []) as unknown as Array<
      Omit<CalendarTask, "client"> & {
        client:
          | CalendarTask["client"]
          | CalendarTask["client"][]
          | null;
      }
    >).map((task) => ({
      ...task,
      client: Array.isArray(task.client)
        ? task.client[0] ?? null
        : task.client,
      progress: clampProgress(task.progress),
    }));

    setTasks(normalizedTasks);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesStatus =
        statusFilter === "الكل" || task.status === statusFilter;

      const matchesSearch =
        !normalizedSearch ||
        [
          task.title,
          task.assigned_to,
          task.priority,
          task.status,
          task.client?.name,
          task.client?.project_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [tasks, searchTerm, statusFilter]);

  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: Array<{
      date: Date;
      key: string;
      isCurrentMonth: boolean;
    }> = [];

    for (let index = firstDay.getDay() - 1; index >= 0; index -= 1) {
      const date = new Date(year, month, -index);
      days.push({
        date,
        key: toDateKey(date),
        isCurrentMonth: false,
      });
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(year, month, day);
      days.push({
        date,
        key: toDateKey(date),
        isCurrentMonth: true,
      });
    }

    let nextMonthDay = 1;

    while (days.length % 7 !== 0 || days.length < 42) {
      const date = new Date(year, month + 1, nextMonthDay);
      days.push({
        date,
        key: toDateKey(date),
        isCurrentMonth: false,
      });
      nextMonthDay += 1;
    }

    return days;
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();

    filteredTasks.forEach((task) => {
      const taskDate = task.due_date || task.start_date;
      if (!taskDate) return;

      const current = map.get(taskDate) ?? [];
      current.push(task);
      map.set(taskDate, current);
    });

    return map;
  }, [filteredTasks]);

  const selectedTasks = useMemo(() => {
    if (!selectedDate) return [];
    return tasksByDate.get(selectedDate) ?? [];
  }, [selectedDate, tasksByDate]);

  const monthStatistics = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const monthTasks = filteredTasks.filter((task) => {
      const date = parseDate(task.due_date || task.start_date);
      return (
        date &&
        date.getFullYear() === year &&
        date.getMonth() === month
      );
    });

    return {
      total: monthTasks.length,
      completed: monthTasks.filter((task) => task.status === "مكتملة").length,
      inProgress: monthTasks.filter(
        (task) => task.status === "قيد التنفيذ"
      ).length,
      overdue: monthTasks.filter(isOverdue).length,
    };
  }, [currentMonth, filteredTasks]);

  function moveMonth(offset: number) {
    setCurrentMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1)
    );
    setSelectedDate(null);
  }

  function goToToday() {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(toDateKey(today));
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 sm:px-6"
    >
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl bg-white p-5 shadow sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-gray-500">إدارة تنفيذ المشاريع</p>
              <h1 className="mt-1 text-3xl font-black text-blue-700">
                تقويم المهام
              </h1>
              <p className="mt-2 text-gray-500">
                عرض مواعيد جميع مهام المشاريع في تقويم شهري موحد.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin"
                className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800"
              >
                لوحة التحكم
              </Link>
            </div>
          </div>
        </header>

        {message && (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-center font-bold text-red-700">
            {message}
          </p>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["مهام الشهر", monthStatistics.total, "text-blue-700"],
            ["قيد التنفيذ", monthStatistics.inProgress, "text-cyan-700"],
            ["المكتملة", monthStatistics.completed, "text-emerald-700"],
            ["المتأخرة", monthStatistics.overdue, "text-red-700"],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-gray-500">{label}</p>
              <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-2xl bg-white p-5 shadow sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="rounded-xl border border-gray-300 px-4 py-3 font-bold hover:bg-gray-50"
              >
                الشهر التالي
              </button>

              <button
                type="button"
                onClick={goToToday}
                className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700"
              >
                اليوم
              </button>

              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="rounded-xl border border-gray-300 px-4 py-3 font-bold hover:bg-gray-50"
              >
                الشهر السابق
              </button>

              <h2 className="mr-2 text-2xl font-black">
                {MONTH_NAMES[currentMonth.getMonth()]}{" "}
                {currentMonth.getFullYear()}
              </h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ابحث عن مهمة أو موظف أو مشروع..."
                className="min-w-64 rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "الكل" | TaskStatus)
                }
                className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option>الكل</option>
                <option>لم تبدأ</option>
                <option>قيد التنفيذ</option>
                <option>مكتملة</option>
                <option>متوقفة</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p className="mt-6 rounded-xl bg-gray-50 p-10 text-center text-gray-500">
              جاري تحميل تقويم المهام...
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-7 gap-2">
                  {WEEK_DAYS.map((day) => (
                    <div
                      key={day}
                      className="rounded-xl bg-slate-900 p-3 text-center text-sm font-bold text-white"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-2">
                  {monthDays.map((day) => {
                    const dayTasks = tasksByDate.get(day.key) ?? [];
                    const isToday = day.key === toDateKey(today);
                    const isSelected = selectedDate === day.key;

                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => setSelectedDate(day.key)}
                        className={`min-h-36 rounded-xl border p-3 text-right align-top transition ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                            : isToday
                              ? "border-emerald-400 bg-emerald-50"
                              : day.isCurrentMonth
                                ? "border-gray-200 bg-white hover:border-blue-300"
                                : "border-gray-100 bg-gray-50 text-gray-400"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                              isToday
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {day.date.getDate()}
                          </span>

                          {dayTasks.length > 0 && (
                            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">
                              {dayTasks.length}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 space-y-2">
                          {dayTasks.slice(0, 3).map((task) => (
                            <div
                              key={task.id}
                              className={`truncate rounded-lg px-2 py-1.5 text-xs font-bold ${
                                isOverdue(task)
                                  ? "bg-red-100 text-red-700"
                                  : task.status === "مكتملة"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : task.status === "قيد التنفيذ"
                                      ? "bg-blue-100 text-blue-700"
                                      : task.status === "متوقفة"
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-gray-100 text-gray-700"
                              }`}
                              title={task.title}
                            >
                              {task.title}
                            </div>
                          ))}

                          {dayTasks.length > 3 && (
                            <p className="text-xs font-bold text-blue-700">
                              + {dayTasks.length - 3} مهام أخرى
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl bg-white p-5 shadow sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">مهام اليوم المحدد</h2>
              <p className="mt-1 text-sm text-gray-500">
                {selectedDate
                  ? formatDate(selectedDate)
                  : "اختر يومًا من التقويم لعرض مهامه."}
              </p>
            </div>

            {selectedTasks.length > 0 && (
              <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-black text-blue-700">
                {selectedTasks.length} مهمة
              </span>
            )}
          </div>

          {!selectedDate ? (
            <p className="mt-6 rounded-xl bg-gray-50 p-8 text-center text-gray-500">
              لم يتم اختيار يوم.
            </p>
          ) : selectedTasks.length === 0 ? (
            <p className="mt-6 rounded-xl bg-gray-50 p-8 text-center text-gray-500">
              لا توجد مهام في هذا اليوم.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {selectedTasks.map((task) => {
                const overdue = isOverdue(task);

                return (
                  <article
                    key={task.id}
                    className={`rounded-2xl border p-5 ${
                      overdue
                        ? "border-red-300 bg-red-50/40"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-black">{task.title}</h3>
                        <p className="mt-2 text-sm text-gray-500">
                          {task.client?.project_name || "مشروع غير محدد"}
                          {task.client?.name
                            ? ` — ${task.client.name}`
                            : ""}
                        </p>
                      </div>

                      <span className="rounded-xl bg-blue-50 px-3 py-2 text-lg font-black text-blue-700">
                        {task.progress}%
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses(
                          task.status
                        )}`}
                      >
                        {task.status}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${priorityClasses(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>

                      {overdue && (
                        <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                          متأخرة
                        </span>
                      )}
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={`h-full rounded-full ${
                          overdue ? "bg-red-600" : "bg-blue-600"
                        }`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>

                    <div className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-gray-500">المسؤول</p>
                        <p className="mt-1 font-bold">
                          {task.assigned_to || "غير معين"}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500">البداية</p>
                        <p className="mt-1 font-bold">
                          {formatDate(task.start_date)}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500">الاستحقاق</p>
                        <p
                          className={`mt-1 font-bold ${
                            overdue ? "text-red-700" : ""
                          }`}
                        >
                          {formatDate(task.due_date)}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/admin/client/${task.client_id}/tasks`}
                      className="mt-4 inline-block rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                    >
                      فتح مهام المشروع
                    </Link>
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