import { supabase } from "./supabase";

export type ActivityInput = {
  action: string;
  description: string;
  entityType?: string;
  entityId?: string | number | null;
  metadata?: Record<string, unknown>;
};

export async function logActivity(input: ActivityInput) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      action: input.action,
      description: input.description,
      entity_type: input.entityType || "general",
      entity_id:
        input.entityId === null || input.entityId === undefined
          ? null
          : String(input.entityId),
      actor_id: user?.id || null,
      actor_email: user?.email || null,
      metadata: input.metadata || {},
    };

    const { error } = await supabase.from("activity_logs").insert(payload);

    if (error) {
      console.warn("Activity log insert failed:", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn("Activity log insert failed:", error);
    return false;
  }
}
