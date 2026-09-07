import { NextResponse } from "next/server";
import { getMobileClientSession } from "@/lib/mobile-client-session";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await context.params;
  const clientId = Number(id);

  if (!Number.isFinite(clientId) || clientId <= 0) {
    return NextResponse.json(
      { error: "رقم العميل غير صحيح" },
      { status: 400 }
    );
  }

  const session = await getMobileClientSession(request, clientId);

  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { admin } = session;

  const [
    { data: notifications, error },
    { count: unreadCount, error: countError },
  ] = await Promise.all([
    admin
      .from("project_notifications")
      .select(
        "id, title, message, notification_type, is_read, created_at, read_at, entity_type, entity_id, target_path"
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(100),

    admin
      .from("project_notifications")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("is_read", false),
  ]);

  if (error || countError) {
    return NextResponse.json(
      { error: "تعذر تحميل الإشعارات" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      notifications: notifications ?? [],
      unreadCount: unreadCount ?? 0,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
