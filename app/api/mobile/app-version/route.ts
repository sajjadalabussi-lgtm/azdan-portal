import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const latestVersion =
    process.env.AZDAN_ANDROID_LATEST_VERSION?.trim() || "1.0.0";

  const minimumVersion =
    process.env.AZDAN_ANDROID_MIN_VERSION?.trim() || "1.0.0";

  const updateUrl =
    process.env.AZDAN_ANDROID_UPDATE_URL?.trim() || "";

  const message =
    process.env.AZDAN_ANDROID_UPDATE_MESSAGE?.trim() ||
    "يتوفر إصدار أحدث من تطبيق أزدان يتضمن تحسينات وإصلاحات.";

  return NextResponse.json(
    {
      latestVersion,
      minimumVersion,
      updateUrl,
      message,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
