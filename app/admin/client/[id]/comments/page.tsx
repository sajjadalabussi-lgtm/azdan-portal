"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { logActivityClient } from "@/lib/log-activity-client";

type ClientRow = {
  id: number;
  name: string;
  project_name: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type CommentRow = {
  id: number;
  client_id: number;
  user_id: string;
  author_name: string;
  author_role: string | null;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-IQ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function roleLabel(role: string | null) {
  const labels: Record<string, string> = {
    owner: "المالك",
    admin: "مدير",
    engineer: "مهندس",
    accountant: "محاسب",
    employee: "موظف",
  };
  return role ? labels[role] || role : "مستخدم";
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "م";
}

export default function ProjectCommentsPage() {
  const params = useParams();
  const clientId = Number(params.id);

  const [client, setClient] = useState<ClientRow | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | "">("");

  const canModerate = profile?.role === "owner" || profile?.role === "admin";

  const loadData = useCallback(async () => {
    if (!Number.isFinite(clientId) || clientId <= 0) {
      setFeedback("رقم المشروع غير صحيح.");
      setFeedbackType("error");
      setLoading(false);
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setFeedback("انتهت الجلسة. سجّل الدخول من جديد.");
      setFeedbackType("error");
      setLoading(false);
      return;
    }

    const [clientResult, profileResult, commentsResult] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, project_name")
        .eq("id", clientId)
        .single(),
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("project_comments")
        .select("*")
        .eq("client_id", clientId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (clientResult.error || !clientResult.data) {
      setFeedback(`تعذر تحميل المشروع: ${clientResult.error?.message || "غير موجود"}`);
      setFeedbackType("error");
    } else {
      setClient(clientResult.data as ClientRow);
    }

    if (profileResult.error) {
      setFeedback(`تعذر تحميل بيانات المستخدم: ${profileResult.error.message}`);
      setFeedbackType("error");
    } else {
      setProfile((profileResult.data as ProfileRow | null) ?? {
        id: user.id,
        full_name: user.email || "مستخدم الإدارة",
        role: null,
      });
    }

    if (commentsResult.error) {
      setFeedback(`تعذر تحميل التعليقات: ${commentsResult.error.message}`);
      setFeedbackType("error");
    } else {
      setComments((commentsResult.data as CommentRow[] | null) ?? []);
    }

    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel(`project-comments-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_comments",
          filter: `client_id=eq.${clientId}`,
        },
        () => void loadData()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, loadData]);

  const filteredComments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return comments;

    return comments.filter(
      (comment) =>
        comment.body.toLowerCase().includes(query) ||
        comment.author_name.toLowerCase().includes(query) ||
        (comment.attachment_name || "").toLowerCase().includes(query)
    );
  }, [comments, search]);

  function showFeedback(text: string, type: "success" | "error") {
    setFeedback(text);
    setFeedbackType(type);
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanBody = body.trim();
    if (!cleanBody) {
      showFeedback("اكتب التعليق أولاً.", "error");
      return;
    }

    if (!profile || !client) {
      showFeedback("بيانات المستخدم أو المشروع غير مكتملة.", "error");
      return;
    }

    setSaving(true);

    const payload = {
      client_id: clientId,
      user_id: profile.id,
      author_name: profile.full_name?.trim() || "مستخدم الإدارة",
      author_role: profile.role,
      body: cleanBody,
      attachment_url: attachmentUrl.trim() || null,
      attachment_name: attachmentName.trim() || null,
    };

    const { data, error } = await supabase
      .from("project_comments")
      .insert(payload)
      .select("*")
      .single();

    if (error || !data) {
      showFeedback(`تعذر إضافة التعليق: ${error?.message || "خطأ غير معروف"}`, "error");
      setSaving(false);
      return;
    }

    const notificationMessage =
      cleanBody.length > 120 ? `${cleanBody.slice(0, 120)}...` : cleanBody;

    await supabase.from("project_notifications").insert({
      client_id: clientId,
      title: "تعليق جديد على المشروع",
      message: `${payload.author_name}: ${notificationMessage}`,
      notification_type: "comment",
      is_read: false,
    });

    await logActivityClient({
      action: "create",
      entity_type: "project_comments",
      entity_id: String(data.id),
      description: `إضافة تعليق جديد على مشروع ${client.project_name}`,
      metadata: {
        client_id: clientId,
        project_name: client.project_name,
      },
    });

    setComments((current) => [data as CommentRow, ...current]);
    setBody("");
    setAttachmentUrl("");
    setAttachmentName("");
    showFeedback("تمت إضافة التعليق وإرسال إشعار.", "success");
    setSaving(false);
  }

  async function saveEdit(comment: CommentRow) {
    const cleanBody = editingBody.trim();
    if (!cleanBody) {
      showFeedback("لا يمكن حفظ تعليق فارغ.", "error");
      return;
    }

    const { data, error } = await supabase
      .from("project_comments")
      .update({
        body: cleanBody,
        updated_at: new Date().toISOString(),
      })
      .eq("id", comment.id)
      .select("*")
      .single();

    if (error || !data) {
      showFeedback(`تعذر تعديل التعليق: ${error?.message || "خطأ غير معروف"}`, "error");
      return;
    }

    setComments((current) =>
      current.map((item) => (item.id === comment.id ? (data as CommentRow) : item))
    );
    setEditingId(null);
    setEditingBody("");
    showFeedback("تم تعديل التعليق.", "success");
  }

  async function togglePin(comment: CommentRow) {
    if (!canModerate) return;

    const { data, error } = await supabase
      .from("project_comments")
      .update({
        is_pinned: !comment.is_pinned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", comment.id)
      .select("*")
      .single();

    if (error || !data) {
      showFeedback(`تعذر تحديث التثبيت: ${error?.message || "خطأ غير معروف"}`, "error");
      return;
    }

    setComments((current) =>
      current
        .map((item) => (item.id === comment.id ? (data as CommentRow) : item))
        .sort(
          (a, b) =>
            Number(b.is_pinned) - Number(a.is_pinned) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
    );
    showFeedback(comment.is_pinned ? "تم إلغاء تثبيت التعليق." : "تم تثبيت التعليق.", "success");
  }

  async function deleteComment(comment: CommentRow) {
    if (!window.confirm("هل تريد حذف هذا التعليق نهائيًا؟")) return;

    const { error } = await supabase
      .from("project_comments")
      .delete()
      .eq("id", comment.id);

    if (error) {
      showFeedback(`تعذر حذف التعليق: ${error.message}`, "error");
      return;
    }

    setComments((current) => current.filter((item) => item.id !== comment.id));
    showFeedback("تم حذف التعليق.", "success");
  }

  function canEdit(comment: CommentRow) {
    return profile?.id === comment.user_id || canModerate;
  }

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-100 p-4 sm:p-8">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-12 text-center font-bold text-slate-500 shadow">
          جاري تحميل محادثات المشروع...
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen overflow-x-hidden bg-slate-100 px-3 py-5 text-slate-900 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-3xl bg-slate-950 p-5 text-white shadow-xl sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-300">التعاون والملاحظات الداخلية</p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">محادثات المشروع</h1>
              <p className="mt-2 text-sm text-slate-300">
                {client?.project_name || "المشروع"} — {client?.name || ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/client/${clientId}`}
                className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-black hover:bg-slate-900"
              >
                نظرة عامة
              </Link>
              <Link
                href={`/admin/client/${clientId}/tasks`}
                className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-amber-400"
              >
                المهام
              </Link>
            </div>
          </div>
        </header>

        {feedback && (
          <p
            className={`mt-5 rounded-2xl border p-4 font-bold ${
              feedbackType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {feedback}
          </p>
        )}

        <section className="mt-5 rounded-3xl bg-white p-4 shadow sm:p-6">
          <form onSubmit={addComment}>
            <label className="text-sm font-black text-slate-700">إضافة تعليق جديد</label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              maxLength={3000}
              placeholder="اكتب ملاحظة، تحديثًا، قرارًا أو سؤالاً للفريق..."
              className="mt-2 w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
            />

            <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-black">إرفاق رابط ملف أو صورة</summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input
                  value={attachmentUrl}
                  onChange={(event) => setAttachmentUrl(event.target.value)}
                  type="url"
                  placeholder="رابط الملف https://..."
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
                <input
                  value={attachmentName}
                  onChange={(event) => setAttachmentName(event.target.value)}
                  placeholder="اسم الملف أو الصورة"
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>
            </details>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-500">{body.length} / 3000</span>
              <button
                disabled={saving}
                className="rounded-xl bg-blue-600 px-6 py-3 font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "جاري الإرسال..." : "نشر التعليق"}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-5 rounded-3xl bg-white p-4 shadow sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">سجل المحادثات</h2>
              <p className="mt-1 text-sm text-slate-500">{comments.length} تعليق</p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="بحث في التعليقات..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 sm:max-w-xs"
            />
          </div>

          {filteredComments.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-slate-50 p-10 text-center text-slate-500">
              {comments.length === 0 ? "لا توجد تعليقات بعد." : "لا توجد نتائج مطابقة."}
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {filteredComments.map((comment) => (
                <article
                  key={comment.id}
                  className={`rounded-2xl border p-4 sm:p-5 ${
                    comment.is_pinned
                      ? "border-amber-300 bg-amber-50/70"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">
                      {initials(comment.author_name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black">{comment.author_name}</h3>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                              {roleLabel(comment.author_role)}
                            </span>
                            {comment.is_pinned && (
                              <span className="rounded-full bg-amber-200 px-2 py-1 text-[11px] font-black text-amber-900">
                                مثبت
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(comment.created_at)}
                            {comment.updated_at !== comment.created_at ? " — تم التعديل" : ""}
                          </p>
                        </div>

                        {canEdit(comment) && (
                          <div className="flex flex-wrap gap-2">
                            {canModerate && (
                              <button
                                type="button"
                                onClick={() => void togglePin(comment)}
                                className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-black text-amber-800 hover:bg-amber-200"
                              >
                                {comment.is_pinned ? "إلغاء التثبيت" : "تثبيت"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(comment.id);
                                setEditingBody(comment.body);
                              }}
                              className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteComment(comment)}
                              className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                            >
                              حذف
                            </button>
                          </div>
                        )}
                      </div>

                      {editingId === comment.id ? (
                        <div className="mt-4">
                          <textarea
                            value={editingBody}
                            onChange={(event) => setEditingBody(event.target.value)}
                            rows={4}
                            maxLength={3000}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                          />
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => void saveEdit(comment)}
                              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white"
                            >
                              حفظ
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditingBody("");
                              }}
                              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-black"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-4 whitespace-pre-wrap break-words leading-8 text-slate-700">
                          {comment.body}
                        </p>
                      )}

                      {comment.attachment_url && (
                        <a
                          href={comment.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex max-w-full items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 hover:bg-blue-100"
                        >
                          <span>📎</span>
                          <span className="truncate">
                            {comment.attachment_name || "فتح المرفق"}
                          </span>
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
