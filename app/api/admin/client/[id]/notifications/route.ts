import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { canAccess, isAdminRole } from "@/lib/admin-permissions";
import { sendExpoPushNotifications } from "@/lib/expo-push";

async function authorizeNotifications() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "غير مصرح" }, { status: 401 }) };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle<{ role: string; is_active: boolean }>();

  if (
    error ||
    !profile ||
    !profile.is_active ||
    !isAdminRole(profile.role) ||
    !canAccess(profile.role, "manage_notifications")
  ) {
    return {
      error: NextResponse.json(
        { error: "لا تملك صلاحية إرسال الإشعارات" },
        { status: 403 }
      ),
    };
  }

  return { user };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authorization = await authorizeNotifications();
    if ("error" in authorization) return authorization.error;

    const { id } = await context.params;
    const clientId = Number(id);

    if (!Number.isFinite(clientId) || clientId <= 0) {
      return NextResponse.json(
        { error: "رقم العميل غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const title = String(body?.title || "").trim();
    const message = String(body?.message || "").trim();
    const notificationType = String(
      body?.notificationType || "general"
    ).trim();

    const entityType = body?.entityType
      ? String(body.entityType).trim().slice(0, 80)
      : null;

    const entityIdRaw = Number(body?.entityId);
    const entityId =
      Number.isFinite(entityIdRaw) && entityIdRaw > 0 ? entityIdRaw : null;

    const rawTargetPath = body?.targetPath
      ? String(body.targetPath).trim()
      : "";

    const targetPath =
      rawTargetPath.startsWith("/") && rawTargetPath.length <= 300
        ? rawTargetPath
        : null;

    if (!title || !message) {
      return NextResponse.json(
        { error: "عنوان ونص الإشعار مطلوبان" },
        { status: 400 }
      );
    }

    const allowedTypes = new Set([
      "general",
      "payment",
      "addition",
      "file",
      "image",
      "stage_update",
      "stage_complete",
      "update",
      "progress",
    ]);

    const safeType = allowedTypes.has(notificationType)
      ? notificationType
      : "general";

    const admin = createSupabaseAdminClient();

    const { data: notification, error: insertError } = await admin
      .from("project_notifications")
      .insert({
        client_id: clientId,
        title,
        message,
        notification_type: safeType,
        is_read: false,
        entity_type: entityType,
        entity_id: entityId,
        target_path: targetPath,
      })
      .select(
        "id, client_id, title, message, notification_type, is_read, created_at, read_at, entity_type, entity_id, target_path"
      )
      .single();

    if (insertError || !notification) {
      return NextResponse.json(
        { error: insertError?.message || "تعذر إنشاء الإشعار" },
        { status: 500 }
      );
    }

    const { data: devices, error: devicesError } = await admin
      .from("client_push_tokens")
      .select("expo_push_token")
      .eq("client_id", clientId)
      .eq("is_active", true);

    let push = { sent: 0, failed: 0, invalidTokens: [] as string[] };

    if (!devicesError && devices && devices.length > 0) {
      push = await sendExpoPushNotifications({
        tokens: devices.map((item) => item.expo_push_token),
        title,
        message,
        data: {
          clientId,
          notificationId: notification.id,
          notificationType: safeType,
          entityType,
          entityId,
          targetPath,
        },
      });

      if (push.invalidTokens.length > 0) {
        await admin
          .from("client_push_tokens")
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .in("expo_push_token", push.invalidTokens);
      }
    }

    return NextResponse.json({
      ok: true,
      notification,
      push: {
        sent: push.sent,
        failed: push.failed,
        registeredDevices: devices?.length ?? 0,
      },
    });
  } catch (error) {
    console.error("Push notification error:", error);

    return NextResponse.json(
      { error: "تعذر إرسال الإشعار حالياً" },
      { status: 500 }
    );
  }
}
