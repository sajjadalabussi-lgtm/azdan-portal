import { NextResponse } from "next/server";
import { getClientPortalSession } from "@/lib/client-portal-session";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await context.params;
  const clientId = Number(id);
  const session = await getClientPortalSession(clientId);

  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const readAt = new Date().toISOString();
  let query = session.admin
    .from("project_notifications")
    .update({ is_read: true, read_at: readAt })
    .eq("client_id", clientId)
    .eq("is_read", false);

  if (!body?.all) {
    const notificationId = Number(body?.notificationId);
    if (!Number.isFinite(notificationId) || notificationId <= 0) {
      return NextResponse.json({ error: "إشعار غير صحيح" }, { status: 400 });
    }
    query = query.eq("id", notificationId);
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: "تعذر تحديث الإشعارات" }, { status: 500 });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
