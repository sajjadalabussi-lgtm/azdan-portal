import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "متغيرات Supabase غير موجودة. تأكد من NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

/**
 * عميل المتصفح المشترك.
 * استخدام @supabase/ssr يوحّد جلسة المتصفح مع middleware وServer Components.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
