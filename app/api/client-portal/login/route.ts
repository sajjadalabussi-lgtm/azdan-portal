import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { clientPortalCookieNames } from "@/lib/client-portal-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = String(body?.phone || "").trim();
    const password = String(body?.password || "");

    if (!phone || !password || phone.length > 40 || password.length > 200) {
      return NextResponse.json({ error: "بيانات الدخول غير مكتملة" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("verify_client_login_session", {
      p_phone: phone,
      p_password: password,
    });

    if (error) {
      console.error("client portal login error", error);
      return NextResponse.json({ error: "تعذر تسجيل الدخول حالياً" }, { status: 500 });
    }

    const result = data as { client_id?: number | string | null; token?: string | null } | null;
    const clientId = Number(result?.client_id);
    const token = String(result?.token || "");

    if (!Number.isFinite(clientId) || clientId <= 0 || !token) {
      return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, clientId });
    const secure = process.env.NODE_ENV === "production";
    const common = {
      httpOnly: true,
      secure,
      sameSite: "strict" as const,
      path: "/",
      maxAge: 60 * 60 * 12,
    };

    response.cookies.set(clientPortalCookieNames.clientId, String(clientId), common);
    response.cookies.set(clientPortalCookieNames.token, token, common);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "تعذر تسجيل الدخول حالياً" }, { status: 500 });
  }
}
