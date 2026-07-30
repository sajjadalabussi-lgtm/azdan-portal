"use client";

import { useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";
import ClientForm, {
  ClientFormValues,
} from "../components/ClientForm";

export default function NewAdminClientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const createClient = async (values: ClientFormValues) => {
    try {
      setSaving(true);

      const payload = {
        name: values.name,
        phone: values.phone,
        project_name: values.project_name,
        progress: Number(values.progress),
        status: values.status,
        access_code: values.access_code,
      };

      const { data, error } = await supabase
        .from("clients")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      Alert.alert(
        "تمت الإضافة",
        "تم إنشاء العميل والمشروع بنجاح.",
        [
          {
            text: "فتح المشروع",
            onPress: () =>
              router.replace(
                `/admin/client/${data.id}` as never
              ),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        "خطأ",
        error?.message || "تعذر إضافة العميل"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.title}>إضافة عميل</Text>
            <Text style={styles.subtitle}>
              أنشئ حساب العميل ومعلومات مشروعه
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeIcon}>🔐</Text>

          <View style={styles.noticeInfo}>
            <Text style={styles.noticeTitle}>
              بيانات دخول العميل
            </Text>

            <Text style={styles.noticeText}>
              سيستخدم العميل رقم الهاتف ورمز الدخول لفتح
              بوابة المشروع.
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <ClientForm
            submitTitle="حفظ العميل"
            loading={saving}
            onSubmit={createClient}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08111f",
  },
  content: {
    paddingBottom: 45,
  },
  header: {
    backgroundColor: "#0d1a2c",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 22,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 45,
    height: 45,
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
  headerInfo: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 12,
  },
  title: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
  },
  subtitle: {
    color: "#9eacc1",
    fontSize: 11,
    marginTop: 4,
    textAlign: "right",
  },
  headerSpacer: {
    width: 45,
  },
  notice: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: "#172841",
    borderWidth: 1,
    borderColor: "#2e4463",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  noticeIcon: {
    fontSize: 28,
    marginLeft: 12,
  },
  noticeInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  noticeTitle: {
    color: "#ffffff",
    fontWeight: "900",
  },
  noticeText: {
    color: "#aebbd0",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    textAlign: "right",
  },
  formCard: {
    margin: 16,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    borderRadius: 21,
    padding: 17,
  },
});
