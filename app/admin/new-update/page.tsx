"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { logActivityClient } from "@/lib/log-activity-client";

type Client = {
  id: number;
  name: string;
  project_name: string;
};

type SelectedImage = {
  file: File;
};

export default function NewProjectUpdatePage() {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState("0");
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [loadingClients, setLoadingClients] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadClients() {
      setLoadingClients(true);

      const searchParams = new URLSearchParams(window.location.search);
      const clientIdFromUrl = searchParams.get("clientId");

      const { data, error } = await supabase
        .from("clients")
        .select("id, name, project_name")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(`تعذر تحميل العملاء: ${error.message}`);
        setLoadingClients(false);
        return;
      }

      const loadedClients = data ?? [];

      setClients(loadedClients);

      if (
        clientIdFromUrl &&
        loadedClients.some(
          (client) => String(client.id) === clientIdFromUrl
        )
      ) {
        setClientId(clientIdFromUrl);
      }

      setLoadingClients(false);
    }

    loadClients();
  }, []);

  function handleImagesChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    setMessage("");
    setUploadedCount(0);

    const imageFiles = selectedFiles.filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length !== selectedFiles.length) {
      setMessage("تم تجاهل الملفات التي ليست صورًا");
    }

    setImages(
      imageFiles.map((file) => ({
        file,
      }))
    );
  }

  function removeImage(indexToRemove: number) {
    setImages((currentImages) =>
      currentImages.filter((_, index) => index !== indexToRemove)
    );
  }

  function clearImages() {
    setImages([]);
    setUploadedCount(0);
    setFileInputKey((currentKey) => currentKey + 1);
  }

  async function saveUpdate() {
    if (!clientId) {
      setMessage("اختر العميل أولًا");
      return;
    }

    if (!title.trim()) {
      setMessage("اكتب عنوان التحديث");
      return;
    }

    const progressValue = Number(progress);

    if (
      !Number.isFinite(progressValue) ||
      progressValue < 0 ||
      progressValue > 100
    ) {
      setMessage("نسبة الإنجاز يجب أن تكون بين 0 و100");
      return;
    }

    setSaving(true);
    setMessage("");
    setUploadedCount(0);

    const { data: updateData, error: updateError } = await supabase
      .from("project_updates")
      .insert({
        client_id: Number(clientId),
        title: title.trim(),
        description: description.trim() || null,
        progress: progressValue,
      })
      .select("id")
      .single();

    if (updateError || !updateData) {
      setMessage(
        `تعذر إنشاء التحديث: ${
          updateError?.message || "خطأ غير معروف"
        }`
      );
      setSaving(false);
      return;
    }

    const updateId = updateData.id;

    let successCount = 0;
    let failedCount = 0;

    for (let index = 0; index < images.length; index++) {
      const file = images[index].file;

      const extension =
        file.name.split(".").pop()?.toLowerCase() || "jpg";

      const safeExtension =
        extension.replace(/[^a-z0-9]/g, "") || "jpg";

      const uniqueName = `${Date.now()}-${index}-${
        crypto.randomUUID().split("-")[0]
      }.${safeExtension}`;

      const storagePath = `${clientId}/${uniqueName}`;

      const { error: uploadError } = await supabase.storage
        .from("project-images")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        console.error(uploadError);
        failedCount += 1;
        continue;
      }

      const { error: imageRecordError } = await supabase
        .from("project_images")
        .insert({
          client_id: Number(clientId),
          update_id: updateId,
          storage_path: storagePath,
          description: title.trim(),
        });

      if (imageRecordError) {
        console.error(imageRecordError);

        await supabase.storage
          .from("project-images")
          .remove([storagePath]);

        failedCount += 1;
        continue;
      }

      successCount += 1;
      setUploadedCount(successCount);
    }

    const { error: clientUpdateError } = await supabase
      .from("clients")
      .update({
        progress: progressValue,
      })
      .eq("id", Number(clientId));

    if (clientUpdateError) {
      console.error(clientUpdateError);
    }

    const { error: notificationError } = await supabase
      .from("project_notifications")
      .insert({
        client_id: Number(clientId),
        title: "تم إضافة تحديث جديد",
        message: `تمت إضافة تحديث جديد بعنوان "${title.trim()}"\nنسبة الإنجاز الحالية: ${progressValue}%`,
        notification_type: "update",
      });

    if (notificationError) {
      console.error(notificationError);
    }

    await logActivityClient({
      action: "create",
      entityType: "project_updates",
      entityId: updateData?.id ?? null,
      description: `أضاف تحديثًا جديدًا: ${title.trim()}`,
      newData: { client_id: clientId, title: title.trim(), description: description.trim() || null, progress: progressValue },
    });

    setSaving(false);

    if (failedCount === 0) {
      setMessage(
        images.length > 0
          ? `تم حفظ التحديث ورفع ${successCount} صورة بنجاح ✅`
          : "تم حفظ التحديث بنجاح ✅"
      );

      setTimeout(() => {
        router.push(`/admin/client/${clientId}`);
        router.refresh();
      }, 1000);

      return;
    }

    setMessage(
      `تم حفظ التحديث، ورفع ${successCount} صورة، وتعذر رفع ${failedCount} صورة`
    );
  }

  function goBack() {
    if (clientId) {
      router.push(`/admin/client/${clientId}`);
      return;
    }

    router.push("/admin");
  }

  const selectedClient = clients.find(
    (client) => String(client.id) === clientId
  );

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-100 px-5 py-10 text-gray-900"
    >
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-blue-700">
          إضافة تحديث جديد
        </h1>

        <p className="mt-2 text-gray-500">
          أضف مرحلة جديدة للمشروع مع الوصف والصور
        </p>

        <div className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block font-medium">
              العميل والمشروع
            </label>

            <select
              value={clientId}
              disabled={loadingClients || saving}
              onChange={(event) => {
                setClientId(event.target.value);
                setMessage("");
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60"
            >
              <option value="">
                {loadingClients
                  ? "جاري تحميل العملاء..."
                  : "اختر العميل"}
              </option>

              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} — {client.project_name}
                </option>
              ))}
            </select>
          </div>

          {selectedClient && (
            <div className="rounded-lg bg-blue-50 p-4 text-blue-800">
              سيتم إضافة التحديث إلى مشروع:
              <span className="mr-1 font-bold">
                {selectedClient.project_name}
              </span>
            </div>
          )}

          <div>
            <label className="mb-2 block font-medium">
              عنوان التحديث
            </label>

            <input
              type="text"
              value={title}
              disabled={saving}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="مثال: أعمال الطابوق"
              maxLength={120}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              وصف التحديث
            </label>

            <textarea
              value={description}
              disabled={saving}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="مثال: تم الانتهاء من بناء الجدران الخارجية للطابق الأول"
              rows={5}
              maxLength={1000}
              className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              نسبة الإنجاز بعد التحديث
            </label>

            <input
              type="number"
              min="0"
              max="100"
              value={progress}
              disabled={saving}
              onChange={(event) => setProgress(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              صور التحديث
            </label>

            <input
              key={fileInputKey}
              type="file"
              accept="image/*"
              multiple
              disabled={saving}
              onChange={handleImagesChange}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 disabled:opacity-60"
            />
          </div>

          {images.length > 0 && (
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  الصور المختارة: {images.length}
                </p>

                <button
                  type="button"
                  onClick={clearImages}
                  disabled={saving}
                  className="text-sm text-red-600 disabled:opacity-60"
                >
                  إزالة الكل
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {images.map((image, index) => (
                  <div
                    key={`${image.file.name}-${image.file.lastModified}-${index}`}
                    className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {image.file.name}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {(image.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      disabled={saving}
                      className="mr-3 rounded-lg bg-red-100 px-3 py-1 text-sm text-red-600 disabled:opacity-60"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {saving && images.length > 0 && (
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-center text-blue-700">
                جاري رفع الصور: {uploadedCount} من {images.length}
              </p>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{
                    width: `${
                      images.length > 0
                        ? (uploadedCount / images.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {message && (
            <p className="rounded-lg bg-gray-100 p-4 text-center">
              {message}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={saveUpdate}
              disabled={saving || loadingClients}
              className="flex-1 rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "جاري حفظ التحديث..." : "حفظ التحديث"}
            </button>

            <button
              type="button"
              onClick={goBack}
              disabled={saving}
              className="rounded-lg bg-gray-200 px-6 py-3 text-gray-700 hover:bg-gray-300 disabled:opacity-60"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}