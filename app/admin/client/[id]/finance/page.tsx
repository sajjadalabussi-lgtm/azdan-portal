
913
914
915
916
917
918
919
920
921
922
923
924
925
926
927
928
929
930
931
932
933
934
935
936
937
938
939
940
941
942
943
944
945
946
947
948
949
950
951
952
953
954
955
956
957
958
959
960
961
962
963
964
965
966
967
968
969
970
971
972
973
974
975
976
977
978
979
980
981
982
983
984
985
986
987
988
989
"use client";
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
