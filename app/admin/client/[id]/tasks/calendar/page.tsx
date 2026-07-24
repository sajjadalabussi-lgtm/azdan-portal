"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TaskStatus = "لم تبدأ" | "قيد التنفيذ" | "مكتملة" | "متوقفة";
type TaskPriority = "منخفضة" | "متوسطة" | "عالية" | "عاجلة";

type ClientRecord = {
  id: number;
  name: string;
  project_name: string;
};

type ProjectTaskRecord = {
  id: number;
  client_id: number;
  title: string;
  description: string | null;
  assigned_to: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

type CalendarTask = ProjectTaskRecord & {
  client_name: string;
  project_name: string;
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

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isOverdue(task: CalendarTask) {
  if (!task.due_date || task.status === "مكتملة") return false;
  return parseDate(task.due_date).getTime() < new Date().setHours(0, 0, 0, 0);
}

function statusClasses(task: CalendarTask) {
  if (isOverdue(task)) {
    return "border-red-300 bg-red-100 text-red-800";
  }

  if (task.status === "مكتملة") {
    return "border-emerald-300 bg-emerald-100 text-emerald-800";
  }

  if (task.status === "قيد التنفيذ") {
    return "border-blue-300 bg-blue-100 text-blue-800";
  }

  if (task.status === "متوقفة") {
    return "border-orange-300 bg-orange-100 text-orange-800";
  }

  return "border-gray-300 bg-gray-100 text-gray-800";
}

function priorityClasses(priority: TaskPriority) {
  if (priority === "عاجلة") return "bg-red-600 text-white";
  if (priority === "عالية") return "bg-orange-500 text-white";
  if (priority === "متوسطة") return "bg-blue-600 text-white";
  return "bg-gray-500 text-white";
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("ar-IQ", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parseDate(value));
}

export default function TasksCalendarPage() {
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [currentMonth, setCurrentMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);
  const [projectFilter, setProjectFilter] = useState("الكل");
  const [employeeFilter, setEmployeeFilter] = useState("الكل");
  const [statusFilter, setStatusFilter] = useState<"الكل" | TaskStatus>("الكل");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const [tasksResult, clientsResult] = await Promise.all([
      supabase
        .from("project_tasks")
        .select(
          "id, client_id, title, description, assigned_to, priority, status, progress, start_date, due_date, created_at, updated_at"
        )
        .not("due_date", "is", null)
        .order("due_date", { ascending: true }),
      supabase
        .from("clients")
        .select("id, name, project_name")
        .order("project_name", { ascending: true }),
    ]);

    if (tasksResult.error) {
      console.error(tasksResult.error);
      setMessage(`تعذر تحميل المهام: ${tasksResult.error.message}`);
      setLoading(false);
      return;
    }

    if (clientsResult.error) {
      console.error(clientsResult.error);
      setMessage(`تعذر تحميل المشاريع: ${clientsResult.error.message}`);
      setLoading(false);
      return;
    }

    const clients = (clientsResult.data as ClientRecord[] | null) ?? [];
    const clientMap = new Map(clients.map((client) => [client.id, client]));

    const preparedTasks = (
      (tasksResult.data as ProjectTaskRecord[] | null) ?? []
    ).map((task) => {
      const client = clientMap.get(task.client_id);

      return {
        ...task,
        client_name: client?.name ?? "عميل غير معروف",
        project_name: client?.project_name ?? `مشروع رقم ${task.client_id}`,
      };
    });

    setTasks(preparedTasks);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const projects = useMemo(
    () =>
      Array.from(
        new Map(
          tasks.map((task) => [
            String(task.client_id),
            {
              id: String(task.client_id),
              name: task.project_name,
            },
          ])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name, "ar")),
    [tasks]
  );

  const employees = useMemo(
    () =>
      Array.from(
        new Set(
          tasks
            .map((task) => task.assigned_to?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b, "ar")),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesProject =
        projectFilter === "الكل" ||
        String(task.client_id) === projectFilter;

      const matchesEmployee =
        employeeFilter === "الكل" ||
        task.assigned_to === employeeFilter;

      const matchesStatus =
        statusFilter === "الكل" || task.status === statusFilter;

      const matchesSearch =
        !normalizedSearch ||
        [
          task.title,
          task.description,
          task.assigned_to,
          task.project_name,
          task.client_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return (
        matchesProject &&
        matchesEmployee &&
        matchesStatus &&
        matchesSearch
      );
    });
  }, [
    tasks,
    projectFilter,
    employeeFilter,
    statusFilter,
    searchTerm,
  ]);

  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, CalendarTask[]>();

    filteredTasks.forEach((task) => {
      if (!task.due_date) return;

      const current = grouped.get(task.due_date) ?? [];
      current.push(task);
      grouped.set(task.due_date, current);
    });

    return grouped;
  }, [filteredTasks]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    );

    const firstVisibleDay = new Date(firstDay);
    firstVisibleDay.setDate(firstVisibleDay.getDate() - firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(firstVisibleDay);
      day.setDate(firstVisibleDay.getDate() + index);
      return day;
    });
  }, [currentMonth]);

  const statistics = useMemo(() => {
    const monthStart = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    );

    const monthEnd = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    const monthTasks = filteredTasks.filter((task) => {
      if (!task.due_date) return false;
      const dueDate = parseDate(task.due_date);
      return dueDate >= monthStart && dueDate <= monthEnd;
    });

    return {
      total: monthTasks.length,
      completed: monthTasks.filter((task) => task.status === "مكتملة").length,
      inProgress: monthTasks.filter(
        (task) => task.status === "قيد التنفيذ"
      ).length,
      overdue: monthTasks.filter(isOverdue).length,
    };
  }, [filteredTasks, currentMonth]);

  function changeMonth(offset: number) {
    setCurrentMonth(
      (month) => new Date(month.getFullYear(), month.getMonth() + offset, 1)
    );
    setSelectedTask(null);
  }

  function goToToday() {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedTask(null);
  }

  const todayKey = dateKey(new Date());

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-100 px-3 py-6 text-gray-900 sm:px-6 sm:py-8"
    >
      <div className="mx-auto max-w-[1600px]">
        <header className="rounded-2xl bg-white p-5 shadow sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm text-gray-500">متابعة مواعيد التنفيذ</p>
              <h1 className="mt-1 text-3xl font-black text-blue-700">
                تقويم مهام المشاريع
              </h1>
              <p className="mt-2 text-gray-500">
                عرض المهام حسب تاريخ الاستحقاق مع فلترة المشروع والموظف والحالة.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={goToToday}
                className="rounded-xl border border-blue-300 bg-blue-50 px-5 py-3 font-bold text-blue-700 hover:bg-blue-100"
              >
                اليوم
              </button>

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

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["مهام الشهر", statistics.total, "text-blue-700"],
            ["قيد التنفيذ", statistics.inProgress, "text-cyan-700"],
            ["المكتملة", statistics.completed, "text-emerald-700"],
            ["المتأخرة", statistics.overdue, "text-red-700"],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-gray-500">{label}</p>
              <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-2xl bg-white p-5 shadow sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className="mb-2 block text-sm font-bold">البحث</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="مهمة، مشروع، موظف..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">المشروع</span>
              <select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="الكل">كل المشاريع</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">الموظف</span>
              <select
                value={employeeFilter}
                onChange={(event) => setEmployeeFilter(event.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="الكل">كل الموظفين</option>
                {employees.map((employee) => (
                  <option key={employee} value={employee}>
                    {employee}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">الحالة</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "الكل" | TaskStatus)
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option>الكل</option>
                <option>لم تبدأ</option>
                <option>قيد التنفيذ</option>
                <option>مكتملة</option>
                <option>متوقفة</option>
              </select>
            </label>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow">
          <div className="flex flex-col gap-4 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="rounded-xl border border-gray-300 px-5 py-3 font-bold hover:bg-gray-50"
            >
              الشهر السابق
            </button>

            <h2 className="text-center text-2xl font-black text-blue-700">
              {formatMonth(currentMonth)}
            </h2>

            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="rounded-xl border border-gray-300 px-5 py-3 font-bold hover:bg-gray-50"
            >
              الشهر التالي
            </button>
          </div>

          {loading ? (
            <p className="p-12 text-center text-gray-500">
              جاري تحميل التقويم...
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1050px]">
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                  {WEEK_DAYS.map((day) => (
                    <div
                      key={day}
                      className="border-l border-gray-200 p-3 text-center text-sm font-black last:border-l-0"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {calendarDays.map((day) => {
                    const key = dateKey(day);
                    const dayTasks = tasksByDate.get(key) ?? [];
                    const isCurrentMonth =
                      day.getMonth() === currentMonth.getMonth();
                    const isToday = key === todayKey;

                    return (
                      <div
                        key={key}
                        className={`min-h-44 border-b border-l border-gray-200 p-2 last:border-l-0 ${
                          isCurrentMonth ? "bg-white" : "bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                              isToday
                                ? "bg-blue-600 text-white"
                                : isCurrentMonth
                                  ? "text-gray-900"
                                  : "text-gray-400"
                            }`}
                          >
                            {day.getDate()}
                          </span>

                          {dayTasks.length > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                              {dayTasks.length}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 space-y-2">
                          {dayTasks.slice(0, 4).map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => setSelectedTask(task)}
                              className={`w-full rounded-lg border p-2 text-right text-xs transition hover:-translate-y-0.5 hover:shadow ${statusClasses(
                                task
                              )}`}
                            >
                              <span className="block truncate font-black">
                                {task.title}
                              </span>
                              <span className="mt-1 block truncate opacity-75">
                                {task.project_name}
                              </span>
                            </button>
                          ))}

                          {dayTasks.length > 4 && (
                            <p className="text-center text-xs font-bold text-blue-700">
                              +{dayTasks.length - 4} مهام أخرى
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 flex flex-wrap gap-3 rounded-2xl bg-white p-5 text-sm shadow">
          <span className="font-bold">دليل الألوان:</span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
            لم تبدأ
          </span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
            قيد التنفيذ
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
            مكتملة
          </span>
          <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-700">
            متوقفة
          </span>
          <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
            متأخرة
          </span>
        </section>
      </div>

      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedTask(null)}
        >
          <article
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">
                  {selectedTask.project_name}
                </p>
                <h3 className="mt-1 text-2xl font-black">
                  {selectedTask.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded-lg bg-gray-100 px-3 py-2 font-bold hover:bg-gray-200"
              >
                إغلاق
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-sm font-bold ${statusClasses(
                  selectedTask
                )}`}
              >
                {isOverdue(selectedTask) ? "متأخرة" : selectedTask.status}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ${priorityClasses(
                  selectedTask.priority
                )}`}
              >
                {selectedTask.priority}
              </span>
            </div>

            {selectedTask.description && (
              <p className="mt-5 whitespace-pre-wrap leading-7 text-gray-700">
                {selectedTask.description}
              </p>
            )}

            <div className="mt-5 grid gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">العميل</p>
                <p className="mt-1 font-bold">{selectedTask.client_name}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">المسؤول</p>
                <p className="mt-1 font-bold">
                  {selectedTask.assigned_to || "غير معين"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">تاريخ الاستحقاق</p>
                <p className="mt-1 font-bold">
                  {selectedTask.due_date
                    ? formatFullDate(selectedTask.due_date)
                    : "غير محدد"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">نسبة الإنجاز</p>
                <p className="mt-1 font-bold text-blue-700">
                  {selectedTask.progress}%
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/admin/client/${selectedTask.client_id}/tasks`}
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
              >
                فتح مهام المشروع
              </Link>

              <Link
                href={`/admin/client/${selectedTask.client_id}`}
                className="rounded-xl border border-gray-300 px-5 py-3 font-bold hover:bg-gray-50"
              >
                فتح المشروع
              </Link>
            </div>
          </article>
        </div>
      )}
    </main>
  );
}