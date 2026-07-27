export type ActivityAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "other";

export type LogActivityClientInput = {
  action: ActivityAction;
  entityType: string;
  entityId?: string | number | null;
  description: string;
  oldData?: unknown;
  newData?: unknown;
};

export async function logActivityClient(
  input: LogActivityClientInput
): Promise<void> {
  try {
    const response = await fetch("/api/admin/activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);

      console.error(
        "تعذر ربط النشاط بالمستخدم:",
        result?.error || response.statusText
      );
    }
  } catch (error) {
    console.error("تعذر ربط النشاط بالمستخدم:", error);
  }
}