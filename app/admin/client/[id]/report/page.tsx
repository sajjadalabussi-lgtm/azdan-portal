"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { QRCodeSVG } from "qrcode.react";

type Client = {
  id: number;
  name: string;
  phone: string | null;
  project_name: string;
  progress: number;
  status: string;
};

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
  created_at: string;
};

type UpdateRecord = {
  id: number;
  title: string;
  description: string | null;
  progress: number;
  created_at: string;
};

type FileRecord = {
  id: number;
  title: string;
  category: string;
  file_name: string;
  created_at: string;
};

type ImageRecord = {
  id: number;
  update_id: number | null;
  storage_path: string;
  description: string | null;
  created_at: string;
};

type ReportImage = ImageRecord & {
  publicUrl: string;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampProgress(value: number) {
  return Math.min(Math.max(Number(value) || 0, 0), 100);
}

function formatDate(date: string) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "التاريخ غير متوفر";
  }

  return new Intl.DateTimeFormat("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

function getCategoryLabel(category: string) {
  const categories: Record<string, string> = {
    contract: "العقد",
    drawing: "المخططات",
    boq: "جدول الكميات BOQ",
    invoice: "الفواتير",
    report: "التقارير",
    document: "المستندات",
    other: "أخرى",
  };

  return categories[category] || "أخرى";
}

export default function ProjectReportPage() {
  const params = useParams();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [finance, setFinance] = useState<FinanceRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [updates, setUpdates] = useState<UpdateRecord[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [images, setImages] = useState<ReportImage[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [logoFailed, setLogoFailed] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState("");

  useEffect(() => {
    setSiteOrigin(window.location.origin);

    async function loadReportData() {
      if (!Number.isFinite(clientId) || clientId <= 0) {
        setMessage("رقم العميل غير صحيح");
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage("");

      const [
        clientResult,
        financeResult,
        paymentsResult,
        updatesResult,
        filesResult,
        imagesResult,
      ] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, phone, project_name, progress, status")
          .eq("id", clientId)
          .single(),

        supabase
          .from("project_finances")
          .select("contract_amount, currency, notes")
          .eq("client_id", clientId)
          .maybeSingle(),

        supabase
          .from("project_payments")
          .select("id, amount, payment_date, note, created_at")
          .eq("client_id", clientId)
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false }),

        supabase
          .from("project_updates")
          .select("id, title, description, progress, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),

        supabase
          .from("project_files")
          .select("id, title, category, file_name, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),

        supabase
          .from("project_images")
          .select(
            "id, update_id, storage_path, description, created_at"
          )
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
      ]);

      if (clientResult.error || !clientResult.data) {
        console.error(clientResult.error);
        setMessage(
          `تعذر تحميل بيانات العميل: ${
            clientResult.error?.message || "العميل غير موجود"
          }`
        );
        setLoading(false);
        return;
      }

      const firstError =
        financeResult.error ||
        paymentsResult.error ||
        updatesResult.error ||
        filesResult.error ||
        imagesResult.error;

      if (firstError) {
        console.error(firstError);
        setMessage(`تعذر تحميل بيانات التقرير: ${firstError.message}`);
        setLoading(false);
        return;
      }

      const preparedImages: ReportImage[] = (
        (imagesResult.data as ImageRecord[] | null) ?? []
      ).map((image) => {
        const { data } = supabase.storage
          .from("project-images")
          .getPublicUrl(image.storage_path);

        return {
          ...image,
          publicUrl: data.publicUrl,
        };
      });

      setClient(clientResult.data as Client);
      setFinance(financeResult.data as FinanceRecord | null);
      setPayments((paymentsResult.data as PaymentRecord[] | null) ?? []);
      setUpdates((updatesResult.data as UpdateRecord[] | null) ?? []);
      setFiles((filesResult.data as FileRecord[] | null) ?? []);
      setImages(preparedImages);
      setLoading(false);
    }

    loadReportData();
  }, [clientId]);

  const contractAmount = toNumber(finance?.contract_amount);

  const totalPaid = useMemo(
    () =>
      payments.reduce(
        (total, payment) => total + toNumber(payment.amount),
        0
      ),
    [payments]
  );

  const remainingAmount = Math.max(contractAmount - totalPaid, 0);
  const overpaidAmount = Math.max(totalPaid - contractAmount, 0);

  const paymentPercentage =
    contractAmount > 0
      ? Math.min(Math.round((totalPaid / contractAmount) * 100), 100)
      : 0;

  const latestImages = images.slice(0, 12);

  function formatMoney(value: number) {
    const formatted = new Intl.NumberFormat("ar-IQ", {
      maximumFractionDigits: 2,
    }).format(value);

    const currency = finance?.currency || "IQD";

    if (currency === "IQD") return `${formatted} د.ع`;
    if (currency === "USD") return `${formatted} $`;

    return `${formatted} ${currency}`;
  }

  function printReport() {
    window.print();
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-gray-100"
      >
        <p className="text-gray-600">جاري تجهيز تقرير المشروع...</p>
      </main>
    );
  }

  if (!client) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-gray-100 px-5"
      >
        <div className="text-center">
          <p className="text-red-600">
            {message || "لم يتم العثور على المشروع"}
          </p>

          <Link
            href="/admin/clients"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-3 text-white"
          >
            رجوع للعملاء
          </Link>
        </div>
      </main>
    );
  }

  const safeProgress = clampProgress(client.progress);
  const portalUrl = siteOrigin
    ? `${siteOrigin}/client-portal/${client.id}`
    : `/client-portal/${client.id}`;

  const reportDate = new Intl.DateTimeFormat("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-100 px-4 py-8 text-gray-900 print:bg-white print:px-0 print:py-0"
    >
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          html,
          body {
            background: white !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .no-print {
            display: none !important;
          }

          .report-shell {
            max-width: none !important;
          }

          .report-card {
            box-shadow: none !important;
          }

          .cover-page {
            min-height: 270mm;
            display: flex !important;
            break-after: page;
            page-break-after: always;
          }

          .watermark {
            display: block !important;
            position: fixed !important;
            top: 38%;
            left: 50%;
            width: 310px;
            transform: translate(-50%, -50%) rotate(-18deg);
            opacity: 0.035;
            pointer-events: none;
            z-index: 0;
          }

          .report-content {
            position: relative;
            z-index: 1;
          }

          .page-number::after {
            content: counter(page);
          }

          .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .page-break {
            break-before: page;
            page-break-before: always;
          }

          thead {
            display: table-header-group;
          }

          tr,
          img {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .report-footer {
            position: fixed;
            right: 0;
            bottom: -7mm;
            left: 0;
            font-size: 9px;
            color: #64748b;
            text-align: center;
          }
        }
      `}</style>

      <div className="report-shell mx-auto max-w-5xl">
        <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/admin/client/${client.id}`}
            className="rounded-xl bg-white px-5 py-3 text-center font-bold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            رجوع للمشروع
          </Link>

          <button
            type="button"
            onClick={printReport}
            className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white shadow-sm hover:bg-blue-800"
          >
            طباعة / حفظ PDF
          </button>
        </div>

        {message && (
          <p className="no-print mb-6 rounded-xl bg-red-50 p-4 text-red-700">
            {message}
          </p>
        )}

        <section className="report-card relative overflow-hidden rounded-3xl bg-white shadow-xl print:rounded-none">
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            className="watermark hidden"
          />

          <section className="cover-page hidden flex-col items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 px-10 text-center text-white print:flex">
            {!logoFailed ? (
              <img
                src="/logo.png"
                alt="شعار أزدان"
                className="h-40 w-40 rounded-3xl bg-white object-contain p-4 shadow-2xl"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-3xl bg-white text-7xl font-black text-blue-900">
                أ
              </div>
            )}

            <p className="mt-10 text-lg font-bold text-blue-200">
              أزدان للمقاولات العامة
            </p>

            <h1 className="mt-5 text-5xl font-black leading-tight">
              تقرير متابعة المشروع
            </h1>

            <div className="mt-12 w-full max-w-2xl rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur">
              <p className="text-sm text-blue-200">المشروع</p>
              <p className="mt-3 text-3xl font-black">{client.project_name}</p>

              <div className="mt-8 grid grid-cols-2 gap-5 text-right">
                <div>
                  <p className="text-sm text-blue-200">العميل</p>
                  <p className="mt-2 text-xl font-bold">{client.name}</p>
                </div>

                <div>
                  <p className="text-sm text-blue-200">تاريخ التقرير</p>
                  <p className="mt-2 text-xl font-bold">{reportDate}</p>
                </div>
              </div>
            </div>

            <div className="mt-12 rounded-2xl bg-white p-3">
              <QRCodeSVG
                value={portalUrl}
                size={120}
                level="H"
                includeMargin
              />
            </div>

            <p className="mt-4 text-sm text-blue-200">
              امسح الرمز لفتح بوابة العميل
            </p>
          </section>

          <div className="report-content">
          <header className="bg-gradient-to-l from-blue-900 to-blue-700 px-6 py-8 text-white sm:px-10">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <div className="flex items-center gap-4">
                {!logoFailed ? (
                  <img
                    src="/logo.png"
                    alt="شعار أزدان"
                    className="h-20 w-20 rounded-2xl bg-white object-contain p-2"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-4xl font-black text-blue-800">
                    أ
                  </div>
                )}

                <div>
                  <h1 className="text-2xl font-black sm:text-3xl">
                    أزدان للمقاولات العامة
                  </h1>

                  <p className="mt-2 text-sm text-blue-100">
                    تقرير متابعة وتنفيذ المشروع
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-5 py-4 text-center backdrop-blur">
                <p className="text-xs text-blue-100">تاريخ التقرير</p>
                <p className="mt-1 font-bold">{reportDate}</p>
              </div>
            </div>
          </header>

          <div className="p-6 sm:p-10">
            <section className="avoid-break">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <p className="text-sm text-gray-500">اسم العميل</p>
                  <p className="mt-2 text-xl font-black">{client.name}</p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <p className="text-sm text-gray-500">اسم المشروع</p>
                  <p className="mt-2 text-xl font-black">
                    {client.project_name}
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <p className="text-sm text-gray-500">رقم التواصل</p>
                  <p className="mt-2 text-xl font-black">
                    {client.phone || "غير مسجل"}
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <p className="text-sm text-gray-500">حالة المشروع</p>
                  <p className="mt-2 text-xl font-black text-green-700">
                    {client.status}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-blue-950">
                      نسبة إنجاز المشروع
                    </p>
                    <p className="mt-1 text-sm text-blue-700">
                      النسبة الحالية المسجلة في النظام
                    </p>
                  </div>

                  <p className="text-4xl font-black text-blue-700">
                    {safeProgress}%
                  </p>
                </div>

                <div className="mt-5 h-4 overflow-hidden rounded-full bg-blue-100">
                  <div
                    className="h-full rounded-full bg-blue-700"
                    style={{ width: `${safeProgress}%` }}
                  />
                </div>
              </div>
            </section>

            <section className="mt-10">
              <h2 className="border-b-2 border-blue-700 pb-3 text-2xl font-black text-blue-950">
                الملخص المالي
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="avoid-break rounded-2xl border border-blue-100 bg-blue-50 p-5">
                  <p className="text-sm text-blue-700">قيمة العقد</p>
                  <p className="mt-2 font-black text-blue-950">
                    {formatMoney(contractAmount)}
                  </p>
                </div>

                <div className="avoid-break rounded-2xl border border-green-100 bg-green-50 p-5">
                  <p className="text-sm text-green-700">إجمالي المدفوع</p>
                  <p className="mt-2 font-black text-green-950">
                    {formatMoney(totalPaid)}
                  </p>
                </div>

                <div className="avoid-break rounded-2xl border border-amber-100 bg-amber-50 p-5">
                  <p className="text-sm text-amber-700">المبلغ المتبقي</p>
                  <p className="mt-2 font-black text-amber-950">
                    {formatMoney(remainingAmount)}
                  </p>
                </div>

                <div className="avoid-break rounded-2xl border border-purple-100 bg-purple-50 p-5">
                  <p className="text-sm text-purple-700">نسبة الدفع</p>
                  <p className="mt-2 text-2xl font-black text-purple-950">
                    {paymentPercentage}%
                  </p>
                </div>
              </div>

              {overpaidAmount > 0 && (
                <p className="avoid-break mt-4 rounded-xl bg-purple-50 p-4 font-bold text-purple-700">
                  توجد زيادة مدفوعة مقدارها:{" "}
                  {formatMoney(overpaidAmount)}
                </p>
              )}

              {finance?.notes && (
                <div className="avoid-break mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <p className="font-black">ملاحظات الحساب</p>
                  <p className="mt-2 whitespace-pre-line leading-7 text-gray-600">
                    {finance.notes}
                  </p>
                </div>
              )}
            </section>

            <section className="mt-10">
              <div className="flex items-end justify-between border-b-2 border-blue-700 pb-3">
                <h2 className="text-2xl font-black text-blue-950">
                  سجل الدفعات
                </h2>

                <span className="text-sm text-gray-500">
                  عدد الدفعات: {payments.length}
                </span>
              </div>

              {payments.length === 0 ? (
                <p className="mt-5 rounded-xl bg-gray-50 p-6 text-center text-gray-500">
                  لا توجد دفعات مسجلة
                </p>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse">
                    <thead>
                      <tr className="bg-blue-900 text-right text-white">
                        <th className="border border-blue-800 p-3">
                          التاريخ
                        </th>
                        <th className="border border-blue-800 p-3">
                          المبلغ
                        </th>
                        <th className="border border-blue-800 p-3">
                          الملاحظة
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="odd:bg-gray-50">
                          <td className="border border-gray-200 p-3">
                            {formatDate(payment.payment_date)}
                          </td>
                          <td className="border border-gray-200 p-3 font-bold text-green-700">
                            {formatMoney(toNumber(payment.amount))}
                          </td>
                          <td className="border border-gray-200 p-3">
                            {payment.note || "لا توجد ملاحظة"}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot>
                      <tr className="bg-green-50 font-black">
                        <td className="border border-gray-200 p-3">
                          الإجمالي
                        </td>
                        <td className="border border-gray-200 p-3 text-green-800">
                          {formatMoney(totalPaid)}
                        </td>
                        <td className="border border-gray-200 p-3" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            <section className="page-break mt-10">
              <div className="flex items-end justify-between border-b-2 border-blue-700 pb-3">
                <h2 className="text-2xl font-black text-blue-950">
                  تحديثات المشروع
                </h2>

                <span className="text-sm text-gray-500">
                  عدد التحديثات: {updates.length}
                </span>
              </div>

              {updates.length === 0 ? (
                <p className="mt-5 rounded-xl bg-gray-50 p-6 text-center text-gray-500">
                  لا توجد تحديثات مسجلة
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  {updates.map((update, index) => (
                    <article
                      key={update.id}
                      className="avoid-break rounded-2xl border border-gray-200 bg-white p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-700 font-black text-white">
                            {updates.length - index}
                          </span>

                          <h3 className="text-lg font-black">
                            {update.title}
                          </h3>
                        </div>

                        <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                          الإنجاز: {clampProgress(update.progress)}%
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-gray-500">
                        {formatDate(update.created_at)}
                      </p>

                      {update.description && (
                        <p className="mt-3 whitespace-pre-line leading-7 text-gray-700">
                          {update.description}
                        </p>
                      )}

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-blue-700"
                          style={{
                            width: `${clampProgress(update.progress)}%`,
                          }}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10">
              <div className="flex items-end justify-between border-b-2 border-blue-700 pb-3">
                <h2 className="text-2xl font-black text-blue-950">
                  صور المشروع
                </h2>

                <span className="text-sm text-gray-500">
                  إجمالي الصور: {images.length}
                </span>
              </div>

              {latestImages.length === 0 ? (
                <p className="mt-5 rounded-xl bg-gray-50 p-6 text-center text-gray-500">
                  لا توجد صور مرفوعة للمشروع
                </p>
              ) : (
                <>
                  <p className="mt-4 text-sm text-gray-500">
                    يعرض التقرير أحدث {latestImages.length} صورة من المشروع.
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {latestImages.map((image) => (
                      <figure
                        key={image.id}
                        className="avoid-break overflow-hidden rounded-2xl border border-gray-200 bg-gray-50"
                      >
                        <img
                          src={image.publicUrl}
                          alt={
                            image.description ||
                            "صورة من مراحل تنفيذ المشروع"
                          }
                          className="h-44 w-full object-cover"
                        />

                        <figcaption className="p-3">
                          <p className="line-clamp-2 text-sm font-bold">
                            {image.description ||
                              "صورة من مراحل تنفيذ المشروع"}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {formatDate(image.created_at)}
                          </p>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section className="mt-10">
              <div className="flex items-end justify-between border-b-2 border-blue-700 pb-3">
                <h2 className="text-2xl font-black text-blue-950">
                  ملفات المشروع
                </h2>

                <span className="text-sm text-gray-500">
                  عدد الملفات: {files.length}
                </span>
              </div>

              {files.length === 0 ? (
                <p className="mt-5 rounded-xl bg-gray-50 p-6 text-center text-gray-500">
                  لا توجد ملفات مرفوعة للمشروع
                </p>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[680px] border-collapse">
                    <thead>
                      <tr className="bg-blue-900 text-right text-white">
                        <th className="border border-blue-800 p-3">
                          العنوان
                        </th>
                        <th className="border border-blue-800 p-3">
                          التصنيف
                        </th>
                        <th className="border border-blue-800 p-3">
                          اسم الملف
                        </th>
                        <th className="border border-blue-800 p-3">
                          التاريخ
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {files.map((file) => (
                        <tr key={file.id} className="odd:bg-gray-50">
                          <td className="border border-gray-200 p-3 font-bold">
                            {file.title}
                          </td>
                          <td className="border border-gray-200 p-3">
                            {getCategoryLabel(file.category)}
                          </td>
                          <td className="border border-gray-200 p-3">
                            {file.file_name}
                          </td>
                          <td className="border border-gray-200 p-3">
                            {formatDate(file.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="avoid-break mt-12 rounded-3xl border border-blue-100 bg-blue-50 p-6">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-blue-950">
                    بوابة العميل الإلكترونية
                  </h2>

                  <p className="mt-2 max-w-xl leading-7 text-blue-800">
                    يمكن للعميل مسح رمز QR لعرض آخر تحديثات المشروع والصور
                    والملفات والإشعارات من خلال بوابة المشروع.
                  </p>

                  <p className="mt-3 break-all text-sm font-bold text-blue-700">
                    {portalUrl}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <QRCodeSVG
                    value={portalUrl}
                    size={132}
                    level="H"
                    includeMargin
                  />
                </div>
              </div>
            </section>

            <footer className="mt-12 border-t border-gray-200 pt-6 text-center">
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <div className="text-right">
                  <p className="font-black text-blue-900">
                    أزدان للمقاولات العامة
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    الدقة في التنفيذ، الوضوح في المتابعة
                  </p>
                </div>

                <div className="text-center text-sm text-gray-500 sm:text-left">
                  <p>تقرير إلكتروني صادر من نظام متابعة المشاريع</p>
                  <p className="mt-1">{reportDate}</p>
                </div>
              </div>
            </footer>
          </div>
          </div>
        </section>

        <div className="report-footer hidden print:block">
          أزدان للمقاولات العامة — {client.project_name} — {reportDate}
          <span className="mx-2">|</span>
          صفحة <span className="page-number" />
        </div>
      </div>
    </main>
  );
}