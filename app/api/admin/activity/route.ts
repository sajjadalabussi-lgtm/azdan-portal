import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAdminRole, type AdminRole } from "@/lib/admin-permissions";

type ActivityAction = "create" | "update" | "delete" | "login" | "other";

type ActivityBody = {
  action?: ActivityAction;
  entityType?: string;
  entityId?: string | number | null;
  description?: string;
  oldData?: unknown;
  newData?: unknown;
};

const actionAliases: Record<ActivityAction, string[]> = {
  create: ["create", "insert", "إضافة"],
  update: ["update", "تعديل"],
  delete: ["delete", "حذف"],
  login: ["login", "دخول"],
  other: ["other", "أخرى"],
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول أولًا." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle<{ role: string; is_active: boolean }>();

    if (!profile?.is_active || !isAdminRole(profile.role)) {
      return NextResponse.json({ error: "الحساب غير مخول لتسجيل النشاط." }, { status: 403 });
    }

    const body = (await request.json()) as ActivityBody;
    const action = body.action || "other";
    const entityType = String(body.entityType || "").trim();
    const description = String(body.description || "").trim();
    const entityId =
      body.entityId === undefined || body.entityId === null
        ? null
        : String(body.entityId);

    if (!entityType || !description) {
      return NextResponse.json(
        { error: "نوع العنصر ووصف النشاط مطلوبان." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const cutoff = new Date(Date.now() - 90_000).toISOString();

    let query = admin
      .from("activity_logs")
      .select("id, metadata")
      .is("actor_id", null)
      .eq("entity_type", entityType)
      .in("action", actionAliases[action])
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1);

    if (entityId !== null) {
      query = query.eq("entity_id", entityId);
    }

    const { data: automaticLog } = await query.maybeSingle<{
      id: string | number;
      metadata: Record<string, unknown> | null;
    }>();

    const metadata = {
      ...(automaticLog?.metadata || {}),
      actor_email: user.email || null,
      actor_role: profile.role as AdminRole,
      old_data: body.oldData ?? null,
      new_data: body.newData ?? null,
    };

    if (automaticLog) {
      const { error } = await admin
        .from("activity_logs")
        .update({
          actor_id: user.id,
          description,
          metadata,
        })
        .eq("id", automaticLog.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, mode: "attached" });
    }

    const { error } = await admin.from("activity_logs").insert({
      actor_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      description,
      metadata,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, mode: "inserted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
