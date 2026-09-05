"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = Number(id);
  const [finance, setFinance] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedId = sessionStorage.getItem("azdan_client_id");
    if (Number(savedId) !== clientId) {
      router.replace("/client-login");
      return;
    }

    Promise.all([
      supabase
        .from("project_finances")
        .select("contract_amount,currency,notes")
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase
        .from("project_payments")
        .select("id,amount,payment_date,note")
        .eq("client_id", clientId)
        .order("payment_date", { ascending: false }),
    ]).then(([financeResult, paymentsResult]) => {
      setFinance(financeResult.data);
      setPayments(paymentsResult.data ?? []);
      setLoading(false);
    });
  }, [clientId, router]);

  if (loading) {
    return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-100">جاري التحميل...</main>;
  }

  const paid = payments.reduce((total, item) => total + Number(item.amount || 0), 0);
  const contract = Number(finance?.contract_amount || 0);
  const formatMoney = (value: number) =>
    `${new Intl.NumberFormat("ar-IQ").format(value)} ${finance?.currency === "USD" ? "$" : "د.ع"}`;

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => router.back()} className="mb-4 rounded-xl border bg-white px-4 py-2 font-bold">← رجوع</button>
        <h1 className="text-3xl font-black">الحساب المالي</h1>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            ["قيمة العقد", contract],
            ["المدفوع", paid],
            ["المتبقي", Math.max(contract - paid, 0)],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-white p-5">
              <p className="text-sm text-slate-500">{label}</p>
              <b className="text-xl">{formatMoney(Number(value))}</b>
            </div>
          ))}
        </div>
        <section className="mt-5 rounded-[2rem] bg-white p-6">
          <h2 className="text-xl font-black">سجل الدفعات</h2>
          {payments.length === 0 ? (
            <p className="mt-4 text-slate-500">لا توجد دفعات مسجلة.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex justify-between gap-3 rounded-2xl border p-4">
                  <div>
                    <b>{formatMoney(Number(payment.amount))}</b>
                    <p className="mt-1 text-sm text-slate-500">{payment.note || "دفعة مشروع"}</p>
                  </div>
                  <span className="text-sm">
                    {new Intl.DateTimeFormat("ar-IQ").format(new Date(payment.payment_date))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
