"use client";

import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type ProjectNotification = {
  id: number;
  client_id: number;
  title: string | null;
  message: string | null;
  notification_type: string | null;
  is_read: boolean | null;
  created_at: string | null;
  read_at: string | null;
};

type NotificationDestination =
  | "/client/images"
  | "/client/updates"
  | "/client/payments"
  | "/client/files"
  | null;

export default function NotificationsPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const clientId = useMemo(() => {
    const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
    const parsedId = Number(rawId);

    return Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
  }, [params.id]);

  const [notifications, setNotifications] = useState<ProjectNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const markNotificationsAsRead = useCallback(
    async (items: ProjectNotification[]) => {
      if (!clientId) return;

      const unreadIds = items
        .filter((item) => item.is_read !== true)
        .map((item) => item.id);

      if (unreadIds.length === 0) return;

      const now = new Date().toISOString();

      const { error } = await supabase
        .from("project_notifications")
        .update({
          is_read: true,
          read_at: now,
        })
        .eq("client_id", clientId)
        .in("id", unreadIds);

      if (error) {
        console.error("Mark notifications as read error:", error);
        return;
      }

      setNotifications((current) =>
        current.map((item) =>
          unreadIds.includes(item.id)
            ? {
                ...item,
                is_read: true,
                read_at: now,
              }
            : item
        )
      );
    },
    [clientId]
  );

  const loadNotifications = useCallback(
    async (showLoader = true) => {
      if (!clientId) {
        setErrorMessage("معرّف العميل غير صحيح");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (showLoader) {
          setLoading(true);
        }

        setErrorMessage("");

        const { data, error } = await supabase
          .from("project_notifications")
          .select(
            "id, client_id, title, message, notification_type, is_read, created_at, read_at"
          )
          .eq("client_id", clientId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const loadedNotifications = (data ?? []) as ProjectNotification[];

        setNotifications(loadedNotifications);

        await markNotificationsAsRead(loadedNotifications);
      } catch (error: any) {
        console.error("Notifications error:", error);
        setErrorMessage(error?.message || "تعذر تحميل الإشعارات");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [clientId, markNotificationsAsRead]
  );

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications(false);
  };

  const getNotificationDestination = (
    notificationType: string | null
  ): NotificationDestination => {
    const normalizedType = (notificationType || "").trim().toLowerCase();

    if (
      normalizedType === "image" ||
      normalizedType === "images" ||
      normalizedType === "photo" ||
      normalizedType === "photos"
    ) {
      return "/client/images";
    }

    if (
      normalizedType === "update" ||
      normalizedType === "updates" ||
      normalizedType === "progress"
    ) {
      return "/client/updates";
    }

    if (
      normalizedType === "payment" ||
      normalizedType === "payments" ||
      normalizedType === "finance"
    ) {
      return "/client/payments";
    }

    if (
      normalizedType === "file" ||
      normalizedType === "files" ||
      normalizedType === "document" ||
      normalizedType === "documents"
    ) {
      return "/client/files";
    }

    return null;
  };

  const getNotificationIcon = (notificationType: string | null) => {
    const destination = getNotificationDestination(notificationType);

    if (destination === "/client/images") return "📷";
    if (destination === "/client/updates") return "📝";
    if (destination === "/client/payments") return "💳";
    if (destination === "/client/files") return "📁";

    return "🔔";
  };

  const getNotificationLabel = (notificationType: string | null) => {
    const destination = getNotificationDestination(notificationType);

    if (destination === "/client/images") return "صور المشروع";
    if (destination === "/client/updates") return "تحديث المشروع";
    if (destination === "/client/payments") return "دفعة مالية";
    if (destination === "/client/files") return "ملف جديد";

    return "إشعار";
  };

  const formatDate = (dateValue: string | null) => {
    if (!dateValue) return "تاريخ غير متوفر";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "تاريخ غير متوفر";
    }

    return date.toLocaleString("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const openNotification = async (notification: ProjectNotification) => {
    if (!clientId) {
      Alert.alert("تنبيه", "تعذر تحديد رقم العميل");
      return;
    }

    if (notification.is_read !== true) {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("project_notifications")
        .update({
          is_read: true,
          read_at: now,
        })
        .eq("id", notification.id)
        .eq("client_id", clientId);

      if (!error) {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  is_read: true,
                  read_at: now,
                }
              : item
          )
        );
      }
    }

    const destination = getNotificationDestination(
      notification.notification_type
    );

    if (!destination) {
      return;
    }

    router.push({
      pathname: destination,
      params: { id: String(clientId) },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>جاري تحميل الإشعارات...</Text>
      </SafeAreaView>
    );
  }

  if (errorMessage) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="light-content" />

        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>تعذر تحميل الإشعارات</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>

        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.8}
          onPress={() => loadNotifications()}
        >
          <Text style={styles.primaryButtonText}>إعادة المحاولة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.8}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>العودة</Text>
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
          activeOpacity={0.8}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>الإشعارات</Text>
          <Text style={styles.headerSubtitle}>
            آخر التنبيهات الخاصة بمشروعك
          </Text>
        </View>

        <View style={styles.headerIconContainer}>
          <Text style={styles.headerIcon}>🔔</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          notifications.length === 0 && styles.emptyScrollContent,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#d4a94e"
            colors={["#d4a94e"]}
          />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>🔕</Text>
            </View>

            <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
            <Text style={styles.emptyText}>
              ستظهر هنا إشعارات الصور والتحديثات والدفعات والملفات الجديدة.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                عدد الإشعارات: {notifications.length}
              </Text>
              <Text style={styles.summaryTitle}>سجل الإشعارات</Text>
            </View>

            {notifications.map((notification) => {
              const destination = getNotificationDestination(
                notification.notification_type
              );

              return (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationCard,
                    notification.is_read !== true &&
                      styles.unreadNotificationCard,
                  ]}
                  activeOpacity={destination ? 0.75 : 1}
                  onPress={() => openNotification(notification)}
                >
                  <View style={styles.notificationTopRow}>
                    <View style={styles.notificationContent}>
                      <View style={styles.typeRow}>
                        {notification.is_read !== true ? (
                          <>
                            <View style={styles.unreadDot} />
                            <Text style={styles.unreadLabel}>جديد</Text>
                          </>
                        ) : (
                          <Text style={styles.readLabel}>
                            {getNotificationLabel(notification.notification_type)}
                          </Text>
                        )}
                      </View>

                      <Text style={styles.notificationTitle}>
                        {notification.title || "إشعار جديد"}
                      </Text>
                    </View>

                    <View style={styles.notificationIconContainer}>
                      <Text style={styles.notificationIcon}>
                        {getNotificationIcon(
                          notification.notification_type
                        )}
                      </Text>
                    </View>
                  </View>

                  {notification.message ? (
                    <Text style={styles.notificationMessage}>
                      {notification.message}
                    </Text>
                  ) : null}

                  <View style={styles.notificationFooter}>
                    {destination ? (
                      <Text style={styles.openText}>اضغط للعرض ←</Text>
                    ) : (
                      <View />
                    )}

                    <Text style={styles.notificationDate}>
                      {formatDate(notification.created_at)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
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
    color: "#c5d0df",
    fontSize: 15,
    marginTop: 14,
  },
  errorIcon: {
    fontSize: 52,
    marginBottom: 14,
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },
  errorText: {
    color: "#aebbd0",
    fontSize: 14,
    lineHeight: 22,
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
    borderColor: "#34445d",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#e3eaf5",
    fontSize: 15,
    fontWeight: "700",
  },
  header: {
    minHeight: 96,
    backgroundColor: "#0d1a2c",
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#34445d",
    backgroundColor: "#13233a",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 34,
    lineHeight: 37,
    fontWeight: "400",
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 14,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 23,
    fontWeight: "900",
    textAlign: "right",
  },
  headerSubtitle: {
    color: "#99a9be",
    fontSize: 12,
    textAlign: "right",
    marginTop: 5,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    fontSize: 23,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  emptyScrollContent: {
    flexGrow: 1,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  summaryTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
  },
  summaryText: {
    color: "#8fa0b8",
    fontSize: 12,
  },
  notificationCard: {
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    borderRadius: 20,
    padding: 17,
    marginBottom: 13,
  },
  unreadNotificationCard: {
    borderColor: "#d4a94e",
    backgroundColor: "#14243a",
  },
  notificationTopRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
  },
  notificationContent: {
    flex: 1,
    alignItems: "flex-end",
  },
  notificationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#1a2b44",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 13,
  },
  notificationIcon: {
    fontSize: 23,
  },
  typeRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 7,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e84949",
    marginLeft: 7,
  },
  unreadLabel: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    backgroundColor: "#e84949",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: "hidden",
  },
  readLabel: {
    color: "#d4a94e",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  notificationTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 24,
    textAlign: "right",
  },
  notificationMessage: {
    color: "#aebbd0",
    fontSize: 14,
    lineHeight: 23,
    textAlign: "right",
    marginTop: 13,
  },
  notificationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#243650",
  },
  notificationDate: {
    color: "#7f91aa",
    fontSize: 11,
    textAlign: "right",
    flexShrink: 1,
  },
  openText: {
    color: "#d4a94e",
    fontSize: 12,
    fontWeight: "800",
    marginRight: 12,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 430,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 39,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 9,
  },
  emptyText: {
    color: "#95a6be",
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
  },
  footerText: {
    color: "#6f7f95",
    fontSize: 12,
    textAlign: "center",
    marginTop: 22,
  },
});