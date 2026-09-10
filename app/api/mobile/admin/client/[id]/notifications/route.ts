import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { canAccess, isAdminRole } from "@/lib/admin-permissions";
import { sendExpoPushNotifications } from "@/lib/expo-push";

async function authorize(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    return { error: NextResponse.json({ error: "غير مصرح" }, { status: 401 }) };
  }

  const admin = createSupabaseAdminClient();
  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const user = userResult?.user;

  if (userError || !user) {
    return { error: NextResponse.json({ error: "الجلسة غير صالحة" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle<{ role: string; is_active: boolean }>();

  if (
    profileError ||
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

  return { admin, user, profile };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authorization = await authorize(request);
    if ("error" in authorization) return authorization.error;

    const { admin } = authorization;
    const { id } = await context.params;
    const clientId = Number(id);

    if (!Number.isFinite(clientId) || clientId <= 0) {
      return NextResponse.json({ error: "رقم العميل غير صحيح" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    const message = String(body?.message || "").trim();
    const notificationType = String(body?.notificationType || "general").trim();

    if (!title || !message) {
      return NextResponse.json({ error: "عنوان ونص الإشعار مطلوبان" }, { status: 400 });
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

    const safeType = allowedTypes.has(notificationType) ? notificationType : "general";

    const entityType = body?.entityType
      ? String(body.entityType).trim().slice(0, 80)
      : null;

    const entityIdRaw = Number(body?.entityId);
    const entityId = Number.isFinite(entityIdRaw) && entityIdRaw > 0 ? entityIdRaw : null;

    const rawTargetPath = body?.targetPath ? String(body.targetPath).trim() : "";
    const targetPath =
      rawTargetPath.startsWith("/") && rawTargetPath.length <= 300
        ? rawTargetPath
        : null;

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

    if (!devicesError && devices?.length) {
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

      if (push.invalidTokens.length) {
        await admin
          .from("client_push_tokens")
          .update({ is_active: false, updated_at: new Date().toISOString() })
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
    console.error("Mobile admin notification error:", error);
    return NextResponse.json(
      { error: "تعذر إرسال الإشعار حالياً" },
      { status: 500 }
    );
  }
}
