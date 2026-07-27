import { NextRequest, NextResponse } from "next/server";
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
  "project_tasks",
  "project_comments",
  "activity_logs",
] as const;

const RESTORE_ORDER = [
  "profiles",
  "clients",
  "project_finances",
  "project_updates",
  "project_images",
  "project_files",
  "project_payments",
  "project_tasks",
  "project_comments",
  "project_notifications",
  "activity_logs",
] as const;

type TableName = (typeof TABLES)[number];
type JsonRow = Record<string, unknown>;

type BackupPayload = {
  format?: unknown;
  version?: unknown;
  generated_at?: unknown;
  tables?: unknown;
};

async function requireSystemAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "يجب تسجيل الدخول أولًا." },
        { status: 401 }
      ),
      user: null,
    };
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
    return {
      error: NextResponse.json(
        { error: "هذه العملية متاحة لمدير النظام فقط." },
        { status: 403 }
      ),
      user: null,
    };
  }

  return { error: null, user };
}

async function readAllRows(table: TableName) {
  const admin = createSupabaseAdminClient();
  const pageSize = 1000;
  const rows: JsonRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return { rows: [], skipped: true, reason: error.message };
      }

      throw new Error(`تعذر نسخ جدول ${table}: ${error.message}`);
    }

    const page = (data ?? []) as JsonRow[];
    rows.push(...page);

    if (page.length < pageSize) break;
  }

  return { rows, skipped: false, reason: null };
}

function isJsonRow(value: unknown): value is JsonRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateBackup(payload: BackupPayload) {
  if (payload.format !== "azdan-portal-backup") {
    throw new Error("صيغة ملف النسخة الاحتياطية غير صحيحة.");
  }

  if (!isJsonRow(payload.tables)) {
    throw new Error("ملف النسخة لا يحتوي على جداول صالحة.");
  }

  const tables = payload.tables as Record<string, unknown>;
  const normalized: Partial<Record<TableName, JsonRow[]>> = {};

  for (const table of TABLES) {
    const value = tables[table];

    if (value === undefined) {
      normalized[table] = [];
      continue;
    }

    if (!Array.isArray(value) || !value.every(isJsonRow)) {
      throw new Error(`بيانات جدول ${table} غير صالحة.`);
    }

    if (value.length > 100000) {
      throw new Error(`جدول ${table} يحتوي على عدد سجلات غير مسموح.`);
    }

    normalized[table] = value as JsonRow[];
  }

  return normalized;
}

async function restoreTable(table: TableName, rows: JsonRow[]) {
  if (rows.length === 0) return 0;

  const admin = createSupabaseAdminClient();
  const batchSize = 200;
  let restored = 0;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { error } = await admin.from(table).upsert(batch);

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        throw Object.assign(new Error(error.message), {
          skippedTable: true,
        });
      }

      throw new Error(`فشلت استعادة جدول ${table}: ${error.message}`);
    }

    restored += batch.length;
  }

  return restored;
}

export async function GET() {
  try {
    const auth = await requireSystemAdmin();
    if (auth.error || !auth.user) return auth.error;

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
      version: 2,
      generated_at: generatedAt,
      generated_by: {
        id: auth.user.id,
        email: auth.user.email ?? null,
      },
      summary: Object.fromEntries(
        Object.entries(tables).map(([table, rows]) => [table, rows.length])
      ),
      skipped_tables: skippedTables,
      tables,
    };

    const body = JSON.stringify(backup, null, 2);
    const date = generatedAt.slice(0, 10);

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

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemAdmin();
    if (auth.error || !auth.user) return auth.error;

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "حجم ملف النسخة أكبر من 25MB." },
        { status: 413 }
      );
    }

    const payload = (await request.json()) as BackupPayload;
    const tables = validateBackup(payload);

    const restored: Record<string, number> = {};
    const skipped: Array<{ table: string; reason: string }> = [];

    for (const table of RESTORE_ORDER) {
      const rows = tables[table] || [];

      try {
        restored[table] = await restoreTable(table, rows);
      } catch (error) {
        if (
          error instanceof Error &&
          "skippedTable" in error &&
          error.skippedTable
        ) {
          skipped.push({ table, reason: error.message });
          restored[table] = 0;
          continue;
        }

        throw error;
      }
    }

    return NextResponse.json({
      message: "اكتملت الاستعادة الآمنة ودمج البيانات بنجاح.",
      restored,
      skipped,
      restored_at: new Date().toISOString(),
      restored_by: auth.user.id,
    });
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? "ملف JSON غير صالح."
        : error instanceof Error
          ? error.message
          : "حدث خطأ غير متوقع أثناء الاستعادة.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
