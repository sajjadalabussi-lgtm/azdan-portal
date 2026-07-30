import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { supabase } from "../../lib/supabase";

type ProjectImageRecord = {
  id: number;
  storage_path: string;
  description: string | null;
  created_at: string | null;
};

type ProjectImage = {
  id: number;
  storagePath: string;
  publicUrl: string;
  description: string | null;
  createdAt: string | null;
};

export default function ProjectImagesScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const clientId = Number(params.id);

  const [images, setImages] = useState<ProjectImage[]>([]);
  const [projectName, setProjectName] = useState("");
  const [selectedImage, setSelectedImage] =
    useState<ProjectImage | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadProjectImages();
  }, [clientId]);

  async function loadProjectImages(isRefresh = false) {
    if (!Number.isFinite(clientId) || clientId <= 0) {
      setErrorMessage("رقم العميل غير صحيح");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("project_name")
        .eq("id", clientId)
        .single();

      if (clientError) {
        console.log("Project name error:", clientError);
      } else {
        setProjectName(clientData?.project_name || "المشروع");
      }

      const { data, error } = await supabase
        .from("project_images")
        .select("id, storage_path, description, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Project images error:", error);
        setErrorMessage(`تعذر تحميل الصور: ${error.message}`);
        setImages([]);
        return;
      }

      const imageRecords =
        (data as ProjectImageRecord[] | null) ?? [];

      const preparedImages: ProjectImage[] = imageRecords.map(
        (imageRecord) => {
          const { data: publicUrlData } = supabase.storage
            .from("project-images")
            .getPublicUrl(imageRecord.storage_path);

          return {
            id: imageRecord.id,
            storagePath: imageRecord.storage_path,
            publicUrl: publicUrlData.publicUrl,
            description: imageRecord.description,
            createdAt: imageRecord.created_at,
          };
        }
      );

      setImages(preparedImages);
    } catch (error) {
      console.log("Unexpected images error:", error);
      setErrorMessage("حدث خطأ غير متوقع أثناء تحميل الصور");
      setImages([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

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
    }).format(parsedDate);
  }

  function renderImage({
    item,
  }: {
    item: ProjectImage;
  }) {
    return (
      <TouchableOpacity
        style={styles.imageCard}
        activeOpacity={0.85}
        onPress={() => setSelectedImage(item)}
      >
        <Image
          source={{ uri: item.publicUrl }}
          style={styles.projectImage}
          resizeMode="cover"
        />

        <View style={styles.imageInfo}>
          <Text
            style={styles.imageDescription}
            numberOfLines={2}
          >
            {item.description || "صورة من مراحل تنفيذ المشروع"}
          </Text>

          <Text style={styles.imageDate}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fbbf24" />

          <Text style={styles.loadingText}>
            جاري تحميل صور المشروع...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>رجوع</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>صور المشروع</Text>

          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {projectName || "مشروع أزدان"}
          </Text>
        </View>
      </View>

      {errorMessage ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>
            تعذر تحميل الصور
          </Text>

          <Text style={styles.errorText}>
            {errorMessage}
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadProjectImages()}
          >
            <Text style={styles.retryButtonText}>
              إعادة المحاولة
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={images}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderImage}
          numColumns={2}
          columnWrapperStyle={
            images.length > 1
              ? styles.columnWrapper
              : undefined
          }
          contentContainerStyle={
            images.length === 0
              ? styles.emptyListContent
              : styles.listContent
          }
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => loadProjectImages(true)}
          ListHeaderComponent={
            images.length > 0 ? (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>
                  {images.length}
                </Text>

                <Text style={styles.summaryText}>
                  صورة مضافة إلى المشروع
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📷</Text>

              <Text style={styles.emptyTitle}>
                لا توجد صور حتى الآن
              </Text>

              <Text style={styles.emptyDescription}>
                ستظهر هنا صور مراحل تنفيذ المشروع عند إضافتها
              </Text>

              <TouchableOpacity
                style={styles.refreshButton}
                onPress={() => loadProjectImages(true)}
              >
                <Text style={styles.refreshButtonText}>
                  تحديث
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal
        visible={selectedImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedImage(null)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>
              صورة المشروع
            </Text>
          </View>

          {selectedImage && (
            <>
              <Image
                source={{ uri: selectedImage.publicUrl }}
                style={styles.fullImage}
                resizeMode="contain"
              />

              <View style={styles.modalInfo}>
                <Text style={styles.modalDescription}>
                  {selectedImage.description ||
                    "صورة من مراحل تنفيذ المشروع"}
                </Text>

                <Text style={styles.modalDate}>
                  {formatDate(selectedImage.createdAt)}
                </Text>
              </View>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  loadingText: {
    color: "#cbd5e1",
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },

  headerTitleContainer: {
    flex: 1,
    alignItems: "flex-end",
    marginLeft: 14,
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 23,
    fontWeight: "900",
    textAlign: "right",
  },

  headerSubtitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 4,
    textAlign: "right",
    maxWidth: "90%",
  },

  backButton: {
    borderWidth: 1,
    borderColor: "#fbbf24",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },

  backButtonText: {
    color: "#fbbf24",
    fontSize: 14,
    fontWeight: "800",
  },

  listContent: {
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 30,
  },

  columnWrapper: {
    justifyContent: "space-between",
  },

  summaryCard: {
    backgroundColor: "#1e293b",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 18,
    marginHorizontal: 6,
    marginBottom: 18,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },

  summaryNumber: {
    color: "#fbbf24",
    fontSize: 25,
    fontWeight: "900",
    marginRight: 10,
  },

  summaryText: {
    color: "#cbd5e1",
    fontSize: 15,
  },

  imageCard: {
    width: "48%",
    backgroundColor: "#1e293b",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 14,
  },

  projectImage: {
    width: "100%",
    height: 165,
    backgroundColor: "#334155",
  },

  imageInfo: {
    padding: 12,
  },

  imageDescription: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "right",
    minHeight: 40,
  },

  imageDate: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 8,
    textAlign: "right",
  },

  emptyListContent: {
    flexGrow: 1,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  emptyIcon: {
    fontSize: 56,
    marginBottom: 18,
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },

  emptyDescription: {
    color: "#94a3b8",
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 22,
  },

  refreshButton: {
    backgroundColor: "#fbbf24",
    borderRadius: 13,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },

  refreshButtonText: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },

  errorTitle: {
    color: "#ffffff",
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
  },

  errorText: {
    color: "#fca5a5",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 22,
  },

  retryButton: {
    backgroundColor: "#fbbf24",
    borderRadius: 13,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },

  retryButtonText: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },

  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.98)",
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
  },

  modalTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },

  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#475569",
  },

  closeButtonText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },

  fullImage: {
    flex: 1,
    width: "100%",
  },

  modalInfo: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },

  modalDescription: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    textAlign: "right",
  },

  modalDate: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 8,
    textAlign: "right",
  },
});