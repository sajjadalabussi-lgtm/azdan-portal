import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function getMobileClientSession(request: Request, expectedClientId: number) {
  if (!Number.isFinite(expectedClientId) || expectedClientId <= 0) return null;
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || "";
  if (!token) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("client_finance_sessions")
    .select("client_id, expires_at")
    .eq("client_id", expectedClientId)
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return { clientId: expectedClientId, token, admin };
}
