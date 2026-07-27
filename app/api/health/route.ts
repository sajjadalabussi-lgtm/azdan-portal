import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const healthy = hasSupabaseUrl && hasAnonKey;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "configuration_error",
      service: "azdan-portal",
      timestamp: new Date().toISOString(),
      checks: {
        supabase_url: hasSupabaseUrl,
        supabase_anon_key: hasAnonKey,
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
