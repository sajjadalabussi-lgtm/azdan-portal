"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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

function toNumber(
  value: number | string | null | undefined
) {
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
  const [financeId, setFinanceId] = useState<number | null>(
    null
  );

  const [contractAmount, setContractAmount] = useState("");
  const [currency, setCurrency] = useState("IQD");
  const [financeNotes, setFinanceNotes] = useState("");

  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  const [paymentAmount, setPaymentAmount] = useState("");

  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [paymentNote, setPaymentNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingFinance, setSavingFinance] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);

  const [deletingPaymentId, setDeletingPaymentId] =
    useState<number | null>(null);

  const [message, setMessage] = useState("");

  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");

  const loadFinanceData = useCallback(async () => {
    if (!Number.isFinite(clientId) || clientId <= 0) {
      setMessage("رقم العميل غير صحيح");
      setMessageType("error");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    setMessageType("");

    const { data: clientData, error: clientError } =
      await supabase
        .from("clients")
        .select("id, name, project_name")
        .eq("id", clientId)
        .single();

    if (clientError || !clientData) {
      setMessage(
        `تعذر تحميل بيانات العميل: ${
          clientError?.message || "العميل غير موجود"
        }`
      );

      setMessageType("error");
      setLoading(false);
      return;
    }

    const { data: financeData, error: financeError } =
      await supabase
        .from("project_finances")
        .select(
          "id, client_id, contract_amount, currency, notes"
        )
        .eq("client_id", clientId)
        .maybeSingle();

    if (financeError) {
      console.error(financeError);

      setMessage(
        `تعذر تحميل الحساب المالي: ${financeError.message}`
      );

      setMessageType("error");
      setLoading(false);
      return;
    }

    let preparedFinance =
      financeData as FinanceRecord | null;

    if (!preparedFinance) {
      const {
        data: createdFinance,
        error: createFinanceError,
      } = await supabase
        .from("project_finances")
        .insert({
          client_id: clientId,
          contract_amount: 0,
          currency: "IQD",
        })
        .select(
          "id, client_id, contract_amount, currency, notes"
        )
        .single();

      if (createFinanceError || !createdFinance) {
        setMessage(
          `تعذر إنشاء الحساب المالي: ${
            createFinanceError?.message ||
            "حدث خطأ غير معروف"
          }`
        );

        setMessageType("error");
        setLoading(false);
        return;
      }

      preparedFinance =
        createdFinance as FinanceRecord;
    }

    const { data: paymentsData, error: paymentsError } =
      await supabase
        .from("project_payments")
        .select(
          "id, client_id, amount, payment_date, note, created_at"
        )
        .eq("client_id", clientId)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false });

    if (paymentsError) {
      console.error(paymentsError);

      setMessage(
        `تعذر تحميل الدفعات: ${paymentsError.message}`
      );

      setMessageType("error");
      setLoading(false);
      return;
    }

    setClient(clientData);
    setFinanceId(preparedFinance.id);

    setContractAmount(
      String(toNumber(preparedFinance.contract_amount))
    );

    setCurrency(preparedFinance.currency || "IQD");
    setFinanceNotes(preparedFinance.notes || "");

    setPayments(
      (paymentsData as PaymentRecord[] | null) ?? []
    );

    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const contractAmountNumber = toNumber(contractAmount);

  const totalPaid = useMemo(
    () =>
      payments.reduce(
        (total, payment) =>
          total + toNumber(payment.amount),
        0
      ),
    [payments]
  );

  const remainingAmount = Math.max(
    contractAmountNumber - totalPaid,
    0
  );

  const overpaidAmount = Math.max(
    totalPaid - contractAmountNumber,
    0
  );

  const paymentPercentage =
    contractAmountNumber > 0
      ? clampPercentage(
          Math.round(
            (totalPaid / contractAmountNumber) * 100
          )
        )
      : 0;

  function showMessage(
    text: string,
    type: "success" | "error"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  function formatMoney(
    value: number,
    selectedCurrency = currency
  ) {
    const formatted = new Intl.NumberFormat("ar-IQ", {
      maximumFractionDigits: 2,
    }).format(value);

    if (selectedCurrency === "IQD") {
      return `${formatted} د.ع`;
    }

    if (selectedCurrency === "USD") {
      return `${formatted} $`;
    }

    return `${formatted} ${selectedCurrency}`;
  }

  function formatDate(date: string) {
    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return "التاريخ غير متوفر";
    }

    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(parsedDate);
  }

  async function saveFinance(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (savingFinance) {
      return;
    }

    if (contractAmountNumber < 0) {
      showMessage(
        "قيمة العقد لا يمكن أن تكون سالبة",
        "error"
      );

      return;
    }

    if (!currency.trim()) {
      showMessage("يرجى اختيار العملة", "error");
      return;
    }

    setSavingFinance(true);
    setMessage("");
    setMessageType("");

    const financePayload = {
      client_id: clientId,
      contract_amount: contractAmountNumber,
      currency: currency.trim().toUpperCase(),
      notes: financeNotes.trim() || null,
    };

    const query = financeId
      ? supabase
          .from("project_finances")
          .update(financePayload)
          .eq("id", financeId)
          .eq("client_id", clientId)
      : supabase
          .from("project_finances")
          .insert(financePayload);

    const { error } = await query;

    if (error) {
      console.error(error);

      showMessage(
        `تعذر حفظ الحساب المالي: ${error.message}`,
        "error"
      );

      setSavingFinance(false);
      return;
    }

    await logActivityClient({
      action: financeId ? "update" : "create",
      entityType: "project_finances",
      entityId: financeId,
      description: financeId
        ? `عدّل الحساب المالي للمشروع رقم ${clientId}`
        : `أنشأ الحساب المالي للمشروع رقم ${clientId}`,
      newData: financePayload,
    });

    setCurrency(currency.trim().toUpperCase());

    showMessage(
      "تم حفظ معلومات الحساب المالي بنجاح ✅",
      "success"
    );

    setSavingFinance(false);

    if (!financeId) {
      await loadFinanceData();
    }
  }

  async function addPayment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (addingPayment) {
      return;
    }

    const amount = toNumber(paymentAmount);

    if (amount <= 0) {
      showMessage(
        "يرجى إدخال مبلغ دفعة صحيح",
        "error"
      );

      return;
    }

    if (!paymentDate) {
      showMessage(
        "يرجى اختيار تاريخ الدفعة",
        "error"
      );

      return;
    }

    setAddingPayment(true);
    setMessage("");
    setMessageType("");

    const { data, error } = await supabase
      .from("project_payments")
      .insert({
        client_id: clientId,
        amount,
        payment_date: paymentDate,
        note: paymentNote.trim() || null,
      })
      .select(
        "id, client_id, amount, payment_date, note, created_at"
      )
      .single();

    if (error || !data) {
      console.error(error);

      showMessage(
        `تعذر إضافة الدفعة: ${
          error?.message || "حدث خطأ غير معروف"
        }`,
        "error"
      );

      setAddingPayment(false);
      return;
    }

    const insertedPayment = data as PaymentRecord;

    await logActivityClient({
      action: "create",
      entityType: "project_payments",
      entityId: insertedPayment.id,
      description: `أضاف دفعة بقيمة ${formatMoney(amount)}`,
      newData: insertedPayment,
    });

    setPayments((currentPayments) =>
      [insertedPayment, ...currentPayments].sort(
        (a, b) => {
          const dateComparison =
            new Date(b.payment_date).getTime() -
            new Date(a.payment_date).getTime();

          if (dateComparison !== 0) {
            return dateComparison;
          }

          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
        }
      )
    );

    const paymentCurrency =
      currency.trim().toUpperCase() || "IQD";

    const notificationMessageParts = [
      `تم تسجيل دفعة جديدة بقيمة ${formatMoney(
        amount,
        paymentCurrency
      )}.`,
      `تاريخ الدفعة: ${formatDate(paymentDate)}.`,
    ];

    if (paymentNote.trim()) {
      notificationMessageParts.push(
        `ملاحظة الدفعة: ${paymentNote.trim()}.`
      );
    }

    const { error: notificationError } = await supabase
      .from("project_notifications")
      .insert({
        client_id: clientId,
        title: "تمت إضافة دفعة جديدة",
        message: notificationMessageParts.join("\n"),
        notification_type: "payment",
        is_read: false,
      });

    setPaymentAmount("");
    setPaymentNote("");

    setPaymentDate(
      new Date().toISOString().slice(0, 10)
    );

    if (notificationError) {
      console.error(notificationError);

      showMessage(
        `تمت إضافة الدفعة بنجاح، لكن تعذر إرسال الإشعار للعميل: ${notificationError.message}`,
        "error"
      );

      setAddingPayment(false);
      return;
    }

    showMessage(
      "تمت إضافة الدفعة وإرسال إشعار للعميل بنجاح ✅",
      "success"
    );

    setAddingPayment(false);
  }

  async function deletePayment(
    payment: PaymentRecord
  ) {
    if (deletingPaymentId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `هل تريد حذف دفعة بقيمة ${formatMoney(
        toNumber(payment.amount)
      )} نهائيًا؟`
    );

    if (!confirmed) {
      return;
    }

    setDeletingPaymentId(payment.id);
    setMessage("");
    setMessageType("");

    const { error } = await supabase
      .from("project_payments")
      .delete()
      .eq("id", payment.id)
      .eq("client_id", clientId);

    if (error) {
      console.error(error);

      showMessage(
        `تعذر حذف الدفعة: ${error.message}`,
        "error"
      );

      setDeletingPaymentId(null);
      return;
    }

    await logActivityClient({
      action: "delete",
      entityType: "project_payments",
      entityId: payment.id,
      description: `حذف دفعة بقيمة ${formatMoney(toNumber(payment.amount))}`,
      oldData: payment,
    });

    setPayments((currentPayments) =>
      currentPayments.filter(
        (currentPayment) =>
          currentPayment.id !== payment.id
      )
    );

    showMessage(
      "تم حذف الدفعة بنجاح ✅",
      "success"
    );

    setDeletingPaymentId(null);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-gray-100"
      >
        <p className="text-gray-600">
          جاري تحميل الحساب المالي...
        </p>
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
            {message || "لم يتم العثور على العميل"}
          </p>

          <Link
            href="/admin/clients"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700"
          >
            رجوع للعملاء
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 sm:px-6 sm:py-10"
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-5 rounded-2xl bg-white p-5 shadow sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-gray-500">
              الإدارة المالية للمشروع
            </p>

            <h1 className="mt-1 text-2xl font-bold text-blue-700 sm:text-3xl">
              {client.project_name}
            </h1>

            <p className="mt-2 text-gray-500">
              العميل: {client.name}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/admin/client/${client.id}`}
              className="rounded-lg bg-gray-200 px-4 py-3 text-gray-700 hover:bg-gray-300"
            >
              رجوع للمشروع
            </Link>

            <Link
              href={`/admin/client/${client.id}/notifications`}
              className="rounded-lg bg-amber-500 px-4 py-3 text-white hover:bg-amber-600"
            >
              الإشعارات
            </Link>

            <Link
              href="/admin/clients"
              className="rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700"
            >
              قائمة العملاء
            </Link>
          </div>
        </header>

        {message && (
          <p
            className={`mb-6 rounded-xl border p-4 text-center ${
              messageType === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message}
          </p>
        )}

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              قيمة العقد
            </p>

            <p className="mt-3 text-2xl font-bold text-gray-900">
              {formatMoney(contractAmountNumber)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              إجمالي المدفوع
            </p>

            <p className="mt-3 text-2xl font-bold text-green-600">
              {formatMoney(totalPaid)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              المبلغ المتبقي
            </p>

            <p className="mt-3 text-2xl font-bold text-amber-600">
              {formatMoney(remainingAmount)}
            </p>

            {overpaidAmount > 0 && (
              <p className="mt-2 text-sm font-bold text-purple-600">
                زيادة مدفوعة:{" "}
                {formatMoney(overpaidAmount)}
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                نسبة الدفع
              </p>

              <p className="font-bold text-blue-700">
                {paymentPercentage}%
              </p>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{
                  width: `${paymentPercentage}%`,
                }}
              />
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow sm:p-6">
            <h2 className="text-2xl font-bold">
              معلومات العقد
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              تعديل قيمة العقد والعملة والملاحظات
            </p>

            <form
              onSubmit={saveFinance}
              className="mt-6 space-y-5"
            >
              <div>
                <label className="mb-2 block font-bold">
                  قيمة العقد
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={contractAmount}
                  onChange={(event) =>
                    setContractAmount(event.target.value)
                  }
                  placeholder="مثال: 75000000"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block font-bold">
                  العملة
                </label>

                <select
                  value={currency}
                  onChange={(event) =>
                    setCurrency(event.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="IQD">
                    الدينار العراقي — IQD
                  </option>

                  <option value="USD">
                    الدولار الأمريكي — USD
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-bold">
                  ملاحظات الحساب
                </label>

                <textarea
                  value={financeNotes}
                  onChange={(event) =>
                    setFinanceNotes(event.target.value)
                  }
                  rows={5}
                  placeholder="مثال: قيمة العقد لا تشمل أعمال الديكور..."
                  className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={savingFinance}
                className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingFinance
                  ? "جاري الحفظ..."
                  : "حفظ معلومات العقد"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow sm:p-6">
            <h2 className="text-2xl font-bold">
              إضافة دفعة جديدة
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              عند إضافة الدفعة سيصل إشعار تلقائي للعميل
            </p>

            <form
              onSubmit={addPayment}
              className="mt-6 space-y-5"
            >
              <div>
                <label className="mb-2 block font-bold">
                  مبلغ الدفعة
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(event) =>
                    setPaymentAmount(event.target.value)
                  }
                  placeholder="أدخل مبلغ الدفعة"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="mb-2 block font-bold">
                  تاريخ الدفعة
                </label>

                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(event) =>
                    setPaymentDate(event.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="mb-2 block font-bold">
                  ملاحظة الدفعة
                </label>

                <textarea
                  value={paymentNote}
                  onChange={(event) =>
                    setPaymentNote(event.target.value)
                  }
                  rows={5}
                  placeholder="مثال: الدفعة الأولى، دفعة الهيكل..."
                  className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-500"
                />
              </div>

              <button
                type="submit"
                disabled={addingPayment}
                className="w-full rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {addingPayment
                  ? "جاري إضافة الدفعة..."
                  : "إضافة الدفعة وإرسال إشعار"}
              </button>
            </form>
          </section>
        </div>

        <section className="mt-8 rounded-2xl bg-white p-4 shadow sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                سجل الدفعات
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                جميع الدفعات مرتبة من الأحدث إلى الأقدم
              </p>
            </div>

            <span className="text-sm text-gray-500">
              عدد الدفعات: {payments.length}
            </span>
          </div>

          {payments.length === 0 ? (
            <p className="mt-6 rounded-xl bg-gray-50 p-8 text-center text-gray-500">
              لا توجد دفعات مسجلة حتى الآن
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-right">
                    <th className="p-4">التاريخ</th>
                    <th className="p-4">المبلغ</th>
                    <th className="p-4">الملاحظة</th>
                    <th className="p-4">الإجراء</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-gray-100"
                    >
                      <td className="p-4">
                        {formatDate(
                          payment.payment_date
                        )}
                      </td>

                      <td className="p-4 font-bold text-green-700">
                        {formatMoney(
                          toNumber(payment.amount)
                        )}
                      </td>

                      <td className="p-4 text-gray-600">
                        {payment.note ||
                          "لا توجد ملاحظة"}
                      </td>

                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() =>
                            deletePayment(payment)
                          }
                          disabled={
                            deletingPaymentId !== null
                          }
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingPaymentId ===
                          payment.id
                            ? "جاري الحذف..."
                            : "حذف الدفعة"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="bg-green-50 font-bold">
                    <td className="p-4">
                      الإجمالي
                    </td>

                    <td className="p-4 text-green-700">
                      {formatMoney(totalPaid)}
                    </td>

                    <td
                      colSpan={2}
                      className="p-4"
                    />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}