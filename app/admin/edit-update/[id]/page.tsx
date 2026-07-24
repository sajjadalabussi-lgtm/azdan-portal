"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { logActivityClient } from "@/lib/log-activity-client";

type UpdateData = {
  id: number;
  client_id: number;
  title: string;
  description: string | null;
  progress: number;
  created_at: string;
};

type ExistingImage = {
  id: number;
  path: string;
  name: string;
  publicUrl: string;
};

function clampProgress(value: number) {
  return Math.min(Math.max(Number(value) || 0, 0), 100);
}

export default function EditUpdatePage() {
  const params = useParams();
  const router = useRouter();

  const updateId = Number(params.id);

  const [update, setUpdate] = useState<UpdateData | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState("0");

  const [existingImages, setExistingImages] = useState<
    ExistingImage[]
  >([]);

  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingImageId, setDeletingImageId] =
    useState<number | null>(null);

  const [uploadedCount, setUploadedCount] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadUpdate() {
      if (!Number.isFinite(updateId) || updateId <= 0) {
        setMessage("رقم التحديث غير صحيح");
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage("");

      const { data: updateData, error: updateError } = await supabase
        .from("project_updates")
        .select(
          "id, client_id, title, description, progress, created_at"
        )
        .eq("id", updateId)
        .single();

      if (updateError || !updateData) {
        setMessage(
          `تعذر تحميل التحديث: ${
            updateError?.message || "التحديث غير موجود"
          }`
        );
        setLoading(false);
        return;
      }

      const { data: imageData, error: imageError } = await supabase
        .from("project_images")
        .select("id, storage_path")
        .eq("update_id", updateId)
        .order("created_at", { ascending: false });

      if (imageError) {
        setMessage(
          `تعذر تحميل صور التحديث: ${imageError.message}`
        );
        setLoading(false);
        return;
      }

      const preparedImages: ExistingImage[] = (imageData ?? []).map(
        (image) => {
          const { data } = supabase.storage
            .from("project-images")
            .getPublicUrl(image.storage_path);

          return {
            id: image.id,
            path: image.storage_path,
            name:
              image.storage_path.split("/").pop() ||
              image.storage_path,
            publicUrl: data.publicUrl,
          };
        }
      );

      setUpdate(updateData);
      setTitle(updateData.title);
      setDescription(updateData.description ?? "");
      setProgress(String(clampProgress(updateData.progress)));
      setExistingImages(preparedImages);
      setLoading(false);
    }

    loadUpdate();
  }, [updateId]);

  function handleFilesChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selectedFiles = Array.from(
      event.target.files ?? []
    );

    setMessage("");
    setUploadedCount(0);

    const imageFiles = selectedFiles.filter((file) =>
      file.type.startsWith("image/")
    );

    if (selectedFiles.length !== imageFiles.length) {
      setMessage("تم تجاهل الملفات التي ليست صورًا");
    }

    setNewFiles(imageFiles);
  }

  function removeNewFile(indexToRemove: number) {
    setNewFiles((currentFiles) =>
      currentFiles.filter(
        (_, index) => index !== indexToRemove
      )
    );
  }

  function clearNewFiles() {
    setNewFiles([]);
    setUploadedCount(0);
    setFileInputKey((currentKey) => currentKey + 1);
  }

  async function deleteExistingImage(image: ExistingImage) {
    if (deletingImageId !== null || saving) {
      return;
    }

    const confirmed = window.confirm(
      "هل تريد حذف هذه الصورة من التحديث نهائيًا؟"
    );

    if (!confirmed) return;

    setDeletingImageId(image.id);
    setMessage("");

    const { error: storageError } = await supabase.storage
      .from("project-images")
      .remove([image.path]);

    if (storageError) {
      setMessage(
        `تعذر حذف الصورة: ${storageError.message}`
      );
      setDeletingImageId(null);
      return;
    }

    const { error: databaseError } = await supabase
      .from("project_images")
      .delete()
      .eq("id", image.id)
      .eq("update_id", updateId);

    if (databaseError) {
      setMessage(
        "تم حذف الصورة من التخزين، لكن تعذر حذف سجلها"
      );
      setDeletingImageId(null);
      return;
    }

    await logActivityClient({
      action: "delete",
      entityType: "project_images",
      entityId: image.id,
      description: `حذف صورة من التحديث رقم ${updateId}`,
    });

    setExistingImages((currentImages) =>
      currentImages.filter(
        (currentImage) => currentImage.id !== image.id
      )
    );

    setMessage("تم حذف الصورة بنجاح ✅");
    setDeletingImageId(null);
  }

  async function updateClientProgressIfLatest(
    clientId: number,
    progressValue: number
  ) {
    const { data: latestUpdate, error } = await supabase
      .from("project_updates")
      .select("id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      return;
    }

    if (latestUpdate?.id !== updateId) {
      return;
    }

    const { error: clientError } = await supabase
      .from("clients")
      .update({ progress: progressValue })
      .eq("id", clientId);

    if (clientError) {
      console.error(clientError);
    }
  }

  async function saveUpdate() {
    if (!update) {
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

    const { error: updateError } = await supabase
      .from("project_updates")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        progress: progressValue,
      })
      .eq("id", updateId)
      .eq("client_id", update.client_id);

    if (updateError) {
      setMessage(
        `تعذر تعديل التحديث: ${updateError.message}`
      );
      setSaving(false);
      return;
    }

    await logActivityClient({
      action: "update",
      entityType: "project_updates",
      entityId: updateId,
      description: `عدّل التحديث: ${title.trim()}`,
      newData: { title: title.trim(), description: description.trim() || null, progress: progressValue },
    });

    let successCount = 0;
    let failedCount = 0;

    for (let index = 0; index < newFiles.length; index++) {
      const file = newFiles[index];

      const extension =
        file.name.split(".").pop()?.toLowerCase() || "jpg";

      const safeExtension =
        extension.replace(/[^a-z0-9]/g, "") || "jpg";

      const uniqueName = `${Date.now()}-${index}-${
        crypto.randomUUID().split("-")[0]
      }.${safeExtension}`;

      const storagePath = `${update.client_id}/${uniqueName}`;

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

      const { data: imageRecord, error: imageRecordError } =
        await supabase
          .from("project_images")
          .insert({
            client_id: update.client_id,
            update_id: updateId,
            storage_path: storagePath,
            description: title.trim(),
          })
          .select("id")
          .single();

      if (imageRecordError || !imageRecord) {
        console.error(imageRecordError);

        await supabase.storage
          .from("project-images")
          .remove([storagePath]);

        failedCount += 1;
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from("project-images")
        .getPublicUrl(storagePath);

      setExistingImages((currentImages) => [
        {
          id: imageRecord.id,
          path: storagePath,
          name: uniqueName,
          publicUrl: publicUrlData.publicUrl,
        },
        ...currentImages,
      ]);

      successCount += 1;
      setUploadedCount(successCount);
    }

    await updateClientProgressIfLatest(
      update.client_id,
      progressValue
    );

    setNewFiles([]);
    setFileInputKey((currentKey) => currentKey + 1);
    setSaving(false);

    if (failedCount === 0) {
      setMessage(
        successCount > 0
          ? `تم تعديل التحديث ورفع ${successCount} صورة بنجاح ✅`
          : "تم تعديل التحديث بنجاح ✅"
      );

      setTimeout(() => {
        router.push(`/admin/client/${update.client_id}`);
        router.refresh();
      }, 1000);

      return;
    }

    setMessage(
      `تم تعديل التحديث، ورفع ${successCount} صورة، وتعذر رفع ${failedCount} صورة`
    );
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-gray-100"
      >
        <p className="text-gray-600">
          جاري تحميل التحديث...
        </p>
      </main>
    );
  }

  if (!update) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-gray-100 px-5"
      >
        <div className="text-center">
          <p className="text-red-600">
            {message || "لم يتم العثور على التحديث"}
          </p>

          <Link
            href="/admin/clients"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-3 text-white"
          >
            رجوع للعملاء
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 sm:px-6 sm:py-10"
    >
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-5 shadow-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-700">
              تعديل التحديث
            </h1>

            <p className="mt-2 text-gray-500">
              عدّل تفاصيل المرحلة أو أضف واحذف الصور
            </p>
          </div>

          <Link
            href={`/admin/client/${update.client_id}`}
            className="rounded-lg bg-gray-200 px-5 py-3 text-center text-gray-700 hover:bg-gray-300"
          >
            رجوع للمشروع
          </Link>
        </div>

        <div className="mt-8 space-y-6">
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
              onChange={(event) =>
                setDescription(event.target.value)
              }
              rows={5}
              maxLength={1000}
              placeholder="اكتب تفاصيل الأعمال المنجزة"
              className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              نسبة الإنجاز
            </label>

            <input
              type="number"
              min="0"
              max="100"
              value={progress}
              disabled={saving}
              onChange={(event) =>
                setProgress(event.target.value)
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-60"
            />

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{
                  width: `${clampProgress(Number(progress))}%`,
                }}
              />
            </div>
          </div>

          <section className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  الصور الحالية
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  عدد الصور: {existingImages.length}
                </p>
              </div>
            </div>

            {existingImages.length === 0 ? (
              <p className="mt-5 rounded-lg bg-gray-50 p-5 text-center text-gray-500">
                لا توجد صور مرتبطة بهذا التحديث
              </p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {existingImages.map((image) => (
                  <article
                    key={image.id}
                    className="overflow-hidden rounded-xl border border-gray-200"
                  >
                    <a
                      href={image.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden"
                    >
                      <img
                        src={image.publicUrl}
                        alt="صورة التحديث"
                        loading="lazy"
                        className="h-48 w-full object-cover transition duration-300 hover:scale-105"
                      />
                    </a>

                    <div className="p-3">
                      <p
                        className="truncate text-xs text-gray-500"
                        title={image.name}
                      >
                        {image.name}
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          deleteExistingImage(image)
                        }
                        disabled={
                          saving || deletingImageId !== null
                        }
                        className="mt-3 w-full rounded-lg bg-red-600 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingImageId === image.id
                          ? "جاري الحذف..."
                          : "حذف الصورة"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 p-4">
            <h2 className="text-xl font-bold">
              إضافة صور جديدة
            </h2>

            <input
              key={fileInputKey}
              type="file"
              accept="image/*"
              multiple
              disabled={saving}
              onChange={handleFilesChange}
              className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 disabled:opacity-60"
            />

            {newFiles.length > 0 && (
              <div className="mt-5 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    الصور الجديدة: {newFiles.length}
                  </p>

                  <button
                    type="button"
                    onClick={clearNewFiles}
                    disabled={saving}
                    className="text-sm text-red-600 disabled:opacity-60"
                  >
                    إزالة الكل
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {newFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {file.name}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeNewFile(index)}
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
          </section>

          {saving && newFiles.length > 0 && (
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-center text-blue-700">
                جاري رفع الصور: {uploadedCount} من{" "}
                {newFiles.length}
              </p>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{
                    width:
                      newFiles.length > 0
                        ? `${
                            (uploadedCount / newFiles.length) * 100
                          }%`
                        : "0%",
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

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={saveUpdate}
              disabled={saving || deletingImageId !== null}
              className="flex-1 rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "جاري حفظ التعديلات..."
                : "حفظ التعديلات"}
            </button>

            <Link
              href={`/admin/client/${update.client_id}`}
              className="rounded-lg bg-gray-200 px-6 py-3 text-center text-gray-700 hover:bg-gray-300"
            >
              إلغاء
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}