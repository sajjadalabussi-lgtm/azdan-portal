"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type FinanceRecord = { contract_amount: number | string; currency: string; notes: string | null };
type PaymentRecord = { id: number; amount: number | string; payment_date: string; note: string | null; created_at: string };

function toNumber(value: number | string | null | undefined) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export default function ClientFinancePage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);
  const [finance, setFinance] = useState<FinanceRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedId = sessionStorage.getItem("azdan_client_id");
    if (!Number.isFinite(clientId) || Number(savedId) !== clientId) {
      router.replace("/client-login");
      return;
    }

    async function loadData() {
      const [financeResult, paymentsResult] = await Promise.all([
        supabase.from("project_finances").select("contract_amount, currency, notes").eq("client_id", clientId).maybeSingle(),
        supabase.from("project_payments").select("id, amount, payment_date, note, created_at").eq("client_id", clientId).order("payment_date", { ascending: false }).order("created_at", { ascending: false }),
      ]);

      if (financeResult.error || paymentsResult.error) {
        setMessage(financeResult.error?.message || paymentsResult.error?.message || "تعذر تحميل الحساب المالي");
      } else {
        setFinance(financeResult.data as FinanceRecord | null);
        setPayments((paymentsResult.data ?? []) as PaymentRecord[]);
      }
      setLoading(false);
    }

    loadData();
  }, [clientId, router]);

  const contractAmount = toNumber(finance?.contract_amount);
  const totalPaid = useMemo(() => payments.reduce((sum, item) => sum + toNumber(item.amount), 0), [payments]);
  const remaining = Math.max(contractAmount - totalPaid, 0);
  const percentage = contractAmount > 0 ? Math.min(Math.round((totalPaid / contractAmount) * 100), 100) : 0;

  function formatMoney(value: number) {
    const number = new Intl.NumberFormat("ar-IQ", { maximumFractionDigits: 2 }).format(value);
    const currency = finance?.currency || "IQD";
    if (currency === "IQD") return `${number} د.ع`;
    if (currency === "USD") return `${number} $`;
    return `${number} ${currency}`;
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("ar-IQ", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${date}T00:00:00`));
  }

  if (loading) return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f4f6f8] font-black text-[#0b2239]">جاري تحميل الحساب المالي...</main>;

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6f8] px-4 py-6 text-[#10253b] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => router.push(`/client-portal/${clientId}`)} className="mb-5 rounded-2xl bg-white px-4 py-3 text-sm font-black shadow-sm">→ الرجوع إلى البوابة</button>
        <section className="rounded-[2rem] bg-[#0b2239] p-6 text-white shadow-xl sm:p-8">
          <p className="text-sm font-black text-[#d8b56a]">الحساب المالي</p>
          <h1 className="mt-2 text-3xl font-black">ملخص الحساب وسجل الدفعات</h1>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#d8b56a]" style={{ width: `${percentage}%` }} /></div>
          <p className="mt-2 text-sm text-slate-300">نسبة الدفعات المسجلة: {percentage}%</p>
        </section>

        {message && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{message}</div>}

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["مبلغ العقد", formatMoney(contractAmount), "📑"],
            ["إجمالي المدفوع", formatMoney(totalPaid), "✅"],
            ["المبلغ المتبقي", formatMoney(remaining), "💰"],
          ].map(([label, value, icon]) => (
            <div key={label} className="rounded-[1.75rem] bg-white p-5 shadow-lg shadow-slate-200/60">
              <div className="flex items-center justify-between"><p className="text-xs font-bold text-slate-500">{label}</p><span className="text-2xl">{icon}</span></div>
              <p className="mt-4 break-words text-xl font-black text-[#0b2239]">{value}</p>
            </div>
          ))}
        </section>

        {finance?.notes && <section className="mt-6 rounded-[1.75rem] border border-[#d8b56a]/30 bg-[#fffaf0] p-5"><h2 className="font-black text-[#0b2239]">ملاحظات الحساب</h2><p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{finance.notes}</p></section>}

        <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-xl sm:p-7">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-black text-[#0b2239]">سجل الدفعات</h2><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">{payments.length} دفعة</span></div>
          {payments.length === 0 ? <p className="mt-5 rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">لا توجد دفعات مسجلة حتى الآن</p> : <div className="mt-5 space-y-3">{payments.map((payment) => <article key={payment.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-lg font-black text-emerald-700">{formatMoney(toNumber(payment.amount))}</p><p className="mt-1 text-xs text-slate-400">{formatDate(payment.payment_date)}</p></div><p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:max-w-[60%]">{payment.note || "لا توجد ملاحظة"}</p></article>)}</div>}
        </section>
      </div>
    </main>
  );
}
