"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  canAccess,
  roleLabels,
} from "@/lib/admin-permissions";
import { useAdminRole } from "./role-provider";

type Client = {
  id: number;
  name: string;
  project_name: string;
  progress: number;
  status: string;
};

type FinanceRecord = {
  client_id: number;
  contract_amount: number | string;
  currency: string;
};

type PaymentRecord = {
  id: number;
  client_id: number;
  amount: number | string;
  payment_date: string;
  note: string | null;
  created_at: string;
};

type UpdateRecord = {
  id: number;
  client_id: number;
  title: string;
  progress: number;
  created_at: string;
};

type ProjectFileRecord = {
  id: number;
  client_id: number;
};

type RecentPayment = PaymentRecord & {
  clientName: string;
  projectName: string;
  currency: string;
};

type RecentUpdate = UpdateRecord & {
  clientName: string;
  projectName: string;
};

type DashboardAlert = {
  type: "red" | "yellow" | "green" | "blue";
  title: string;
  client: Client;
};

function toNumber(value: number | string | null | undefined) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function clampProgress(value: number) {
  return Math.min(Math.max(Number(value) || 0, 0), 100);
}

export default function AdminPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [finances, setFinances] = useState<FinanceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [updates, setUpdates] = useState<UpdateRecord[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFileRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [analyticsPeriod, setAnalyticsPeriod] = useState<
    "all" | "30" | "90" | "365"
  >("365");
  const { role } = useAdminRole();

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setMessage("");

      const canViewFinance = canAccess(role, "manage_finance");
      const canViewUpdates = canAccess(role, "manage_updates");
      const canViewFiles = canAccess(role, "manage_files");

      const [
        clientsResult,
        financesResult,
        paymentsResult,
        updatesResult,
        filesResult,
      ] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, project_name, progress, status")
          .order("id", { ascending: false }),

        canViewFinance
          ? supabase
              .from("project_finances")
              .select("client_id, contract_amount, currency")
          : Promise.resolve({ data: [], error: null }),

        canViewFinance
          ? supabase
              .from("project_payments")
              .select(
                "id, client_id, amount, payment_date, note, created_at"
              )
              .order("payment_date", { ascending: false })
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),

        canViewUpdates
          ? supabase
              .from("project_updates")
              .select("id, client_id, title, progress, created_at")
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),

        canViewFiles
          ? supabase.from("project_files").select("id, client_id")
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (clientsResult.error) {
        console.error(clientsResult.error);
        setMessage(
          `تعذر تحميل بيانات العملاء: ${clientsResult.error.message}`
        );
        setLoading(false);
        return;
      }

      if (financesResult.error) {
        console.error(financesResult.error);
        setMessage(
          `تعذر تحميل البيانات المالية: ${financesResult.error.message}`
        );
        setLoading(false);
        return;
      }

      if (paymentsResult.error) {
        console.error(paymentsResult.error);
        setMessage(`تعذر تحميل الدفعات: ${paymentsResult.error.message}`);
        setLoading(false);
        return;
      }

      if (updatesResult.error) {
        console.error(updatesResult.error);
        setMessage(
          `تعذر تحميل تحديثات المشاريع: ${updatesResult.error.message}`
        );
        setLoading(false);
        return;
      }

      if (filesResult.error) {
        console.error(filesResult.error);
        setMessage(
          `تعذر تحميل ملفات المشاريع: ${filesResult.error.message}`
        );
        setLoading(false);
        return;
      }

      setClients((clientsResult.data as Client[] | null) ?? []);
      setFinances((financesResult.data as FinanceRecord[] | null) ?? []);
      setPayments((paymentsResult.data as PaymentRecord[] | null) ?? []);
      setUpdates((updatesResult.data as UpdateRecord[] | null) ?? []);
      setProjectFiles(
        (filesResult.data as ProjectFileRecord[] | null) ?? []
      );

      setLoading(false);
    }

    void loadDashboard();
  }, [role]);

  const canManageClients = role ? canAccess(role, "manage_clients") : false;
  const canManageUpdates = role ? canAccess(role, "manage_updates") : false;
  const canManageFiles = role ? canAccess(role, "manage_files") : false;
  const canManageFinance = role ? canAccess(role, "manage_finance") : false;
  const canManageUsers = role ? canAccess(role, "manage_users") : false;
  const canViewActivity = role ? canAccess(role, "view_activity") : false;
  const canViewReports = role ? canAccess(role, "view_reports") : false;

  const clientMap = useMemo(() => {
    return new Map(
      clients.map((client) => [client.id, client])
    );
  }, [clients]);

  const financeMap = useMemo(() => {
    return new Map(
      finances.map((finance) => [finance.client_id, finance])
    );
  }, [finances]);

  const statistics = useMemo(() => {
    const totalClients = clients.length;

    const completedProjects = clients.filter(
      (client) => client.status.trim() === "مكتمل"
    ).length;

    const activeProjects = clients.filter(
      (client) => client.status.trim() === "قيد التنفيذ"
    ).length;

    const otherProjects =
      totalClients - completedProjects - activeProjects;

    const averageProgress =
      totalClients === 0
        ? 0
        : Math.round(
            clients.reduce(
              (total, client) =>
                total + clampProgress(client.progress),
              0
            ) / totalClients
          );

    const totalUpdates = updates.length;
    const totalFiles = projectFiles.length;
    const totalPaymentsCount = payments.length;

    return {
      totalClients,
      completedProjects,
      activeProjects,
      otherProjects,
      averageProgress,
      totalUpdates,
      totalFiles,
      totalPaymentsCount,
    };
  }, [clients, updates, projectFiles, payments]);

  const financialStatistics = useMemo(() => {
    const currencyTotals: Record<
      string,
      {
        contracts: number;
        paid: number;
        remaining: number;
      }
    > = {};

    finances.forEach((finance) => {
      const currency = finance.currency?.trim().toUpperCase() || "IQD";

      if (!currencyTotals[currency]) {
        currencyTotals[currency] = {
          contracts: 0,
          paid: 0,
          remaining: 0,
        };
      }

      currencyTotals[currency].contracts += toNumber(
        finance.contract_amount
      );
    });

    payments.forEach((payment) => {
      const finance = financeMap.get(payment.client_id);
      const currency =
        finance?.currency?.trim().toUpperCase() || "IQD";

      if (!currencyTotals[currency]) {
        currencyTotals[currency] = {
          contracts: 0,
          paid: 0,
          remaining: 0,
        };
      }

      currencyTotals[currency].paid += toNumber(payment.amount);
    });

    Object.keys(currencyTotals).forEach((currency) => {
      currencyTotals[currency].remaining = Math.max(
        currencyTotals[currency].contracts -
          currencyTotals[currency].paid,
        0
      );
    });

    return currencyTotals;
  }, [finances, payments, financeMap]);

  const recentPayments = useMemo<RecentPayment[]>(() => {
    return payments.slice(0, 5).map((payment) => {
      const client = clientMap.get(payment.client_id);
      const finance = financeMap.get(payment.client_id);

      return {
        ...payment,
        clientName: client?.name || "عميل غير معروف",
        projectName:
          client?.project_name || "مشروع غير معروف",
        currency:
          finance?.currency?.trim().toUpperCase() || "IQD",
      };
    });
  }, [payments, clientMap, financeMap]);

  const recentUpdates = useMemo<RecentUpdate[]>(() => {
    return updates.slice(0, 5).map((update) => {
      const client = clientMap.get(update.client_id);

      return {
        ...update,
        clientName: client?.name || "عميل غير معروف",
        projectName:
          client?.project_name || "مشروع غير معروف",
      };
    });
  }, [updates, clientMap]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredClients = useMemo(() => {
    if (!normalizedSearch) return clients.slice(0, 8);

    return clients
      .filter((client) => {
        const searchableText = [
          client.name,
          client.project_name,
          client.status,
          String(client.progress),
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedSearch);
      })
      .slice(0, 8);
  }, [clients, normalizedSearch]);

  const attentionProjects = useMemo(() => {
    return clients
      .filter((client) => {
        const status = client.status.trim();
        const progress = clampProgress(client.progress);

        return status !== "مكتمل" && progress < 40;
      })
      .sort(
        (firstClient, secondClient) =>
          clampProgress(firstClient.progress) -
          clampProgress(secondClient.progress)
      )
      .slice(0, 6);
  }, [clients]);

  const statusDistribution = useMemo(() => {
    const total = Math.max(statistics.totalClients, 1);

    return [
      {
        label: "قيد التنفيذ",
        value: statistics.activeProjects,
        percentage: Math.round(
          (statistics.activeProjects / total) * 100
        ),
        barClass: "bg-green-600",
      },
      {
        label: "مكتمل",
        value: statistics.completedProjects,
        percentage: Math.round(
          (statistics.completedProjects / total) * 100
        ),
        barClass: "bg-purple-600",
      },
      {
        label: "حالات أخرى",
        value: statistics.otherProjects,
        percentage: Math.round(
          (statistics.otherProjects / total) * 100
        ),
        barClass: "bg-slate-500",
      },
    ];
  }, [statistics]);

  const nearCompletionProjects = useMemo(() => {
    return clients
      .filter((client) => {
        const progress = clampProgress(client.progress);
        return client.status.trim() !== "مكتمل" && progress >= 90;
      })
      .sort(
        (firstClient, secondClient) =>
          clampProgress(secondClient.progress) -
          clampProgress(firstClient.progress)
      )
      .slice(0, 6);
  }, [clients]);

  const projectProgressChart = useMemo(() => {
    return [...clients]
      .sort(
        (firstClient, secondClient) =>
          clampProgress(secondClient.progress) -
          clampProgress(firstClient.progress)
      )
      .slice(0, 10);
  }, [clients]);

  const monthlyPayments = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("ar-IQ", {
      month: "short",
      year: "2-digit",
    });
    const months: Array<{
      key: string;
      label: string;
      total: number;
    }> = [];
    const now = new Date();

    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      months.push({
        key,
        label: formatter.format(date),
        total: 0,
      });
    }

    payments.forEach((payment) => {
      const date = new Date(payment.payment_date || payment.created_at);
      if (Number.isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      const month = months.find((item) => item.key === key);

      if (month) month.total += toNumber(payment.amount);
    });

    const maximum = Math.max(...months.map((month) => month.total), 1);

    return months.map((month) => ({
      ...month,
      percentage: Math.round((month.total / maximum) * 100),
    }));
  }, [payments]);

  const dashboardAlerts = useMemo<DashboardAlert[]>(() => {
    const now = new Date();

    return clients.flatMap((client) => {
      const alerts: DashboardAlert[] = [];
      const progress = clampProgress(client.progress);
      const clientUpdates = updates
        .filter((update) => update.client_id === client.id)
        .sort(
          (firstUpdate, secondUpdate) =>
            new Date(secondUpdate.created_at).getTime() -
            new Date(firstUpdate.created_at).getTime()
        );
      const latestUpdate = clientUpdates[0];
      const daysSinceLatestUpdate = latestUpdate
        ? (now.getTime() - new Date(latestUpdate.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
        : Number.POSITIVE_INFINITY;

      if (daysSinceLatestUpdate > 14) {
        alerts.push({
          type: "red",
          title: "لم يتم تحديث المشروع منذ أكثر من 14 يومًا",
          client,
        });
      }

      if (!payments.some((payment) => payment.client_id === client.id)) {
        alerts.push({
          type: "yellow",
          title: "لا توجد دفعات مسجلة",
          client,
        });
      }

      if (progress >= 100 && client.status.trim() !== "مكتمل") {
        alerts.push({
          type: "green",
          title: "بلغ 100% لكن حالته ليست مكتمل",
          client,
        });
      }

      if (!projectFiles.some((file) => file.client_id === client.id)) {
        alerts.push({
          type: "blue",
          title: "لا توجد ملفات مرفقة",
          client,
        });
      }

      return alerts;
    });
  }, [clients, updates, payments, projectFiles]);


  const filteredAnalyticsPayments = useMemo(() => {
    if (analyticsPeriod === "all") return payments;

    const days = Number(analyticsPeriod);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);

    return payments.filter((payment) => {
      const paymentDate = new Date(
        payment.payment_date || payment.created_at
      );

      return (
        !Number.isNaN(paymentDate.getTime()) &&
        paymentDate >= threshold
      );
    });
  }, [payments, analyticsPeriod]);

  const topClientsByContracts = useMemo(() => {
    return clients
      .map((client) => {
        const finance = financeMap.get(client.id);

        return {
          ...client,
          contractAmount: toNumber(finance?.contract_amount),
          currency:
            finance?.currency?.trim().toUpperCase() || "IQD",
        };
      })
      .filter((client) => client.contractAmount > 0)
      .sort(
        (firstClient, secondClient) =>
          secondClient.contractAmount - firstClient.contractAmount
      )
      .slice(0, 5);
  }, [clients, financeMap]);

  const analyticsCurrencyTotals = useMemo(() => {
    const totals: Record<
      string,
      {
        contracts: number;
        paid: number;
        remaining: number;
      }
    > = {};

    finances.forEach((finance) => {
      const currency =
        finance.currency?.trim().toUpperCase() || "IQD";

      if (!totals[currency]) {
        totals[currency] = {
          contracts: 0,
          paid: 0,
          remaining: 0,
        };
      }

      totals[currency].contracts += toNumber(
        finance.contract_amount
      );
    });

    filteredAnalyticsPayments.forEach((payment) => {
      const finance = financeMap.get(payment.client_id);
      const currency =
        finance?.currency?.trim().toUpperCase() || "IQD";

      if (!totals[currency]) {
        totals[currency] = {
          contracts: 0,
          paid: 0,
          remaining: 0,
        };
      }

      totals[currency].paid += toNumber(payment.amount);
    });

    Object.values(totals).forEach((total) => {
      total.remaining = Math.max(
        total.contracts - total.paid,
        0
      );
    });

    return totals;
  }, [
    finances,
    filteredAnalyticsPayments,
    financeMap,
  ]);

  function escapeCsv(value: string | number) {
    const normalizedValue = String(value ?? "");
    return `"${normalizedValue.replaceAll('"', '""')}"`;
  }

  function exportAnalyticsCsv() {
    const rows = [
      [
        "العميل",
        "المشروع",
        "الحالة",
        "نسبة الإنجاز",
        "قيمة العقد",
        "العملة",
        "إجمالي الدفعات ضمن الفترة",
      ],
      ...clients.map((client) => {
        const finance = financeMap.get(client.id);
        const clientPayments = filteredAnalyticsPayments
          .filter(
            (payment) => payment.client_id === client.id
          )
          .reduce(
            (total, payment) =>
              total + toNumber(payment.amount),
            0
          );

        return [
          client.name,
          client.project_name,
          client.status,
          `${clampProgress(client.progress)}%`,
          toNumber(finance?.contract_amount),
          finance?.currency?.trim().toUpperCase() || "IQD",
          clientPayments,
        ];
      }),
    ];

    const csvContent = rows
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
    const blob = new Blob(
      ["\uFEFF", csvContent],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `azdan-analytics-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function printAnalytics() {
    window.print();
  }

  function formatMoney(value: number, currency: string) {
    const formatted = new Intl.NumberFormat("ar-IQ", {
      maximumFractionDigits: 2,
    }).format(value);

    if (currency === "IQD") {
      return `${formatted} د.ع`;
    }

    if (currency === "USD") {
      return `${formatted} $`;
    }

    return `${formatted} ${currency}`;
  }

  function formatDate(date: string, includeTime = false) {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "التاريخ غير متوفر";
    }

    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
      ...(includeTime
        ? {
            hour: "numeric",
            minute: "2-digit",
          }
        : {}),
    }).format(parsedDate);
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-gray-100 px-3 pb-32 pt-4 text-gray-900 sm:px-6 sm:pb-28 sm:pt-8 lg:py-10"
    >
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-2xl bg-white p-4 shadow sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-white p-1 shadow-sm sm:h-20 sm:w-20">
              <Image
                src="/logo.png"
                alt="شعار شركة أزدان للمقاولات العامة"
                width={80}
                height={80}
                priority
                className="h-full w-full object-contain"
              />
            </div>

            <div className="min-w-0">
              <p className="text-xs text-gray-500 sm:text-sm">
                الإدارة العامة
              </p>

              <h1 className="mt-1 break-words text-2xl font-bold leading-tight text-blue-700 sm:text-4xl">
                لوحة تحكم أزدان
              </h1>

              <p className="mt-2 text-sm text-gray-500 sm:text-base">
                متابعة المشاريع حسب صلاحيات الحساب
              </p>

              {role && (
                <p className="mt-3 inline-flex max-w-full rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 sm:px-4 sm:text-sm">
                  الدور الحالي: {roleLabels[role]}
                </p>
              )}
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-3">
            <Link
              href="/admin/overview"
              className="flex min-h-12 items-center justify-center rounded-xl bg-cyan-600 px-3 py-3 text-center text-sm font-bold text-white hover:bg-cyan-700 sm:px-5 sm:text-base"
            >
              مركز الإدارة
            </Link>

            <Link
              href="/admin/clients"
              className="flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-3 py-3 text-center text-sm font-bold text-white hover:bg-blue-700 sm:px-5 sm:text-base"
            >
              عرض العملاء
            </Link>

            {canManageClients && (
              <Link
                href="/admin/new-client"
                className="flex min-h-12 items-center justify-center rounded-xl bg-green-600 px-3 py-3 text-center text-sm font-bold text-white hover:bg-green-700 sm:px-5 sm:text-base"
              >
                إضافة عميل جديد
              </Link>
            )}

            {canManageUsers && (
              <Link
                href="/admin/users"
                className="flex min-h-12 items-center justify-center rounded-xl bg-slate-900 px-3 py-3 text-center text-sm font-bold text-white hover:bg-slate-800 sm:px-5 sm:text-base"
              >
                إدارة المستخدمين
              </Link>
            )}

            {canManageUsers && (
              <Link
                href="/admin/backup"
                className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 px-3 py-3 text-center text-sm font-bold text-white hover:bg-emerald-800 sm:px-5 sm:text-base"
              >
                النسخ الاحتياطي
              </Link>
            )}

            {canManageUsers && (
              <Link
                href="/admin/settings"
                className="flex min-h-12 items-center justify-center rounded-xl bg-violet-700 px-3 py-3 text-center text-sm font-bold text-white hover:bg-violet-800 sm:px-5 sm:text-base"
              >
                إعدادات النظام
              </Link>
            )}

            {canViewActivity && (
              <Link
                href="/admin/activity"
                className="flex min-h-12 items-center justify-center rounded-xl bg-indigo-600 px-3 py-3 text-center text-sm font-bold text-white hover:bg-indigo-700 sm:px-5 sm:text-base"
              >
                سجل النشاطات
              </Link>
            )}

            {canViewReports && (
              <Link
                href="/admin/reports"
                className="flex min-h-12 items-center justify-center rounded-xl bg-amber-600 px-3 py-3 text-center text-sm font-bold text-white hover:bg-amber-700 sm:px-5 sm:text-base"
              >
                التقارير والإحصائيات
              </Link>
            )}
          </div>
        </header>

        {message && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-center text-red-700">
            {message}
          </p>
        )}

        {!loading && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  البحث السريع
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  ابحث باسم العميل أو المشروع أو الحالة أو نسبة الإنجاز
                </p>
              </div>

              <div className="w-full lg:max-w-xl">
                <label
                  htmlFor="dashboard-search"
                  className="sr-only"
                >
                  البحث في العملاء والمشاريع
                </label>
                <input
                  id="dashboard-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(event.target.value)
                  }
                  placeholder="مثال: علي، إنشاء منزل، قيد التنفيذ..."
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            {searchTerm.trim() && (
              <div className="mt-5">
                {filteredClients.length === 0 ? (
                  <p className="rounded-xl bg-gray-50 p-6 text-center text-gray-500">
                    لا توجد نتائج مطابقة
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {filteredClients.map((client) => {
                      const progress = clampProgress(client.progress);

                      return (
                        <Link
                          key={client.id}
                          href={`/admin/client/${client.id}`}
                          className="rounded-xl border border-gray-200 p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                        >
                          <p className="font-bold text-gray-900">
                            {client.project_name}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            العميل: {client.name}
                          </p>
                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="text-gray-500">
                              {client.status}
                            </span>
                            <span className="font-bold text-blue-700">
                              {progress}%
                            </span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {loading ? (
          <p className="mt-6 rounded-2xl bg-white p-10 text-center text-gray-500 shadow">
            جاري تحميل لوحة الإحصائيات...
          </p>
        ) : (
          <>
            
            <section className="mt-6 rounded-2xl bg-white p-5 shadow sm:p-6 print:shadow-none">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">
                    التحليلات الاحترافية
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    تحليل العقود والتحصيل وأعلى العملاء حسب الفترة المحددة
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 print:hidden">
                  <select
                    value={analyticsPeriod}
                    onChange={(event) =>
                      setAnalyticsPeriod(
                        event.target.value as
                          | "all"
                          | "30"
                          | "90"
                          | "365"
                      )
                    }
                    className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="30">آخر 30 يومًا</option>
                    <option value="90">آخر 3 أشهر</option>
                    <option value="365">آخر سنة</option>
                    <option value="all">كل الفترات</option>
                  </select>

                  <button
                    type="button"
                    onClick={exportAnalyticsCsv}
                    className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700"
                  >
                    تصدير Excel
                  </button>

                  <button
                    type="button"
                    onClick={printAnalytics}
                    className="rounded-xl bg-slate-800 px-5 py-3 font-bold text-white hover:bg-slate-900"
                  >
                    طباعة / PDF
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <article className="rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-xl font-bold">
                    أعلى العملاء قيمةً
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    حسب قيمة العقد المسجلة
                  </p>

                  {topClientsByContracts.length === 0 ? (
                    <p className="mt-5 rounded-xl bg-gray-50 p-6 text-center text-gray-500">
                      لا توجد عقود مالية مسجلة
                    </p>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {topClientsByContracts.map(
                        (client, index) => (
                          <Link
                            key={client.id}
                            href={`/admin/client/${client.id}`}
                            className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 p-4 transition hover:border-blue-200 hover:bg-blue-50/30"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 font-black text-blue-700">
                                {index + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-bold">
                                  {client.name}
                                </p>
                                <p className="truncate text-sm text-gray-500">
                                  {client.project_name}
                                </p>
                              </div>
                            </div>

                            <p className="shrink-0 font-black text-blue-700">
                              {formatMoney(
                                client.contractAmount,
                                client.currency
                              )}
                            </p>
                          </Link>
                        )
                      )}
                    </div>
                  )}
                </article>

                <article className="rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-xl font-bold">
                    التحصيل حسب العملة
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    الدفعات ضمن الفترة المحددة مقارنةً بالعقود
                  </p>

                  {Object.keys(analyticsCurrencyTotals).length ===
                  0 ? (
                    <p className="mt-5 rounded-xl bg-gray-50 p-6 text-center text-gray-500">
                      لا توجد بيانات مالية
                    </p>
                  ) : (
                    <div className="mt-5 space-y-5">
                      {Object.entries(
                        analyticsCurrencyTotals
                      ).map(([currency, totals]) => {
                        const collectionRate =
                          totals.contracts > 0
                            ? Math.min(
                                Math.round(
                                  (totals.paid /
                                    totals.contracts) *
                                    100
                                ),
                                100
                              )
                            : 0;

                        return (
                          <div
                            key={currency}
                            className="rounded-xl bg-gray-50 p-4"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-black">
                                {currency}
                              </span>
                              <span className="font-bold text-emerald-700">
                                {collectionRate}%
                              </span>
                            </div>

                            <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-200">
                              <div
                                className="h-full rounded-full bg-emerald-600"
                                style={{
                                  width: `${collectionRate}%`,
                                }}
                              />
                            </div>

                            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                              <div>
                                <p className="text-gray-500">
                                  العقود
                                </p>
                                <p className="mt-1 font-bold">
                                  {formatMoney(
                                    totals.contracts,
                                    currency
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">
                                  المدفوع
                                </p>
                                <p className="mt-1 font-bold text-emerald-700">
                                  {formatMoney(
                                    totals.paid,
                                    currency
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">
                                  المتبقي
                                </p>
                                <p className="mt-1 font-bold text-amber-700">
                                  {formatMoney(
                                    totals.remaining,
                                    currency
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-6 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-orange-800">مركز التنبيهات</h2>
                  <p className="text-sm text-orange-700">إجمالي التنبيهات: {dashboardAlerts.length}</p>
                </div>
                <span className="rounded-full bg-orange-600 px-4 py-2 font-bold text-white">{dashboardAlerts.length}</span>
              </div>

              {dashboardAlerts.length===0 ? (
                <p className="mt-5 rounded-xl bg-white p-5 text-center text-green-700 font-bold">
                  لا توجد تنبيهات حالياً.
                </p>
              ):(
                <div className="mt-5 space-y-3">
                  {dashboardAlerts.slice(0,12).map((alert,index)=>(
                    <Link key={index} href={`/admin/client/${alert.client.id}`}
                      className="flex items-center justify-between rounded-xl border bg-white p-4 hover:bg-gray-50">
                      <div>
                        <p className="font-bold">{alert.client.project_name}</p>
                        <p className="text-sm text-gray-600">{alert.title}</p>
                      </div>
                      <span className="text-blue-700 font-bold">فتح المشروع ←</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

<section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-4 shadow sm:p-6">
                <p className="text-sm font-bold text-red-700">
                  مشاريع تحتاج متابعة
                </p>
                <p className="mt-3 text-4xl font-black text-red-700">
                  {attentionProjects.length}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  غير مكتملة وأقل من 40%
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow sm:p-6">
                <p className="text-sm font-bold text-emerald-700">
                  قريبة من الإنجاز
                </p>
                <p className="mt-3 text-4xl font-black text-emerald-700">
                  {nearCompletionProjects.length}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  وصلت إلى 90% أو أكثر
                </p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow sm:p-6">
                <p className="text-sm font-bold text-blue-700">
                  أعلى نسبة إنجاز
                </p>
                <p className="mt-3 text-4xl font-black text-blue-700">
                  {projectProgressChart.length > 0
                    ? clampProgress(projectProgressChart[0].progress)
                    : 0}
                  %
                </p>
                <p className="mt-2 truncate text-sm text-gray-500">
                  {projectProgressChart[0]?.project_name || "لا توجد مشاريع"}
                </p>
              </div>

              <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4 shadow sm:p-6">
                <p className="text-sm font-bold text-violet-700">
                  معدل التحصيل العام
                </p>
                <p className="mt-3 text-4xl font-black text-violet-700">
                  {(() => {
                    const totals = Object.values(financialStatistics);
                    const contracts = totals.reduce(
                      (sum, item) => sum + item.contracts,
                      0
                    );
                    const paid = totals.reduce(
                      (sum, item) => sum + item.paid,
                      0
                    );

                    return contracts > 0
                      ? Math.min(Math.round((paid / contracts) * 100), 100)
                      : 0;
                  })()}
                  %
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  من إجمالي قيمة العقود
                </p>
              </div>
            </section>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <section className="rounded-2xl bg-white p-5 shadow sm:p-6">
                <div>
                  <h2 className="text-2xl font-bold">
                    نسب إنجاز المشاريع
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    أعلى 10 مشاريع حسب نسبة الإنجاز
                  </p>
                </div>

                {projectProgressChart.length === 0 ? (
                  <p className="mt-6 rounded-xl bg-gray-50 p-8 text-center text-gray-500">
                    لا توجد مشاريع مسجلة
                  </p>
                ) : (
                  <div className="mt-6 space-y-4">
                    {projectProgressChart.map((client) => {
                      const progress = clampProgress(client.progress);

                      return (
                        <Link
                          key={client.id}
                          href={`/admin/client/${client.id}`}
                          className="block rounded-xl border border-gray-100 p-3 transition hover:border-blue-200 hover:bg-blue-50/30"
                        >
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="truncate font-bold text-gray-800">
                              {client.project_name}
                            </span>
                            <span className="font-black text-blue-700">
                              {progress}%
                            </span>
                          </div>
                          <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>

              {canManageFinance && (
                <section className="rounded-2xl bg-white p-5 shadow sm:p-6">
                  <div>
                    <h2 className="text-2xl font-bold">
                      حركة الدفعات الشهرية
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      مقارنة آخر 6 أشهر حسب الدفعات المسجلة
                    </p>
                  </div>

                  <div className="mt-8 flex h-72 items-end gap-3 overflow-x-auto border-b border-gray-200 pb-2">
                    {monthlyPayments.map((month) => (
                      <div
                        key={month.key}
                        className="flex min-w-16 flex-1 flex-col items-center justify-end"
                      >
                        <p className="mb-2 max-w-24 truncate text-xs font-bold text-gray-600">
                          {new Intl.NumberFormat("ar-IQ", {
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(month.total)}
                        </p>
                        <div className="flex h-48 w-full items-end rounded-t-lg bg-emerald-50">
                          <div
                            className="w-full rounded-t-lg bg-emerald-600 transition-all"
                            style={{
                              height: `${Math.max(
                                month.percentage,
                                month.total > 0 ? 6 : 0
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="mt-2 whitespace-nowrap text-xs text-gray-500">
                          {month.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
              <section className="rounded-2xl bg-white p-5 shadow sm:p-6 xl:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">
                      المشاريع التي تحتاج متابعة
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      مشاريع غير مكتملة ونسبة إنجازها أقل من 40%
                    </p>
                  </div>

                  <span className="rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-700">
                    {attentionProjects.length}
                  </span>
                </div>

                {attentionProjects.length === 0 ? (
                  <p className="mt-6 rounded-xl bg-green-50 p-6 text-center font-bold text-green-700">
                    ممتاز، لا توجد مشاريع منخفضة الإنجاز حاليًا
                  </p>
                ) : (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {attentionProjects.map((client) => {
                      const progress = clampProgress(client.progress);

                      return (
                        <Link
                          key={client.id}
                          href={`/admin/client/${client.id}`}
                          className="rounded-xl border border-red-100 bg-red-50/40 p-4 transition hover:border-red-300 hover:shadow"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-gray-900">
                                {client.project_name}
                              </p>
                              <p className="mt-1 text-sm text-gray-500">
                                العميل: {client.name}
                              </p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-red-700">
                              {progress}%
                            </span>
                          </div>

                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-red-100">
                            <div
                              className="h-full rounded-full bg-red-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-2xl bg-white p-5 shadow sm:p-6">
                <h2 className="text-2xl font-bold">
                  توزيع حالات المشاريع
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  نظرة سريعة على حالة جميع المشاريع
                </p>

                <div className="mt-6 space-y-5">
                  {statusDistribution.map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-gray-700">
                          {item.label}
                        </span>
                        <span className="text-gray-500">
                          {item.value} — {item.percentage}%
                        </span>
                      </div>
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={`h-full rounded-full ${item.barClass}`}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
                <p className="text-sm text-gray-500">
                  عدد العملاء والمشاريع
                </p>

                <p className="mt-3 text-4xl font-bold text-blue-700">
                  {statistics.totalClients}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
                <p className="text-sm text-gray-500">
                  المشاريع قيد التنفيذ
                </p>

                <p className="mt-3 text-4xl font-bold text-green-600">
                  {statistics.activeProjects}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
                <p className="text-sm text-gray-500">
                  المشاريع المكتملة
                </p>

                <p className="mt-3 text-4xl font-bold text-purple-600">
                  {statistics.completedProjects}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
                <p className="text-sm text-gray-500">
                  متوسط نسبة الإنجاز
                </p>

                <p className="mt-3 text-4xl font-bold text-amber-600">
                  {statistics.averageProgress}%
                </p>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{
                      width: `${statistics.averageProgress}%`,
                    }}
                  />
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
{canManageUpdates && (
              <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
                <p className="text-sm text-gray-500">
                  تحديثات المشاريع
                </p>

                <p className="mt-3 text-3xl font-bold text-cyan-700">
                  {statistics.totalUpdates}
                </p>
              </div>
              )}

{canManageFiles && (
              <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
                <p className="text-sm text-gray-500">
                  ملفات المشاريع
                </p>

                <p className="mt-3 text-3xl font-bold text-indigo-700">
                  {statistics.totalFiles}
                </p>
              </div>
              )}

{canManageFinance && (
              <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
                <p className="text-sm text-gray-500">
                  عدد الدفعات
                </p>

                <p className="mt-3 text-3xl font-bold text-emerald-700">
                  {statistics.totalPaymentsCount}
                </p>
              </div>
              )}

              <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
                <p className="text-sm text-gray-500">
                  حالات مشاريع أخرى
                </p>

                <p className="mt-3 text-3xl font-bold text-gray-700">
                  {statistics.otherProjects}
                </p>
              </div>
            </section>

            {canManageFinance && (
            <section className="mt-8 rounded-2xl bg-white p-5 shadow sm:p-6">
              <div>
                <h2 className="text-2xl font-bold">
                  الملخص المالي
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  إجمالي العقود والمدفوع والمتبقي حسب العملة
                </p>
              </div>

              {Object.keys(financialStatistics).length === 0 ? (
                <p className="mt-6 rounded-xl bg-gray-50 p-8 text-center text-gray-500">
                  لا توجد بيانات مالية مسجلة حتى الآن
                </p>
              ) : (
                <div className="mt-6 space-y-6">
                  {Object.entries(financialStatistics).map(
                    ([currency, totals]) => {
                      const paymentPercentage =
                        totals.contracts > 0
                          ? Math.min(
                              Math.max(
                                Math.round(
                                  (totals.paid /
                                    totals.contracts) *
                                    100
                                ),
                                0
                              ),
                              100
                            )
                          : 0;

                      return (
                        <article
                          key={currency}
                          className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <h3 className="text-xl font-bold">
                              العملة: {currency}
                            </h3>

                            <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700">
                              نسبة التحصيل: {paymentPercentage}%
                            </span>
                          </div>

                          <div className="mt-5 grid gap-4 sm:grid-cols-3">
                            <div className="rounded-xl bg-white p-4">
                              <p className="text-sm text-gray-500">
                                إجمالي العقود
                              </p>

                              <p className="mt-2 text-xl font-bold text-blue-700">
                                {formatMoney(
                                  totals.contracts,
                                  currency
                                )}
                              </p>
                            </div>

                            <div className="rounded-xl bg-white p-4">
                              <p className="text-sm text-gray-500">
                                إجمالي المقبوض
                              </p>

                              <p className="mt-2 text-xl font-bold text-green-600">
                                {formatMoney(
                                  totals.paid,
                                  currency
                                )}
                              </p>
                            </div>

                            <div className="rounded-xl bg-white p-4">
                              <p className="text-sm text-gray-500">
                                إجمالي المتبقي
                              </p>

                              <p className="mt-2 text-xl font-bold text-amber-600">
                                {formatMoney(
                                  totals.remaining,
                                  currency
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-green-600"
                              style={{
                                width: `${paymentPercentage}%`,
                              }}
                            />
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </section>
            )}

            {(canManageFinance || canManageUpdates) && (
              <div className="mt-8 grid gap-8 xl:grid-cols-2">
                {canManageFinance && (
              <section className="rounded-2xl bg-white p-5 shadow sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">
                      آخر الدفعات
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      أحدث الدفعات المسجلة للمشاريع
                    </p>
                  </div>
                </div>

                {recentPayments.length === 0 ? (
                  <p className="mt-6 rounded-xl bg-gray-50 p-8 text-center text-gray-500">
                    لا توجد دفعات مسجلة
                  </p>
                ) : (
                  <div className="mt-6 space-y-4">
                    {recentPayments.map((payment) => (
                      <article
                        key={payment.id}
                        className="rounded-xl border border-gray-200 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-bold">
                              {payment.projectName}
                            </p>

                            <p className="mt-1 text-sm text-gray-500">
                              العميل: {payment.clientName}
                            </p>

                            <p className="mt-1 text-sm text-gray-500">
                              {formatDate(
                                payment.payment_date
                              )}
                            </p>
                          </div>

                          <p className="text-lg font-bold text-green-600">
                            {formatMoney(
                              toNumber(payment.amount),
                              payment.currency
                            )}
                          </p>
                        </div>

                        {payment.note && (
                          <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                            {payment.note}
                          </p>
                        )}

                        <Link
                          href={`/admin/client/${payment.client_id}/finance`}
                          className="mt-4 inline-block text-sm font-bold text-blue-700 hover:underline"
                        >
                          فتح الإدارة المالية
                        </Link>
                      </article>
                    ))}
                  </div>
                )}
              </section>
                )}

                {canManageUpdates && (
              <section className="rounded-2xl bg-white p-5 shadow sm:p-6">
                <div>
                  <h2 className="text-2xl font-bold">
                    آخر تحديثات المشاريع
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    أحدث مراحل الإنجاز المضافة
                  </p>
                </div>

                {recentUpdates.length === 0 ? (
                  <p className="mt-6 rounded-xl bg-gray-50 p-8 text-center text-gray-500">
                    لا توجد تحديثات مسجلة
                  </p>
                ) : (
                  <div className="mt-6 space-y-4">
                    {recentUpdates.map((update) => {
                      const safeProgress = clampProgress(
                        update.progress
                      );

                      return (
                        <article
                          key={update.id}
                          className="rounded-xl border border-gray-200 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-bold">
                                {update.title}
                              </p>

                              <p className="mt-1 text-sm text-gray-500">
                                {update.projectName}
                              </p>

                              <p className="mt-1 text-sm text-gray-500">
                                العميل: {update.clientName}
                              </p>

                              <p className="mt-1 text-sm text-gray-500">
                                {formatDate(
                                  update.created_at,
                                  true
                                )}
                              </p>
                            </div>

                            <span className="rounded-full bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
                              {safeProgress}%
                            </span>
                          </div>

                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{
                                width: `${safeProgress}%`,
                              }}
                            />
                          </div>

                          <Link
                            href={`/admin/client/${update.client_id}`}
                            className="mt-4 inline-block text-sm font-bold text-blue-700 hover:underline"
                          >
                            فتح المشروع
                          </Link>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
                )}
              </div>
            )}

            <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <Link
                href="/admin/clients"
                className="rounded-2xl bg-blue-600 p-6 text-white shadow transition hover:-translate-y-1 hover:bg-blue-700"
              >
                <h2 className="text-xl font-bold">عرض العملاء</h2>
                <p className="mt-3 text-blue-100">
                  مشاهدة العملاء والمشاريع المتاحة
                </p>
              </Link>

              {canManageClients && (
                <Link
                  href="/admin/new-client"
                  className="rounded-2xl bg-green-600 p-6 text-white shadow transition hover:-translate-y-1 hover:bg-green-700"
                >
                  <h2 className="text-xl font-bold">إضافة عميل</h2>
                  <p className="mt-3 text-green-100">
                    إنشاء عميل ومشروع جديد
                  </p>
                </Link>
              )}

              {canManageFinance && (
                <Link
                  href="/admin/clients"
                  className="rounded-2xl bg-purple-600 p-6 text-white shadow transition hover:-translate-y-1 hover:bg-purple-700"
                >
                  <h2 className="text-xl font-bold">الإدارة المالية</h2>
                  <p className="mt-3 text-purple-100">
                    اختر مشروعًا لفتح العقود والدفعات
                  </p>
                </Link>
              )}

              {canManageFiles && (
                <Link
                  href="/admin/clients"
                  className="rounded-2xl bg-cyan-600 p-6 text-white shadow transition hover:-translate-y-1 hover:bg-cyan-700"
                >
                  <h2 className="text-xl font-bold">ملفات المشاريع</h2>
                  <p className="mt-3 text-cyan-100">
                    اختر مشروعًا لإدارة ملفاته
                  </p>
                </Link>
              )}

              {canManageUpdates && (
                <Link
                  href="/admin/clients"
                  className="rounded-2xl bg-amber-600 p-6 text-white shadow transition hover:-translate-y-1 hover:bg-amber-700"
                >
                  <h2 className="text-xl font-bold">تحديثات المشاريع</h2>
                  <p className="mt-3 text-amber-100">
                    اختر مشروعًا لإدارة التحديثات والصور
                  </p>
                </Link>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}