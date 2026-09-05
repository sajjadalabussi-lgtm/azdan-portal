"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
};

type AdditionRecord = {
  id: number;
  title: string;
  amount: number | string;
  addition_date: string;
  note: string | null;
};

function toNumber(value: number | string | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = Number(id);

  const [finance, setFinance] = useState<FinanceRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [additions, setAdditions] = useState<AdditionRecord[]>([]);
  const [projectName, setProjectName] = useState("مشروعك");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedId = sessionStorage.getItem("azdan_client_id");
    const token = sessionStorage.getItem("azdan_client_token");

    if (Number(savedId) !== clientId || !token) {
      router.replace("/client-login");
      return;
    }

    (async () => {
      const { data, error: snapshotError } = await supabase.rpc("get_client_finance_snapshot", {
        p_client_id: clientId,
        p_token: token,
      });

      if (snapshotError || !data) {
        console.error(snapshotError);
        sessionStorage.removeItem("azdan_client_token");
        setError("انتهت جلسة الدخول أو تعذر تحميل الحساب. سجل الدخول مرة أخرى.");
        setLoading(false);
        return;
      }

      const snapshot = data as {
        project_name?: string | null;
        finance?: FinanceRecord | null;
        payments?: PaymentRecord[] | null;
        additions?: AdditionRecord[] | null;
      };

      if (snapshot.project_name) setProjectName(snapshot.project_name);
      setFinance(snapshot.finance ?? null);
      setPayments(snapshot.payments ?? []);
      setAdditions(snapshot.additions ?? []);
      setLoading(false);
    })();
  }, [clientId, router]);

  const contract = toNumber(finance?.contract_amount);
  const paid = useMemo(() => payments.reduce((total, item) => total + toNumber(item.amount), 0), [payments]);
  const additionsTotal = useMemo(
    () => additions.reduce((total, item) => total + toNumber(item.amount), 0),
    [additions]
  );
  const totalDue = contract + additionsTotal;
  const remaining = Math.max(totalDue - paid, 0);
  const paymentPercentage = totalDue > 0 ? Math.min(Math.round((paid / totalDue) * 100), 100) : 0;

  const formatMoney = (value: number) =>
    `${new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 2 }).format(value)} ${
      finance?.currency === "USD" ? "$" : "د.ع"
    }`;

  if (loading) {
    return (
      <main dir="rtl" className="grid min-h-screen place-items-center bg-[#f4f6f8] px-5">
        <div className="rounded-[2rem] bg-white px-8 py-7 font-black text-[#0b2239] shadow-xl">جاري تحميل الحساب...</div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6f8] p-4 pb-10 text-[#0b2239] sm:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            href={`/client-portal/${clientId}`}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 shadow-sm"
          >
            ← رجوع إلى المشروع
          </Link>
          <span className="text-xs font-bold text-slate-400">بوابة عملاء أزدان</span>
        </div>

        <section className="rounded-[2rem] bg-[#0b2239] p-5 text-white shadow-xl shadow-[#0b2239]/15 sm:p-7">
          <p className="text-xs font-black text-[#d8b56a]">الحساب المالي</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">{projectName}</h1>
          <p className="mt-2 text-sm text-slate-300">ملخص العقد، الإضافات والدفعات</p>
        </section>

        {error && <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-700">{error}</div>}

        <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ["قيمة العقد", contract],
            ["الإضافات", additionsTotal],
            ["إجمالي المستحق", totalDue],
            ["المدفوع", paid],
            ["المتبقي", remaining],
          ].map(([label, value], index) => (
            <div
              key={String(label)}
              className={`rounded-3xl border bg-white p-4 shadow-sm ${index === 4 ? "col-span-2 lg:col-span-1" : "border-slate-100"}`}
            >
              <p className="text-xs font-bold text-slate-400">{String(label)}</p>
              <p className={`mt-2 text-base font-black ${index === 1 ? "text-[#b58b36]" : index === 3 ? "text-emerald-600" : "text-[#0b2239]"}`}>
                {formatMoney(Number(value))}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black">نسبة التسديد</p>
              <p className="mt-1 text-xs text-slate-400">من إجمالي العقد بعد الإضافات</p>
            </div>
            <span className="text-xl font-black text-[#d8b56a]">{paymentPercentage}%</span>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[#d8b56a]" style={{ width: `${paymentPercentage}%` }} />
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#d8b56a]/25 bg-[#fffdf8] p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#b58b36]">بعد توقيع العقد</p>
              <h2 className="mt-1 text-xl font-black">الإضافات</h2>
            </div>
            <span className="rounded-xl bg-[#d8b56a]/15 px-3 py-1.5 text-xs font-black text-[#8f6b25]">
              {formatMoney(additionsTotal)}
            </span>
          </div>
          <p className="mt-2 text-xs leading-6 text-slate-500">الأعمال أو المواد التي تم الاتفاق عليها بعد توقيع العقد الأصلي.</p>

          {additions.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-white p-6 text-center text-sm text-slate-400">لا توجد إضافات على العقد.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {additions.map((addition) => (
                <div key={addition.id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{addition.title}</p>
                      {addition.note && <p className="mt-1 text-xs leading-5 text-slate-500">{addition.note}</p>}
                    </div>
                    <p className="shrink-0 font-black text-[#b58b36]">{formatMoney(toNumber(addition.amount))}</p>
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-400">{formatDate(addition.addition_date)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-emerald-600">الدفعات</p>
              <h2 className="mt-1 text-xl font-black">سجل الدفعات</h2>
            </div>
            <span className="text-sm font-black text-emerald-600">{formatMoney(paid)}</span>
          </div>

          {payments.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">لا توجد دفعات مسجلة.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 p-4">
                  <div>
                    <p className="font-black text-emerald-700">{formatMoney(toNumber(payment.amount))}</p>
                    <p className="mt-1 text-xs text-slate-500">{payment.note || "دفعة مشروع"}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-slate-400">{formatDate(payment.payment_date)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {finance?.notes && (
          <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-black text-[#d8b56a]">ملاحظات العقد</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">{finance.notes}</p>
          </section>
        )}
      </div>
    </main>
  );
}
