import { NextResponse } from "next/server";

import { isAdminRole } from "@/lib/admin-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";

type SettingsPayload = {
  company_name?: unknown;
  phone?: unknown;
  email?: unknown;
  address?: unknown;
  logo_url?: unknown;
  primary_color?: unknown;
  secondary_color?: unknown;
};

const DEFAULT_SETTINGS = {
  id: 1,
  company_name: "شركة أزدان للمقاولات العامة",
  phone: "",
  email: "",
  address: "",
  logo_url: "/logo.png",
  primary_color: "#2563eb",
  secondary_color: "#0f172a",
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const color = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

async function authorizeAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "يجب تسجيل الدخول أولًا.", status: 401 as const };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle<{ role: string; is_active: boolean }>();

  if (
    error ||
    !profile?.is_active ||
    !isAdminRole(profile.role) ||
    profile.role !== "admin"
  ) {
    return { error: "هذه الصفحة متاحة لمدير النظام فقط.", status: 403 as const };
  }

  return { user, status: 200 as const };
}

export async function GET() {
  const auth = await authorizeAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("system_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json(
        { error: "جدول إعدادات النظام غير موجود. نفّذ ملف SQL المرفق أولًا." },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data ?? DEFAULT_SETTINGS });
}

export async function PATCH(request: Request) {
  const auth = await authorizeAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: SettingsPayload;
  try {
    body = (await request.json()) as SettingsPayload;
  } catch {
    return NextResponse.json({ error: "البيانات المرسلة غير صحيحة." }, { status: 400 });
  }

  const companyName = cleanText(body.company_name, 120);
  if (!companyName) {
    return NextResponse.json({ error: "اسم الشركة مطلوب." }, { status: 400 });
  }

  const settings = {
    id: 1,
    company_name: companyName,
    phone: cleanText(body.phone, 40),
    email: cleanText(body.email, 160),
    address: cleanText(body.address, 300),
    logo_url: cleanText(body.logo_url, 500) || "/logo.png",
    primary_color: cleanColor(body.primary_color, "#2563eb"),
    secondary_color: cleanColor(body.secondary_color, "#0f172a"),
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("system_settings")
    .upsert(settings, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data, message: "تم حفظ إعدادات النظام." });
}
