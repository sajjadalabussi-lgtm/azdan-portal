import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAdminRole } from "@/lib/admin-permissions";

const TABLES = [
  "profiles",
  "clients",
  "project_updates",
  "project_images",
  "project_files",
  "project_finances",
  "project_payments",
  "project_notifications",
  "activity_logs",
] as const;

type JsonRow = Record<string, unknown>;

async function readAllRows(table: (typeof TABLES)[number]) {
  const admin = createSupabaseAdminClient();
  const pageSize = 1000;
  const rows: JsonRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);

    if (error) {
      // بعض المشاريع القديمة قد لا تحتوي على كل الجداول الاختيارية.
      if (error.code === "42P01") {
        return { rows: [], skipped: true, reason: error.message };
      }

      throw new Error(`تعذر نسخ جدول ${table}: ${error.message}`);
    }

    const page = (data ?? []) as JsonRow[];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return { rows, skipped: false, reason: null };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولًا." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle<{ role: string; is_active: boolean }>();

    if (
      profileError ||
      !profile?.is_active ||
      !isAdminRole(profile.role) ||
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "هذه العملية متاحة لمدير النظام فقط." },
        { status: 403 }
      );
    }

    const tables: Record<string, JsonRow[]> = {};
    const skippedTables: Array<{ table: string; reason: string }> = [];

    for (const table of TABLES) {
      const result = await readAllRows(table);
      tables[table] = result.rows;

      if (result.skipped && result.reason) {
        skippedTables.push({ table, reason: result.reason });
      }
    }

    const generatedAt = new Date().toISOString();
    const backup = {
      format: "azdan-portal-backup",
      version: 1,
      generated_at: generatedAt,
      generated_by: {
        id: user.id,
        email: user.email ?? null,
      },
      summary: Object.fromEntries(
        Object.entries(tables).map(([table, rows]) => [table, rows.length])
      ),
      skipped_tables: skippedTables,
      tables,
    };

    const date = generatedAt.slice(0, 10);
    const body = JSON.stringify(backup, null, 2);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="azdan-backup-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "حدث خطأ غير متوقع.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
