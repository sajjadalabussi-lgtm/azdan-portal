# نشر بوابة أزدان 1.0 على Vercel

## 1. قبل النشر

- احتفظ بنسخة احتياطية من Supabase ومن مجلد المشروع.
- لا ترفع ملف `.env.local` إلى GitHub.
- تأكد أن جداول Supabase وملف إعدادات النظام موجودة.
- جرّب محليًا: `npm install` ثم `npm run build`.

## 2. متغيرات البيئة المطلوبة

أضفها في Vercel > Project Settings > Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

مفتاح Service Role سري جدًا ولا يوضع أبدًا في متغير يبدأ بـ `NEXT_PUBLIC_`.

## 3. إعدادات Vercel

- Framework Preset: Next.js
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: اتركه افتراضيًا
- Node.js: 22.x

## 4. بعد النشر

- افتح `/api/health` وتأكد أن النتيجة `status: ok`.
- اختبر تسجيل دخول الإدارة.
- اختبر إضافة عميل وتعديل مشروع ورفع ملف وإضافة دفعة.
- اختبر صفحة التقارير والنسخ الاحتياطي وسجل النشاطات.
- اختبر مستخدمًا من كل دور للتأكد من الصلاحيات.
- أضف رابط Vercel إلى Supabase Auth > URL Configuration ضمن Site URL وRedirect URLs.

## 5. ربط الدومين

من Vercel > Domains أضف الدومين، ثم طبّق سجلات DNS التي يعرضها Vercel. بعد نجاح الربط حدّث Site URL في Supabase إلى رابط الدومين النهائي.
