"use client";

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import * as Notifications from "expo-notifications";
import {
  registerForPushNotificationsAsync,
  scheduleLocalTestNotification,
} from "../../../lib/notifications";
import { supabase } from "../../../lib/supabase";

type TokenRow = {
  id: number;
  expo_push_token: string;
  platform: string | null;
  device_name: string | null;
  is_active: boolean;
  updated_at: string;
};

export default function NotificationsSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [permission, setPermission] = useState("غير معروف");
  const [tokens, setTokens] = useState<TokenRow[]>([]);

  async function loadData() {
    try {
      setLoading(true);

      const permissions = await Notifications.getPermissionsAsync();
      setPermission(
        permissions.status === "granted"
          ? "مسموح"
          : permissions.status === "denied"
          ? "مرفوض"
          : "لم يُطلب بعد"
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const { data, error } = await supabase
        .from("push_tokens")
        .select(
          "id, expo_push_token, platform, device_name, is_active, updated_at"
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setTokens((data ?? []) as TokenRow[]);
    } catch (error: any) {
      Alert.alert("خطأ", error?.message || "تعذر تحميل إعدادات الإشعارات.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function enableNotifications() {
    try {
      setWorking(true);
      await registerForPushNotificationsAsync();
      await loadData();
      Alert.alert("تم", "تم تفعيل إشعارات أزدان على هذا الجهاز.");
    } catch (error: any) {
      Alert.alert("تعذر التفعيل", error?.message || "حدث خطأ غير متوقع.");
    } finally {
      setWorking(false);
    }
  }

  async function sendLocalTest() {
    try {
      setWorking(true);
      await scheduleLocalTestNotification();
      Alert.alert("تم", "سيظهر إشعار تجريبي بعد ثانيتين.");
    } catch (error: any) {
      Alert.alert("خطأ", error?.message || "تعذر إنشاء الإشعار التجريبي.");
    } finally {
      setWorking(false);
    }
  }

  async function disableDeviceToken(token: TokenRow) {
    try {
      const { error } = await supabase
        .from("push_tokens")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", token.id);

      if (error) throw error;
      await loadData();
    } catch (error: any) {
      Alert.alert("خطأ", error?.message || "تعذر تعطيل الجهاز.");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>جاري تحميل الإشعارات...</Text>
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
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.title}>الإشعارات</Text>
          <Text style={styles.subtitle}>إعداد Push Notifications</Text>
        </View>

        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>🔔</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>صلاحية الإشعارات</Text>
          <Text style={styles.statusValue}>{permission}</Text>
          <Text style={styles.statusDescription}>
            فعّل الإشعارات حتى تستلم تنبيهات المواعيد والدفعات وتحديثات المشاريع.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={enableNotifications}
          disabled={working}
        >
          {working ? (
            <ActivityIndicator color="#08111f" />
          ) : (
            <Text style={styles.primaryButtonText}>
              تفعيل الإشعارات على هذا الجهاز
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={sendLocalTest}
          disabled={working}
        >
          <Text style={styles.secondaryButtonText}>
            إرسال إشعار تجريبي محلي
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>الأجهزة المسجلة</Text>

        {tokens.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              لا يوجد جهاز مسجل بعد. اضغط زر التفعيل أعلاه.
            </Text>
          </View>
        ) : (
          tokens.map((token) => (
            <View key={token.id} style={styles.deviceCard}>
              <View style={styles.deviceIcon}>
                <Text style={styles.deviceIconText}>
                  {token.platform === "ios" ? "🍎" : "🤖"}
                </Text>
              </View>

              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>
                  {token.device_name || "جهاز غير معروف"}
                </Text>
                <Text style={styles.devicePlatform}>
                  {token.platform || "unknown"}
                </Text>
                <Text style={styles.deviceStatus}>
                  {token.is_active ? "فعال" : "معطل"}
                </Text>
              </View>

              {token.is_active ? (
                <TouchableOpacity
                  style={styles.disableButton}
                  onPress={() =>
                    Alert.alert(
                      "تعطيل الجهاز",
                      "لن يستلم هذا الجهاز إشعارات جديدة.",
                      [
                        { text: "إلغاء", style: "cancel" },
                        {
                          text: "تعطيل",
                          style: "destructive",
                          onPress: () => disableDeviceToken(token),
                        },
                      ]
                    )
                  }
                >
                  <Text style={styles.disableText}>تعطيل</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>ملاحظة مهمة</Text>
          <Text style={styles.noticeText}>
            إشعارات Push الخارجية تحتاج Development Build أو نسخة APK/AAB.
            لا تعتمد على Expo Go للاختبار النهائي.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#08111f" },
  center: {
    flex: 1,
    backgroundColor: "#08111f",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: "#9caabd", marginTop: 12 },
  header: {
    minHeight: 84,
    backgroundColor: "#0d1a2c",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#172840",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: "#fff", fontSize: 30, marginTop: -4 },
  headerText: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 12,
  },
  title: { color: "#fff", fontSize: 19, fontWeight: "900" },
  subtitle: { color: "#8291a6", fontSize: 10, marginTop: 4 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconText: { fontSize: 20 },
  content: { padding: 16, paddingBottom: 45 },
  statusCard: {
    backgroundColor: "#111f33",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#263852",
    padding: 22,
    alignItems: "center",
  },
  statusLabel: { color: "#98a6b9", fontSize: 10 },
  statusValue: {
    color: "#d4a94e",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 9,
  },
  statusDescription: {
    color: "#9aa8ba",
    fontSize: 10,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 10,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 13,
  },
  primaryButtonText: { color: "#08111f", fontWeight: "900" },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#172840",
    borderWidth: 1,
    borderColor: "#30425e",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  secondaryButtonText: { color: "#fff", fontWeight: "900" },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 23,
    marginBottom: 11,
  },
  emptyCard: {
    minHeight: 85,
    backgroundColor: "#111f33",
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    padding: 17,
  },
  emptyText: {
    color: "#8291a6",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 18,
  },
  deviceCard: {
    minHeight: 82,
    backgroundColor: "#111f33",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#263852",
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#20334e",
    alignItems: "center",
    justifyContent: "center",
  },
  deviceIconText: { fontSize: 21 },
  deviceInfo: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 12,
  },
  deviceName: { color: "#fff", fontSize: 12, fontWeight: "900" },
  devicePlatform: { color: "#8392a7", fontSize: 9, marginTop: 4 },
  deviceStatus: { color: "#d4a94e", fontSize: 9, marginTop: 4 },
  disableButton: {
    backgroundColor: "#4a2422",
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  disableText: { color: "#ffaaa3", fontSize: 9, fontWeight: "900" },
  noticeCard: {
    backgroundColor: "#17243a",
    borderRadius: 17,
    padding: 17,
    marginTop: 19,
  },
  noticeTitle: {
    color: "#d4a94e",
    fontWeight: "900",
    textAlign: "right",
  },
  noticeText: {
    color: "#9aa8ba",
    fontSize: 9,
    lineHeight: 17,
    textAlign: "right",
    marginTop: 8,
  },
});
