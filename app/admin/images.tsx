import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";

type Client = {
  id: number;
  name: string | null;
  project_name: string | null;
};

export default function AdminImagesScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [description, setDescription] = useState("");
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [uploading, setUploading] = useState(false);

  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ?? null;

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      setLoadingClients(true);

      const { data, error } = await supabase
        .from("clients")
        .select("id, name, project_name")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as Client[];
      setClients(rows);

      if (rows.length === 1) {
        setSelectedClientId(rows[0].id);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "تعذر تحميل قائمة العملاء.";

      Alert.alert("خطأ", message);
    } finally {
      setLoadingClients(false);
    }
  }

  async function selectFromGallery() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "صلاحية الصور مطلوبة",
        "اسمح لتطبيق أزدان بالوصول إلى الصور من إعدادات الهاتف."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.75,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      setSelectedImage(result.assets[0]);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "صلاحية الكاميرا مطلوبة",
        "اسمح لتطبيق أزدان باستخدام الكاميرا من إعدادات الهاتف."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.75,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      setSelectedImage(result.assets[0]);
    }
  }

  function getImageExtension(asset: ImagePicker.ImagePickerAsset) {
    const mimeType = asset.mimeType?.toLowerCase() ?? "";
    const fileName = asset.fileName?.toLowerCase() ?? "";

    if (mimeType.includes("png") || fileName.endsWith(".png")) {
      return "png";
    }

    if (mimeType.includes("webp") || fileName.endsWith(".webp")) {
      return "webp";
    }

    if (mimeType.includes("heic") || fileName.endsWith(".heic")) {
      return "heic";
    }

    if (mimeType.includes("heif") || fileName.endsWith(".heif")) {
      return "heif";
    }

    return "jpg";
  }

  async function uploadImage() {
    if (!selectedClientId) {
      Alert.alert(
        "اختر المشروع",
        "اختر العميل والمشروع الذي تريد إضافة الصورة إليه."
      );
      return;
    }

    if (!selectedImage?.base64) {
      Alert.alert(
        "اختر صورة",
        "التقط صورة أو اختر صورة من معرض الهاتف أولاً."
      );
      return;
    }

    const extension = getImageExtension(selectedImage);

    const contentType =
      selectedImage.mimeType ??
      (extension === "jpg" ? "image/jpeg" : `image/${extension}`);

    const randomPart = Math.random().toString(36).slice(2, 10);

    const storagePath =
      `${selectedClientId}/${Date.now()}-${randomPart}.${extension}`;

    try {
      setUploading(true);

      const { error: uploadError } = await supabase.storage
        .from("project-images")
        .upload(storagePath, decode(selectedImage.base64), {
          contentType,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: insertError } = await supabase
        .from("project_images")
        .insert({
          client_id: selectedClientId,
          storage_path: storagePath,
          description: description.trim() || null,
        });

      if (insertError) {
        await supabase.storage
          .from("project-images")
          .remove([storagePath]);

        throw insertError;
      }

      setSelectedImage(null);
      setDescription("");

      Alert.alert(
        "تم رفع الصورة",
        "تمت إضافة الصورة إلى المشروع بنجاح."
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "تعذر رفع الصورة.";

      Alert.alert("فشل رفع الصورة", message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.pageTitle}>رفع صور المشروع</Text>
            <Text style={styles.pageSubtitle}>
              إضافة صورة جديدة من الكاميرا أو المعرض
            </Text>
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>رجوع</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>📷</Text>

          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>صورة جديدة</Text>
            <Text style={styles.infoText}>
              اختر المشروع ثم التقط صورة أو اخترها من معرض الهاتف.
            </Text>
          </View>
        </View>

        <Text style={styles.label}>المشروع</Text>

        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => setClientModalVisible(true)}
          disabled={loadingClients}
          activeOpacity={0.8}
        >
          {loadingClients ? (
            <ActivityIndicator color="#f8c340" />
          ) : (
            <>
              <Text style={styles.selectButtonText}>
                {selectedClient
                  ? selectedClient.project_name ||
                    selectedClient.name ||
                    `المشروع رقم ${selectedClient.id}`
                  : "اضغط لاختيار العميل والمشروع"}
              </Text>

              <Text style={styles.selectArrow}>⌄</Text>
            </>
          )}
        </TouchableOpacity>

        {selectedClient && (
          <View style={styles.selectedClientCard}>
            <Text style={styles.selectedClientLabel}>العميل</Text>
            <Text style={styles.selectedClientName}>
              {selectedClient.name || "بدون اسم"}
            </Text>
          </View>
        )}

        <Text style={styles.label}>اختيار الصورة</Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={takePhoto}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>📸</Text>
            <Text style={styles.actionTitle}>فتح الكاميرا</Text>
            <Text style={styles.actionSubtitle}>التقاط صورة الآن</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={selectFromGallery}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>🖼️</Text>
            <Text style={styles.actionTitle}>معرض الصور</Text>
            <Text style={styles.actionSubtitle}>اختيار صورة محفوظة</Text>
          </TouchableOpacity>
        </View>

        {selectedImage ? (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>معاينة الصورة</Text>

            <Image
              source={{ uri: selectedImage.uri }}
              style={styles.previewImage}
              resizeMode="cover"
            />

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => setSelectedImage(null)}
              disabled={uploading}
            >
              <Text style={styles.removeButtonText}>إزالة الصورة</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyPreviewIcon}>🖼️</Text>
            <Text style={styles.emptyPreviewText}>
              لم يتم اختيار صورة بعد
            </Text>
          </View>
        )}

        <Text style={styles.label}>وصف الصورة</Text>

        <TextInput
          style={styles.descriptionInput}
          value={description}
          onChangeText={setDescription}
          placeholder="مثلاً: إكمال أعمال الطابق الأول"
          placeholderTextColor="#7180a5"
          multiline
          maxLength={300}
          textAlign="right"
          textAlignVertical="top"
          editable={!uploading}
        />

        <Text style={styles.charactersCount}>
          {description.length}/300
        </Text>

        <TouchableOpacity
          style={[
            styles.uploadButton,
            uploading && styles.uploadButtonDisabled,
          ]}
          onPress={uploadImage}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#09152f" />
              <Text style={styles.uploadButtonText}>
                جاري رفع الصورة...
              </Text>
            </View>
          ) : (
            <Text style={styles.uploadButtonText}>
              رفع الصورة إلى المشروع
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={clientModalVisible}
        animationType="slide"
        onRequestClose={() => setClientModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <StatusBar style="light" />

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>اختيار المشروع</Text>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setClientModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>إغلاق</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.clientsList}>
            {clients.length === 0 ? (
              <View style={styles.noClientsCard}>
                <Text style={styles.noClientsIcon}>👤</Text>
                <Text style={styles.noClientsTitle}>
                  لا يوجد عملاء
                </Text>
                <Text style={styles.noClientsText}>
                  أضف عميلاً ومشروعاً أولاً ثم ارجع إلى هذه الصفحة.
                </Text>
              </View>
            ) : (
              clients.map((client) => {
                const isSelected = client.id === selectedClientId;

                return (
                  <TouchableOpacity
                    key={client.id}
                    style={[
                      styles.clientCard,
                      isSelected && styles.clientCardSelected,
                    ]}
                    onPress={() => {
                      setSelectedClientId(client.id);
                      setClientModalVisible(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.clientCardText}>
                      <Text style={styles.clientProjectName}>
                        {client.project_name ||
                          `المشروع رقم ${client.id}`}
                      </Text>

                      <Text style={styles.clientName}>
                        {client.name || "عميل بدون اسم"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.selectionCircle,
                        isSelected && styles.selectionCircleSelected,
                      ]}
                    >
                      {isSelected && (
                        <Text style={styles.selectionCheck}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const colors = {
  background: "#07142d",
  card: "#11264d",
  cardLight: "#183565",
  border: "#31558d",
  gold: "#f8c340",
  white: "#ffffff",
  muted: "#aebdde",
  input: "#0c1d3d",
  danger: "#ff637d",
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 50,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 20,
  },
  headerTextContainer: {
    flex: 1,
  },
  pageTitle: {
    color: colors.white,
    fontSize: 27,
    fontWeight: "800",
    textAlign: "right",
  },
  pageSubtitle: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 5,
    textAlign: "right",
  },
  backButton: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 13,
    paddingHorizontal: 17,
    paddingVertical: 10,
  },
  backButtonText: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 18,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },
  infoIcon: {
    fontSize: 38,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "right",
  },
  infoText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 4,
    textAlign: "right",
  },
  label: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 9,
    marginTop: 7,
  },
  selectButton: {
    minHeight: 58,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    paddingHorizontal: 16,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  selectButtonText: {
    color: colors.white,
    fontSize: 15,
    flex: 1,
    textAlign: "right",
  },
  selectArrow: {
    color: colors.gold,
    fontSize: 25,
    marginLeft: 10,
  },
  selectedClientCard: {
    backgroundColor: colors.card,
    borderRadius: 13,
    padding: 13,
    marginBottom: 18,
  },
  selectedClientLabel: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "right",
  },
  selectedClientName: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 3,
  },
  actionsRow: {
    flexDirection: "row-reverse",
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    minHeight: 135,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  actionIcon: {
    fontSize: 34,
    marginBottom: 8,
  },
  actionTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  actionSubtitle: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 5,
  },
  previewCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 12,
    marginBottom: 19,
  },
  previewTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 10,
  },
  previewImage: {
    width: "100%",
    height: 260,
    borderRadius: 13,
    backgroundColor: colors.input,
  },
  removeButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 10,
  },
  removeButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyPreview: {
    minHeight: 175,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 19,
  },
  emptyPreviewIcon: {
    fontSize: 43,
    marginBottom: 8,
  },
  emptyPreviewText: {
    color: colors.muted,
    fontSize: 14,
  },
  descriptionInput: {
    minHeight: 120,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    color: colors.white,
    fontSize: 15,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  charactersCount: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 6,
    marginBottom: 18,
    textAlign: "left",
  },
  uploadButton: {
    minHeight: 59,
    backgroundColor: colors.gold,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  uploadButtonDisabled: {
    opacity: 0.65,
  },
  uploadButtonText: {
    color: "#09152f",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  loadingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: colors.white,
    fontSize: 23,
    fontWeight: "800",
  },
  closeButton: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  closeButtonText: {
    color: colors.gold,
    fontWeight: "700",
  },
  clientsList: {
    padding: 18,
    paddingBottom: 40,
  },
  clientCard: {
    minHeight: 82,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clientCardSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.cardLight,
  },
  clientCardText: {
    flex: 1,
  },
  clientProjectName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  clientName: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 5,
    textAlign: "right",
  },
  selectionCircle: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  selectionCircleSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  selectionCheck: {
    color: "#09152f",
    fontSize: 16,
    fontWeight: "900",
  },
  noClientsCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 25,
    alignItems: "center",
  },
  noClientsIcon: {
    fontSize: 42,
  },
  noClientsTitle: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 10,
  },
  noClientsText: {
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 7,
  },
});