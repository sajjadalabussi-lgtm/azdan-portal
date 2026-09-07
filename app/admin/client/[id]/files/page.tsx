"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Client = {
  id: number;
  name: string;
  project_name: string;
};

type ProjectFile = {
  id: number;
  client_id: number;
  title: string;
  description: string | null;
  category: string;
  storage_path: string;
  file_name: string;
  file_size: number | string;
  file_type: string | null;
  is_visible_to_client: boolean;
  created_at: string;
};

type ProjectFileRecord = ProjectFile;

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const categories = [
  { value: "contract", label: "العقد" },
  { value: "drawing", label: "المخططات" },
  { value: "boq", label: "جدول الكميات BOQ" },
  { value: "invoice", label: "الفواتير" },
  { value: "report", label: "التقارير" },
  { value: "document", label: "المستندات" },
  { value: "other", label: "أخرى" },
];

function getSafeExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex === -1) {
    return "";
  }

  return fileName
    .slice(lastDotIndex + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function createUniqueFileName(originalFileName: string) {
  const extension = getSafeExtension(originalFileName);

  const uniqueId =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return extension ? `${uniqueId}.${extension}` : uniqueId;
}

function getCategoryLabel(category: string) {
  return (
    categories.find((item) => item.value === category)?.label ||
    "أخرى"
  );
}

export default function ProjectFilesPage() {
  const params = useParams();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("document");
  const [isVisibleToClient, setIsVisibleToClient] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [deletingFileId, setDeletingFileId] =
    useState<number | null>(null);

  const [updatingVisibilityId, setUpdatingVisibilityId] =
    useState<number | null>(null);

  const [message, setMessage] = useState("");

  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [openingFileId, setOpeningFileId] = useState<number | null>(null);

  async function sendAutomaticNotification(
    title: string,
    messageText: string,
    notificationType: "file" | "update" = "file"
  ) {
    try {
      const response = await fetch(`/api/admin/client/${clientId}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message: messageText,
          notificationType,
        }),
      });
      return response.ok;
    } catch (error) {
      console.error("تعذر إرسال الإشعار التلقائي:", error);
      return false;
    }
  }

  // Important: all React hooks must run before any conditional return.
  const filteredFiles = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return files.filter((file) => {
      const matchesCategory =
        categoryFilter === "all" || file.category === categoryFilter;

      if (!matchesCategory) return false;
      if (!query) return true;

      return [file.title, file.file_name, file.description || ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [files, searchTerm, categoryFilter]);

  const loadData = useCallback(async () => {
    if (!Number.isFinite(clientId) || clientId <= 0) {
      setMessage("رقم العميل غير صحيح");
      setMessageType("error");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    setMessageType("");

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("id, name, project_name")
      .eq("id", clientId)
      .single();

    if (clientError || !clientData) {
      console.error(clientError);

      setMessage(
        `تعذر تحميل بيانات العميل: ${
          clientError?.message || "العميل غير موجود"
        }`
      );

      setMessageType("error");
      setLoading(false);
      return;
    }

    const { data: filesData, error: filesError } = await supabase
      .from("project_files")
      .select(
        `
          id,
          client_id,
          title,
          description,
          category,
          storage_path,
          file_name,
          file_size,
          file_type,
          is_visible_to_client,
          created_at
        `
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (filesError) {
      console.error(filesError);

      setMessage(
        `تعذر تحميل ملفات المشروع: ${filesError.message}`
      );

      setMessageType("error");
      setLoading(false);
      return;
    }

    const preparedFiles: ProjectFile[] =
      (filesData as ProjectFileRecord[] | null) ?? [];

    setClient(clientData);
    setFiles(preparedFiles);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function showMessage(
    text: string,
    type: "success" | "error"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] ?? null;

    setMessage("");
    setMessageType("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showMessage(
        "حجم الملف أكبر من الحد المسموح، الحد الأعلى 50MB",
        "error"
      );

      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);

    if (!title.trim()) {
      const lastDotIndex = file.name.lastIndexOf(".");

      const titleWithoutExtension =
        lastDotIndex > 0
          ? file.name.slice(0, lastDotIndex)
          : file.name;

      setTitle(titleWithoutExtension);
    }
  }

  async function uploadFile(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (uploading) {
      return;
    }

    if (!selectedFile) {
      showMessage("يرجى اختيار ملف للرفع", "error");
      return;
    }

    if (!title.trim()) {
      showMessage("يرجى كتابة عنوان الملف", "error");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      showMessage(
        "حجم الملف أكبر من الحد المسموح، الحد الأعلى 50MB",
        "error"
      );
      return;
    }

    setUploading(true);
    setMessage("");
    setMessageType("");

    const generatedFileName = createUniqueFileName(
      selectedFile.name
    );

    const storagePath = `${clientId}/${generatedFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("project-files")
      .upload(storagePath, selectedFile, {
        cacheControl: "3600",
        upsert: false,
        contentType:
          selectedFile.type || "application/octet-stream",
      });

    if (uploadError) {
      console.error(uploadError);

      showMessage(
        `تعذر رفع الملف: ${uploadError.message}`,
        "error"
      );

      setUploading(false);
      return;
    }

    const { data: insertedFile, error: databaseError } =
      await supabase
        .from("project_files")
        .insert({
          client_id: clientId,
          title: title.trim(),
          description: description.trim() || null,
          category,
          storage_path: storagePath,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          file_type:
            selectedFile.type || "application/octet-stream",
          is_visible_to_client: isVisibleToClient,
        })
        .select(
          `
            id,
            client_id,
            title,
            description,
            category,
            storage_path,
            file_name,
            file_size,
            file_type,
            is_visible_to_client,
            created_at
          `
        )
        .single();

    if (databaseError || !insertedFile) {
      console.error(databaseError);

      await supabase.storage
        .from("project-files")
        .remove([storagePath]);

      showMessage(
        `تعذر حفظ بيانات الملف: ${
          databaseError?.message || "حدث خطأ غير معروف"
        }`,
        "error"
      );

      setUploading(false);
      return;
    }

    const fileRecord = insertedFile as ProjectFileRecord;

    setFiles((currentFiles) => [
      fileRecord,
      ...currentFiles,
    ]);

    let notificationErrorMessage = "";

    if (fileRecord.is_visible_to_client) {
      const categoryLabel = getCategoryLabel(fileRecord.category);

      const notificationMessageParts = [
        `تم رفع ملف جديد بعنوان: ${fileRecord.title}.`,
        `التصنيف: ${categoryLabel}.`,
        `اسم الملف: ${fileRecord.file_name}.`,
      ];

      if (fileRecord.description) {
        notificationMessageParts.push(
          `الوصف: ${fileRecord.description}.`
        );
      }

      const notificationSent = await sendAutomaticNotification(
        "تم رفع ملف جديد",
        notificationMessageParts.join("\n"),
        "file"
      );

      if (!notificationSent) {
        notificationErrorMessage = "تعذر إرسال Push Notification";
      }
    }

    setTitle("");
    setDescription("");
    setCategory("document");
    setIsVisibleToClient(true);
    setSelectedFile(null);

    const fileInput = document.getElementById(
      "project-file-input"
    ) as HTMLInputElement | null;

    if (fileInput) {
      fileInput.value = "";
    }

    if (notificationErrorMessage) {
      showMessage(
        `تم رفع الملف بنجاح، لكن تعذر إرسال الإشعار للعميل: ${notificationErrorMessage}`,
        "error"
      );
    } else if (fileRecord.is_visible_to_client) {
      showMessage(
        "تم رفع الملف وإرسال إشعار للعميل بنجاح ✅",
        "success"
      );
    } else {
      showMessage(
        "تم رفع الملف بنجاح، ولم يُرسل إشعار لأنه مخفي عن العميل ✅",
        "success"
      );
    }

    setUploading(false);
  }

  async function openFile(file: ProjectFile) {
    if (openingFileId !== null) return;

    setOpeningFileId(file.id);
    setMessage("");
    setMessageType("");

    const { data, error } = await supabase.storage
      .from("project-files")
      .createSignedUrl(file.storage_path, 60);

    if (error || !data?.signedUrl) {
      console.error(error);
      showMessage(
        `تعذر فتح الملف: ${error?.message || "تعذر إنشاء رابط آمن"}`,
        "error"
      );
      setOpeningFileId(null);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    setOpeningFileId(null);
  }

  async function toggleVisibility(file: ProjectFile) {
    if (updatingVisibilityId !== null) {
      return;
    }

    setUpdatingVisibilityId(file.id);
    setMessage("");
    setMessageType("");

    const newVisibility = !file.is_visible_to_client;

    const { error } = await supabase
      .from("project_files")
      .update({
        is_visible_to_client: newVisibility,
      })
      .eq("id", file.id)
      .eq("client_id", clientId);

    if (error) {
      console.error(error);

      showMessage(
        `تعذر تغيير ظهور الملف: ${error.message}`,
        "error"
      );

      setUpdatingVisibilityId(null);
      return;
    }

    setFiles((currentFiles) =>
      currentFiles.map((currentFile) =>
        currentFile.id === file.id
          ? {
              ...currentFile,
              is_visible_to_client: newVisibility,
            }
          : currentFile
      )
    );

    if (newVisibility) {
      await sendAutomaticNotification(
        "ملف متاح الآن",
        `أصبح ملف «${file.title}» متاحًا لك ضمن ملفات المشروع.`,
        "file"
      );
    }

    showMessage(
      newVisibility
        ? "أصبح الملف ظاهرًا للعميل وتم إشعاره ✅"
        : "تم إخفاء الملف عن العميل ✅",
      "success"
    );

    setUpdatingVisibilityId(null);
  }

  async function deleteFile(file: ProjectFile) {
    if (deletingFileId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `هل تريد حذف ملف "${file.title}" نهائيًا؟`
    );

    if (!confirmed) {
      return;
    }

    setDeletingFileId(file.id);
    setMessage("");
    setMessageType("");

    const { error: storageError } = await supabase.storage
      .from("project-files")
      .remove([file.storage_path]);

    if (storageError) {
      console.error(storageError);

      showMessage(
        `تعذر حذف الملف من التخزين: ${storageError.message}`,
        "error"
      );

      setDeletingFileId(null);
      return;
    }

    const { error: databaseError } = await supabase
      .from("project_files")
      .delete()
      .eq("id", file.id)
      .eq("client_id", clientId);

    if (databaseError) {
      console.error(databaseError);

      showMessage(
        "تم حذف الملف من التخزين، لكن تعذر حذف سجله من قاعدة البيانات",
        "error"
      );

      setDeletingFileId(null);
      return;
    }

    setFiles((currentFiles) =>
      currentFiles.filter(
        (currentFile) => currentFile.id !== file.id
      )
    );

    showMessage("تم حذف الملف بنجاح ✅", "success");
    setDeletingFileId(null);
  }

  function formatFileSize(value: number | string) {
    const bytes = Number(value);

    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "الحجم غير متوفر";
    }

    if (bytes < 1024) {
      return `${bytes} بايت`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(
      bytes /
      (1024 * 1024 * 1024)
    ).toFixed(1)} GB`;
  }

  function formatDate(date: string) {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "التاريخ غير متوفر";
    }

    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(parsedDate);
  }

  function getFileIcon(fileName: string) {
    const extension = getSafeExtension(fileName);

    if (extension === "pdf") {
      return "📕";
    }

    if (
      extension === "doc" ||
      extension === "docx"
    ) {
      return "📘";
    }

    if (
      extension === "xls" ||
      extension === "xlsx"
    ) {
      return "📗";
    }

    if (
      extension === "dwg" ||
      extension === "dxf"
    ) {
      return "📐";
    }

    if (
      extension === "jpg" ||
      extension === "jpeg" ||
      extension === "png" ||
      extension === "webp"
    ) {
      return "🖼️";
    }

    if (
      extension === "zip" ||
      extension === "rar"
    ) {
      return "🗜️";
    }

    return "📄";
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-gray-100"
      >
        <p className="text-gray-600">
          جاري تحميل ملفات المشروع...
        </p>
      </main>
    );
  }

  if (!client) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-gray-100 px-5"
      >
        <div className="text-center">
          <p className="text-red-600">
            {message || "لم يتم العثور على العميل"}
          </p>

          <Link
            href="/admin/clients"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700"
          >
            رجوع للعملاء
          </Link>
        </div>
      </main>
    );
  }

  const visibleFilesCount = files.filter(
    (file) => file.is_visible_to_client
  ).length;

  const hiddenFilesCount =
    files.length - visibleFilesCount;

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f5f7fb] px-4 py-6 text-slate-900 sm:px-6 sm:py-8"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-l from-blue-600 via-blue-500 to-violet-500" />

          <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-black text-blue-700 ring-1 ring-blue-100">
                م
              </div>

              <div>
                <p className="text-xs font-bold tracking-wide text-slate-400">
                  إدارة ملفات المشروع
                </p>

                <h1 className="mt-1 text-2xl font-black text-blue-800 sm:text-3xl">
                  {client.project_name}
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span>العميل: <strong className="text-slate-700">{client.name}</strong></span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>رقم المشروع: #{client.id}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Link
                href={`/admin/client/${client.id}`}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                رجوع للمشروع
              </Link>

              <Link
                href={`/admin/client/${client.id}/finance`}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"
              >
                الإدارة المالية
              </Link>

              <Link
                href="/admin/clients"
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
              >
                قائمة العملاء
              </Link>
            </div>
          </div>
        </header>

        {message && (
          <div
            className={`mb-6 rounded-2xl border px-5 py-4 text-sm font-bold shadow-sm ${
              messageType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[24px] border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-500">جميع الملفات</p>
                <p className="mt-2 text-3xl font-black text-blue-700">{files.length}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl font-black text-blue-700">▤</div>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-500">ظاهرة للعميل</p>
                <p className="mt-2 text-3xl font-black text-emerald-600">{visibleFilesCount}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl text-emerald-700">◉</div>
            </div>
          </div>

          <div className="rounded-[24px] border border-amber-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-500">مخفية عن العميل</p>
                <p className="mt-2 text-3xl font-black text-amber-600">{hiddenFilesCount}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-xl text-amber-700">◌</div>
            </div>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
            <div>
              <h2 className="text-xl font-black text-slate-900">رفع ملف جديد</h2>
              <p className="mt-1 text-sm text-slate-500">
                أضف المستندات والمخططات والتقارير المرتبطة بالمشروع
              </p>
            </div>

            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
              الحد الأعلى 50MB
            </span>
          </div>

          <form onSubmit={uploadFile} className="grid gap-5 p-5 sm:p-7 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">عنوان الملف</label>
              <input
                type="text"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="مثال: المخطط الإنشائي"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">التصنيف</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              >
                {categories.map((categoryItem) => (
                  <option key={categoryItem.value} value={categoryItem.value}>
                    {categoryItem.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm font-black text-slate-700">وصف الملف</label>
                <span className="text-xs text-slate-400">اختياري</span>
              </div>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="اكتب وصفًا مختصرًا يوضح محتوى الملف..."
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm leading-7 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
              <p className="mt-1 text-left text-xs text-slate-400">{description.length}/500</p>
            </div>

            <div className="lg:col-span-2">
              <label
                htmlFor="project-file-input"
                className="group flex cursor-pointer flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-blue-200 bg-blue-50/40 px-5 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl text-blue-700 shadow-sm ring-1 ring-blue-100">
                  ↑
                </div>
                <p className="mt-3 font-black text-slate-800">
                  {selectedFile ? "تم اختيار الملف" : "اضغط هنا لاختيار ملف"}
                </p>
                <p className="mt-1 text-xs leading-6 text-slate-500">
                  PDF، Word، Excel، DWG، الصور والملفات المضغوطة
                </p>
                {selectedFile && (
                  <div className="mt-4 max-w-full rounded-xl bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-blue-100">
                    <p className="max-w-xl truncate font-bold text-blue-700">{selectedFile.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                )}
              </label>

              <input
                id="project-file-input"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.zip,.rar,.jpg,.jpeg,.png,.webp"
                className="sr-only"
              />
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 lg:col-span-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={isVisibleToClient}
                  onChange={(event) => setIsVisibleToClient(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-black text-slate-800">إظهار الملف للعميل</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    سيظهر داخل بوابة المشروع ويُرسل إشعار تلقائي عند الرفع
                  </p>
                </div>
              </label>

              <button
                type="submit"
                disabled={uploading}
                className="min-w-40 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? "جاري رفع الملف..." : "رفع الملف"}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">ملفات المشروع</h2>
                <p className="mt-1 text-sm text-slate-500">
                  إدارة وفتح وإظهار وإخفاء ملفات المشروع
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_190px]">
                <div className="relative">
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="ابحث باسم الملف..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
                </div>

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                >
                  <option value="all">جميع التصنيفات</option>
                  {categories.map((categoryItem) => (
                    <option key={categoryItem.value} value={categoryItem.value}>
                      {categoryItem.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {files.length === 0 ? (
            <div className="p-8 text-center sm:p-12">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">▤</div>
              <p className="mt-4 font-black text-slate-700">لا توجد ملفات مرفوعة حتى الآن</p>
              <p className="mt-1 text-sm text-slate-400">ارفع أول ملف للمشروع من النموذج أعلاه</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="p-10 text-center text-sm font-bold text-slate-500">
              لا توجد نتائج مطابقة للبحث أو التصنيف المحدد.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="px-5 py-3.5 text-right font-black">الملف</th>
                      <th className="px-4 py-3.5 text-right font-black">التصنيف</th>
                      <th className="px-4 py-3.5 text-right font-black">الحجم</th>
                      <th className="px-4 py-3.5 text-right font-black">تاريخ الرفع</th>
                      <th className="px-4 py-3.5 text-right font-black">الظهور</th>
                      <th className="px-5 py-3.5 text-center font-black">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFiles.map((file) => (
                      <tr key={file.id} className="transition hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                              {getFileIcon(file.file_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="max-w-[320px] truncate font-black text-slate-800" title={file.title}>{file.title}</p>
                              <p className="mt-1 max-w-[320px] truncate text-xs text-slate-400" title={file.file_name}>{file.file_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                            {getCategoryLabel(file.category)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-500">{formatFileSize(file.file_size)}</td>
                        <td className="px-4 py-4 text-slate-500">{formatDate(file.created_at)}</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${file.is_visible_to_client ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {file.is_visible_to_client ? "ظاهر للعميل" : "مخفي"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => openFile(file)}
                              disabled={openingFileId !== null}
                              className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                            >
                              {openingFileId === file.id ? "يفتح..." : "فتح"}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleVisibility(file)}
                              disabled={updatingVisibilityId !== null}
                              className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                            >
                              {updatingVisibilityId === file.id ? "تحديث..." : file.is_visible_to_client ? "إخفاء" : "إظهار"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteFile(file)}
                              disabled={deletingFileId !== null}
                              className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                            >
                              {deletingFileId === file.id ? "حذف..." : "حذف"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 p-4 md:hidden">
                {filteredFiles.map((file) => (
                  <article key={file.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">{getFileIcon(file.file_name)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="break-words font-black text-slate-800">{file.title}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${file.is_visible_to_client ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {file.is_visible_to_client ? "ظاهر" : "مخفي"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-400">{file.file_name}</p>
                      </div>
                    </div>

                    {file.description && (
                      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{file.description}</p>
                    )}

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <span>{getCategoryLabel(file.category)}</span>
                      <span>{formatFileSize(file.file_size)}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => openFile(file)} disabled={openingFileId !== null} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">فتح</button>
                      <button type="button" onClick={() => toggleVisibility(file)} disabled={updatingVisibilityId !== null} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">{file.is_visible_to_client ? "إخفاء" : "إظهار"}</button>
                      <button type="button" onClick={() => deleteFile(file)} disabled={deletingFileId !== null} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-600">حذف</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-xs text-slate-400 sm:px-7">
            <span>المعروض: {filteredFiles.length}</span>
            <span>إجمالي الملفات: {files.length}</span>
          </div>
        </section>
      </div>
    </main>
  );
}
