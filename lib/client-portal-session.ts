import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const CLIENT_ID_COOKIE = "azdan_client_id";
const CLIENT_TOKEN_COOKIE = "azdan_client_token";

export async function getClientPortalSession(expectedClientId: number) {
  if (!Number.isFinite(expectedClientId) || expectedClientId <= 0) return null;

  const cookieStore = await cookies();
  const cookieClientId = Number(cookieStore.get(CLIENT_ID_COOKIE)?.value || "");
  const token = cookieStore.get(CLIENT_TOKEN_COOKIE)?.value || "";

  if (cookieClientId !== expectedClientId || !token) return null;

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

export const clientPortalCookieNames = {
  clientId: CLIENT_ID_COOKIE,
  token: CLIENT_TOKEN_COOKIE,
};
