export default function DashboardPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 rounded-2xl bg-white p-6 shadow">
          <h1 className="text-3xl font-bold text-blue-700">
            مشروع منزل السيد علي
          </h1>

          <p className="mt-2 text-gray-600">
            أهلاً بك في بوابة متابعة المشروع
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-500">نسبة الإنجاز</p>
            <p className="mt-2 text-4xl font-bold text-blue-700">
              25%
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-500">حالة المشروع</p>
            <p className="mt-2 text-xl font-bold text-green-600">
              قيد التنفيذ
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-500">آخر تحديث</p>
            <p className="mt-2 text-xl font-bold text-gray-800">
              اليوم
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-2xl font-bold text-gray-800">
            آخر تحديث للمشروع
          </h2>

          <div className="mt-5 space-y-4">
            <div>
              <h3 className="font-bold text-gray-700">
                الأعمال المنجزة
              </h3>
              <p className="mt-1 text-gray-600">
                تم الانتهاء من أعمال الحفر وتجهيز الموقع.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-gray-700">
                الأعمال القادمة
              </h3>
              <p className="mt-1 text-gray-600">
                المباشرة بأعمال الأساسات والقواعد الخرسانية.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-gray-700">
                الملاحظات
              </h3>
              <p className="mt-1 text-gray-600">
                العمل يسير حسب الجدول المخطط.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}