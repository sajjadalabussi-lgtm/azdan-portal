import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

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
    if (error) return NextResponse.json({ error: "تعذر تسجيل الدخول حالياً" }, { status: 500 });

    const result = data as { client_id?: number | string | null; token?: string | null } | null;
    const clientId = Number(result?.client_id);
    const token = String(result?.token || "");
    if (!Number.isFinite(clientId) || clientId <= 0 || !token) {
      return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
    }

    return NextResponse.json(
      { ok: true, clientId, token },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "تعذر تسجيل الدخول حالياً" }, { status: 500 });
  }
}
