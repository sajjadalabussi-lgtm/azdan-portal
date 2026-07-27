import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const REQUIRED_TABLES = [
  "profiles",
  "clients",
  "project_updates",
  "project_images",
  "project_files",
  "project_finances",
  "project_payments",
  "project_notifications",
  "project_tasks",
  "project_comments",
  "activity_logs",
] as const;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_active || profile.role !== "admin") {
      return NextResponse.json(
        { error: "الفحص متاح للمدير فقط." },
        { status: 403 }
      );
    }

    const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

    checks.push({
      name: "NEXT_PUBLIC_SUPABASE_URL",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      detail: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? "متغير الاتصال موجود."
        : "المتغير غير موجود في Vercel.",
    });

    checks.push({
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      detail: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? "مفتاح المتصفح موجود."
        : "المفتاح غير موجود في Vercel.",
    });

    checks.push({
      name: "SUPABASE_SERVICE_ROLE_KEY",
      ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      detail: process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "مفتاح الخادم موجود."
        : "المفتاح غير موجود، وستفشل النسخ الاحتياطية والاستعادة.",
    });

    const admin = createSupabaseAdminClient();

    for (const table of REQUIRED_TABLES) {
      const { error } = await admin.from(table).select("*").limit(1);
      checks.push({
        name: `جدول ${table}`,
        ok: !error,
        detail: error ? error.message : "الجدول متاح.",
      });
    }

    return NextResponse.json({
      status: checks.every((item) => item.ok) ? "ready" : "attention_required",
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "حدث خطأ أثناء فحص النظام.",
      },
      { status: 500 }
    );
  }
}
