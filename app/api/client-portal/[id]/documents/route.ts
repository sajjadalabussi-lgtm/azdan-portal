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
  const { data, error } = await admin
    .from("project_files")
    .select("id, title, description, category, storage_path, file_name, created_at")
    .eq("client_id", clientId)
    .eq("is_visible_to_client", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "تعذر تحميل المستندات" }, { status: 500 });

  const files = await Promise.all(
    (data ?? []).map(async (file) => {
      const signed = await admin.storage.from("project-files").createSignedUrl(file.storage_path, 60 * 15);
      return { ...file, url: signed.data?.signedUrl || "" };
    })
  );

  return NextResponse.json({ files }, { headers: { "Cache-Control": "no-store" } });
}
