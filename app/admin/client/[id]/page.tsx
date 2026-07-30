"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { logActivityClient } from "@/lib/log-activity-client";
import Permission from "@/app/admin/permission";

type Client = {
  id: number;
  name: string;
  phone: string | null;
  project_name: string;
  progress: number;
  status: string;
};

type UpdateImage = {
  id: number;
  name: string;
  path: string;
  publicUrl: string;
  description: string | null;
  createdAt: string | null;
};

type ProjectUpdate = {
  id: number;
  title: string;
  description: string | null;
  progress: number;
  createdAt: string;
  images: UpdateImage[];
};

type ImageRecord = {
  id: number;
  update_id: number | null;
  storage_path: string;
  description: string | null;
  created_at: string;
};

type UpdateRecord = {
  id: number;
  title: string;
  description: string | null;
  progress: number;
  created_at: string;
};

function clampProgress(value: number) {
  return Math.min(Math.max(Number(value) || 0, 0), 100);
}

export default function ClientDetailsPage() {
  const params = useParams();
  const clientId = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [legacyImages, setLegacyImages] = useState<UpdateImage[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [deletingUpdateId, setDeletingUpdateId] =
    useState<number | null>(null);

  const [deletingImagePath, setDeletingImagePath] =
    useState<string | null>(null);

  const loadClientDetails = useCallback(async () => {
    if (!Number.isFinite(clientId) || clientId <= 0) {
      setMessage("رقم العميل غير صحيح");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("id, name, phone, project_name, progress, status")
      .eq("id", clientId)
      .single();

    if (clientError || !clientData) {
      setMessage(
        `تعذر تحميل بيانات العميل: ${
          clientError?.message || "العميل غير موجود"
        }`
      );
      setLoading(false);
      return;
    }

    const { data: updatesData, error: updatesError } = await supabase
      .from("project_updates")
      .select("id, title, description, progress, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (updatesError) {
      console.error(updatesError);

      setMessage(
        `تعذر تحميل تحديثات المشروع: ${updatesError.message}`
      );

      setLoading(false);
      return;
    }

    const { data: imageRecordsData, error: imageRecordsError } =
      await supabase
        .from("project_images")
        .select(
          "id, update_id, storage_path, description, created_at"
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

    if (imageRecordsError) {
      console.error(imageRecordsError);

      setMessage(
        `تعذر تحميل بيانات الصور: ${imageRecordsError.message}`
      );

      setLoading(false);
      return;
    }

    const updateRecords =
      (updatesData as UpdateRecord[] | null) ?? [];

    const imageRecords =
      (imageRecordsData as ImageRecord[] | null) ?? [];

    const preparedImages: UpdateImage[] = imageRecords.map(
      (imageRecord) => {
        const { data } = supabase.storage
          .from("project-images")
          .getPublicUrl(imageRecord.storage_path);

        return {
          id: imageRecord.id,
          name:
            imageRecord.storage_path.split("/").pop() ||
            imageRecord.storage_path,
          path: imageRecord.storage_path,
          publicUrl: data.publicUrl,
          description: imageRecord.description,
          createdAt: imageRecord.created_at,
        };
      }
    );

    const imageMap = new Map<number, UpdateImage>(
      preparedImages.map((image) => [image.id, image])
    );

    const preparedUpdates: ProjectUpdate[] = updateRecords.map(
      (updateRecord) => ({
        id: updateRecord.id,
        title: updateRecord.title,
        description: updateRecord.description,
        progress: clampProgress(updateRecord.progress),
        createdAt: updateRecord.created_at,
        images: imageRecords
          .filter(
            (imageRecord) =>
              Number(imageRecord.update_id) === updateRecord.id
          )
          .map((imageRecord) => imageMap.get(imageRecord.id))
          .filter(
            (image): image is UpdateImage => image !== undefined
          ),
      })
    );

    const preparedLegacyImages = imageRecords
      .filter((imageRecord) => imageRecord.update_id === null)
      .map((imageRecord) => imageMap.get(imageRecord.id))
      .filter(
        (image): image is UpdateImage => image !== undefined
      );

    setClient(clientData);
    setUpdates(preparedUpdates);
    setLegacyImages(preparedLegacyImages);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    loadClientDetails();
  }, [loadClientDetails]);

  function formatDate(date: string | null) {
    if (!date) {
      return "التاريخ غير متوفر";
    }

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

  async function updateClientProgressAfterDeletion(
    deletedUpdateId: number
  ) {
    const remainingUpdates = updates.filter(
      (update) => update.id !== deletedUpdateId
    );

    const newProgress =
      remainingUpdates.length > 0
        ? clampProgress(remainingUpdates[0].progress)
        : 0;

    const { error } = await supabase
      .from("clients")
      .update({ progress: newProgress })
      .eq("id", clientId);

    if (error) {
      console.error(error);
      return;
    }

    setClient((currentClient) =>
      currentClient
        ? {
            ...currentClient,
            progress: newProgress,
          }
        : currentClient
    );
  }

  async function deleteUpdate(update: ProjectUpdate) {
    if (deletingUpdateId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `هل تريد حذف تحديث "${update.title}" مع جميع صوره نهائيًا؟`
    );

    if (!confirmed) {
      return;
    }

    setDeletingUpdateId(update.id);
    setMessage("");

    const imagePaths = update.images.map((image) => image.path);

    if (imagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("project-images")
        .remove(imagePaths);

      if (storageError) {
        console.error(storageError);

        setMessage(
          `تعذر حذف صور التحديث: ${storageError.message}`
        );

        setDeletingUpdateId(null);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("project_updates")
      .delete()
      .eq("id", update.id)
      .eq("client_id", clientId);

    if (deleteError) {
      console.error(deleteError);

      setMessage(
        `تعذر حذف التحديث: ${deleteError.message}`
      );

      setDeletingUpdateId(null);
      return;
    }

    await logActivityClient({
      action: "delete",
      entityType: "project_updates",
      entityId: update.id,
      description: `حذف التحديث: ${update.title}`,
      oldData: update,
    });

    const wasLatestUpdate = updates[0]?.id === update.id;

    setUpdates((currentUpdates) =>
      currentUpdates.filter(
        (currentUpdate) => currentUpdate.id !== update.id
      )
    );

    if (wasLatestUpdate) {
      await updateClientProgressAfterDeletion(update.id);
    }

    setMessage("تم حذف التحديث مع جميع صوره بنجاح ✅");
    setDeletingUpdateId(null);
  }

  async function deleteLegacyImage(image: UpdateImage) {
    if (deletingImagePath !== null) {
      return;
    }

    const confirmed = window.confirm(
      "هل تريد حذف هذه الصورة القديمة نهائيًا؟"
    );

    if (!confirmed) {
      return;
    }

    setDeletingImagePath(image.path);
    setMessage("");

    const { error: storageError } = await supabase.storage
      .from("project-images")
      .remove([image.path]);

    if (storageError) {
      setMessage(
        `تعذر حذف الصورة: ${storageError.message}`
      );

      setDeletingImagePath(null);
      return;
    }

    const { error: databaseError } = await supabase
      .from("project_images")
      .delete()
      .eq("id", image.id)
      .eq("client_id", clientId);

    if (databaseError) {
      console.error(databaseError);

      setMessage(
        "تم حذف الصورة من التخزين، لكن تعذر حذف سجلها"
      );

      setDeletingImagePath(null);
      return;
    }

    await logActivityClient({
      action: "delete",
      entityType: "project_images",
      entityId: image.id,
      description: `حذف صورة قديمة من المشروع رقم ${clientId}`,
      oldData: image,
    });

    setLegacyImages((currentImages) =>
      currentImages.filter(
        (currentImage) => currentImage.id !== image.id
      )
    );

    setMessage("تم حذف الصورة القديمة بنجاح ✅");
    setDeletingImagePath(null);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-gray-100"
      >
        <p className="text-gray-600">
          جاري تحميل بيانات المشروع...
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
            {message || "لم يتم العثور على بيانات العميل"}
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

  const safeProgress = clampProgress(client.progress);

  const totalUpdateImages = updates.reduce(
    (total, update) => total + update.images.length,
    0
  );

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 sm:px-6 sm:py-10"
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-5 rounded-2xl bg-white p-5 shadow sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-700 sm:text-3xl">
              {client.project_name}
            </h1>

            <p className="mt-2 text-gray-500">
              تفاصيل العميل وتحديثات مراحل المشروع
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/clients"
              className="rounded-lg bg-gray-200 px-4 py-3 text-gray-700 hover:bg-gray-300"
            >
              رجوع للعملاء
            </Link>

            <Permission permission="manage_clients">
              <Link
                href={`/admin/edit-client/${client.id}`}
                className="rounded-lg bg-amber-500 px-4 py-3 text-white hover:bg-amber-600"
              >
                تعديل بيانات العميل
              </Link>
            </Permission>

            <Permission permission="manage_finance">
              <Link
                href={`/admin/client/${client.id}/finance`}
                className="rounded-lg bg-purple-600 px-4 py-3 text-white hover:bg-purple-700"
              >
                الإدارة المالية
              </Link>
            </Permission>

            <Permission permission="manage_files">
              <Link
                href={`/admin/client/${client.id}/files`}
                className="rounded-lg bg-cyan-600 px-4 py-3 text-white hover:bg-cyan-700"
              >
                ملفات المشروع
              </Link>
            </Permission>

            <Permission permission="view_reports">
              <Link
                href={`/admin/client/${client.id}/report`}
                className="rounded-lg bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-700"
              >
                📄 تقرير المشروع
              </Link>
            </Permission>

            <Permission permission="manage_updates">
              <Link
                href={`/admin/client/${client.id}/tasks`}
                className="rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700"
              >
                مهام المشروع
              </Link>
            </Permission>

            <Permission permission="manage_updates">
              <Link
                href={`/admin/client/${client.id}/comments`}
                className="rounded-lg bg-slate-700 px-4 py-3 text-white hover:bg-slate-800"
              >
                💬 تعليقات المشروع
              </Link>
            </Permission>

            <Permission permission="manage_updates">
              <Link
                href={`/admin/new-update?clientId=${client.id}`}
                className="rounded-lg bg-green-600 px-4 py-3 text-white hover:bg-green-700"
              >
                إضافة تحديث جديد
              </Link>
            </Permission>
          </div>
        </header>

        {message && (
          <p className="mb-6 rounded-xl bg-white p-4 text-center text-gray-700 shadow">
            {message}
          </p>
        )}

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              اسم العميل
            </p>

            <p className="mt-2 font-bold">
              {client.name}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              رقم الهاتف
            </p>

            <p className="mt-2 font-bold">
              {client.phone || "غير مسجل"}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              حالة المشروع
            </p>

            <p className="mt-2 font-bold text-green-600">
              {client.status}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              نسبة الإنجاز الحالية
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-700">
              {safeProgress}%
            </p>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${safeProgress}%` }}
              />
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-4 shadow sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                تحديثات المشروع
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                كل تحديث يحتوي على عنوان ووصف ونسبة إنجاز وصور
              </p>
            </div>

            <div className="text-sm text-gray-500">
              {updates.length} تحديث — {totalUpdateImages} صورة
            </div>
          </div>

          {updates.length === 0 ? (
            <div className="mt-8 rounded-xl bg-gray-50 p-8 text-center">
              <p className="text-gray-500">
                لا توجد تحديثات للمشروع حتى الآن
              </p>

              <Permission permission="manage_updates">
                <Link
                  href={`/admin/new-update?clientId=${client.id}`}
                  className="mt-4 inline-block rounded-lg bg-green-600 px-5 py-3 text-white hover:bg-green-700"
                >
                  إضافة أول تحديث
                </Link>
              </Permission>
            </div>
          ) : (
            <div className="relative mt-8">
              <div className="absolute bottom-0 right-5 top-0 hidden w-0.5 bg-green-100 sm:block" />

              <div className="space-y-8">
                {updates.map((update, index) => (
                  <article
                    key={update.id}
                    className="relative sm:pr-16"
                  >
                    <div className="absolute right-0 top-5 hidden h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-green-600 font-bold text-white shadow sm:flex">
                      {updates.length - index}
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                      <div className="border-b border-gray-100 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="text-xl font-bold text-gray-900 sm:text-2xl">
                                {update.title}
                              </h3>

                              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700 sm:hidden">
                                تحديث {updates.length - index}
                              </span>
                            </div>

                            <p className="mt-2 text-sm text-gray-500">
                              {formatDate(update.createdAt)}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                              الإنجاز: {update.progress}%
                            </span>

                            <Permission permission="manage_updates">
                              <Link
                                href={`/admin/edit-update/${update.id}`}
                                className="rounded-lg bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600"
                              >
                                تعديل التحديث
                              </Link>
                            </Permission>

                            <Permission permission="manage_updates">
                              <button
                                type="button"
                                onClick={() => deleteUpdate(update)}
                                disabled={deletingUpdateId !== null}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingUpdateId === update.id
                                  ? "جاري الحذف..."
                                  : "حذف التحديث"}
                              </button>
                            </Permission>
                          </div>
                        </div>

                        {update.description ? (
                          <p className="mt-4 whitespace-pre-line leading-7 text-gray-700">
                            {update.description}
                          </p>
                        ) : (
                          <p className="mt-4 text-sm text-gray-400">
                            لا يوجد وصف لهذا التحديث
                          </p>
                        )}

                        <div className="mt-5">
                          <div className="mb-2 flex justify-between text-sm">
                            <span className="text-gray-500">
                              نسبة الإنجاز وقت التحديث
                            </span>

                            <span className="font-bold text-blue-700">
                              {update.progress}%
                            </span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-blue-600 transition-all"
                              style={{
                                width: `${update.progress}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <h4 className="font-bold">
                            صور التحديث
                          </h4>

                          <span className="text-sm text-gray-500">
                            {update.images.length} صورة
                          </span>
                        </div>

                        {update.images.length === 0 ? (
                          <p className="rounded-lg bg-gray-50 p-5 text-center text-gray-500">
                            لا توجد صور مرتبطة بهذا التحديث
                          </p>
                        ) : (
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {update.images.map((image) => (
                              <a
                                key={image.id}
                                href={image.publicUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="group overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                              >
                                <div className="overflow-hidden">
                                  <img
                                    src={image.publicUrl}
                                    alt={update.title}
                                    loading="lazy"
                                    className="h-56 w-full object-cover transition duration-300 group-hover:scale-105"
                                  />
                                </div>

                                <p
                                  className="truncate p-3 text-xs text-gray-500"
                                  title={image.name}
                                >
                                  {image.name}
                                </p>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        {legacyImages.length > 0 && (
          <section className="mt-8 rounded-2xl bg-white p-4 shadow sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  الصور القديمة
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  صور رُفعت قبل إنشاء نظام تحديثات المشروع
                </p>
              </div>

              <span className="text-sm text-gray-500">
                عدد الصور: {legacyImages.length}
              </span>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {legacyImages.map((image) => (
                <article
                  key={image.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                >
                  <a
                    href={image.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden"
                  >
                    <img
                      src={image.publicUrl}
                      alt={
                        image.description ||
                        "صورة قديمة للمشروع"
                      }
                      loading="lazy"
                      className="h-64 w-full object-cover transition duration-300 hover:scale-105"
                    />
                  </a>

                  <div className="p-4">
                    <h3 className="font-bold">
                      {image.description ||
                        "صورة من مراحل المشروع"}
                    </h3>

                    <p className="mt-2 text-sm text-gray-500">
                      {formatDate(image.createdAt)}
                    </p>

                    <Permission permission="manage_images">
                      <button
                        type="button"
                        onClick={() => deleteLegacyImage(image)}
                        disabled={deletingImagePath !== null}
                        className="mt-4 w-full rounded-lg bg-red-600 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingImagePath === image.path
                          ? "جاري الحذف..."
                          : "حذف الصورة"}
                      </button>
                    </Permission>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}