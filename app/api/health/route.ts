import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return NextResponse.json(
    {
      status: configured ? "ok" : "configuration_required",
      app: "azdan-portal",
      version: "1.0.1",
      timestamp: new Date().toISOString(),
    },
    {
      status: configured ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
