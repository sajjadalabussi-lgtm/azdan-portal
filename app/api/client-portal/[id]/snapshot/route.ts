import { NextResponse } from "next/server";
import { getClientPortalSession } from "@/lib/client-portal-session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await context.params;
  const clientId = Number(id);
  const session = await getClientPortalSession(clientId);

  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { admin } = session;
  const [clientResult, stagesResult, imagesResult, notificationsResult] = await Promise.all([
    admin.from("clients").select("id, name, phone, project_name, progress, status").eq("id", clientId).single(),
    admin
      .from("project_stages")
      .select("id, client_id, stage_order, stage_name, status, progress, notes, engineer_name, started_at, completed_at")
      .eq("client_id", clientId)
      .order("stage_order", { ascending: true }),
    admin
      .from("project_images")
      .select("id, stage_id, storage_path, description, created_at")
      .eq("client_id", clientId)
      .not("stage_id", "is", null)
      .order("created_at", { ascending: false }),
    admin
      .from("project_notifications")
      .select("id, title, message, notification_type, is_read, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (clientResult.error || !clientResult.data) {
    return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
  }

  const rawImages = imagesResult.data ?? [];
  const images = await Promise.all(
    rawImages.map(async (image) => {
      const { data } = await admin.storage.from("project-images").createSignedUrl(image.storage_path, 60 * 30);
      return { ...image, publicUrl: data?.signedUrl || "" };
    })
  );

  return NextResponse.json(
    {
      client: clientResult.data,
      stages: stagesResult.data ?? [],
      images,
      notifications: notificationsResult.data ?? [],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
