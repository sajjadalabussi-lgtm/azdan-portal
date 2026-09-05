"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { logActivityClient } from "@/lib/log-activity-client";

type Client = {
  id: number;
  name: string;
  project_name: string;
};

type FinanceRecord = {
  id: number;
  client_id: number;
  contract_amount: number | string;
  currency: string;
  notes: string | null;
};

type PaymentRecord = {
  id: number;
  client_id: number;
  amount: number | string;
  payment_date: string;
  note: string | null;
  created_at: string;
};

type AdditionRecord = {
  id: number;
  client_id: number;
  title: string;
  amount: number | string;
  addition_date: string;
  note: string | null;
  created_at: string;
};

function toNumber(value: number | string | null | undefined) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function clampPercentage(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

export default function ClientFinancePage() {
  const params = useParams();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [financeId, setFinanceId] = useState<number | null>(null);
  const [contractAmount, setContractAmount] = useState("");
  const [currency, setCurrency] = useState("IQD");
  const [financeNotes, setFinanceNotes] = useState("");

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [additions, setAdditions] = useState<AdditionRecord[]>([]);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState("");

  const [additionTitle, setAdditionTitle] = useState("");
  const [additionAmount, setAdditionAmount] = useState("");
  const [additionDate, setAdditionDate] = useState(new Date().toISOString().slice(0, 10));
  const [additionNote, setAdditionNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingFinance, setSavingFinance] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);
  const [addingAddition, setAddingAddition] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);
  const [deletingAdditionId, setDeletingAdditionId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage(text);
    setMessageType(type);
  };

  const formatMoney = useCallback(
    (value: number, selectedCurrency = currency) => {
      const formatted = new Intl.NumberFormat("ar-IQ", {
        maximumFractionDigits: 2,
      }).format(value);
      if (selectedCurrency === "IQD") return `${formatted} د.ع`;
      if (selectedCurrency === "USD") return `${formatted} $`;
      return `${formatted} ${selectedCurrency}`;
    },
    [currency]
  );

  function formatDate(date: string) {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return "التاريخ غير متوفر";
    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(parsed);
  }

  const loadFinanceData = useCallback(async () => {
    if (!Number.isFinite(clientId) || clientId <= 0) {
      showMessage("رقم العميل غير صحيح", "error");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const [clientResult, financeResult, paymentsResult, additionsResult] = await Promise.all([
      supabase.from("clients").select("id, name, project_name").eq("id", clientId).single(),
      supabase
        .from("project_finances")
        .select("id, client_id, contract_amount, currency, notes")
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase
        .from("project_payments")
        .select("id, client_id, amount, payment_date, note, created_at")
        .eq("client_id", clientId)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("project_additions")
        .select("id, client_id, title, amount, addition_date, note, created_at")
        .eq("client_id", clientId)
        .order("addition_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (clientResult.error || !clientResult.data) {
      showMessage(`تعذر تحميل العميل: ${clientResult.error?.message || "العميل غير موجود"}`, "error");
      setLoading(false);
      return;
    }

    if (paymentsResult.error) {
      showMessage(`تعذر تحميل الدفعات: ${paymentsResult.error.message}`, "error");
      setLoading(false);
      return;
    }

    if (additionsResult.error) {
      showMessage(
        `تعذر تحميل الإضافات: ${additionsResult.error.message}. شغّل ملف SQL المرفق مرة واحدة في Supabase.`,
        "error"
      );
      setLoading(false);
      return;
    }

    let preparedFinance = financeResult.data as FinanceRecord | null;

    if (financeResult.error) {
      showMessage(`تعذر تحميل الحساب: ${financeResult.error.message}`, "error");
      setLoading(false);
      return;
    }

    if (!preparedFinance) {
      const { data, error } = await supabase
        .from("project_finances")
        .insert({ client_id: clientId, contract_amount: 0, currency: "IQD" })
        .select("id, client_id, contract_amount, currency, notes")
        .single();

      if (error || !data) {
        showMessage(`تعذر إنشاء الحساب المالي: ${error?.message || "حدث خطأ"}`, "error");
        setLoading(false);
        return;
      }
      preparedFinance = data as FinanceRecord;
    }

    setClient(clientResult.data as Client);
    setFinanceId(preparedFinance.id);
    setContractAmount(String(toNumber(preparedFinance.contract_amount)));
    setCurrency(preparedFinance.currency || "IQD");
    setFinanceNotes(preparedFinance.notes || "");
    setPayments((paymentsResult.data ?? []) as PaymentRecord[]);
    setAdditions((additionsResult.data ?? []) as AdditionRecord[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const contractAmountNumber = toNumber(contractAmount);
  const totalPaid = useMemo(
    () => payments.reduce((total, payment) => total + toNumber(payment.amount), 0),
    [payments]
  );
  const totalAdditions = useMemo(
    () => additions.reduce((total, addition) => total + toNumber(addition.amount), 0),
    [additions]
  );
  const totalDue = contractAmountNumber + totalAdditions;
  const remainingAmount = Math.max(totalDue - totalPaid, 0);
  const overpaidAmount = Math.max(totalPaid - totalDue, 0);
  const paymentPercentage = totalDue > 0 ? clampPercentage(Math.round((totalPaid / totalDue) * 100)) : 0;

  async function saveFinance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingFinance) return;
    if (contractAmountNumber < 0) return showMessage("قيمة العقد لا يمكن أن تكون سالبة", "error");

    setSavingFinance(true);
    const payload = {
      client_id: clientId,
      contract_amount: contractAmountNumber,
      currency: currency.trim().toUpperCase() || "IQD",
      notes: financeNotes.trim() || null,
    };

    const query = financeId
      ? supabase.from("project_finances").update(payload).eq("id", financeId).eq("client_id", clientId)
      : supabase.from("project_finances").insert(payload);

    const { error } = await query;
    if (error) {
      showMessage(`تعذر حفظ معلومات العقد: ${error.message}`, "error");
      setSavingFinance(false);
      return;
    }

    await logActivityClient({
      action: financeId ? "update" : "create",
      entityType: "project_finances",
      entityId: financeId,
      description: `تحديث معلومات عقد المشروع رقم ${clientId}`,
      newData: payload,
    });

    showMessage("تم حفظ معلومات العقد ✅", "success");
    setSavingFinance(false);
    if (!financeId) await loadFinanceData();
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addingPayment) return;

    const amount = toNumber(paymentAmount);
    if (amount <= 0) return showMessage("أدخل مبلغ دفعة صحيح", "error");
    if (!paymentDate) return showMessage("اختر تاريخ الدفعة", "error");

    setAddingPayment(true);
    const { data, error } = await supabase
      .from("project_payments")
      .insert({
        client_id: clientId,
        amount,
        payment_date: paymentDate,
        note: paymentNote.trim() || null,
      })
      .select("id, client_id, amount, payment_date, note, created_at")
      .single();

    if (error || !data) {
      showMessage(`تعذر إضافة الدفعة: ${error?.message || "حدث خطأ"}`, "error");
      setAddingPayment(false);
      return;
    }

    const inserted = data as PaymentRecord;
    setPayments((current) => [inserted, ...current]);

    await logActivityClient({
      action: "create",
      entityType: "project_payments",
      entityId: inserted.id,
      description: `إضافة دفعة بقيمة ${formatMoney(amount)}`,
      newData: inserted,
    });

    await supabase.from("project_notifications").insert({
      client_id: clientId,
      title: "تم تسجيل دفعة جديدة",
      message: `تم تسجيل دفعة بقيمة ${formatMoney(amount)} بتاريخ ${formatDate(paymentDate)}.`,
      notification_type: "payment",
      is_read: false,
    });

    setPaymentAmount("");
    setPaymentNote("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    showMessage("تمت إضافة الدفعة وإشعار العميل ✅", "success");
    setAddingPayment(false);
  }

  async function addAddition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addingAddition) return;

    const amount = toNumber(additionAmount);
    if (!additionTitle.trim()) return showMessage("اكتب اسم الإضافة", "error");
    if (amount <= 0) return showMessage("أدخل قيمة الإضافة", "error");
    if (!additionDate) return showMessage("اختر تاريخ الإضافة", "error");

    setAddingAddition(true);
    const { data, error } = await supabase
      .from("project_additions")
      .insert({
        client_id: clientId,
        title: additionTitle.trim(),
        amount,
        addition_date: additionDate,
        note: additionNote.trim() || null,
      })
      .select("id, client_id, title, amount, addition_date, note, created_at")
      .single();

    if (error || !data) {
      showMessage(`تعذر إضافة البند: ${error?.message || "حدث خطأ"}`, "error");
      setAddingAddition(false);
      return;
    }

    const inserted = data as AdditionRecord;
    setAdditions((current) => [inserted, ...current]);

    await logActivityClient({
      action: "create",
      entityType: "project_additions",
      entityId: inserted.id,
      description: `إضافة بند بعد العقد: ${inserted.title} بقيمة ${formatMoney(amount)}`,
      newData: inserted,
    });

    await supabase.from("project_notifications").insert({
      client_id: clientId,
      title: "إضافة جديدة على العقد",
      message: `تم تسجيل إضافة جديدة: ${inserted.title} بقيمة ${formatMoney(amount)}.`,
      notification_type: "update",
      is_read: false,
    });

    setAdditionTitle("");
    setAdditionAmount("");
    setAdditionNote("");
    setAdditionDate(new Date().toISOString().slice(0, 10));
    showMessage("تمت إضافة البند وإشعار العميل ✅", "success");
    setAddingAddition(false);
  }

  async function deletePayment(payment: PaymentRecord) {
    if (deletingPaymentId !== null) return;
    if (!window.confirm(`حذف دفعة ${formatMoney(toNumber(payment.amount))}؟`)) return;

    setDeletingPaymentId(payment.id);
    const { error } = await supabase
      .from("project_payments")
      .delete()
      .eq("id", payment.id)
      .eq("client_id", clientId);

    if (error) showMessage(`تعذر حذف الدفعة: ${error.message}`, "error");
    else {
      setPayments((current) => current.filter((item) => item.id !== payment.id));
      showMessage("تم حذف الدفعة ✅", "success");
    }
    setDeletingPaymentId(null);
  }

  async function deleteAddition(addition: AdditionRecord) {
    if (deletingAdditionId !== null) return;
    if (!window.confirm(`حذف الإضافة «${addition.title}»؟`)) return;

    setDeletingAdditionId(addition.id);
    const { error } = await supabase
      .from("project_additions")
      .delete()
      .eq("id", addition.id)
      .eq("client_id", clientId);

    if (error) showMessage(`تعذر حذف الإضافة: ${error.message}`, "error");
    else {
      setAdditions((current) => current.filter((item) => item.id !== addition.id));
      showMessage("تم حذف الإضافة ✅", "success");
    }
    setDeletingAdditionId(null);
  }

  if (loading) {
    return (
      <main dir="rtl" className="grid min-h-screen place-items-center bg-[#f4f6f8] px-5">
        <div className="rounded-[2rem] bg-white px-8 py-7 font-black text-[#0b2239] shadow-xl">
          جاري تحميل الحساب...
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <main dir="rtl" className="grid min-h-screen place-items-center bg-[#f4f6f8] px-5">
        <div className="max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <p className="font-bold text-red-600">{message || "لم يتم العثور على المشروع"}</p>
          <Link href="/admin/clients" className="mt-5 inline-block rounded-2xl bg-[#0b2239] px-5 py-3 font-black text-white">
            رجوع إلى العملاء
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6f8] p-4 pb-12 text-[#0b2239] sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/admin/client/${client.id}`}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 shadow-sm"
          >
            ← رجوع إلى المشروع
          </Link>
          <span className="text-xs font-bold text-slate-400">الإدارة المالية · أزدان</span>
        </div>

        <section className="rounded-[2rem] bg-[#0b2239] p-5 text-white shadow-xl shadow-[#0b2239]/15 sm:p-7">
          <p className="text-xs font-black text-[#d8b56a]">الحساب والدفعات</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">{client.project_name}</h1>
          <p className="mt-2 text-sm text-slate-300">العميل: {client.name}</p>
        </section>

        {message && (
          <div
            className={`mt-4 rounded-2xl border p-4 text-sm font-bold ${
              messageType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["قيمة العقد", contractAmountNumber, "text-[#0b2239]"],
            ["الإضافات", totalAdditions, "text-[#b58b36]"],
            ["إجمالي المستحق", totalDue, "text-[#0b2239]"],
            ["المدفوع", totalPaid, "text-emerald-600"],
            ["المتبقي", remainingAmount, "text-amber-600"],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-400">{String(label)}</p>
              <p className={`mt-2 text-lg font-black ${String(color)}`}>{formatMoney(Number(value))}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">نسبة تسديد المستحق</p>
              <p className="mt-1 text-xs text-slate-400">تُحسب من قيمة العقد + الإضافات</p>
            </div>
            <span className="text-xl font-black text-[#d8b56a]">{paymentPercentage}%</span>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[#d8b56a]" style={{ width: `${paymentPercentage}%` }} />
          </div>
          {overpaidAmount > 0 && (
            <p className="mt-3 text-xs font-black text-violet-600">زيادة مدفوعة: {formatMoney(overpaidAmount)}</p>
          )}
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-[#d8b56a]">دفعات العميل</p>
                <h2 className="mt-1 text-xl font-black">إضافة دفعة</h2>
              </div>
              <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">+ دفعة</span>
            </div>
            <form onSubmit={addPayment} className="mt-5 space-y-4">
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="مبلغ الدفعة"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 outline-none focus:border-[#d8b56a]"
              />
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 outline-none focus:border-[#d8b56a]"
              />
              <input
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="ملاحظة، مثلاً: الدفعة الثانية"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 outline-none focus:border-[#d8b56a]"
              />
              <button
                type="submit"
                disabled={addingPayment}
                className="w-full rounded-2xl bg-[#0b2239] py-3.5 font-black text-white disabled:opacity-50"
              >
                {addingPayment ? "جاري الإضافة..." : "إضافة الدفعة"}
              </button>
            </form>
          </section>

          <section className="rounded-[2rem] border border-[#d8b56a]/25 bg-[#fffdf8] p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-[#b58b36]">بعد توقيع العقد</p>
                <h2 className="mt-1 text-xl font-black">إضافة بند جديد</h2>
                <p className="mt-1 text-xs text-slate-500">أي عمل أو مادة جديدة لم تكن ضمن العقد الأصلي.</p>
              </div>
              <span className="rounded-xl bg-[#d8b56a]/15 px-3 py-1.5 text-xs font-black text-[#8f6b25]">+ إضافة</span>
            </div>
            <form onSubmit={addAddition} className="mt-5 space-y-4">
              <input
                value={additionTitle}
                onChange={(e) => setAdditionTitle(e.target.value)}
                placeholder="اسم الإضافة، مثلاً: صب مظلة إضافية"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:border-[#d8b56a]"
              />
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={additionAmount}
                onChange={(e) => setAdditionAmount(e.target.value)}
                placeholder="قيمة الإضافة"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:border-[#d8b56a]"
              />
              <input
                type="date"
                value={additionDate}
                onChange={(e) => setAdditionDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:border-[#d8b56a]"
              />
              <input
                value={additionNote}
                onChange={(e) => setAdditionNote(e.target.value)}
                placeholder="ملاحظة اختيارية"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:border-[#d8b56a]"
              />
              <button
                type="submit"
                disabled={addingAddition}
                className="w-full rounded-2xl bg-[#d8b56a] py-3.5 font-black text-[#0b2239] disabled:opacity-50"
              >
                {addingAddition ? "جاري الإضافة..." : "تسجيل الإضافة"}
              </button>
            </form>
          </section>
        </div>

        <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#d8b56a]">الإضافات بعد العقد</p>
              <h2 className="mt-1 text-xl font-black">سجل الإضافات</h2>
            </div>
            <span className="text-sm font-black text-[#b58b36]">{formatMoney(totalAdditions)}</span>
          </div>
          {additions.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">لا توجد إضافات على العقد.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {additions.map((addition) => (
                <div key={addition.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black">{addition.title}</p>
                    <p className="mt-1 text-sm font-black text-[#b58b36]">{formatMoney(toNumber(addition.amount))}</p>
                    {addition.note && <p className="mt-1 text-xs text-slate-500">{addition.note}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400">{formatDate(addition.addition_date)}</span>
                    <button
                      type="button"
                      onClick={() => deleteAddition(addition)}
                      disabled={deletingAdditionId !== null}
                      className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600 disabled:opacity-50"
                    >
                      {deletingAdditionId === addition.id ? "..." : "حذف"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-emerald-600">الدفعات</p>
              <h2 className="mt-1 text-xl font-black">سجل الدفعات</h2>
            </div>
            <span className="text-sm font-black text-emerald-600">{formatMoney(totalPaid)}</span>
          </div>
          {payments.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">لا توجد دفعات مسجلة.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black text-emerald-700">{formatMoney(toNumber(payment.amount))}</p>
                    <p className="mt-1 text-xs text-slate-500">{payment.note || "دفعة مشروع"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400">{formatDate(payment.payment_date)}</span>
                    <button
                      type="button"
                      onClick={() => deletePayment(payment)}
                      disabled={deletingPaymentId !== null}
                      className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600 disabled:opacity-50"
                    >
                      {deletingPaymentId === payment.id ? "..." : "حذف"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <details className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
          <summary className="cursor-pointer font-black">إعدادات العقد</summary>
          <form onSubmit={saveFinance} className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-black">قيمة العقد الأصلية</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={contractAmount}
                onChange={(e) => setContractAmount(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 outline-none focus:border-[#d8b56a]"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-black">العملة</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none focus:border-[#d8b56a]"
              >
                <option value="IQD">الدينار العراقي — IQD</option>
                <option value="USD">الدولار الأمريكي — USD</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-black">ملاحظات العقد</label>
              <textarea
                rows={3}
                value={financeNotes}
                onChange={(e) => setFinanceNotes(e.target.value)}
                className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3.5 outline-none focus:border-[#d8b56a]"
              />
            </div>
            <button type="submit" disabled={savingFinance} className="md:col-span-2 rounded-2xl bg-[#0b2239] py-3.5 font-black text-white disabled:opacity-50">
              {savingFinance ? "جاري الحفظ..." : "حفظ إعدادات العقد"}
            </button>
          </form>
        </details>
      </div>
    </main>
  );
}
