import { NextResponse } from "next/server";
import { getMobileClientSession } from "@/lib/mobile-client-session";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await context.params;
    const clientId = Number(id);
    const session = await getMobileClientSession(request, clientId);

    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const expoPushToken = String(body?.expoPushToken || "").trim();
    const platform = String(body?.platform || "android").trim().toLowerCase();

    const validExpoToken =
      /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(expoPushToken);

    if (!validExpoToken) {
      return NextResponse.json(
        { error: "رمز الإشعارات غير صحيح" },
        { status: 400 }
      );
    }

    const { error } = await session.admin.from("client_push_tokens").upsert(
      {
        client_id: clientId,
        expo_push_token: expoPushToken,
        platform: platform === "ios" ? "ios" : "android",
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "expo_push_token" }
    );

    if (error) {
      console.error("تعذر حفظ Push Token:", error);
      return NextResponse.json(
        { error: "تعذر تسجيل الجهاز للإشعارات" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "تعذر تسجيل الجهاز للإشعارات" },
      { status: 500 }
    );
  }
}
