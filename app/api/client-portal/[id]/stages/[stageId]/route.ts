import { NextResponse } from "next/server";
import { getClientPortalSession } from "@/lib/client-portal-session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; stageId: string }> | { id: string; stageId: string } }
) {
  const { id, stageId: stageIdRaw } = await context.params;
  const clientId = Number(id);
  const stageId = Number(stageIdRaw);
  const session = await getClientPortalSession(clientId);

  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (!Number.isFinite(stageId) || stageId <= 0) {
    return NextResponse.json({ error: "مرحلة غير صحيحة" }, { status: 400 });
  }

  const { admin } = session;
  const [clientResult, stageResult, stagesResult, imagesResult] = await Promise.all([
    admin.from("clients").select("id, name, project_name").eq("id", clientId).single(),
    admin
      .from("project_stages")
      .select("id, stage_order, stage_name, status, progress, notes, engineer_name, started_at, completed_at")
      .eq("id", stageId)
      .eq("client_id", clientId)
      .single(),
    admin
      .from("project_stages")
      .select("id, stage_order, stage_name, status")
      .eq("client_id", clientId)
      .order("stage_order", { ascending: true }),
    admin
      .from("project_images")
      .select("id, storage_path, description")
      .eq("client_id", clientId)
      .eq("stage_id", stageId)
      .order("created_at", { ascending: false }),
  ]);

  if (stageResult.error || !stageResult.data) {
    return NextResponse.json({ error: "المرحلة غير موجودة" }, { status: 404 });
  }

  const images = await Promise.all(
    (imagesResult.data ?? []).map(async (image) => {
      const { data } = await admin.storage.from("project-images").createSignedUrl(image.storage_path, 60 * 30);
      return { ...image, publicUrl: data?.signedUrl || "" };
    })
  );

  return NextResponse.json(
    {
      client: clientResult.data ?? null,
      stage: stageResult.data,
      stages: stagesResult.data ?? [],
      images,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
