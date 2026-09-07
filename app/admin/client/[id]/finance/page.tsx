"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { logActivityClient } from "@/lib/log-activity-client";

type Client = {
  id: number;
  name: string;
  phone: string | null;
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

  async function sendAutomaticNotification(
    title: string,
    message: string,
    notificationType:
      | "general"
      | "payment"
      | "addition"
      | "file"
      | "image"
      | "stage_update"
      | "stage_complete" = "general",
    meta?: {
      entityType?: string;
      entityId?: number;
      targetPath?: string;
    }
  ) {
    try {
      const response = await fetch(`/api/admin/client/${clientId}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          notificationType,
          entityType: meta?.entityType,
          entityId: meta?.entityId,
          targetPath: meta?.targetPath,
        }),
      });
      return response.ok;
    } catch (error) {
      console.error("تعذر إرسال الإشعار التلقائي:", error);
      return false;
    }
  }

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

  function escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function numberToArabicWords(value: number) {
    const n = Math.round(Math.abs(value));
    if (n === 0) return "صفر";

    const ones = [
      "", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة",
      "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
    ];
    const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
    const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

    function under1000(num: number) {
      const parts: string[] = [];
      const h = Math.floor(num / 100);
      const r = num % 100;
      if (h) parts.push(hundreds[h]);
      if (r) {
        if (r < 20) parts.push(ones[r]);
        else {
          const u = r % 10;
          const t = Math.floor(r / 10);
          parts.push(u ? `${ones[u]} و${tens[t]}` : tens[t]);
        }
      }
      return parts.join(" و");
    }

    const groups = [
      { value: 1_000_000_000_000, one: "تريليون", two: "تريليونان", few: "تريليونات", many: "تريليون" },
      { value: 1_000_000_000, one: "مليار", two: "ملياران", few: "مليارات", many: "مليار" },
      { value: 1_000_000, one: "مليون", two: "مليونان", few: "ملايين", many: "مليون" },
      { value: 1_000, one: "ألف", two: "ألفان", few: "آلاف", many: "ألف" },
    ];

    let remaining = n;
    const result: string[] = [];
    for (const group of groups) {
      const count = Math.floor(remaining / group.value);
      if (!count) continue;
      if (count === 1) result.push(group.one);
      else if (count === 2) result.push(group.two);
      else if (count >= 3 && count <= 10) result.push(`${under1000(count)} ${group.few}`);
      else result.push(`${under1000(count)} ${group.many}`);
      remaining %= group.value;
    }
    if (remaining) result.push(under1000(remaining));
    return result.join(" و");
  }

  function printFinanceDocument(options: {
    kind: "payment" | "addition";
    id: number;
    amount: number;
    date: string;
    title: string;
    note?: string | null;
  }) {
    if (!client) return;

    const popup = window.open("", "_blank", "width=900,height=1000");
    if (!popup) {
      showMessage("اسمح للنوافذ المنبثقة حتى نطبع السند", "error");
      return;
    }

    const isPayment = options.kind === "payment";
    const documentTitle = isPayment ? "سند قبض" : "أمر تغيير وأعمال إضافية";
    const serial = `${isPayment ? "RCPT" : "VO"}-${clientId}-${String(options.id).padStart(4, "0")}`;
    const safeClient = escapeHtml(client.name);
    const safePhone = escapeHtml(client.phone || "غير مسجل");
    const safeProject = escapeHtml(client.project_name);
    const safeTitle = escapeHtml(options.title);
    const safeNote = escapeHtml(options.note || "—");
    const logoUrl = `${window.location.origin}/azdan-logo-black.png`;
    const amountWords = escapeHtml(`${numberToArabicWords(options.amount)} ${currency === "IQD" ? "دينار عراقي" : currency} فقط لا غير`);

    const paymentTotalToDate = payments
      .filter((item) => item.payment_date < options.date || (item.payment_date === options.date && item.id <= options.id))
      .reduce((sum, item) => sum + toNumber(item.amount), 0);

    const additionsBefore = additions
      .filter((item) => item.id !== options.id && (item.addition_date < options.date || (item.addition_date === options.date && item.id < options.id)))
      .reduce((sum, item) => sum + toNumber(item.amount), 0);

    const totalAdditionsThroughThis = isPayment
      ? totalAdditions
      : additionsBefore + options.amount;
    const documentTotalDue = contractAmountNumber + totalAdditionsThroughThis;
    const detailSection = isPayment
      ? `
        <section class="summary-grid">
          <div class="summary"><span>قيمة العقد + الإضافات</span><strong>${escapeHtml(formatMoney(totalDue))}</strong></div>
          <div class="summary"><span>إجمالي المدفوع حتى هذا السند</span><strong>${escapeHtml(formatMoney(paymentTotalToDate))}</strong></div>
          <div class="summary emphasis"><span>الرصيد المتبقي</span><strong>${escapeHtml(formatMoney(Math.max(totalDue - paymentTotalToDate, 0)))}</strong></div>
        </section>`
      : `
        <section class="summary-grid">
          <div class="summary"><span>قيمة العقد الأصلي</span><strong>${escapeHtml(formatMoney(contractAmountNumber))}</strong></div>
          <div class="summary"><span>الإضافات السابقة</span><strong>${escapeHtml(formatMoney(additionsBefore))}</strong></div>
          <div class="summary"><span>قيمة هذه الإضافة</span><strong>${escapeHtml(formatMoney(options.amount))}</strong></div>
          <div class="summary emphasis"><span>إجمالي العقد بعد الإضافة</span><strong>${escapeHtml(formatMoney(documentTotalDue))}</strong></div>
        </section>
        <div class="agreement">يقر الطرفان بأن الأعمال المبينة في هذا المستند تعد أعمالاً إضافية خارج نطاق العقد الأصلي، وتضاف قيمتها إلى إجمالي مستحقات المشروع بعد موافقة الطرفين.</div>`;

    popup.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${documentTitle} - ${serial}</title>
<style>
  @page { size: A4 portrait; margin: 6mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #eef2f5; color: #111827; }
  body { font-family: Tahoma, Arial, sans-serif; padding: 12px; }
  .sheet { width: 198mm; min-height: 285mm; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; padding: 7mm 10mm 10mm; position: relative; }
  .header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; padding-bottom: 8px; border-bottom: 2px solid #111827; }
  .brand-text { text-align: right; }
  .brand-text .ar { font-size: 16px; font-weight: 900; color: #111827; }
  .brand-text .en { margin-top: 2px; font-size: 8px; letter-spacing: 1.2px; color: #6b7280; }
  .logo { width: 22mm; height: 22mm; object-fit: contain; display: block; }
  .doc-meta { text-align: left; font-size: 10px; color: #4b5563; line-height: 1.55; }
  .doc-title { text-align: center; margin: 7mm 0 5mm; }
  .doc-title h1 { margin: 0; font-size: 23px; font-weight: 900; color: #0b2239; }
  .doc-title .gold-line { width: 30mm; height: 2px; background: #d8b56a; margin: 6px auto 0; }
  .info { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #d1d5db; break-inside: avoid; }
  .field { min-height: 14mm; padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  .field:nth-child(odd) { border-left: 1px solid #e5e7eb; }
  .field .label { font-size: 9px; color: #6b7280; margin-bottom: 3px; }
  .field .value { font-size: 13px; font-weight: 800; color: #111827; }
  .amount-box { margin-top: 4.5mm; border: 1.5px solid #d8b56a; padding: 4mm; text-align: center; break-inside: avoid; }
  .amount-box .label { font-size: 10px; color: #6b7280; }
  .amount-box .amount { margin-top: 3px; font-size: 23px; font-weight: 900; color: #0b2239; }
  .amount-box .words { margin-top: 4px; font-size: 10.5px; font-weight: 700; color: #374151; }
  .description { margin-top: 4.5mm; border: 1px solid #d1d5db; min-height: 23mm; padding: 3.5mm 4mm; break-inside: avoid; }
  .description .label { font-size: 9px; color: #6b7280; }
  .description .title { margin-top: 3px; font-size: 14px; font-weight: 900; }
  .description .note { margin-top: 5px; font-size: 10.5px; color: #4b5563; line-height: 1.55; }
  .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 4.5mm; break-inside: avoid; }
  .summary { border: 1px solid #d1d5db; padding: 7px 10px; min-height: 14mm; }
  .summary span { display: block; font-size: 9px; color: #6b7280; }
  .summary strong { display: block; margin-top: 3px; font-size: 12.5px; color: #111827; }
  .summary.emphasis { background: #fff9eb; border-color: #d8b56a; }
  .agreement { margin-top: 4mm; padding: 2.5mm 4mm; border-right: 3px solid #d8b56a; background: #fafafa; font-size: 9.8px; line-height: 1.55; color: #374151; break-inside: avoid; }
  .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10mm; margin-top: 8mm; text-align: center; font-size: 10px; font-weight: 800; break-inside: avoid; }
  .signature { padding-top: 8mm; border-top: 1px solid #6b7280; }
  .footer { position: absolute; right: 10mm; left: 10mm; bottom: 5mm; border-top: 1px solid #e5e7eb; padding-top: 4px; display: flex; justify-content: space-between; gap: 10px; font-size: 7.5px; color: #9ca3af; }
  .no-print { text-align: center; margin-bottom: 8px; }
  .no-print button { border: 0; border-radius: 10px; padding: 8px 14px; background: #0b2239; color: #fff; font-weight: 800; cursor: pointer; }
  @media print {
    html, body { width: 210mm; min-height: 297mm; background: #fff; }
    body { padding: 0; }
    .sheet { width: 198mm; min-height: 285mm; margin: 0 auto; border: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="no-print"><button onclick="window.print()">طباعة A4</button></div>
<main class="sheet">
  <header class="header">
    <div class="brand-text">
      <div class="ar">أزدان للمقاولات العامة</div>
      <div class="en">AZDAN GENERAL CONTRACTING</div>
    </div>
    <img class="logo" src="${logoUrl}" alt="شعار أزدان" />
    <div class="doc-meta">
      <div><strong>رقم المستند:</strong> ${serial}</div>
      <div><strong>التاريخ:</strong> ${escapeHtml(formatDate(options.date))}</div>
    </div>
  </header>

  <section class="doc-title">
    <h1>${documentTitle}</h1>
    <div class="gold-line"></div>
  </section>

  <section class="info">
    <div class="field"><div class="label">اسم العميل</div><div class="value">${safeClient}</div></div>
    <div class="field"><div class="label">رقم الهاتف</div><div class="value">${safePhone}</div></div>
    <div class="field"><div class="label">اسم المشروع</div><div class="value">${safeProject}</div></div>
    <div class="field"><div class="label">رقم المشروع</div><div class="value">AZ-${clientId}</div></div>
  </section>

  <section class="amount-box">
    <div class="label">${isPayment ? "استلمنا مبلغاً قدره" : "قيمة الأعمال الإضافية"}</div>
    <div class="amount">${escapeHtml(formatMoney(options.amount))}</div>
    <div class="words">المبلغ كتابةً: ${amountWords}</div>
  </section>

  <section class="description">
    <div class="label">${isPayment ? "وذلك عن" : "وصف العمل الإضافي"}</div>
    <div class="title">${safeTitle}</div>
    <div class="note"><strong>ملاحظات:</strong> ${safeNote}</div>
  </section>

  ${detailSection}

  <section class="signatures">
    <div class="signature">توقيع العميل</div>
    <div class="signature">المستلم / ممثل أزدان</div>
    <div class="signature">ختم أزدان</div>
  </section>

  <footer class="footer">
    <span>أزدان للمقاولات العامة</span>
    <span>نسخة إلكترونية صادرة من نظام متابعة المشاريع</span>
  </footer>
</main>
<script>
  window.addEventListener('load', function () {
    setTimeout(function () { window.print(); }, 450);
  });
</script>
</body>
</html>`);
    popup.document.close();
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
      supabase.from("clients").select("id, name, phone, project_name").eq("id", clientId).single(),
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

    await sendAutomaticNotification(
      "تحديث الحساب المالي",
      `تم تحديث معلومات العقد. قيمة العقد الحالية ${formatMoney(contractAmountNumber, payload.currency)}.`,
      "addition",
      {
        entityType: "project_addition",
        entityId: inserted.id,
        targetPath: `/finance?additionId=${inserted.id}`,
      }
    );

    showMessage("تم حفظ معلومات العقد وإشعار العميل ✅", "success");
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

    await sendAutomaticNotification(
      "تم تسجيل دفعة جديدة",
      `تم تسجيل دفعة بقيمة ${formatMoney(amount)} بتاريخ ${formatDate(paymentDate)}.`,
      "payment",
      {
        entityType: "project_payment",
        entityId: inserted.id,
        targetPath: `/finance?paymentId=${inserted.id}`,
      }
    );

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

    await sendAutomaticNotification(
      "إضافة جديدة على العقد",
      `تم تسجيل إضافة جديدة: ${inserted.title} بقيمة ${formatMoney(amount)}.`,
      "update"
    );

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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">{formatDate(addition.addition_date)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        printFinanceDocument({
                          kind: "addition",
                          id: addition.id,
                          amount: toNumber(addition.amount),
                          date: addition.addition_date,
                          title: addition.title,
                          note: addition.note,
                        })
                      }
                      className="rounded-xl bg-[#fff7e2] px-3 py-2 text-xs font-black text-[#8f6b25]"
                    >
                      أمر تغيير
                    </button>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">{formatDate(payment.payment_date)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        printFinanceDocument({
                          kind: "payment",
                          id: payment.id,
                          amount: toNumber(payment.amount),
                          date: payment.payment_date,
                          title: payment.note || "دفعة مشروع",
                          note: payment.note,
                        })
                      }
                      className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"
                    >
                      سند قبض
                    </button>
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
