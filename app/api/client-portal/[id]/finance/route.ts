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
  const [clientResult, financeResult, paymentsResult, additionsResult] = await Promise.all([
    admin.from("clients").select("project_name").eq("id", clientId).single(),
    admin.from("project_finances").select("contract_amount, currency, notes").eq("client_id", clientId).maybeSingle(),
    admin
      .from("project_payments")
      .select("id, amount, payment_date, note")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false }),
    admin
      .from("project_additions")
      .select("id, title, amount, addition_date, note")
      .eq("client_id", clientId)
      .order("addition_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (clientResult.error) return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });

  return NextResponse.json(
    {
      project_name: clientResult.data?.project_name ?? "مشروعك",
      finance: financeResult.data ?? null,
      payments: paymentsResult.data ?? [],
      additions: additionsResult.data ?? [],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
