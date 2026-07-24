import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

type ActivityRow = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  metadata: JsonRecord | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  role: string;
  is_active: boolean;
};

type ActorInfo = {
  name: string;
  email: string;
  role: string | null;
};

type PageProps = {
  searchParams: Promise<{
    q?: string;
    action?: string;
    entity?: string;
  }>;
};

const actionLabels: Record<string, string> = {
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
  login: "دخول",
  other: "أخرى",
};

const entityLabels: Record<string, string> = {
  clients: "العملاء",
  project_updates: "تحديثات المشاريع",
  project_images: "صور المشاريع",
  project_files: "ملفات المشاريع",
  project_finances: "البيانات المالية",
  project_payments: "الدفعات",
  project_notifications: "الإشعارات",
  profiles: "المستخدمون والصلاحيات",
};

const roleLabels: Record<string, string> = {
  admin: "مدير النظام",
  engineer: "مهندس",
  accountant: "محاسب",
  employee: "موظف",
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function numberText(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("ar-IQ").format(amount)
    : "";
}

function getActivityData(row: ActivityRow): JsonRecord {
  const metadata = asRecord(row.metadata);
  return row.action === "delete"
    ? asRecord(metadata.old_data)
    : asRecord(metadata.new_data);
}

function buildDescription(row: ActivityRow): string {
  const data = getActivityData(row);
  const action = actionLabels[row.action] || row.action;

  switch (row.entity_type) {
    case "clients": {
      const name = text(data.name);
      const project = text(data.project_name);
      if (name && project) return `${action} العميل «${name}» لمشروع «${project}».`;
      if (name) return `${action} العميل «${name}».`;
      return `${action} سجل عميل.`;
    }
    case "project_updates": {
      const title = text(data.title);
      const progress = text(data.progress);
      if (title && progress) return `${action} تحديث «${title}» بنسبة إنجاز ${progress}٪.`;
      if (title) return `${action} تحديث «${title}».`;
      return `${action} تحديث للمشروع.`;
    }
    case "project_images": {
      const description = text(data.description);
      return description
        ? `${action} صورة بعنوان «${description}».`
        : `${action} صورة من صور المشروع.`;
    }
    case "project_files": {
      const title = text(data.title) || text(data.file_name);
      return title ? `${action} ملف «${title}».` : `${action} ملف للمشروع.`;
    }
    case "project_finances":
      return `${action} البيانات المالية للمشروع.`;
    case "project_payments": {
      const amount = numberText(data.amount);
      const date = text(data.payment_date);
      if (amount && date) return `${action} دفعة بمبلغ ${amount} د.ع بتاريخ ${date}.`;
      if (amount) return `${action} دفعة بمبلغ ${amount} د.ع.`;
      return `${action} دفعة للمشروع.`;
    }
    case "project_notifications": {
      const title = text(data.title);
      return title ? `${action} إشعار «${title}».` : `${action} إشعار للمشروع.`;
    }
    case "profiles": {
      const role = text(data.role);
      return role
        ? `${action} حساب مستخدم بصلاحية ${roleLabels[role] || role}.`
        : `${action} حساب مستخدم.`;
    }
    default:
      return row.description || `${action} سجل في ${row.entity_type}.`;
  }
}

export default async function ActivityPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = (params.q || "").trim().toLowerCase();
  const action = (params.action || "").trim();
  const entity = (params.entity || "").trim();
  const admin = createSupabaseAdminClient();

  let query = admin
    .from("activity_logs")
    .select("id, actor_id, action, entity_type, entity_id, description, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (action) query = query.eq("action", action);
  if (entity) query = query.eq("entity_type", entity);

  const { data, error } = await query;
  const allRows = (data || []) as ActivityRow[];

  const actorIds = Array.from(
    new Set(allRows.map((row) => row.actor_id).filter((id): id is string => Boolean(id)))
  );
  const actorMap = new Map<string, ActorInfo>();

  if (actorIds.length > 0) {
    const [{ data: profiles }, { data: authData }] = await Promise.all([
      admin.from("profiles").select("id, role, is_active").in("id", actorIds),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const profileMap = new Map(
      ((profiles || []) as ProfileRow[]).map((profile) => [profile.id, profile])
    );

    for (const user of authData?.users || []) {
      if (!actorIds.includes(user.id)) continue;
      const profile = profileMap.get(user.id);
      const fullName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name.trim()
          : "";
      actorMap.set(user.id, {
        name: fullName || user.email || "مستخدم غير معروف",
        email: user.email || "",
        role: profile?.role || null,
      });
    }
  }

  const entities = Array.from(new Set(allRows.map((row) => row.entity_type))).sort();
  const rows = q
    ? allRows.filter((row) => {
        const actor = row.actor_id ? actorMap.get(row.actor_id) : undefined;
        return [
          buildDescription(row),
          entityLabels[row.entity_type] || row.entity_type,
          row.entity_id || "",
          actor?.name || "",
          actor?.email || "",
          actor?.role || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
    : allRows;

  return (
    <main dir="rtl" className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">الإدارة والرقابة</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">سجل النشاطات</h1>
              <p className="mt-2 text-gray-500">آخر 500 عملية نُفذت داخل لوحة الإدارة.</p>
            </div>
            <Link href="/admin" className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800">
              الرجوع للوحة التحكم
            </Link>
          </div>

          <form className="mt-6 grid gap-3 md:grid-cols-[1fr_180px_220px_auto]">
            <input name="q" defaultValue={params.q || ""} placeholder="ابحث بالوصف أو اسم المستخدم أو البريد" className="rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500" />
            <select name="action" defaultValue={action} className="rounded-xl border border-gray-300 px-4 py-3">
              <option value="">كل العمليات</option>
              <option value="create">إضافة</option>
              <option value="update">تعديل</option>
              <option value="delete">حذف</option>
              <option value="login">دخول</option>
              <option value="other">أخرى</option>
            </select>
            <select name="entity" defaultValue={entity} className="rounded-xl border border-gray-300 px-4 py-3">
              <option value="">كل الأقسام</option>
              {entities.map((item) => (
                <option key={item} value={item}>{entityLabels[item] || item}</option>
              ))}
            </select>
            <button className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700">تطبيق</button>
          </form>
        </header>

        {error ? (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">تعذر تحميل السجل: {error.message}</p>
        ) : (
          <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full text-right text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-4 py-4">التاريخ</th>
                    <th className="px-4 py-4">المستخدم</th>
                    <th className="px-4 py-4">العملية</th>
                    <th className="px-4 py-4">القسم</th>
                    <th className="px-4 py-4">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => {
                    const actor = row.actor_id ? actorMap.get(row.actor_id) : undefined;
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-4">
                          {new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Baghdad" }).format(new Date(row.created_at))}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold">{actor?.name || "عملية تلقائية"}</p>
                          {actor?.email ? <p className="mt-1 text-xs text-gray-500">{actor.email}</p> : null}
                          <p className="mt-1 text-xs text-gray-500">{actor?.role ? roleLabels[actor.role] || actor.role : "—"}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 font-bold ${
                              row.action === "create"
                                ? "bg-green-50 text-green-700"
                                : row.action === "update"
                                  ? "bg-blue-50 text-blue-700"
                                  : row.action === "delete"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {actionLabels[row.action] || row.action}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {entityLabels[row.entity_type] || row.entity_type}
                          {row.entity_id ? <span className="block text-xs text-gray-400">#{row.entity_id}</span> : null}
                        </td>
                        <td className="min-w-80 px-4 py-4">{buildDescription(row)}</td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">لا توجد نشاطات مطابقة.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
