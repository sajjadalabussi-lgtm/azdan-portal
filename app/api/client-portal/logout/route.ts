import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { clientPortalCookieNames } from "@/lib/client-portal-session";

export async function POST() {
  const cookieStore = await cookies();
  const clientId = Number(cookieStore.get(clientPortalCookieNames.clientId)?.value || "");
  const token = cookieStore.get(clientPortalCookieNames.token)?.value || "";

  // إبطال الجلسة من قاعدة البيانات أيضاً، وليس فقط حذف الكوكيز من المتصفح.
  if (Number.isFinite(clientId) && clientId > 0 && token) {
    try {
      const admin = createSupabaseAdminClient();
      await admin
        .from("client_finance_sessions")
        .delete()
        .eq("client_id", clientId)
        .eq("token", token);
    } catch (error) {
      console.error("client portal logout session revoke error", error);
    }
  }

  const response = NextResponse.json({ ok: true });
  const cookieOptions = {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  response.cookies.set(clientPortalCookieNames.clientId, "", cookieOptions);
  response.cookies.set(clientPortalCookieNames.token, "", cookieOptions);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
