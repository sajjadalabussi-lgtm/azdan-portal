"use client";

import Link from "next/link";
import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { canAccess } from "@/lib/admin-permissions";
import { useAdminRole } from "../../../role-provider";

type ClientRecord = {
  id: number;
  name: string;
  project_name: string;
};

type TaskStatus = "لم تبدأ" | "قيد التنفيذ" | "مكتملة" | "متوقفة";
type TaskPriority = "منخفضة" | "متوسطة" | "عالية" | "عاجلة";

type ProjectTask = {
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
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type TaskForm = {
  title: string;
  description: string;
  assigned_to: string;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  start_date: string;
  due_date: string;
};

const EMPTY_FORM: TaskForm = {
  title: "",
  description: "",
  assigned_to: "",
  priority: "متوسطة",
  status: "لم تبدأ",
  progress: 0,
  start_date: "",
  due_date: "",
};

function clampProgress(value: number) {
  return Math.min(Math.max(Number(value) || 0, 0), 100);
}

function isOverdue(task: ProjectTask) {
  if (!task.due_date || task.status === "مكتملة") return false;

  const dueDate = new Date(`${task.due_date}T23:59:59`);
  return dueDate.getTime() < Date.now();
}

function formatDate(value: string | null) {
  if (!value) return "غير محدد";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
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

export default function ProjectTasksPage() {
  const params = useParams<{ id: string }>();
  const clientId = Number(params.id);
  const { role } = useAdminRole();

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"الكل" | TaskStatus>("الكل");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  const canManageTasks = role ? canAccess(role, "manage_updates") : false;

  const loadData = useCallback(async () => {
    if (!Number.isFinite(clientId)) {
      setMessage("رقم المشروع غير صحيح.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const [clientResult, tasksResult] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, project_name")
        .eq("id", clientId)
        .single(),
      supabase
        .from("project_tasks")
        .select(
          "id, client_id, title, description, assigned_to, priority, status, progress, start_date, due_date, completed_at, created_at, updated_at"
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
    ]);

    if (clientResult.error) {
      console.error(clientResult.error);
      setMessage(`تعذر تحميل المشروع: ${clientResult.error.message}`);
      setLoading(false);
      return;
    }

    if (tasksResult.error) {
      console.error(tasksResult.error);
      setMessage(`تعذر تحميل المهام: ${tasksResult.error.message}`);
      setLoading(false);
      return;
    }

    setClient(clientResult.data as ClientRecord);
    setTasks((tasksResult.data as ProjectTask[] | null) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesStatus =
        statusFilter === "الكل" || task.status === statusFilter;

      const matchesSearch =
        !normalizedSearch ||
        [task.title, task.description, task.assigned_to, task.priority, task.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [tasks, statusFilter, searchTerm]);

  const statistics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.status === "مكتملة").length;
    const inProgress = tasks.filter(
      (task) => task.status === "قيد التنفيذ"
    ).length;
    const overdue = tasks.filter(isOverdue).length;
    const averageProgress =
      total === 0
        ? 0
        : Math.round(
            tasks.reduce(
              (sum, task) => sum + clampProgress(task.progress),
              0
            ) / total
          );

    return { total, completed, inProgress, overdue, averageProgress };
  }, [tasks]);

  function updateForm<Key extends keyof TaskForm>(
    key: Key,
    value: TaskForm[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingTaskId(null);
  }

  function startEditing(task: ProjectTask) {
    setEditingTaskId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? "",
      assigned_to: task.assigned_to ?? "",
      priority: task.priority,
      status: task.status,
      progress: clampProgress(task.progress),
      start_date: task.start_date ?? "",
      due_date: task.due_date ?? "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageTasks) {
      setMessage("لا تملك صلاحية إدارة المهام.");
      return;
    }

    if (!form.title.trim()) {
      setMessage("يرجى كتابة عنوان المهمة.");
      return;
    }

    setSaving(true);
    setMessage("");

    const normalizedProgress =
      form.status === "مكتملة" ? 100 : clampProgress(form.progress);

    const payload = {
      client_id: clientId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      assigned_to: form.assigned_to.trim() || null,
      priority: form.priority,
      status: form.status,
      progress: normalizedProgress,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
    };

    const result = editingTaskId
      ? await supabase
          .from("project_tasks")
          .update(payload)
          .eq("id", editingTaskId)
          .eq("client_id", clientId)
      : await supabase.from("project_tasks").insert(payload);

    if (result.error) {
      console.error(result.error);
      setMessage(`تعذر حفظ المهمة: ${result.error.message}`);
      setSaving(false);
      return;
    }

    resetForm();
    setMessage(editingTaskId ? "تم تحديث المهمة بنجاح." : "تمت إضافة المهمة.");
    await loadData();
    setSaving(false);
  }

  async function deleteTask(task: ProjectTask) {
    if (!canManageTasks) {
      setMessage("لا تملك صلاحية حذف المهام.");
      return;
    }

    const confirmed = window.confirm(
      `هل تريد حذف المهمة "${task.title}"؟`
    );

    if (!confirmed) return;

    const result = await supabase
      .from("project_tasks")
      .delete()
      .eq("id", task.id)
      .eq("client_id", clientId);

    if (result.error) {
      console.error(result.error);
      setMessage(`تعذر حذف المهمة: ${result.error.message}`);
      return;
    }

    if (editingTaskId === task.id) resetForm();

    setMessage("تم حذف المهمة.");
    await loadData();
  }

  async function changeTaskStatus(task: ProjectTask, status: TaskStatus) {
    if (!canManageTasks || task.status === status || updatingTaskId !== null) {
      return;
    }

    const previousTasks = tasks;
    const nextProgress = status === "مكتملة" ? 100 : task.progress;

    setUpdatingTaskId(task.id);
    setMessage("");

    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === task.id
          ? {
              ...currentTask,
              status,
              progress: nextProgress,
              completed_at:
                status === "مكتملة"
                  ? currentTask.completed_at ?? new Date().toISOString()
                  : null,
              updated_at: new Date().toISOString(),
            }
          : currentTask
      )
    );

    const result = await supabase
      .from("project_tasks")
      .update({
        status,
        progress: nextProgress,
      })
      .eq("id", task.id)
      .eq("client_id", clientId);

    if (result.error) {
      console.error(result.error);
      setTasks(previousTasks);
      setMessage(`تعذر تحديث الحالة: ${result.error.message}`);
      setUpdatingTaskId(null);
      return;
    }

    setMessage(`تم نقل المهمة إلى "${status}".`);
    setUpdatingTaskId(null);
  }

  function handleDragStart(taskId: number) {
    if (!canManageTasks || updatingTaskId !== null) return;
    setDraggedTaskId(taskId);
  }

  function handleDragEnd() {
    setDraggedTaskId(null);
    setDragOverStatus(null);
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>,
    status: TaskStatus
  ) {
    if (!canManageTasks) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  }

  async function handleDrop(
    event: DragEvent<HTMLDivElement>,
    status: TaskStatus
  ) {
    event.preventDefault();

    const taskIdFromTransfer = Number(
      event.dataTransfer.getData("text/project-task-id")
    );

    const taskId =
      Number.isFinite(taskIdFromTransfer) && taskIdFromTransfer > 0
        ? taskIdFromTransfer
        : draggedTaskId;

    setDraggedTaskId(null);
    setDragOverStatus(null);

    if (!taskId) return;

    const task = tasks.find((currentTask) => currentTask.id === taskId);
    if (!task) return;

    await changeTaskStatus(task, status);
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 sm:px-6"
    >
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-gray-500">إدارة تنفيذ المشروع</p>
              <h1 className="mt-1 text-3xl font-black text-blue-700">
                مهام المشروع
              </h1>
              <p className="mt-2 text-gray-500">
                {client
                  ? `${client.project_name} — العميل: ${client.name}`
                  : "جاري تحميل بيانات المشروع..."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/admin/client/${clientId}`}
                className="rounded-xl border border-gray-300 bg-white px-5 py-3 font-bold hover:bg-gray-50"
              >
                العودة إلى المشروع
              </Link>
              <Link
                href="/admin/tasks/calendar"
                className="rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700"
              >
                تقويم المهام
              </Link>

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
          <p className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-center font-bold text-blue-700">
            {message}
          </p>
        )}

        {loading ? (
          <p className="mt-6 rounded-2xl bg-white p-10 text-center text-gray-500 shadow">
            جاري تحميل المهام...
          </p>
        ) : (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["إجمالي المهام", statistics.total, "text-blue-700"],
                ["قيد التنفيذ", statistics.inProgress, "text-cyan-700"],
                ["المكتملة", statistics.completed, "text-emerald-700"],
                ["المتأخرة", statistics.overdue, "text-red-700"],
                [
                  "متوسط الإنجاز",
                  `${statistics.averageProgress}%`,
                  "text-amber-700",
                ],
              ].map(([label, value, color]) => (
                <div key={String(label)} className="rounded-2xl bg-white p-5 shadow">
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className={`mt-2 text-3xl font-black ${color}`}>
                    {value}
                  </p>
                </div>
              ))}
            </section>

            {canManageTasks && (
              <section className="mt-6 rounded-2xl bg-white p-5 shadow sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {editingTaskId ? "تعديل المهمة" : "إضافة مهمة جديدة"}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      أدخل تفاصيل المهمة والمسؤول والموعد ونسبة الإنجاز.
                    </p>
                  </div>

                  {editingTaskId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-xl border border-gray-300 px-4 py-2 font-bold hover:bg-gray-50"
                    >
                      إلغاء التعديل
                    </button>
                  )}
                </div>

                <form
                  onSubmit={saveTask}
                  className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
                >
                  <label className="xl:col-span-2">
                    <span className="mb-2 block text-sm font-bold">
                      عنوان المهمة *
                    </span>
                    <input
                      value={form.title}
                      onChange={(event) =>
                        updateForm("title", event.target.value)
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      placeholder="مثال: إكمال صب السقف"
                      required
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-sm font-bold">
                      الموظف المسؤول
                    </span>
                    <input
                      value={form.assigned_to}
                      onChange={(event) =>
                        updateForm("assigned_to", event.target.value)
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      placeholder="اسم الموظف"
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-sm font-bold">
                      الأولوية
                    </span>
                    <select
                      value={form.priority}
                      onChange={(event) =>
                        updateForm(
                          "priority",
                          event.target.value as TaskPriority
                        )
                      }
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      <option>منخفضة</option>
                      <option>متوسطة</option>
                      <option>عالية</option>
                      <option>عاجلة</option>
                    </select>
                  </label>

                  <label>
                    <span className="mb-2 block text-sm font-bold">
                      الحالة
                    </span>
                    <select
                      value={form.status}
                      onChange={(event) => {
                        const status = event.target.value as TaskStatus;
                        updateForm("status", status);
                        if (status === "مكتملة") {
                          updateForm("progress", 100);
                        }
                      }}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      <option>لم تبدأ</option>
                      <option>قيد التنفيذ</option>
                      <option>مكتملة</option>
                      <option>متوقفة</option>
                    </select>
                  </label>

                  <label>
                    <span className="mb-2 block text-sm font-bold">
                      نسبة الإنجاز
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.progress}
                      onChange={(event) =>
                        updateForm(
                          "progress",
                          clampProgress(Number(event.target.value))
                        )
                      }
                      disabled={form.status === "مكتملة"}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none disabled:bg-gray-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-sm font-bold">
                      تاريخ البداية
                    </span>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(event) =>
                        updateForm("start_date", event.target.value)
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-sm font-bold">
                      تاريخ الاستحقاق
                    </span>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(event) =>
                        updateForm("due_date", event.target.value)
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>

                  <label className="md:col-span-2 xl:col-span-4">
                    <span className="mb-2 block text-sm font-bold">
                      وصف المهمة
                    </span>
                    <textarea
                      value={form.description}
                      onChange={(event) =>
                        updateForm("description", event.target.value)
                      }
                      rows={3}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      placeholder="تفاصيل التنفيذ أو الملاحظات..."
                    />
                  </label>

                  <div className="md:col-span-2 xl:col-span-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? "جاري الحفظ..."
                        : editingTaskId
                          ? "حفظ التعديلات"
                          : "إضافة المهمة"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            <section className="mt-6 rounded-2xl bg-white p-5 shadow sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">لوحة تنفيذ المهام</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    اسحب المهمة بين الأعمدة لتغيير حالتها مباشرة.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="ابحث في المهام..."
                    className="rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />

                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as "الكل" | TaskStatus
                      )
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

              {!canManageTasks && (
                <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
                  يمكنك مشاهدة اللوحة، لكن السحب والتعديل يحتاجان إلى صلاحية إدارة التحديثات.
                </p>
              )}

              <div className="mt-6 overflow-x-auto pb-3">
                <div className="grid min-w-[1180px] grid-cols-4 gap-4">
                  {(
                    [
                      {
                        status: "لم تبدأ" as TaskStatus,
                        title: "لم تبدأ",
                        description: "مهام بانتظار البدء",
                        headerClass: "border-gray-300 bg-gray-100 text-gray-800",
                        dotClass: "bg-gray-500",
                      },
                      {
                        status: "قيد التنفيذ" as TaskStatus,
                        title: "قيد التنفيذ",
                        description: "مهام يجري العمل عليها",
                        headerClass: "border-blue-300 bg-blue-50 text-blue-800",
                        dotClass: "bg-blue-600",
                      },
                      {
                        status: "مكتملة" as TaskStatus,
                        title: "مكتملة",
                        description: "مهام تم إنجازها",
                        headerClass:
                          "border-emerald-300 bg-emerald-50 text-emerald-800",
                        dotClass: "bg-emerald-600",
                      },
                      {
                        status: "متوقفة" as TaskStatus,
                        title: "متوقفة",
                        description: "مهام متوقفة مؤقتًا",
                        headerClass: "border-red-300 bg-red-50 text-red-800",
                        dotClass: "bg-red-600",
                      },
                    ] as const
                  ).map((column) => {
                    const columnTasks = filteredTasks.filter(
                      (task) => task.status === column.status
                    );

                    const isActiveDropZone =
                      dragOverStatus === column.status &&
                      draggedTaskId !== null;

                    return (
                      <div
                        key={column.status}
                        onDragOver={(event) =>
                          handleDragOver(event, column.status)
                        }
                        onDragLeave={(event) => {
                          if (
                            !event.currentTarget.contains(
                              event.relatedTarget as Node | null
                            )
                          ) {
                            setDragOverStatus(null);
                          }
                        }}
                        onDrop={(event) => handleDrop(event, column.status)}
                        className={`flex min-h-[520px] flex-col rounded-2xl border-2 p-3 transition ${
                          isActiveDropZone
                            ? "scale-[1.01] border-blue-500 bg-blue-50 shadow-lg"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div
                          className={`rounded-xl border p-4 ${column.headerClass}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-3 w-3 rounded-full ${column.dotClass}`}
                              />
                              <h3 className="text-lg font-black">
                                {column.title}
                              </h3>
                            </div>

                            <span className="rounded-full bg-white px-3 py-1 text-sm font-black shadow-sm">
                              {columnTasks.length}
                            </span>
                          </div>

                          <p className="mt-1 text-xs opacity-75">
                            {column.description}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-1 flex-col gap-3">
                          {columnTasks.length === 0 ? (
                            <div
                              className={`flex min-h-36 flex-1 items-center justify-center rounded-xl border-2 border-dashed p-5 text-center text-sm ${
                                isActiveDropZone
                                  ? "border-blue-400 bg-blue-100 text-blue-700"
                                  : "border-gray-300 bg-white text-gray-400"
                              }`}
                            >
                              {draggedTaskId
                                ? `أفلت المهمة هنا لنقلها إلى "${column.title}"`
                                : "لا توجد مهام في هذا العمود"}
                            </div>
                          ) : (
                            columnTasks.map((task) => {
                              const progress = clampProgress(task.progress);
                              const overdue = isOverdue(task);
                              const isDragging = draggedTaskId === task.id;
                              const isUpdating = updatingTaskId === task.id;

                              return (
                                <article
                                  key={task.id}
                                  draggable={canManageTasks && !isUpdating}
                                  onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData(
                                      "text/project-task-id",
                                      String(task.id)
                                    );
                                    handleDragStart(task.id);
                                  }}
                                  onDragEnd={handleDragEnd}
                                  className={`rounded-xl border bg-white p-4 shadow-sm transition ${
                                    canManageTasks
                                      ? "cursor-grab active:cursor-grabbing"
                                      : ""
                                  } ${
                                    overdue
                                      ? "border-red-300"
                                      : "border-gray-200"
                                  } ${
                                    isDragging
                                      ? "scale-95 opacity-40"
                                      : "hover:-translate-y-0.5 hover:shadow-md"
                                  } ${
                                    isUpdating
                                      ? "pointer-events-none opacity-60"
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <h4 className="break-words font-black text-gray-900">
                                        {task.title}
                                      </h4>

                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <span
                                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${priorityClasses(
                                            task.priority
                                          )}`}
                                        >
                                          {task.priority}
                                        </span>

                                        {overdue && (
                                          <span className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white">
                                            متأخرة
                                          </span>
                                        )}

                                        {isUpdating && (
                                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                                            جاري الحفظ...
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <span className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1.5 text-sm font-black text-blue-700">
                                      {progress}%
                                    </span>
                                  </div>

                                  {task.description && (
                                    <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                                      {task.description}
                                    </p>
                                  )}

                                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        overdue ? "bg-red-600" : "bg-blue-600"
                                      }`}
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>

                                  <div className="mt-4 space-y-2 rounded-lg bg-gray-50 p-3 text-xs">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-gray-500">
                                        المسؤول
                                      </span>
                                      <span className="truncate font-bold">
                                        {task.assigned_to || "غير معين"}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-gray-500">
                                        الاستحقاق
                                      </span>
                                      <span
                                        className={`font-bold ${
                                          overdue ? "text-red-700" : ""
                                        }`}
                                      >
                                        {formatDate(task.due_date)}
                                      </span>
                                    </div>
                                  </div>

                                  {canManageTasks && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => startEditing(task)}
                                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                                      >
                                        تعديل
                                      </button>

                                      {task.status !== "قيد التنفيذ" && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            changeTaskStatus(
                                              task,
                                              "قيد التنفيذ"
                                            )
                                          }
                                          disabled={updatingTaskId !== null}
                                          className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-700 disabled:opacity-50"
                                        >
                                          تشغيل
                                        </button>
                                      )}

                                      {task.status !== "مكتملة" && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            changeTaskStatus(task, "مكتملة")
                                          }
                                          disabled={updatingTaskId !== null}
                                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                          إكمال
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => deleteTask(task)}
                                        disabled={updatingTaskId !== null}
                                        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                                      >
                                        حذف
                                      </button>
                                    </div>
                                  )}
                                </article>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {filteredTasks.length === 0 && tasks.length > 0 && (
                <p className="mt-4 rounded-xl bg-amber-50 p-4 text-center font-bold text-amber-700">
                  لا توجد مهام مطابقة للبحث أو الفلتر الحالي.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}