import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

const FILES_BUCKET = "project-files";

type Client = {
  id: number;
  project_name: string;
};

type ProjectFile = {
  id: number;
  client_id: number;
  title: string | null;
  description: string | null;
  category: string | null;
  storage_path: string;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  is_visible_to_client: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "غير محدد";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatFileSize(bytes: number | null) {
  const value = Number(bytes ?? 0);

  if (!Number.isFinite(value) || value <= 0) {
    return "الحجم غير محدد";
  }

  if (value < 1024) {
    return `${value} بايت`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} كيلوبايت`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} ميغابايت`;
}

function getFileIcon(fileType: string | null, fileName: string | null) {
  const type = (fileType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();

  if (type.includes("pdf") || name.endsWith(".pdf")) return "📕";
  if (type.includes("image") || /\.(png|jpg|jpeg|webp|gif)$/i.test(name)) return "🖼️";
  if (type.includes("word") || /\.(doc|docx)$/i.test(name)) return "📘";
  if (type.includes("excel") || /\.(xls|xlsx)$/i.test(name)) return "📗";
  if (type.includes("zip") || /\.(zip|rar|7z)$/i.test(name)) return "🗜️";

  return "📄";
}

export default function ProjectFilesPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const clientId = useMemo(() => {
    const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
    const parsedId = Number(rawId);

    return Number.isFinite(parsedId) ? parsedId : null;
  }, [params.id]);

  const [client, setClient] = useState<Client | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const loadFiles = useCallback(async () => {
    if (!clientId) {
      setErrorMessage("معرّف العميل غير صحيح");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setErrorMessage("");

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, project_name")
        .eq("id", clientId)
        .single();

      if (clientError) throw clientError;

      setClient(clientData as Client);

      const { data: filesData, error: filesError } = await supabase
        .from("project_files")
        .select(
          "id, client_id, title, description, category, storage_path, file_name, file_size, file_type, is_visible_to_client, created_at, updated_at"
        )
        .eq("client_id", clientId)
        .eq("is_visible_to_client", true)
        .order("created_at", { ascending: false });

      if (filesError) throw filesError;

      setFiles((filesData as ProjectFile[]) ?? []);
    } catch (error: any) {
      console.error("Project files error:", error);
      setErrorMessage(error?.message || "تعذر تحميل ملفات المشروع");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const openFile = async (file: ProjectFile) => {
    try {
      setOpeningId(file.id);

      const { data } = supabase.storage
        .from(FILES_BUCKET)
        .getPublicUrl(file.storage_path);

      const publicUrl = data.publicUrl;

      if (!publicUrl) {
        throw new Error("تعذر إنشاء رابط الملف");
      }

      const supported = await Linking.canOpenURL(publicUrl);

      if (!supported) {
        throw new Error("لا يمكن فتح هذا الملف على الجهاز");
      }

      await Linking.openURL(publicUrl);
    } catch (error: any) {
      console.error("Open file error:", error);

      Alert.alert(
        "تعذر فتح الملف",
        error?.message ||
          `تأكد أن اسم حاوية التخزين هو ${FILES_BUCKET} وأن الملف متاح للقراءة.`
      );
    } finally {
      setOpeningId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>جاري تحميل الملفات...</Text>
      </SafeAreaView>
    );
  }

  if (errorMessage) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="light-content" />

        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>تعذر تحميل الملفات</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={loadFiles}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>إعادة المحاولة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>رجوع</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backButtonText}>رجوع</Text>
        </TouchableOpacity>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>ملفات المشروع</Text>
          <Text style={styles.headerSubtitle}>
            {client?.project_name || "المشروع"}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadFiles();
            }}
            tintColor="#d4a94e"
            colors={["#d4a94e"]}
          />
        }
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryIcon}>📁</Text>

          <View style={styles.summaryTextContainer}>
            <Text style={styles.summaryCount}>{files.length}</Text>
            <Text style={styles.summaryLabel}>ملف متاح للعميل</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>المستندات والمخططات</Text>

        {files.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyTitle}>لا توجد ملفات حاليًا</Text>
            <Text style={styles.emptyText}>
              ستظهر هنا العقود والمخططات والمستندات التي تتم مشاركتها مع العميل.
            </Text>
          </View>
        ) : (
          files.map((file) => {
            const displayTitle =
              file.title?.trim() || file.file_name?.trim() || "ملف المشروع";

            return (
              <View key={file.id} style={styles.fileCard}>
                <View style={styles.fileTopRow}>
                  <View style={styles.iconBox}>
                    <Text style={styles.fileIcon}>
                      {getFileIcon(file.file_type, file.file_name)}
                    </Text>
                  </View>

                  <View style={styles.fileInfo}>
                    <Text style={styles.fileTitle}>{displayTitle}</Text>

                    {file.category ? (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>
                          {file.category}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.metaBox}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaValue}>
                      {formatDate(file.created_at)}
                    </Text>
                    <Text style={styles.metaLabel}>تاريخ الرفع</Text>
                  </View>

                  <View style={styles.metaDivider} />

                  <View style={styles.metaRow}>
                    <Text style={styles.metaValue}>
                      {formatFileSize(file.file_size)}
                    </Text>
                    <Text style={styles.metaLabel}>حجم الملف</Text>
                  </View>
                </View>

                {file.description ? (
                  <View style={styles.descriptionBox}>
                    <Text style={styles.descriptionLabel}>الوصف</Text>
                    <Text style={styles.descriptionText}>
                      {file.description}
                    </Text>
                  </View>
                ) : null}

                {file.file_name ? (
                  <Text style={styles.fileNameText}>{file.file_name}</Text>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.openButton,
                    openingId === file.id && styles.openButtonDisabled,
                  ]}
                  onPress={() => openFile(file)}
                  activeOpacity={0.8}
                  disabled={openingId === file.id}
                >
                  {openingId === file.id ? (
                    <ActivityIndicator color="#07101d" />
                  ) : (
                    <Text style={styles.openButtonText}>فتح الملف</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <Text style={styles.footerText}>© أزدان للمقاولات العامة</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08111f",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#08111f",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: "#dce6f5",
    fontSize: 15,
    marginTop: 14,
  },
  errorIcon: {
    fontSize: 54,
    marginBottom: 14,
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
  },
  errorText: {
    color: "#aebbd0",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    marginBottom: 24,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#d4a94e",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#07101d",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#31415a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#dce6f5",
    fontSize: 15,
    fontWeight: "700",
  },
  header: {
    backgroundColor: "#0d1a2c",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  backButton: {
    borderWidth: 1,
    borderColor: "#d4a94e",
    borderRadius: 13,
    paddingHorizontal: 17,
    paddingVertical: 10,
  },
  backButtonText: {
    color: "#d4a94e",
    fontSize: 14,
    fontWeight: "800",
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "flex-end",
    marginLeft: 18,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "#9eacc1",
    fontSize: 13,
    marginTop: 5,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#2a3b56",
    borderRadius: 22,
    padding: 20,
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  summaryIcon: {
    fontSize: 42,
    marginLeft: 16,
  },
  summaryTextContainer: {
    flex: 1,
    alignItems: "flex-end",
  },
  summaryCount: {
    color: "#d4a94e",
    fontSize: 31,
    fontWeight: "900",
  },
  summaryLabel: {
    color: "#aebbd0",
    fontSize: 14,
    marginTop: 4,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 24,
    marginBottom: 14,
  },
  emptyCard: {
    minHeight: 260,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#263850",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: 14,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },
  emptyText: {
    color: "#95a5bb",
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
  },
  fileCard: {
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#263850",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  fileTopRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 17,
    backgroundColor: "#0b1727",
    borderWidth: 1,
    borderColor: "#2b3e59",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 13,
  },
  fileIcon: {
    fontSize: 30,
  },
  fileInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  fileTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "right",
    lineHeight: 26,
  },
  categoryBadge: {
    backgroundColor: "#332d1b",
    borderWidth: 1,
    borderColor: "#6a5724",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginTop: 8,
  },
  categoryText: {
    color: "#d4a94e",
    fontSize: 11,
    fontWeight: "800",
  },
  metaBox: {
    marginTop: 16,
    backgroundColor: "#0b1727",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#22344e",
  },
  metaRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLabel: {
    color: "#8fa0b8",
    fontSize: 12,
  },
  metaValue: {
    color: "#dce6f5",
    fontSize: 13,
    fontWeight: "700",
  },
  metaDivider: {
    height: 1,
    backgroundColor: "#243650",
    marginVertical: 11,
  },
  descriptionBox: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#263850",
    paddingTop: 14,
  },
  descriptionLabel: {
    color: "#8fa0b8",
    fontSize: 12,
    textAlign: "right",
    marginBottom: 6,
  },
  descriptionText: {
    color: "#c4cfde",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
  },
  fileNameText: {
    color: "#687b95",
    fontSize: 11,
    textAlign: "right",
    marginTop: 13,
  },
  openButton: {
    marginTop: 16,
    backgroundColor: "#d4a94e",
    borderRadius: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  openButtonDisabled: {
    opacity: 0.65,
  },
  openButtonText: {
    color: "#07101d",
    fontSize: 15,
    fontWeight: "900",
  },
  footerText: {
    color: "#6f7f95",
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
});