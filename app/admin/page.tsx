"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { canAccess, roleLabels } from "@/lib/admin-permissions";
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
  created_at: string;
};

type UpdateRecord = {
  id: number;
  client_id: number;
  title: string;
  progress: number;
  created_at: string;
};

function toNumber(value: number | string | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clampProgress(value: number) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ar-IQ", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function AdminPage() {
  const { role } = useAdminRole();
  const [clients, setClients] = useState<Client[]>([]);
  const [finances, setFinances] = useState<FinanceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [updates, setUpdates] = useState<UpdateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const canManageClients = canAccess(role, "manage_clients");
  const canManageFinance = canAccess(role, "manage_finance");
  const canManageUsers = canAccess(role, "manage_users");
  const canViewActivity = canAccess(role, "view_activity");
  const canViewReports = canAccess(role, "view_reports");
  const canViewSettings = canAccess(role, "view_settings");

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setMessage("");

      const [clientsResult, financesResult, paymentsResult, updatesResult] =
        await Promise.all([
          supabase
            .from("clients")
            .select("id, name, project_name, progress, status")
            .order("id", { ascending: false }),

          canManageFinance
            ? supabase
                .from("project_finances")
                .select("client_id, contract_amount, currency")
            : Promise.resolve({ data: [], error: null }),

          canManageFinance
            ? supabase
                .from("project_payments")
                .select("id, client_id, amount, payment_date, created_at")
                .order("payment_date", { ascending: false })
                .limit(1000)
            : Promise.resolve({ data: [], error: null }),

          supabase
            .from("project_updates")
            .select("id, client_id, title, progress, created_at")
            .order("created_at", { ascending: false })
            .limit(8),
        ]);

      if (clientsResult.error) {
        console.error(clientsResult.error);
        setMessage(`تعذر تحميل المشاريع: ${clientsResult.error.message}`);
        setLoading(false);
        return;
      }

      if (financesResult.error) console.error(financesResult.error);
      if (paymentsResult.error) console.error(paymentsResult.error);
      if (updatesResult.error) console.error(updatesResult.error);

      setClients((clientsResult.data as Client[] | null) ?? []);
      setFinances((financesResult.data as FinanceRecord[] | null) ?? []);
      setPayments((paymentsResult.data as PaymentRecord[] | null) ?? []);
      setUpdates((updatesResult.data as UpdateRecord[] | null) ?? []);
      setLoading(false);
    }

    void loadDashboard();
  }, [canManageFinance]);

  const clientMap = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients]
  );

  const stats = useMemo(() => {
    const total = clients.length;
    const completed = clients.filter(
      (client) => client.status.trim() === "مكتمل"
    ).length;
    const active = clients.filter(
      (client) => client.status.trim() === "قيد التنفيذ"
    ).length;
    const average =
      total === 0
        ? 0
        : Math.round(
            clients.reduce(
              (sum, client) => sum + clampProgress(client.progress),
              0
            ) / total
          );

    const paidByClient = new Map<number, number>();
    payments.forEach((payment) => {
      paidByClient.set(
        payment.client_id,
        (paidByClient.get(payment.client_id) || 0) + toNumber(payment.amount)
      );
    });

    const dueProjects = finances.filter((finance) => {
      const contractAmount = toNumber(finance.contract_amount);
      const paid = paidByClient.get(finance.client_id) || 0;
      return contractAmount > 0 && paid < contractAmount;
    }).length;

    return { total, completed, active, average, dueProjects };
  }, [clients, finances, payments]);

  const filteredClients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const source = query
      ? clients.filter(
          (client) =>
            client.name.toLowerCase().includes(query) ||
            client.project_name.toLowerCase().includes(query)
        )
      : clients;

    return source.slice(0, 6);
  }, [clients, searchTerm]);

  const recentUpdates = useMemo(
    () =>
      updates.slice(0, 5).map((update) => ({
        ...update,
        client: clientMap.get(update.client_id),
      })),
    [updates, clientMap]
  );

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
          <p className="mt-5 font-black text-[#0b2239]">
            جاري تحميل لوحة الإدارة...
          </p>
          <div className="mx-auto mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[#d8b56a]" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f4f6f8] pb-32 text-[#10253b] sm:pb-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
        <header className="mb-5 flex items-center justify-between gap-4 pr-1 sm:mb-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0b2239] text-lg font-black text-[#d8b56a]">
              أ
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#0b2239]">
                أزدان للمقاولات العامة
              </p>
              <p className="mt-0.5 text-xs font-bold text-slate-400">
                لوحة الإدارة · {roleLabels[role]}
              </p>
            </div>
          </div>
        </header>

        {message && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
            {message}
          </div>
        )}

        <section className="overflow-hidden rounded-[2rem] bg-[#0b2239] p-5 text-white shadow-xl shadow-[#0b2239]/15 sm:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-[#d8b56a] px-3 py-1 text-xs font-black text-[#0b2239]">
                الإدارة اليومية
              </span>
              <h1 className="mt-4 text-2xl font-black sm:text-3xl">
                كل مشاريع أزدان بمكان واحد
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-7 text-slate-300">
                تابع المشاريع، افتح ملف العميل، أضف تحديثاً أو دفعة بدون زحمة وظائف.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/clients"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#0b2239] transition hover:bg-slate-100"
              >
                العملاء والمشاريع
              </Link>
              {canManageClients && (
                <Link
                  href="/admin/new-client"
                  className="rounded-2xl bg-[#d8b56a] px-4 py-3 text-sm font-black text-[#0b2239] transition hover:brightness-105"
                >
                  + إضافة عميل
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="كل المشاريع" value={stats.total} icon="🏗️" />
          <StatCard label="قيد التنفيذ" value={stats.active} icon="⚙️" />
          <StatCard label="مكتملة" value={stats.completed} icon="✓" />
          <StatCard label="متوسط الإنجاز" value={`${stats.average}%`} icon="📈" />
          {canManageFinance && (
            <StatCard
              label="عليها مستحقات"
              value={stats.dueProjects}
              icon="💰"
              wideOnMobile
            />
          )}
        </section>

        <section className="mt-5 rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black text-[#d8b56a]">المشاريع</p>
              <h2 className="mt-1 text-xl font-black text-[#0b2239] sm:text-2xl">
                العملاء والمشاريع
              </h2>
            </div>

            <div className="w-full sm:max-w-sm">
              <label htmlFor="project-search" className="sr-only">
                البحث في العملاء والمشاريع
              </label>
              <input
                id="project-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ابحث باسم العميل أو المشروع..."
                className="w-full rounded-2xl border border-slate-200 bg-[#f8fafb] px-4 py-3 text-sm font-bold text-[#0b2239] outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-[#d8b56a] focus:ring-4 focus:ring-[#d8b56a]/15"
              />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {filteredClients.length === 0 ? (
              <div className="rounded-2xl bg-[#f8fafb] p-8 text-center text-sm font-bold text-slate-400">
                لا توجد مشاريع مطابقة.
              </div>
            ) : (
              filteredClients.map((client) => {
                const progress = clampProgress(client.progress);
                return (
                  <Link
                    key={client.id}
                    href={`/admin/client/${client.id}`}
                    className="group block rounded-2xl border border-slate-100 bg-white p-4 transition hover:border-[#d8b56a]/60 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-black text-[#0b2239]">
                            {client.name}
                          </p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">
                            {client.status || "غير محدد"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-bold text-slate-500">
                          {client.project_name}
                        </p>

                        <div className="mt-3 flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-[#d8b56a] transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="w-11 text-left text-xs font-black text-[#0b2239]">
                            {progress}%
                          </span>
                        </div>
                      </div>

                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4f6f8] text-lg font-black text-[#0b2239] transition group-hover:bg-[#0b2239] group-hover:text-[#d8b56a]">
                        ←
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {clients.length > 6 && !searchTerm && (
            <Link
              href="/admin/clients"
              className="mt-4 block rounded-2xl bg-[#f4f6f8] px-4 py-3 text-center text-sm font-black text-[#0b2239] transition hover:bg-slate-200"
            >
              عرض جميع المشاريع
            </Link>
          )}
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <section className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-[#d8b56a]">آخر النشاط</p>
                <h2 className="mt-1 text-xl font-black text-[#0b2239]">
                  آخر تحديثات المشاريع
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {recentUpdates.length === 0 ? (
                <div className="rounded-2xl bg-[#f8fafb] p-7 text-center text-sm font-bold text-slate-400">
                  لا توجد تحديثات بعد.
                </div>
              ) : (
                recentUpdates.map((update) => (
                  <Link
                    key={update.id}
                    href={`/admin/client/${update.client_id}`}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3.5 transition hover:border-[#d8b56a]/60"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0b2239] text-lg text-[#d8b56a]">
                      🏗️
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-[#0b2239]">
                        {update.title}
                      </p>
                      <p className="mt-1 truncate text-xs font-bold text-slate-400">
                        {update.client?.name || "عميل"} · {formatDate(update.created_at)}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#f5e6c4] px-2.5 py-1 text-xs font-black text-[#0b2239]">
                      {clampProgress(update.progress)}%
                    </span>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-6">
            <p className="text-xs font-black text-[#d8b56a]">اختصارات</p>
            <h2 className="mt-1 text-xl font-black text-[#0b2239]">
              الوصول السريع
            </h2>

            <div className="mt-5 grid gap-3">
              <QuickLink
                href="/admin/clients"
                icon="🏠"
                title="المشاريع"
                description="فتح العملاء وإدارة كل مشروع"
              />

              {canManageClients && (
                <QuickLink
                  href="/admin/new-client"
                  icon="＋"
                  title="عميل جديد"
                  description="إضافة مشروع وبيانات عميل"
                />
              )}

              {canManageFinance && (
                <QuickLink
                  href="/admin/clients"
                  icon="💰"
                  title="الحسابات"
                  description="اختر المشروع ثم افتح حسابه"
                />
              )}
            </div>
          </section>
        </div>

        {(canManageUsers || canViewActivity || canViewReports || canViewSettings) && (
          <details className="group mt-5 rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-1 py-1 font-black text-[#0b2239]">
              <div>
                <p className="text-xs font-black text-[#d8b56a]">اختياري</p>
                <p className="mt-1">أدوات الإدارة والإعدادات</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f4f6f8] transition group-open:rotate-180">
               ⌄
              </span>
            </summary>

            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              {canManageUsers && (
                <SmallLink href="/admin/users" title="المستخدمون" icon="👥" />
              )}
              {canViewSettings && (
                <SmallLink href="/admin/settings" title="الإعدادات" icon="⚙️" />
              )}
              {canViewActivity && (
                <SmallLink href="/admin/activity" title="سجل النشاط" icon="🕘" />
              )}
              {canViewReports && (
                <SmallLink href="/admin/reports" title="التقارير" icon="📊" />
              )}
              {canViewSettings && (
                <SmallLink href="/admin/backup" title="النسخ الاحتياطي" icon="🗄️" />
              )}
            </div>
          </details>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  wideOnMobile = false,
}: {
  label: string;
  value: number | string;
  icon: string;
  wideOnMobile?: boolean;
}) {
  return (
    <div
      className={`rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-slate-100 ${
        wideOnMobile ? "col-span-2 lg:col-span-1" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f4f6f8] text-lg">
          {icon}
        </span>
        <span className="text-2xl font-black text-[#0b2239]">{value}</span>
      </div>
      <p className="mt-3 text-xs font-black text-slate-500">{label}</p>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-slate-100 p-3.5 transition hover:border-[#d8b56a]/60 hover:bg-[#fffdf8]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0b2239] text-lg font-black text-[#d8b56a]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-black text-[#0b2239]">{title}</p>
        <p className="mt-0.5 text-xs font-bold text-slate-400">{description}</p>
      </div>
      <span className="font-black text-slate-300 transition group-hover:text-[#d8b56a]">←</span>
    </Link>
  );
}

function SmallLink({
  href,
  title,
  icon,
}: {
  href: string;
  title: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl bg-[#f8fafb] p-3.5 text-sm font-black text-[#0b2239] transition hover:bg-[#f5e6c4]"
    >
      <span>{icon}</span>
      <span>{title}</span>
    </Link>
  );
}
