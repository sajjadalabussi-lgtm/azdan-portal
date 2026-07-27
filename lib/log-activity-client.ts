await logActivityClient({
  action: "create",
  entityType: "project_comments",
  entityId: String(data.id),
  description: `إضافة تعليق جديد على مشروع ${client.project_name}`,
});