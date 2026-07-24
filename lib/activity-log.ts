import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { AdminRole } from "@/lib/admin-permissions";

export type ActivityAction = "create" | "update" | "delete" | "login" | "other";

type LogActivityInput = {
  actorId: string;
  actorEmail?: string | null;
  actorRole?: AdminRole | null;
  action: ActivityAction;
  entityType: string;
  entityId?: string | number | null;
  description: string;
  oldData?: unknown;
  newData?: unknown;
};

export async function logActivity(input: LogActivityInput): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("activity_logs").insert({
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id:
      input.entityId === undefined || input.entityId === null
        ? null
        : String(input.entityId),
    description: input.description,
    metadata: {
      actor_email: input.actorEmail || null,
      actor_role: input.actorRole || null,
      old_data: input.oldData ?? null,
      new_data: input.newData ?? null,
    },
  });

  if (error) {
    console.error("تعذر تسجيل النشاط:", error.message);
  }
}
