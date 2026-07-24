خطوات التركيب:

1) انسخ الملفات إلى نفس المسارات داخل مشروعك.

2) تأكد من وجود هذه القيم داخل ملف .env.local:

NEXT_PUBLIC_SUPABASE_URL=ضع_رابط_مشروع_Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=ضع_مفتاح_Anon

3) تأكد من تثبيت المكتبات:
npm install @supabase/ssr @supabase/supabase-js

4) أوقف السيرفر ثم شغله:
npm run dev

5) افتح:
http://localhost:3000/admin

سيتم تحويلك تلقائيًا إلى:
http://localhost:3000/admin-login

ملاحظة مهمة:
إذا كان لديك ملف app/admin/layout.tsx حالي، خذ نسخة احتياطية منه قبل الاستبدال.
