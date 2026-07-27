"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ClientRow = {
  id: number;
  name: string;
  project_name: string;
  progress: number | string | null;
  status: string | null;
};

type FinanceRow = {
  client_id: number;
  contract_amount: number | string | null;
  currency: string | null;
};

type PaymentRow = {
  client_id: number;
  amount: number | string | null;
  payment_date: string | null;
};

type TaskRow = {
  id: number;
  client_id: number;
  title: string;
  assigned_to: string | null;
  status: string | null;
  priority: string | null;
  progress: number | string | null;
  due_date: string | null;
  updated_at?: string | null;
};

type UpdateRow = {
  id: number;
  client_id: number;
  created_at: string;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number | string | null | undefined) {
  return Math.min(Math.max(toNumber(value), 0), 100);
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatMoney(value: number, currency: string) {
  const number = new Intl.NumberFormat("ar-IQ", {
    maximumFractionDigits: 0,
  }).format(value);

  if (currency === "USD") return `${number} $`;
  if (currency === "IQD") return `${number} د.ع`;
  return `${number} ${currency}`;
}

function statusColor(status: string) {
  if (status === "مكتمل" || status === "مكتملة") return "bg-emerald-500";
  if (status === "قيد التنفيذ") return "bg-blue-500";
  if (status === "متوقف" || status === "متوقفة") return "bg-red-500";
  if (status === "قيد المراجعة") return "bg-violet-500";
  return "bg-slate-400";
}

export default function ExecutiveDashboardPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [finances, setFinances] = useState<FinanceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setMessage("");

      const [clientsResult, financesResult, paymentsResult, tasksResult, updatesResult] =
        await Promise.all([
          supabase
            .from("clients")
            .select("id, name, project_name, progress, status")
            .order("id", { ascending: false }),
          supabase
            .from("project_finances")
            .select("client_id, contract_amount, currency"),
          supabase
            .from("project_payments")
            .select("client_id, amount, payment_date"),
          supabase
            .from("project_tasks")
            .select("id, client_id, title, assigned_to, status, priority, progress, due_date, updated_at"),
          supabase
            .from("project_updates")
            .select("id, client_id, created_at"),
        ]);

      const firstError =
        clientsResult.error ||
        financesResult.error ||
        paymentsResult.error ||
        tasksResult.error ||
        updatesResult.error;

      if (firstError) {
        console.error(firstError);
        setMessage(`تعذر تحميل لوحة الإدارة التنفيذية: ${firstError.message}`);
      }

      setClients((clientsResult.data as ClientRow[] | null) ?? []);
      setFinances((financesResult.data as FinanceRow[] | null) ?? []);
      setPayments((paymentsResult.data as PaymentRow[] | null) ?? []);
      setTasks((tasksResult.data as TaskRow[] | null) ?? []);
      setUpdates((updatesResult.data as UpdateRow[] | null) ?? []);
      setLoading(false);
    }

    void loadDashboard();
  }, []);

  const today = dateKey(new Date());

  const projectSummary = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((item) => item.status === "قيد التنفيذ").length;
    const completed = clients.filter(
      (item) => item.status === "مكتمل" || clamp(item.progress) >= 100
    ).length;
    const stopped = clients.filter(
      (item) => item.status === "متوقف" || item.status === "متوقفة"
    ).length;
    const averageProgress = total
      ? Math.round(
          clients.reduce((sum, item) => sum + clamp(item.progress), 0) / total
        )
      : 0;

    return { total, active, completed, stopped, averageProgress };
  }, [clients]);

  const taskSummary = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((item) => item.status === "مكتملة").length;
    const active = tasks.filter((item) => item.status === "قيد التنفيذ").length;
    const review = tasks.filter((item) => item.status === "قيد المراجعة").length;
    const overdue = tasks.filter(
      (item) =>
        Boolean(item.due_date) &&
        item.due_date! < today &&
        item.status !== "مكتملة"
    ).length;
    const critical = tasks.filter(
      (item) =>
        (item.priority === "عاجلة" || item.priority === "عالية") &&
        item.status !== "مكتملة"
    ).length;

    return { total, completed, active, review, overdue, critical };
  }, [tasks, today]);

  const financeSummary = useMemo(() => {
    const financeMap = new Map<number, FinanceRow>();
    finances.forEach((item) => financeMap.set(item.client_id, item));

    const paidMap = new Map<number, number>();
    payments.forEach((item) => {
      paidMap.set(
        item.client_id,
        (paidMap.get(item.client_id) || 0) + toNumber(item.amount)
      );
    });

    const totals = new Map<
      string,
      { contracts: number; paid: number; remaining: number }
    >();

    clients.forEach((client) => {
      const finance = financeMap.get(client.id);
      const currency = finance?.currency?.trim().toUpperCase() || "IQD";
      const contract = toNumber(finance?.contract_amount);
      const paid = paidMap.get(client.id) || 0;
      const current = totals.get(currency) || {
        contracts: 0,
        paid: 0,
        remaining: 0,
      };

      current.contracts += contract;
      current.paid += paid;
      current.remaining += Math.max(contract - paid, 0);
      totals.set(currency, current);
    });

    return [...totals.entries()].map(([currency, values]) => ({
      currency,
      ...values,
      collectionRate: values.contracts
        ? Math.min(Math.round((values.paid / values.contracts) * 100), 100)
        : 0,
    }));
  }, [clients, finances, payments]);

  const projectStatusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    clients.forEach((item) => {
      const status = item.status?.trim() || "غير محدد";
      counts.set(status, (counts.get(status) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [clients]);

  const taskStatusCounts = useMemo(() => {
    const order = ["لم تبدأ", "قيد التنفيذ", "قيد المراجعة", "مكتملة", "متوقفة"];
    const counts = new Map<string, number>();
    tasks.forEach((item) => {
      const status = item.status?.trim() || "لم تبدأ";
      counts.set(status, (counts.get(status) || 0) + 1);
    });
    return order
      .map((status) => [status, counts.get(status) || 0] as const)
      .filter(([, count]) => count > 0);
  }, [tasks]);

  const riskyProjects = useMemo(() => {
    const tasksByClient = new Map<number, TaskRow[]>();
    tasks.forEach((task) => {
      const list = tasksByClient.get(task.client_id) || [];
      list.push(task);
      tasksByClient.set(task.client_id, list);
    });

    return clients
      .map((client) => {
        const projectTasks = tasksByClient.get(client.id) || [];
        const overdue = projectTasks.filter(
          (task) =>
            Boolean(task.due_date) &&
            task.due_date! < today &&
            task.status !== "مكتملة"
        ).length;
        const critical = projectTasks.filter(
          (task) =>
            (task.priority === "عاجلة" || task.priority === "عالية") &&
            task.status !== "مكتملة"
        ).length;

        return {
          ...client,
          overdue,
          critical,
          score: overdue * 3 + critical * 2 + (clamp(client.progress) < 25 ? 1 : 0),
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [clients, tasks, today]);

  const employeePerformance = useMemo(() => {
    const map = new Map<
      string,
      { total: number; completed: number; progressTotal: number; overdue: number }
    >();

    tasks.forEach((task) => {
      const name = task.assigned_to?.trim();
      if (!name) return;

      const current = map.get(name) || {
        total: 0,
        completed: 0,
        progressTotal: 0,
        overdue: 0,
      };

      current.total += 1;
      current.progressTotal += clamp(task.progress);
      if (task.status === "مكتملة") current.completed += 1;
      if (task.due_date && task.due_date < today && task.status !== "مكتملة") {
        current.overdue += 1;
      }
      map.set(name, current);
    });

    return [...map.entries()]
      .map(([name, value]) => ({
        name,
        ...value,
        completionRate: value.total
          ? Math.round((value.completed / value.total) * 100)
          : 0,
        averageProgress: value.total
          ? Math.round(value.progressTotal / value.total)
          : 0,
      }))
      .sort(
        (a, b) =>
          b.completionRate - a.completionRate ||
          b.completed - a.completed ||
          a.overdue - b.overdue
      )
      .slice(0, 8);
  }, [tasks, today]);

  const monthlyUpdates = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (5 - index));
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        label: new Intl.DateTimeFormat("ar-IQ", { month: "short" }).format(date),
        count: 0,
      };
    });

    const map = new Map(months.map((month) => [month.key, month]));
    updates.forEach((update) => {
      const key = update.created_at?.slice(0, 7);
      const item = map.get(key);
      if (item) item.count += 1;
    });

    return months;
  }, [updates]);

  const maxMonthlyUpdates = Math.max(...monthlyUpdates.map((item) => item.count), 1);
  const maxProjectStatus = Math.max(...projectStatusCounts.map(([, count]) => count), 1);
  const maxTaskStatus = Math.max(...taskStatusCounts.map(([, count]) => count), 1);

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-slate-100 px-3 py-5 text-slate-900 sm:px-6 sm:py-8 print:bg-white print:p-0"
    >
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl bg-slate-950 p-5 text-white shadow-xl sm:p-7 print:bg-white print:p-0 print:text-black print:shadow-none">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-slate-300 print:text-slate-600">
                مؤشرات الأداء وصحة الأعمال
              </p>
              <h1 className="mt-1 text-3xl font-black sm:text-4xl">
                لوحة الإدارة التنفيذية
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base print:text-slate-600">
                ملخص لحظي للمشاريع، المهام، التحصيل المالي، المخاطر وأداء فريق العمل.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950 hover:bg-slate-100"
              >
                طباعة التقرير
              </button>
              <Link
                href="/admin/reports"
                className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-amber-400"
              >
                التقارير
              </Link>
              <Link
                href="/admin"
                className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-black text-white hover:bg-slate-900"
              >
                لوحة التحكم
              </Link>
            </div>
          </div>
        </header>

        {message && (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {message}
          </p>
        )}

        {loading ? (
          <div className="mt-6 rounded-3xl bg-white p-12 text-center font-bold text-slate-500 shadow">
            جاري تحميل مؤشرات الإدارة التنفيذية...
          </div>
        ) : (
          <>
            <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ["إجمالي المشاريع", projectSummary.total, "text-blue-700"],
                ["قيد التنفيذ", projectSummary.active, "text-emerald-700"],
                ["مكتملة", projectSummary.completed, "text-violet-700"],
                ["المهام المتأخرة", taskSummary.overdue, "text-red-700"],
                ["متوسط الإنجاز", `${projectSummary.averageProgress}%`, "text-amber-700"],
              ].map(([label, value, color]) => (
                <article key={String(label)} className="rounded-2xl bg-white p-4 shadow sm:p-5">
                  <p className="text-xs font-bold text-slate-500 sm:text-sm">{label}</p>
                  <p className={`mt-2 text-2xl font-black sm:text-3xl ${color}`}>{value}</p>
                </article>
              ))}
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-2">
              <article className="rounded-3xl bg-white p-5 shadow sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">الملخص المالي</h2>
                    <p className="mt-1 text-sm text-slate-500">القيمة التعاقدية والتحصيل والمتبقي حسب العملة.</p>
                  </div>
                </div>

                {financeSummary.length === 0 ? (
                  <p className="mt-5 rounded-2xl bg-slate-50 p-6 text-center text-slate-500">
                    لا توجد بيانات مالية.
                  </p>
                ) : (
                  <div className="mt-5 space-y-4">
                    {financeSummary.map((item) => (
                      <div key={item.currency} className="rounded-2xl border border-slate-200 p-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <p className="text-xs font-bold text-slate-500">قيمة العقود</p>
                            <p className="mt-1 font-black">{formatMoney(item.contracts, item.currency)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-500">المستلم</p>
                            <p className="mt-1 font-black text-emerald-700">{formatMoney(item.paid, item.currency)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-500">المتبقي</p>
                            <p className="mt-1 font-black text-red-700">{formatMoney(item.remaining, item.currency)}</p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="mb-2 flex justify-between text-xs font-bold">
                            <span>نسبة التحصيل</span>
                            <span>{item.collectionRate}%</span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${item.collectionRate}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="rounded-3xl bg-white p-5 shadow sm:p-6">
                <h2 className="text-xl font-black">حالة المهام</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {taskSummary.total} مهمة، منها {taskSummary.critical} مهمة عالية الخطورة.
                </p>

                <div className="mt-5 space-y-4">
                  {taskStatusCounts.length === 0 ? (
                    <p className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">
                      لا توجد مهام.
                    </p>
                  ) : (
                    taskStatusCounts.map(([status, count]) => (
                      <div key={status}>
                        <div className="mb-2 flex items-center justify-between text-sm font-bold">
                          <span>{status}</span>
                          <span>{count}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${statusColor(status)}`}
                            style={{ width: `${Math.max((count / maxTaskStatus) * 100, 5)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-2">
              <article className="rounded-3xl bg-white p-5 shadow sm:p-6">
                <h2 className="text-xl font-black">توزيع المشاريع</h2>
                <p className="mt-1 text-sm text-slate-500">عدد المشاريع حسب الحالة الحالية.</p>

                <div className="mt-5 space-y-4">
                  {projectStatusCounts.map(([status, count]) => (
                    <div key={status}>
                      <div className="mb-2 flex items-center justify-between text-sm font-bold">
                        <span>{status}</span>
                        <span>{count}</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${statusColor(status)}`}
                          style={{ width: `${Math.max((count / maxProjectStatus) * 100, 5)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-3xl bg-white p-5 shadow sm:p-6">
                <h2 className="text-xl font-black">نشاط التحديثات</h2>
                <p className="mt-1 text-sm text-slate-500">عدد تحديثات المشاريع خلال آخر 6 أشهر.</p>

                <div className="mt-8 flex h-56 items-end gap-3 border-b border-slate-200 pb-2">
                  {monthlyUpdates.map((item) => (
                    <div key={item.key} className="flex h-full flex-1 flex-col items-center justify-end">
                      <span className="mb-2 text-xs font-black text-slate-600">{item.count}</span>
                      <div
                        className="w-full max-w-12 rounded-t-xl bg-blue-600"
                        style={{
                          height: `${Math.max((item.count / maxMonthlyUpdates) * 100, item.count ? 8 : 2)}%`,
                        }}
                      />
                      <span className="mt-2 text-xs font-bold text-slate-500">{item.label}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-2">
              <article className="rounded-3xl bg-white p-5 shadow sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">المشاريع التي تحتاج تدخلاً</h2>
                    <p className="mt-1 text-sm text-slate-500">ترتيب حسب المهام المتأخرة والحرجة.</p>
                  </div>
                  <span className="rounded-full bg-red-50 px-3 py-2 text-sm font-black text-red-700">
                    {riskyProjects.length}
                  </span>
                </div>

                {riskyProjects.length === 0 ? (
                  <p className="mt-5 rounded-2xl bg-emerald-50 p-6 text-center font-bold text-emerald-700">
                    لا توجد مخاطر ظاهرة حاليًا.
                  </p>
                ) : (
                  <div className="mt-5 space-y-3">
                    {riskyProjects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/admin/client/${project.id}`}
                        className="block rounded-2xl border border-slate-200 p-4 hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black">{project.project_name}</p>
                            <p className="mt-1 text-sm text-slate-500">{project.name}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">
                            {clamp(project.progress)}%
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                          {project.overdue > 0 && (
                            <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
                              {project.overdue} متأخرة
                            </span>
                          )}
                          {project.critical > 0 && (
                            <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-700">
                              {project.critical} حرجة
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </article>

              <article className="rounded-3xl bg-white p-5 shadow sm:p-6">
                <h2 className="text-xl font-black">أداء فريق العمل</h2>
                <p className="mt-1 text-sm text-slate-500">ترتيب تقريبي اعتمادًا على المهام المسندة والمنجزة.</p>

                {employeePerformance.length === 0 ? (
                  <p className="mt-5 rounded-2xl bg-slate-50 p-6 text-center text-slate-500">
                    لا توجد مهام مسندة بأسماء موظفين.
                  </p>
                ) : (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[600px] text-right text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="px-3 py-3">الموظف</th>
                          <th className="px-3 py-3">المهام</th>
                          <th className="px-3 py-3">المنجزة</th>
                          <th className="px-3 py-3">نسبة الإكمال</th>
                          <th className="px-3 py-3">متأخرة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeePerformance.map((employee) => (
                          <tr key={employee.name} className="border-b border-slate-100">
                            <td className="px-3 py-4 font-black">{employee.name}</td>
                            <td className="px-3 py-4">{employee.total}</td>
                            <td className="px-3 py-4 text-emerald-700">{employee.completed}</td>
                            <td className="px-3 py-4 font-black">{employee.completionRate}%</td>
                            <td className="px-3 py-4 text-red-700">{employee.overdue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            </section>

            <footer className="mt-5 rounded-2xl bg-white p-4 text-center text-xs text-slate-500 shadow print:shadow-none">
              تم توليد المؤشرات من بيانات النظام الحالية بتاريخ{" "}
              {new Intl.DateTimeFormat("ar-IQ", {
                dateStyle: "full",
                timeStyle: "short",
              }).format(new Date())}
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
