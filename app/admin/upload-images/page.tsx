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
  description: string;
};

export default function UploadImagesPage() {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [uploadedCount, setUploadedCount] = useState(0);

  useEffect(() => {
    async function loadClients() {
      setLoadingClients(true);
      setMessage("");

      const searchParams = new URLSearchParams(window.location.search);
      const clientIdFromUrl = searchParams.get("clientId");

      const { data, error } = await supabase
        .from("clients")
        .select("id, name, project_name")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
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

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    setMessage("");
    setUploadedCount(0);

    if (selectedFiles.length === 0) {
      setSelectedImages([]);
      return;
    }

    const imageFiles = selectedFiles.filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length !== selectedFiles.length) {
      setMessage("تم تجاهل الملفات التي ليست صورًا");
    }

    setSelectedImages(
      imageFiles.map((file) => ({
        file,
        description: "",
      }))
    );
  }

  function updateDescription(index: number, description: string) {
    setSelectedImages((currentImages) =>
      currentImages.map((image, imageIndex) =>
        imageIndex === index
          ? {
              ...image,
              description,
            }
          : image
      )
    );
  }

  function removeImage(imageIndex: number) {
    setSelectedImages((currentImages) =>
      currentImages.filter((_, index) => index !== imageIndex)
    );
  }

  function clearImages() {
    setSelectedImages([]);
    setMessage("");
    setUploadedCount(0);
    setFileInputKey((currentKey) => currentKey + 1);
  }

  async function uploadImages() {
    if (!clientId) {
      setMessage("اختر العميل أولًا");
      return;
    }

    if (selectedImages.length === 0) {
      setMessage("اختر صورة واحدة على الأقل");
      return;
    }

    setUploading(true);
    setMessage("");
    setUploadedCount(0);

    let successCount = 0;
    const failedFiles: string[] = [];

    for (let index = 0; index < selectedImages.length; index++) {
      const selectedImage = selectedImages[index];
      const file = selectedImage.file;

      const originalExtension =
        file.name.split(".").pop()?.toLowerCase() || "jpg";

      const safeExtension = originalExtension.replace(
        /[^a-z0-9]/g,
        ""
      );

      const uniqueName = `${Date.now()}-${index}-${
        crypto.randomUUID().split("-")[0]
      }.${safeExtension || "jpg"}`;

      const filePath = `${clientId}/${uniqueName}`;

      const { error: uploadError } = await supabase.storage
        .from("project-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        console.error(uploadError);
        failedFiles.push(file.name);
        continue;
      }

      const { error: databaseError } = await supabase
        .from("project_images")
        .insert({
          client_id: Number(clientId),
          storage_path: filePath,
          description: selectedImage.description.trim() || null,
        });

      if (databaseError) {
        console.error(databaseError);

        await supabase.storage
          .from("project-images")
          .remove([filePath]);

        failedFiles.push(file.name);
        continue;
      }

      successCount += 1;
      setUploadedCount(successCount);
    }

    if (successCount > 0) {
      await logActivityClient({
        action: "create",
        entityType: "project_images",
        entityId: null,
        description: `رفع ${successCount} صورة للمشروع رقم ${clientId}`,
        newData: { client_id: Number(clientId), count: successCount },
      });
    }

    setUploading(false);

    if (successCount > 0) {
      const { error: notificationError } = await supabase
        .from("project_notifications")
        .insert({
          client_id: Number(clientId),
          title: "تمت إضافة صور جديدة",
          message: `تمت إضافة ${successCount} صورة جديدة إلى المشروع`,
          notification_type: "images",
        });

      if (notificationError) {
        console.error(notificationError);
      }
    }

    if (failedFiles.length === 0) {
      setMessage(`تم رفع ${successCount} صورة بنجاح ✅`);
      setSelectedImages([]);
      setFileInputKey((currentKey) => currentKey + 1);

      setTimeout(() => {
        router.push(`/admin/client/${clientId}`);
        router.refresh();
      }, 1000);

      return;
    }

    if (successCount > 0) {
      setMessage(
        `تم رفع ${successCount} صورة، وتعذر رفع ${failedFiles.length} صورة`
      );
      return;
    }

    setMessage("تعذر رفع الصور. تأكد من إعداد جدول project_images");
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
      className="min-h-screen bg-gray-100 px-6 py-10 text-gray-900"
    >
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-blue-700">
          رفع صور المشروع
        </h1>

        <p className="mt-2 text-gray-500">
          اختر الصور وأضف وصفًا لكل صورة
        </p>

        <div className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block font-medium text-gray-700">
              العميل والمشروع
            </label>

            <select
              value={clientId}
              disabled={loadingClients || uploading}
              onChange={(event) => {
                setClientId(event.target.value);
                setMessage("");
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black outline-none focus:border-blue-500 disabled:opacity-60"
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
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-700">
                سيتم رفع الصور إلى مشروع:
              </p>

              <p className="mt-1 font-bold text-blue-900">
                {selectedClient.project_name}
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block font-medium text-gray-700">
              اختر الصور
            </label>

            <input
              key={fileInputKey}
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={handleFilesChange}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black disabled:opacity-60"
            />
          </div>

          {selectedImages.length > 0 && (
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-700">
                  الصور المختارة: {selectedImages.length}
                </p>

                <button
                  type="button"
                  onClick={clearImages}
                  disabled={uploading}
                  className="text-sm text-red-600 hover:text-red-700 disabled:opacity-60"
                >
                  إزالة الكل
                </button>
              </div>

              <div className="mt-4 max-h-[500px] space-y-4 overflow-y-auto">
                {selectedImages.map((selectedImage, index) => (
                  <div
                    key={`${selectedImage.file.name}-${selectedImage.file.lastModified}-${index}`}
                    className="rounded-xl bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {selectedImage.file.name}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {(
                            selectedImage.file.size /
                            1024 /
                            1024
                          ).toFixed(2)}{" "}
                          MB
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        disabled={uploading}
                        className="rounded-lg bg-red-100 px-3 py-1 text-sm text-red-600 hover:bg-red-200 disabled:opacity-60"
                      >
                        حذف
                      </button>
                    </div>

                    <div className="mt-3">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        وصف الصورة
                      </label>

                      <input
                        type="text"
                        value={selectedImage.description}
                        disabled={uploading}
                        onChange={(event) =>
                          updateDescription(index, event.target.value)
                        }
                        placeholder="مثال: إكمال بناء جدران الطابق الأول"
                        maxLength={250}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black outline-none focus:border-blue-500 disabled:opacity-60"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploading && (
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-center text-blue-700">
                جاري رفع الصور: {uploadedCount} من{" "}
                {selectedImages.length}
              </p>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{
                    width:
                      selectedImages.length > 0
                        ? `${
                            (uploadedCount / selectedImages.length) * 100
                          }%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          )}

          {message && (
            <p className="rounded-lg bg-gray-100 p-3 text-center text-gray-700">
              {message}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={uploadImages}
              disabled={
                uploading ||
                loadingClients ||
                selectedImages.length === 0 ||
                !clientId
              }
              className="flex-1 rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading
                ? `جاري الرفع (${uploadedCount}/${selectedImages.length})`
                : `رفع الصور (${selectedImages.length})`}
            </button>

            <button
              type="button"
              onClick={goBack}
              disabled={uploading}
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