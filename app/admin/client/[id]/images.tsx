"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../../lib/supabase";
import ImageUploader from "../../components/ImageUploader";

type ProjectImageRow = {
  id: number;
  client_id: number;
  storage_path: string;
  description: string | null;
  created_at: string;
  update_id: number | null;
};

type DisplayImage = ProjectImageRow & { publicUrl: string };

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AdminProjectImagesPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const clientId = Number(rawId);

  const [images, setImages] = useState<DisplayImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [preview, setPreview] = useState<DisplayImage | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const loadImages = useCallback(async () => {
    if (!Number.isFinite(clientId) || clientId <= 0) {
      setErrorMessage("رقم العميل غير صحيح");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setErrorMessage("");
      const { data, error } = await supabase
        .from("project_images")
        .select("id, client_id, storage_path, description, created_at, update_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped = ((data ?? []) as ProjectImageRow[]).map((item) => {
        const { data: publicData } = supabase.storage
          .from("project-images")
          .getPublicUrl(item.storage_path);
        return { ...item, publicUrl: publicData.publicUrl };
      });

      setImages(mapped);
    } catch (error: any) {
      setErrorMessage(error?.message || "تعذر تحميل صور المشروع");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const deleteImage = async (image: DisplayImage) => {
    try {
      setDeletingId(image.id);

      const { error: storageError } = await supabase.storage
        .from("project-images")
        .remove([image.storage_path]);
      if (storageError) throw storageError;

      const { error: databaseError } = await supabase
        .from("project_images")
        .delete()
        .eq("id", image.id)
        .eq("client_id", clientId);
      if (databaseError) throw databaseError;

      setImages((current) => current.filter((item) => item.id !== image.id));
      if (preview?.id === image.id) setPreview(null);
      Alert.alert("تم الحذف", "تم حذف الصورة بنجاح.");
    } catch (error: any) {
      Alert.alert("فشل الحذف", error?.message || "تعذر حذف الصورة");
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (image: DisplayImage) => {
    Alert.alert("حذف الصورة", "هل أنت متأكد من حذف هذه الصورة نهائيًا؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteImage(image) },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>جاري تحميل الصور...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadImages(); }}
            tintColor="#d4a94e"
            colors={["#d4a94e"]}
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>صور المشروع</Text>
            <Text style={styles.subtitle}>رفع ومتابعة صور مراحل التنفيذ</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countValue}>{images.length}</Text>
            <Text style={styles.countLabel}>صورة</Text>
          </View>
        </View>

        <View style={styles.body}>
          <ImageUploader clientId={clientId} onUploaded={loadImages} />

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity onPress={loadImages}>
                <Text style={styles.retryText}>إعادة المحاولة</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionCount}>{images.length} صورة</Text>
            <Text style={styles.sectionTitle}>معرض المشروع</Text>
          </View>

          {images.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🖼️</Text>
              <Text style={styles.emptyTitle}>لا توجد صور بعد</Text>
              <Text style={styles.emptyText}>التقط أول صورة للمشروع أو اخترها من المعرض.</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {images.map((image) => (
                <View key={image.id} style={styles.imageCard}>
                  <TouchableOpacity activeOpacity={0.82} onPress={() => setPreview(image)}>
                    <Image source={{ uri: image.publicUrl }} style={styles.thumbnail} resizeMode="cover" />
                  </TouchableOpacity>
                  <View style={styles.imageInfo}>
                    <Text numberOfLines={2} style={styles.description}>
                      {image.description || "صورة من مراحل المشروع"}
                    </Text>
                    <Text style={styles.dateText}>{formatDate(image.created_at)}</Text>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      disabled={deletingId === image.id}
                      onPress={() => confirmDelete(image)}
                    >
                      {deletingId === image.id ? (
                        <ActivityIndicator size="small" color="#ffd2d8" />
                      ) : (
                        <Text style={styles.deleteText}>حذف الصورة</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal transparent animationType="fade" visible={Boolean(preview)} onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewOverlay} onPress={() => setPreview(null)}>
          <Pressable style={styles.previewCard}>
            {preview ? (
              <>
                <Image source={{ uri: preview.publicUrl }} style={styles.previewImage} resizeMode="contain" />
                <View style={styles.previewInfo}>
                  <Text style={styles.previewDescription}>{preview.description || "صورة من مراحل المشروع"}</Text>
                  <Text style={styles.previewDate}>{formatDate(preview.created_at)}</Text>
                  <TouchableOpacity style={styles.closeButton} onPress={() => setPreview(null)}>
                    <Text style={styles.closeText}>إغلاق</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#08111f" },
  center: { flex: 1, backgroundColor: "#08111f", alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#c7d1df", marginTop: 14 },
  content: { paddingBottom: 45 },
  header: { backgroundColor: "#0d1a2c", paddingHorizontal: 16, paddingTop: 18, paddingBottom: 22, borderBottomLeftRadius: 25, borderBottomRightRadius: 25, flexDirection: "row", alignItems: "center" },
  backButton: { width: 45, height: 45, borderRadius: 14, backgroundColor: "#13233a", borderWidth: 1, borderColor: "#34445d", alignItems: "center", justifyContent: "center" },
  backText: { color: "#fff", fontSize: 34, lineHeight: 37 },
  headerInfo: { flex: 1, alignItems: "flex-end", paddingHorizontal: 12 },
  title: { color: "#fff", fontSize: 21, fontWeight: "900" },
  subtitle: { color: "#9eacc1", fontSize: 11, marginTop: 4, textAlign: "right" },
  countBadge: { minWidth: 45, minHeight: 45, borderRadius: 14, backgroundColor: "#d4a94e", alignItems: "center", justifyContent: "center", paddingHorizontal: 7 },
  countValue: { color: "#07101d", fontWeight: "900", fontSize: 15 },
  countLabel: { color: "#07101d", fontSize: 8, fontWeight: "800" },
  body: { padding: 16 },
  errorBox: { backgroundColor: "#3a1f28", borderRadius: 16, padding: 15, marginBottom: 16, alignItems: "center" },
  errorText: { color: "#ffd2d8", textAlign: "center" },
  retryText: { color: "#d4a94e", fontWeight: "900", marginTop: 9 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  sectionCount: { color: "#8192aa", fontSize: 12 },
  emptyState: { backgroundColor: "#111f33", borderWidth: 1, borderColor: "#243650", borderRadius: 20, padding: 28, alignItems: "center" },
  emptyIcon: { fontSize: 45 },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 12 },
  emptyText: { color: "#8192aa", textAlign: "center", lineHeight: 21, marginTop: 7 },
  grid: { gap: 14 },
  imageCard: { backgroundColor: "#111f33", borderWidth: 1, borderColor: "#243650", borderRadius: 20, overflow: "hidden" },
  thumbnail: { width: "100%", height: 225, backgroundColor: "#0b1728" },
  imageInfo: { padding: 14, alignItems: "flex-end" },
  description: { color: "#fff", fontWeight: "800", textAlign: "right", lineHeight: 20 },
  dateText: { color: "#8192aa", fontSize: 10, marginTop: 7 },
  deleteButton: { alignSelf: "stretch", minHeight: 42, marginTop: 12, backgroundColor: "#3a1f28", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deleteText: { color: "#ffd2d8", fontWeight: "900" },
  previewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", padding: 14 },
  previewCard: { maxHeight: "90%", backgroundColor: "#111f33", borderRadius: 22, overflow: "hidden" },
  previewImage: { width: "100%", height: 470, backgroundColor: "#05090f" },
  previewInfo: { padding: 16, alignItems: "flex-end" },
  previewDescription: { color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "right" },
  previewDate: { color: "#8192aa", fontSize: 11, marginTop: 7 },
  closeButton: { alignSelf: "stretch", marginTop: 14, backgroundColor: "#d4a94e", borderRadius: 13, paddingVertical: 13, alignItems: "center" },
  closeText: { color: "#07101d", fontWeight: "900" },
});
