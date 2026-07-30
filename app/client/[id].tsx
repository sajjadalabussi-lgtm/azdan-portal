"use client";

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { registerPushToken } from "../../lib/registerPush";
import { supabase } from "../../lib/supabase";

type Client = {
  id: number;
  name: string;
  phone: string | null;
  project_name: string;
  progress: number | null;
  status: string | null;
};

type ProjectUpdate = {
  id: number;
  title: string | null;
  description: string | null;
  created_at: string | null;
};

export default function ClientDashboardPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const clientId = useMemo(() => {
    const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
    const parsedId = Number(rawId);
    return Number.isFinite(parsedId) ? parsedId : null;
  }, [params.id]);

  const [client, setClient] = useState<Client | null>(null);
  const [latestUpdate, setLatestUpdate] = useState<ProjectUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const notificationScale = useRef(new Animated.Value(1)).current;
  const notificationGlow = useRef(new Animated.Value(0)).current;
  const pushRegistrationStarted = useRef(false);

  const loadDashboard = async () => {
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
        .select("id, name, phone, project_name, progress, status")
        .eq("id", clientId)
        .single();

      if (clientError) throw clientError;
      setClient(clientData as Client);

      const { data: updateData, error: updateError } = await supabase
        .from("project_updates")
        .select("id, title, description, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!updateError) {
        setLatestUpdate((updateData as ProjectUpdate | null) ?? null);
      }
    } catch (error: any) {
      console.error("Dashboard error:", error);
      setErrorMessage(error?.message || "تعذر تحميل بيانات المشروع");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [clientId]);

  useEffect(() => {
    if (!clientId || pushRegistrationStarted.current) return;

    pushRegistrationStarted.current = true;

    const registerPushNotifications = async () => {
      try {
        const token = await registerPushToken({
          clientId,
        });

        console.log("Expo Push Token:", token);
      } catch (error: any) {
        console.log(
          "Push notification registration error:",
          error?.message || error
        );

        if (
          String(error?.message || "").includes(
            "لم يتم السماح"
          )
        ) {
          Alert.alert(
            "صلاحية الإشعارات",
            "فعّل الإشعارات من إعدادات الهاتف حتى تصلك تحديثات المشروع."
          );
        }
      }
    };

    registerPushNotifications();
  }, [clientId]);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(notificationScale, {
            toValue: 1.18,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(notificationScale, {
            toValue: 0.96,
            duration: 140,
            useNativeDriver: true,
          }),
          Animated.timing(notificationScale, {
            toValue: 1.1,
            duration: 160,
            useNativeDriver: true,
          }),
          Animated.timing(notificationScale, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(notificationGlow, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(notificationGlow, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [notificationGlow, notificationScale]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handleLogout = () => {
    Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج من حساب العميل؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تسجيل الخروج",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/login");
        },
      },
    ]);
  };

  const openPage = (
    pathname:
      | "/client/images"
      | "/client/updates"
      | "/client/payments"
      | "/client/files"
      | "/client/notifications"
  ) => {
    if (!client?.id) {
      Alert.alert("تنبيه", "تعذر تحديد رقم العميل");
      return;
    }

    router.push({
      pathname,
      params: { id: String(client.id) },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>جاري تحميل بيانات المشروع...</Text>
      </SafeAreaView>
    );
  }

  if (errorMessage || !client) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>تعذر تحميل الصفحة</Text>
        <Text style={styles.errorText}>
          {errorMessage || "لم يتم العثور على بيانات العميل"}
        </Text>

        <TouchableOpacity style={styles.retryButton} onPress={loadDashboard}>
          <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace("/login")}
        >
          <Text style={styles.backButtonText}>العودة لتسجيل الدخول</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const progressValue = Math.min(
    100,
    Math.max(0, Number(client.progress ?? 0))
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#d4a94e"
            colors={["#d4a94e"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View>
              <Text style={styles.brandName}>أزدان</Text>
              <Text style={styles.brandSubtitle}>للمقاولات العامة</Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutText}>خروج</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openPage("/client/notifications")}
                activeOpacity={0.8}
              >
                <Animated.View
                  style={[
                    styles.notificationButton,
                    { transform: [{ scale: notificationScale }] },
                  ]}
                >
                  <Text style={styles.notificationIcon}>🔔</Text>

                  <View style={styles.notificationDot}>
                    <Text style={styles.notificationDotText}>!</Text>
                  </View>

                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.notificationGlow,
                      { opacity: notificationGlow },
                    ]}
                  />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.welcomeText}>مرحبًا، {client.name}</Text>
          <Text style={styles.projectName}>{client.project_name}</Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.cardLabel}>حالة المشروع</Text>
              <Text style={styles.statusText}>
                {client.status || "قيد التنفيذ"}
              </Text>
            </View>

            <View style={styles.progressCircle}>
              <Text style={styles.progressCircleText}>{progressValue}%</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progressValue}%` }]}
            />
          </View>

          <Text style={styles.progressCaption}>
            نسبة الإنجاز الحالية للمشروع
          </Text>
        </View>

        {latestUpdate ? (
          <View style={styles.updateCard}>
            <Text style={styles.sectionTitle}>آخر تحديث</Text>
            <Text style={styles.updateTitle}>
              {latestUpdate.title || "تحديث المشروع"}
            </Text>

            {latestUpdate.description ? (
              <Text style={styles.updateDescription}>
                {latestUpdate.description}
              </Text>
            ) : null}

            {latestUpdate.created_at ? (
              <Text style={styles.updateDate}>
                {new Date(latestUpdate.created_at).toLocaleDateString("ar-IQ")}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>خدمات المشروع</Text>

        <View style={styles.menuGrid}>
          <TouchableOpacity
            style={styles.menuCard}
            activeOpacity={0.75}
            onPress={() => openPage("/client/images")}
          >
            <Text style={styles.menuIcon}>📷</Text>
            <Text style={styles.menuTitle}>صور المشروع</Text>
            <Text style={styles.menuDescription}>
              متابعة آخر صور التنفيذ
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuCard}
            activeOpacity={0.75}
            onPress={() => openPage("/client/updates")}
          >
            <Text style={styles.menuIcon}>📝</Text>
            <Text style={styles.menuTitle}>التحديثات</Text>
            <Text style={styles.menuDescription}>
              متابعة مراحل وتفاصيل العمل
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuCard}
            activeOpacity={0.75}
            onPress={() => openPage("/client/payments")}
          >
            <Text style={styles.menuIcon}>💳</Text>
            <Text style={styles.menuTitle}>الدفعات</Text>
            <Text style={styles.menuDescription}>
              عرض الدفعات والمستحقات
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuCard}
            activeOpacity={0.75}
            onPress={() => openPage("/client/files")}
          >
            <Text style={styles.menuIcon}>📁</Text>
            <Text style={styles.menuTitle}>الملفات</Text>
            <Text style={styles.menuDescription}>
              مخططات ومستندات المشروع
            </Text>
          </TouchableOpacity>
</View>

        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>بيانات العميل</Text>
          <Text style={styles.contactText}>الاسم: {client.name}</Text>
          <Text style={styles.contactText}>
            الهاتف: {client.phone || "غير مسجل"}
          </Text>
        </View>

        <Text style={styles.footerText}>© أزدان للمقاولات العامة</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#08111f" },
  scrollContent: { paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#08111f",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  loadingText: { color: "#dce6f5", fontSize: 15 },
  errorContainer: {
    flex: 1,
    backgroundColor: "#08111f",
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  errorIcon: { fontSize: 54, marginBottom: 14 },
  errorTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  errorText: {
    color: "#aebbd0",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 23,
    marginBottom: 24,
  },
  retryButton: {
    width: "100%",
    backgroundColor: "#d4a94e",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  retryButtonText: { color: "#07101d", fontSize: 16, fontWeight: "800" },
  backButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#31415a",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  backButtonText: { color: "#dce6f5", fontSize: 15, fontWeight: "700" },
  header: {
    backgroundColor: "#0d1a2c",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  brandRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 26,
  },
  brandName: {
    color: "#d4a94e",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "right",
  },
  brandSubtitle: {
    color: "#9eacc1",
    fontSize: 12,
    textAlign: "right",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#13233a",
    borderWidth: 1,
    borderColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  notificationIcon: {
    fontSize: 22,
  },
  notificationDot: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#e84949",
    borderWidth: 2,
    borderColor: "#0d1a2c",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notificationDotText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  notificationGlow: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#d4a94e",
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: "#34445d",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  logoutText: { color: "#e3eaf5", fontSize: 14, fontWeight: "700" },
  welcomeText: {
    color: "#aebbd0",
    fontSize: 15,
    textAlign: "right",
    marginBottom: 7,
  },
  projectName: {
    color: "#ffffff",
    fontSize: 23,
    fontWeight: "900",
    textAlign: "right",
    lineHeight: 32,
  },
  statusCard: {
    marginHorizontal: 18,
    marginTop: 18,
    padding: 20,
    borderRadius: 22,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
  },
  statusHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  cardLabel: {
    color: "#95a6be",
    fontSize: 13,
    textAlign: "right",
    marginBottom: 6,
  },
  statusText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "right",
  },
  progressCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  progressCircleText: { color: "#07101d", fontSize: 17, fontWeight: "900" },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 10,
    backgroundColor: "#263750",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#d4a94e",
    borderRadius: 10,
  },
  progressCaption: {
    color: "#8fa0b8",
    fontSize: 12,
    textAlign: "right",
    marginTop: 9,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
    textAlign: "right",
    marginHorizontal: 18,
    marginTop: 24,
    marginBottom: 12,
  },
  updateCard: {
    marginHorizontal: 18,
    marginTop: 18,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#101d2f",
    borderWidth: 1,
    borderColor: "#22344e",
  },
  updateTitle: {
    color: "#f2f5fa",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 8,
  },
  updateDescription: {
    color: "#aebbd0",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
  },
  updateDate: {
    color: "#d4a94e",
    fontSize: 12,
    textAlign: "right",
    marginTop: 12,
  },
  menuGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    paddingHorizontal: 12,
  },
  menuCard: {
    width: "46%",
    minHeight: 155,
    marginHorizontal: "2%",
    marginBottom: 14,
    backgroundColor: "#111f33",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#243650",
    padding: 16,
    alignItems: "flex-end",
  },
  fullWidthCard: {
    width: "96%",
    minHeight: 125,
  },
  menuIcon: { fontSize: 30, marginBottom: 13 },
  menuTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 7,
  },
  menuDescription: {
    color: "#8fa0b8",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
  },
  contactCard: {
    marginHorizontal: 18,
    marginTop: 12,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#0d1a2c",
    borderWidth: 1,
    borderColor: "#22344e",
  },
  contactTitle: {
    color: "#d4a94e",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 12,
  },
  contactText: {
    color: "#c4cfde",
    fontSize: 14,
    textAlign: "right",
    marginBottom: 7,
  },
  footerText: {
    color: "#6f7f95",
    fontSize: 12,
    textAlign: "center",
    marginTop: 28,
  },
});