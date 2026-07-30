"use client";

import * as DocumentPicker from "expo-document-picker";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../../../lib/supabase";

const BUCKET_NAME = "project-files";
const TABLE_NAME = "project_files";

type FileRow = {
  id: number;
  client_id: number;
  title: string;
  storage_path: string;
  file_name: string | null;
  description: string | null;
  created_at: string | null;
};

type SelectedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
};

function getClientId(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);

  return Number.isFinite(id) && id > 0 ? id : null;
}

function createSafeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  return cleaned || `file-${Date.now()}`;
}

function getFileExtension(fileName?: string | null) {
  if (!fileName) return "";

  const parts = fileName.split(".");

  if (parts.length < 2) return "";

  return parts.pop()?.toLowerCase() || "";
}

function getFileIcon(fileName?: string | null) {
  const extension = getFileExtension(fileName);

  if (extension === "pdf") return "📕";

  if (["doc", "docx"].includes(extension)) {
    return "📘";
  }

  if (["xls", "xlsx", "csv"].includes(extension)) {
    return "📗";
  }

  if (["ppt", "pptx"].includes(extension)) {
    return "📙";
  }

  if (
    ["jpg", "jpeg", "png", "webp", "gif"].includes(
      extension
    )
  ) {
    return "🖼️";
  }

  if (["zip", "rar", "7z"].includes(extension)) {
    return "🗜️";
  }

  if (["txt", "rtf"].includes(extension)) {
    return "📝";
  }

  return "📎";
}

function getFileTypeLabel(fileName?: string | null) {
  const extension = getFileExtension(fileName);

  if (!extension) return "ملف";

  return extension.toUpperCase();
}

function formatFileSize(size?: number | null) {
  if (!size || size <= 0) return "";

  if (size < 1024) {
    return `${size} بايت`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} كيلوبايت`;
  }

  return `${(size / (1024 * 1024)).toFixed(
    1
  )} ميغابايت`;
}

function formatDate(value?: string | null) {
  if (!value) return "";

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

export default function AdminFilesPage() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const clientId = useMemo(
    () => getClientId(params.id),
    [params.id]
  );

  const [items, setItems] = useState<FileRow[]>([]);
  const [selectedFile, setSelectedFile] =
    useState<SelectedFile | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [openingId, setOpeningId] =
    useState<number | null>(null);

  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  const loadItems = useCallback(async () => {
    if (!clientId) {
      setErrorMessage("رقم العميل غير صحيح");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setErrorMessage("");

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select(
          "id, client_id, title, storage_path, file_name, description, created_at"
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setItems((data ?? []) as FileRow[]);
    } catch (error: any) {
      setErrorMessage(
        error?.message || "تعذر تحميل ملفات المشروع"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadItems();
  };

  const chooseFile = async () => {
    try {
      setChoosing(true);

      const result =
        await DocumentPicker.getDocumentAsync({
          type: "*/*",
          multiple: false,
          copyToCacheDirectory: true,
        });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];

      const fileName =
        asset.name || `file-${Date.now()}`;

      setSelectedFile({
        uri: asset.uri,
        name: fileName,
        mimeType:
          asset.mimeType || "application/octet-stream",
        size: asset.size ?? null,
      });

      if (!title.trim()) {
        setTitle(fileName);
      }
    } catch (error: any) {
      Alert.alert(
        "تعذر اختيار الملف",
        error?.message ||
          "حدث خطأ أثناء اختيار الملف"
      );
    } finally {
      setChoosing(false);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setTitle("");
  };

  const uploadFile = async () => {
    if (!clientId) {
      Alert.alert("خطأ", "رقم العميل غير صحيح");
      return;
    }

    if (!selectedFile) {
      Alert.alert("تنبيه", "اختر ملفًا أولًا");
      return;
    }

    const finalTitle =
      title.trim() ||
      selectedFile.name ||
      "ملف المشروع";

    const safeName = createSafeFileName(
      selectedFile.name
    );

    const storagePath =
      `${clientId}/${Date.now()}-${safeName}`;

    try {
      setUploading(true);

      const response = await fetch(selectedFile.uri);

      if (!response.ok) {
        throw new Error("تعذر قراءة الملف المختار");
      }

      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } =
        await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, arrayBuffer, {
            contentType: selectedFile.mimeType,
            cacheControl: "3600",
            upsert: false,
          });

      if (uploadError) {
        throw uploadError;
      }

      const { error: insertError } = await supabase
        .from(TABLE_NAME)
        .insert({
          client_id: clientId,
          title: finalTitle,
          storage_path: storagePath,
          file_name: selectedFile.name,
          description: description.trim() || null,
        });

      if (insertError) {
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([storagePath]);

        throw insertError;
      }

      setSelectedFile(null);
      setTitle("");
      setDescription("");

      await loadItems();

      Alert.alert(
        "تم رفع الملف",
        "تمت إضافة الملف إلى المشروع بنجاح."
      );
    } catch (error: any) {
      Alert.alert(
        "فشل رفع الملف",
        error?.message || "تعذر رفع الملف"
      );
    } finally {
      setUploading(false);
    }
  };

  const openFile = async (item: FileRow) => {
    try {
      setOpeningId(item.id);

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(item.storage_path, 60 * 30);

      if (error) {
        throw error;
      }

      if (!data?.signedUrl) {
        throw new Error("تعذر إنشاء رابط الملف");
      }

      const canOpen = await Linking.canOpenURL(
        data.signedUrl
      );

      if (!canOpen) {
        throw new Error(
          "لا يوجد تطبيق مناسب لفتح هذا الملف"
        );
      }

      await Linking.openURL(data.signedUrl);
    } catch (error: any) {
      Alert.alert(
        "تعذر فتح الملف",
        error?.message ||
          "حدث خطأ أثناء فتح الملف"
      );
    } finally {
      setOpeningId(null);
    }
  };

  const confirmDelete = (item: FileRow) => {
    Alert.alert(
      "حذف الملف",
      `هل تريد حذف الملف "${
        item.title ||
        item.file_name ||
        "ملف المشروع"
      }" نهائيًا؟`,
      [
        {
          text: "إلغاء",
          style: "cancel",
        },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => deleteFile(item),
        },
      ]
    );
  };

  const deleteFile = async (item: FileRow) => {
    if (!clientId) return;

    try {
      setDeletingId(item.id);

      const { error: storageError } =
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([item.storage_path]);

      if (storageError) {
        throw storageError;
      }

      const { error: databaseError } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq("id", item.id)
        .eq("client_id", clientId);

      if (databaseError) {
        throw databaseError;
      }

      setItems((current) =>
        current.filter((row) => row.id !== item.id)
      );

      Alert.alert(
        "تم الحذف",
        "تم حذف الملف بنجاح."
      );
    } catch (error: any) {
      Alert.alert(
        "فشل الحذف",
        error?.message || "تعذر حذف الملف"
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Header
        title="ملفات المشروع"
        count={items.length}
        onBack={() => router.back()}
      />

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#d4a94e"
            colors={["#d4a94e"]}
          />
        }
        contentContainerStyle={[
          styles.list,
          items.length === 0 && styles.emptyList,
        ]}
        ListHeaderComponent={
          <>
            <View style={styles.form}>
              <View style={styles.formHeader}>
                <Text style={styles.formIcon}>📁</Text>

                <View style={styles.formHeaderInfo}>
                  <Text style={styles.formTitle}>
                    إضافة ملف جديد
                  </Text>

                  <Text style={styles.formSubtitle}>
                    ارفع العقود والمخططات والتقارير
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.chooseButton}
                activeOpacity={0.8}
                disabled={choosing || uploading}
                onPress={chooseFile}
              >
                {choosing ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                  />
                ) : (
                  <Text style={styles.chooseButtonText}>
                    {selectedFile
                      ? "تغيير الملف المختار"
                      : "اختيار ملف"}
                  </Text>
                )}
              </TouchableOpacity>

              {selectedFile ? (
                <View style={styles.selectedFileBox}>
                  <View style={styles.selectedIconBox}>
                    <Text style={styles.selectedIcon}>
                      {getFileIcon(selectedFile.name)}
                    </Text>
                  </View>

                  <View style={styles.selectedInfo}>
                    <Text
                      numberOfLines={2}
                      style={styles.selectedName}
                    >
                      {selectedFile.name}
                    </Text>

                    <Text style={styles.selectedMeta}>
                      {getFileTypeLabel(
                        selectedFile.name
                      )}

                      {selectedFile.size
                        ? ` • ${formatFileSize(
                            selectedFile.size
                          )}`
                        : ""}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.removeSelectedButton}
                    disabled={uploading}
                    onPress={removeSelectedFile}
                  >
                    <Text
                      style={styles.removeSelectedText}
                    >
                      ×
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <Text style={styles.inputLabel}>
                عنوان الملف
              </Text>

              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="مثال: عقد المشروع"
                placeholderTextColor="#718198"
                textAlign="right"
                editable={!uploading}
              />

              <Text style={styles.inputLabel}>
                وصف الملف
              </Text>

              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="وصف الملف (اختياري)"
                placeholderTextColor="#718198"
                textAlign="right"
                multiline
                textAlignVertical="top"
                editable={!uploading}
              />

              <TouchableOpacity
                style={[
                  styles.goldButton,
                  (!selectedFile || uploading) &&
                    styles.disabledButton,
                ]}
                activeOpacity={0.8}
                disabled={!selectedFile || uploading}
                onPress={uploadFile}
              >
                {uploading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator
                      size="small"
                      color="#07101d"
                    />

                    <Text style={styles.goldButtonText}>
                      جاري رفع الملف...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.goldButtonText}>
                    رفع الملف
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {errorMessage}
                </Text>

                <TouchableOpacity onPress={loadItems}>
                  <Text style={styles.retryText}>
                    إعادة المحاولة
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionCount}>
                {items.length} ملف
              </Text>

              <Text style={styles.sectionTitle}>
                ملفات المشروع
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <Loader />
          ) : (
            <Empty text="لا توجد ملفات مضافة للمشروع بعد" />
          )
        }
        renderItem={({ item }) => {
          const opening = openingId === item.id;
          const deleting = deletingId === item.id;

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.fileIconBox}>
                  <Text style={styles.fileIcon}>
                    {getFileIcon(item.file_name)}
                  </Text>
                </View>

                <View style={styles.cardInfo}>
                  <Text
                    numberOfLines={2}
                    style={styles.cardTitle}
                  >
                    {item.title ||
                      item.file_name ||
                      "ملف المشروع"}
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={styles.originalFileName}
                  >
                    {item.file_name || "ملف"}
                  </Text>

                  <View style={styles.fileTypeBadge}>
                    <Text style={styles.fileTypeText}>
                      {getFileTypeLabel(
                        item.file_name
                      )}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.cardText}>
                {item.description || "بدون وصف"}
              </Text>

              {item.created_at ? (
                <Text style={styles.dateText}>
                  أضيف في {formatDate(item.created_at)}
                </Text>
              ) : null}

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[
                    styles.openButton,
                    opening && styles.actionDisabled,
                  ]}
                  disabled={opening || deleting}
                  onPress={() => openFile(item)}
                >
                  {opening ? (
                    <ActivityIndicator
                      size="small"
                      color="#07101d"
                    />
                  ) : (
                    <Text style={styles.openText}>
                      فتح الملف
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    deleting && styles.actionDisabled,
                  ]}
                  disabled={opening || deleting}
                  onPress={() => confirmDelete(item)}
                >
                  {deleting ? (
                    <ActivityIndicator
                      size="small"
                      color="#ffffff"
                    />
                  ) : (
                    <Text style={styles.deleteText}>
                      حذف
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function Header({
  title,
  count,
  onBack,
}: {
  title: string;
  count: number;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
      >
        <Text style={styles.backText}>‹</Text>
      </TouchableOpacity>

      <View style={styles.headerTitleBox}>
        <Text style={styles.headerTitle}>{title}</Text>

        <Text style={styles.headerSubtitle}>
          العقود والمخططات والتقارير
        </Text>
      </View>

      <View style={styles.countBadge}>
        <Text style={styles.countValue}>{count}</Text>
        <Text style={styles.countText}>ملف</Text>
      </View>
    </View>
  );
}

function Loader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator
        size="large"
        color="#d4a94e"
      />

      <Text style={styles.loaderText}>
        جاري تحميل الملفات...
      </Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>📭</Text>

      <Text style={styles.emptyTitle}>
        لا توجد ملفات
      </Text>

      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08111f",
  },

  header: {
    backgroundColor: "#0d1a2c",
    paddingHorizontal: 16,
    paddingTop: 17,
    paddingBottom: 21,
    flexDirection: "row",
    alignItems: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#13233a",
    borderWidth: 1,
    borderColor: "#34445d",
    alignItems: "center",
    justifyContent: "center",
  },

  backText: {
    color: "#ffffff",
    fontSize: 34,
    lineHeight: 37,
  },

  headerTitleBox: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 12,
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "right",
  },

  headerSubtitle: {
    color: "#8e9eb5",
    fontSize: 10,
    marginTop: 4,
    textAlign: "right",
  },

  countBadge: {
    minWidth: 45,
    height: 45,
    paddingHorizontal: 7,
    borderRadius: 14,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },

  countValue: {
    color: "#07101d",
    fontSize: 15,
    fontWeight: "900",
  },

  countText: {
    color: "#07101d",
    fontSize: 8,
    fontWeight: "800",
  },

  list: {
    padding: 16,
    paddingBottom: 45,
  },

  emptyList: {
    flexGrow: 1,
  },

  form: {
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },

  formHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 16,
  },

  formIcon: {
    fontSize: 31,
    marginLeft: 12,
  },

  formHeaderInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  formTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },

  formSubtitle: {
    color: "#8fa0b7",
    fontSize: 11,
    marginTop: 4,
  },

  chooseButton: {
    minHeight: 50,
    backgroundColor: "#142641",
    borderWidth: 1,
    borderColor: "#355071",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  chooseButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  selectedFileBox: {
    marginTop: 12,
    backgroundColor: "#0c2d27",
    borderRadius: 14,
    padding: 11,
    flexDirection: "row-reverse",
    alignItems: "center",
  },

  selectedIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#113d35",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 11,
  },

  selectedIcon: {
    fontSize: 23,
  },

  selectedInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  selectedName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },

  selectedMeta: {
    color: "#83bca9",
    fontSize: 10,
    marginTop: 5,
  },

  removeSelectedButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#3a1f28",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  removeSelectedText: {
    color: "#ffd2d8",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 25,
  },

  inputLabel: {
    color: "#c7d1df",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 13,
    marginBottom: 7,
  },

  titleInput: {
    height: 50,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    borderRadius: 14,
    color: "#ffffff",
    paddingHorizontal: 14,
  },

  descriptionInput: {
    minHeight: 88,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    borderRadius: 14,
    color: "#ffffff",
    paddingHorizontal: 14,
    paddingTop: 13,
  },

  goldButton: {
    height: 50,
    backgroundColor: "#d4a94e",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  disabledButton: {
    opacity: 0.45,
  },

  goldButtonText: {
    color: "#07101d",
    fontWeight: "900",
    fontSize: 15,
  },

  loadingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
  },

  errorBox: {
    backgroundColor: "#3a1f28",
    borderRadius: 16,
    padding: 15,
    marginBottom: 16,
    alignItems: "center",
  },

  errorText: {
    color: "#ffd2d8",
    textAlign: "center",
  },

  retryText: {
    color: "#d4a94e",
    fontWeight: "900",
    marginTop: 9,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  sectionCount: {
    color: "#8192aa",
    fontSize: 12,
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },

  card: {
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
  },

  cardTop: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },

  fileIconBox: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: "#142641",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  fileIcon: {
    fontSize: 27,
  },

  cardInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  cardTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },

  originalFileName: {
    color: "#8495ad",
    fontSize: 10,
    marginTop: 5,
    textAlign: "right",
  },

  fileTypeBadge: {
    backgroundColor: "#263a57",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 7,
  },

  fileTypeText: {
    color: "#cbd5e1",
    fontSize: 9,
    fontWeight: "900",
  },

  cardText: {
    color: "#aebbd0",
    marginTop: 13,
    lineHeight: 21,
    textAlign: "right",
  },

  dateText: {
    color: "#7f90a8",
    fontSize: 10,
    marginTop: 8,
    textAlign: "right",
  },

  actionsRow: {
    flexDirection: "row-reverse",
    gap: 10,
    marginTop: 14,
  },

  openButton: {
    flex: 1,
    height: 43,
    backgroundColor: "#d4a94e",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  openText: {
    color: "#07101d",
    fontWeight: "900",
  },

  deleteButton: {
    width: 88,
    height: 43,
    backgroundColor: "#a53b4b",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  deleteText: {
    color: "#ffffff",
    fontWeight: "900",
  },

  actionDisabled: {
    opacity: 0.6,
  },

  loader: {
    paddingTop: 65,
    alignItems: "center",
    justifyContent: "center",
  },

  loaderText: {
    color: "#9eacc1",
    marginTop: 12,
  },

  empty: {
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
  },

  emptyIcon: {
    fontSize: 43,
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 12,
  },

  emptyText: {
    color: "#95a6be",
    marginTop: 7,
    textAlign: "center",
    lineHeight: 20,
  },
});