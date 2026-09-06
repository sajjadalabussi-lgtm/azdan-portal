import { NextResponse } from "next/server";
import { getMobileClientSession } from "@/lib/mobile-client-session";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await context.params; const clientId = Number(id); const session = await getMobileClientSession(request, clientId);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { admin } = session;
  const [clientResult, stagesResult, imagesResult] = await Promise.all([
    admin.from("clients").select("id, name, phone, project_name, progress, status").eq("id", clientId).single(),
    admin.from("project_stages").select("id, client_id, stage_order, stage_name, status, progress, notes, engineer_name, started_at, completed_at").eq("client_id", clientId).order("stage_order", { ascending: true }),
    admin.from("project_images").select("id, stage_id, storage_path, description, created_at").eq("client_id", clientId).not("stage_id", "is", null).order("created_at", { ascending: false }),
  ]);
  if (clientResult.error || !clientResult.data) return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
  const images = await Promise.all((imagesResult.data ?? []).map(async (image) => {
    const { data } = await admin.storage.from("project-images").createSignedUrl(image.storage_path, 60 * 30);
    return { ...image, publicUrl: data?.signedUrl || "" };
  }));
  return NextResponse.json({ client: clientResult.data, stages: stagesResult.data ?? [], images }, { headers: { "Cache-Control": "no-store" } });
}
