# Azdan Mobile API Patch

انسخ مجلد `app/api/mobile` إلى نفس المسار داخل مشروع Next.js الحالي، وانسخ `lib/mobile-client-session.ts` إلى مجلد `lib`.

هذا الـPatch لا يغيّر تسجيل دخول بوابة الويب الحالية. يضيف API خاص بتطبيق Android يستخدم Bearer Token ويتم التحقق منه من جدول `client_finance_sessions` الموجود أصلاً.

Endpoints:
- POST `/api/mobile/client-login`
- GET `/api/mobile/client/:id/snapshot`
- GET `/api/mobile/client/:id/stages/:stageId`
- GET `/api/mobile/client/:id/finance`
- GET `/api/mobile/client/:id/documents`
