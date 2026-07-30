"use client";

import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "../../../lib/supabase";

type Props = {
  clientId: number;
  onUploaded?: () => void | Promise<void>;
};

type SelectedImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};

export default function ImageUploader({ clientId, onUploaded }: Props) {
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sourceVisible, setSourceVisible] = useState(false);

  const prepareImage = async (asset: ImagePicker.ImagePickerAsset) => {
    const result = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG }
    );

    setImage({
      uri: result.uri,
      fileName: `project-${clientId}-${Date.now()}.jpg`,
      mimeType: "image/jpeg",
    });
  };

  const openCamera = async () => {
    setSourceVisible(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("صلاحية الكاميرا", "يجب السماح للتطبيق باستخدام الكاميرا.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        await prepareImage(result.assets[0]);
      } catch (error: any) {
        Alert.alert("خطأ", error?.message || "تعذر تجهيز الصورة");
      }
    }
  };

  const openGallery = async () => {
    setSourceVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("صلاحية الصور", "يجب السماح للتطبيق بالوصول إلى الصور.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        await prepareImage(result.assets[0]);
      } catch (error: any) {
        Alert.alert("خطأ", error?.message || "تعذر تجهيز الصورة");
      }
    }
  };

  const upload = async () => {
    if (!image) {
      Alert.alert("تنبيه", "اختر صورة أولًا");
      return;
    }

    const storagePath = `${clientId}/${image.fileName}`;

    try {
      setUploading(true);
      const response = await fetch(image.uri);
      if (!response.ok) throw new Error("تعذر قراءة الصورة");
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("project-images")
        .upload(storagePath, arrayBuffer, {
          contentType: image.mimeType,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("project_images")
        .insert({
          client_id: clientId,
          storage_path: storagePath,
          description: description.trim() || null,
          update_id: null,
        });

      if (insertError) {
        await supabase.storage.from("project-images").remove([storagePath]);
        throw insertError;
      }

      setImage(null);
      setDescription("");
      await onUploaded?.();
      Alert.alert("تم الرفع", "تمت إضافة الصورة بنجاح.");
    } catch (error: any) {
      Alert.alert("فشل الرفع", error?.message || "تعذر رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>إضافة صورة جديدة</Text>
      <Text style={styles.subtitle}>التقط صورة أو اخترها من المعرض</Text>

      <TouchableOpacity
        style={styles.chooseButton}
        disabled={uploading}
        onPress={() => setSourceVisible(true)}
      >
        <Text style={styles.chooseText}>{image ? "تغيير الصورة" : "اختيار صورة"}</Text>
      </TouchableOpacity>

      {image ? (
        <View style={styles.readyBox}>
          <Text style={styles.readyTitle}>تم تجهيز الصورة ✅</Text>
          <Text numberOfLines={1} style={styles.readyName}>{image.fileName}</Text>
        </View>
      ) : null}

      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="وصف الصورة (اختياري)"
        placeholderTextColor="#71839c"
        editable={!uploading}
        multiline
        textAlign="right"
        style={styles.input}
      />

      <TouchableOpacity
        style={[styles.uploadButton, (!image || uploading) && styles.disabled]}
        disabled={!image || uploading}
        onPress={upload}
      >
        {uploading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#07101d" />
            <Text style={styles.uploadText}>جاري الرفع...</Text>
          </View>
        ) : (
          <Text style={styles.uploadText}>رفع الصورة</Text>
        )}
      </TouchableOpacity>

      <Modal transparent animationType="fade" visible={sourceVisible} onRequestClose={() => setSourceVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setSourceVisible(false)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>اختر مصدر الصورة</Text>
            <TouchableOpacity style={styles.sourceButton} onPress={openCamera}>
              <Text style={styles.sourceText}>📷 التقاط صورة بالكاميرا</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sourceButton} onPress={openGallery}>
              <Text style={styles.sourceText}>🖼️ اختيار صورة من المعرض</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setSourceVisible(false)}>
              <Text style={styles.cancelText}>إلغاء</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#111f33", borderWidth: 1, borderColor: "#243650", borderRadius: 21, padding: 17, marginBottom: 16 },
  title: { color: "#fff", fontSize: 17, fontWeight: "900", textAlign: "right" },
  subtitle: { color: "#8fa0b7", fontSize: 11, marginTop: 4, textAlign: "right" },
  chooseButton: { marginTop: 17, backgroundColor: "#142641", borderWidth: 1, borderColor: "#355071", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  chooseText: { color: "#fff", fontWeight: "900" },
  readyBox: { marginTop: 12, backgroundColor: "#0c2d27", borderRadius: 13, padding: 12, alignItems: "flex-end" },
  readyTitle: { color: "#7ee5ba", fontWeight: "900" },
  readyName: { color: "#a9c9bd", marginTop: 4, fontSize: 11 },
  input: { minHeight: 88, marginTop: 12, backgroundColor: "#0b1728", borderWidth: 1, borderColor: "#2b3d58", borderRadius: 14, padding: 13, color: "#fff", textAlignVertical: "top" },
  uploadButton: { marginTop: 12, backgroundColor: "#d4a94e", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  disabled: { opacity: 0.45 },
  uploadText: { color: "#07101d", fontWeight: "900" },
  loadingRow: { flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#111f33", padding: 20, paddingBottom: 30, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "900", textAlign: "right", marginBottom: 15 },
  sourceButton: { backgroundColor: "#0b1728", borderWidth: 1, borderColor: "#2b3d58", borderRadius: 15, padding: 17, marginBottom: 10 },
  sourceText: { color: "#fff", fontWeight: "800", textAlign: "right" },
  cancelButton: { marginTop: 4, paddingVertical: 13, alignItems: "center" },
  cancelText: { color: "#ff9ca8", fontWeight: "900" },
});
