"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ClientRow = {
  id: number;
  name: string;
  project_name: string;
  progress: number;
  status: string;
};

type FinanceRow = {
  client_id: number;
  contract_amount: number | string;
  currency: string;
};

type PaymentRow = {
  client_id: number;
  amount: number | string;
};

type UpdateRow = {
  client_id: number;
  created_at: string;
};

type ProjectReportRow = ClientRow & {
  contractAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency: string;
  updatesCount: number;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampProgress(value: number) {
  return Math.min(Math.max(Number(value) || 0, 0), 100);
}

function formatMoney(value: number, currency: string) {
  const formatted = new Intl.NumberFormat("ar-IQ", {
    maximumFractionDigits: 2,
  }).format(value);

  if (currency === "IQD") return `${formatted} د.ع`;
  if (currency === "USD") return `${formatted} $`;
  return `${formatted} ${currency}`;
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

export default function ReportsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [finances, setFinances] = useState<FinanceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      setMessage("");

      const [clientsResult, financesResult, paymentsResult, updatesResult] =
        await Promise.all([
          supabase
            .from("clients")
            .select("id, name, project_name, progress, status")
            .order("id", { ascending: false }),
          supabase
            .from("project_finances")
            .select("client_id, contract_amount, currency"),
          supabase.from("project_payments").select("client_id, amount"),
          supabase.from("project_updates").select("client_id, created_at"),
        ]);

      const firstError =
        clientsResult.error ||
        financesResult.error ||
        paymentsResult.error ||
        updatesResult.error;

      if (firstError) {
        console.error(firstError);
        setMessage(`تعذر تحميل التقارير: ${firstError.message}`);
        setLoading(false);
        return;
      }

      setClients((clientsResult.data as ClientRow[] | null) ?? []);
      setFinances((financesResult.data as FinanceRow[] | null) ?? []);
      setPayments((paymentsResult.data as PaymentRow[] | null) ?? []);
      setUpdates((updatesResult.data as UpdateRow[] | null) ?? []);
      setLoading(false);
    }

    void loadReports();
  }, []);

  const rows = useMemo<ProjectReportRow[]>(() => {
    const financeMap = new Map(finances.map((item) => [item.client_id, item]));
    const paidMap = new Map<number, number>();
    const updatesMap = new Map<number, number>();

    payments.forEach((payment) => {
      paidMap.set(
        payment.client_id,
        (paidMap.get(payment.client_id) || 0) + toNumber(payment.amount)
      );
    });

    updates.forEach((update) => {
      updatesMap.set(
        update.client_id,
        (updatesMap.get(update.client_id) || 0) + 1
      );
    });

    return clients.map((client) => {
      const finance = financeMap.get(client.id);
      const contractAmount = toNumber(finance?.contract_amount);
      const paidAmount = paidMap.get(client.id) || 0;

      return {
        ...client,
        progress: clampProgress(client.progress),
        contractAmount,
        paidAmount,
        remainingAmount: Math.max(contractAmount - paidAmount, 0),
        currency: finance?.currency?.trim().toUpperCase() || "IQD",
        updatesCount: updatesMap.get(client.id) || 0,
      };
    });
  }, [clients, finances, payments, updates]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !query ||
        row.name.toLowerCase().includes(query) ||
        row.project_name.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const summary = useMemo(() => {
    const total = rows.length;
    const averageProgress = total
      ? Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / total)
      : 0;
    const completed = rows.filter((row) => row.status === "مكتمل").length;
    const active = rows.filter((row) => row.status === "قيد التنفيذ").length;

    const currencyTotals = new Map<
      string,
      { contracts: number; paid: number; remaining: number }
    >();

    rows.forEach((row) => {
      const current = currencyTotals.get(row.currency) || {
        contracts: 0,
        paid: 0,
        remaining: 0,
      };
      current.contracts += row.contractAmount;
      current.paid += row.paidAmount;
      current.remaining += row.remainingAmount;
      currencyTotals.set(row.currency, current);
    });

    return { total, averageProgress, completed, active, currencyTotals };
  }, [rows]);

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row) => map.set(row.status, (map.get(row.status) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const statuses = useMemo(
    () => [...new Set(rows.map((row) => row.status))].filter(Boolean),
    [rows]
  );

  function exportCsv() {
    const headers = [
      "العميل",
      "المشروع",
      "الحالة",
      "نسبة الإنجاز",
      "قيمة العقد",
      "المدفوع",
      "المتبقي",
      "العملة",
      "عدد التحديثات",
    ];

    const lines = filteredRows.map((row) =>
      [
        row.name,
        row.project_name,
        row.status,
        `${row.progress}%`,
        row.contractAmount,
        row.paidAmount,
        row.remainingAmount,
        row.currency,
        row.updatesCount,
      ]
        .map(csvCell)
        .join(",")
    );

    const csv = `\uFEFF${headers.map(csvCell).join(",")}\n${lines.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `azdan-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main dir="rtl" className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-gray-500">الإدارة العامة</p>
              <h1 className="mt-1 text-3xl font-bold text-blue-700">التقارير والإحصائيات</h1>
              <p className="mt-2 text-gray-500">ملخص موحد للمشاريع والتقدم والحسابات المالية</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportCsv}
                disabled={filteredRows.length === 0}
                className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                تصدير Excel / CSV
              </button>
              <Link href="/admin" className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800">
                الرجوع للوحة التحكم
              </Link>
            </div>
          </div>
        </header>

        {message && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-center text-red-700">{message}</p>}

        {loading ? (
          <p className="mt-6 rounded-2xl bg-white p-10 text-center text-gray-500 shadow">جاري تجهيز التقارير...</p>
        ) : (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-white p-6 shadow"><p className="text-sm text-gray-500">إجمالي المشاريع</p><p className="mt-3 text-4xl font-bold text-blue-700">{summary.total}</p></div>
              <div className="rounded-2xl bg-white p-6 shadow"><p className="text-sm text-gray-500">قيد التنفيذ</p><p className="mt-3 text-4xl font-bold text-emerald-600">{summary.active}</p></div>
              <div className="rounded-2xl bg-white p-6 shadow"><p className="text-sm text-gray-500">المكتملة</p><p className="mt-3 text-4xl font-bold text-purple-600">{summary.completed}</p></div>
              <div className="rounded-2xl bg-white p-6 shadow"><p className="text-sm text-gray-500">متوسط الإنجاز</p><p className="mt-3 text-4xl font-bold text-amber-600">{summary.averageProgress}%</p></div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <article className="rounded-2xl bg-white p-6 shadow">
                <h2 className="text-xl font-bold">توزيع حالات المشاريع</h2>
                <div className="mt-5 space-y-4">
                  {statusCounts.length === 0 ? <p className="text-gray-500">لا توجد بيانات</p> : statusCounts.map(([status, count]) => {
                    const percentage = summary.total ? Math.round((count / summary.total) * 100) : 0;
                    return <div key={status}><div className="mb-2 flex justify-between text-sm"><span className="font-bold">{status}</span><span>{count} مشروع — {percentage}%</span></div><div className="h-3 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${percentage}%` }} /></div></div>;
                  })}
                </div>
              </article>

              <article className="rounded-2xl bg-white p-6 shadow">
                <h2 className="text-xl font-bold">الملخص المالي حسب العملة</h2>
                <div className="mt-5 space-y-4">
                  {summary.currencyTotals.size === 0 ? <p className="text-gray-500">لا توجد بيانات مالية</p> : [...summary.currencyTotals.entries()].map(([currency, totals]) => (
                    <div key={currency} className="rounded-xl border border-gray-200 p-4">
                      <p className="mb-3 font-bold text-blue-700">{currency}</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div><p className="text-xs text-gray-500">العقود</p><p className="mt-1 font-bold">{formatMoney(totals.contracts, currency)}</p></div>
                        <div><p className="text-xs text-gray-500">المدفوع</p><p className="mt-1 font-bold text-green-600">{formatMoney(totals.paid, currency)}</p></div>
                        <div><p className="text-xs text-gray-500">المتبقي</p><p className="mt-1 font-bold text-amber-600">{formatMoney(totals.remaining, currency)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="mt-6 rounded-2xl bg-white p-5 shadow sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div><h2 className="text-2xl font-bold">تقرير المشاريع التفصيلي</h2><p className="mt-1 text-sm text-gray-500">يمكنك البحث والفلترة ثم تصدير النتائج</p></div>
                <div className="grid gap-3 sm:grid-cols-2 lg:w-[560px]">
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث باسم العميل أو المشروع" className="rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500" />
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500">
                    <option value="all">كل الحالات</option>
                    {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-900 text-white"><tr><th className="p-4 text-right">العميل / المشروع</th><th className="p-4 text-right">الحالة</th><th className="p-4 text-right">الإنجاز</th><th className="p-4 text-right">العقد</th><th className="p-4 text-right">المدفوع</th><th className="p-4 text-right">المتبقي</th><th className="p-4 text-right">التحديثات</th><th className="p-4 text-right">التقرير</th></tr></thead>
                  <tbody>
                    {filteredRows.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-gray-500">لا توجد نتائج مطابقة</td></tr> : filteredRows.map((row) => (
                      <tr key={row.id} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="p-4"><p className="font-bold">{row.name}</p><p className="mt-1 text-xs text-gray-500">{row.project_name}</p></td>
                        <td className="p-4"><span className="rounded-full bg-blue-50 px-3 py-1 font-bold text-blue-700">{row.status}</span></td>
                        <td className="p-4"><p className="font-bold">{row.progress}%</p><div className="mt-2 h-2 w-24 overflow-hidden rounded-full bg-gray-200"><div className="h-full bg-emerald-600" style={{ width: `${row.progress}%` }} /></div></td>
                        <td className="p-4 font-bold">{formatMoney(row.contractAmount, row.currency)}</td>
                        <td className="p-4 font-bold text-green-600">{formatMoney(row.paidAmount, row.currency)}</td>
                        <td className="p-4 font-bold text-amber-600">{formatMoney(row.remainingAmount, row.currency)}</td>
                        <td className="p-4">{row.updatesCount}</td>
                        <td className="p-4"><Link href={`/admin/client/${row.id}/report`} className="font-bold text-blue-700 hover:underline">فتح التقرير</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
