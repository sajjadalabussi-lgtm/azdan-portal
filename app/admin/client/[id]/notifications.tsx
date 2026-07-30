"use client";

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

const TABLE_NAME = "project_notifications";

type NotificationType =
  | "update"
  | "payment"
  | "images"
  | "files";

type NotificationRow = {
  id: number;
  client_id: number;
  title: string;
  message: string;
  notification_type: NotificationType | string | null;
  is_read: boolean | null;
  read_at?: string | null;
  created_at: string | null;
};

type NotificationTypeOption = {
  value: NotificationType;
  label: string;
  icon: string;
};

const NOTIFICATION_TYPES: NotificationTypeOption[] = [
  {
    value: "update",
    label: "تحديث",
    icon: "🏗️",
  },
  {
    value: "payment",
    label: "دفعة",
    icon: "💰",
  },
  {
    value: "images",
    label: "صور",
    icon: "🖼️",
  },
  {
    value: "files",
    label: "ملفات",
    icon: "📁",
  },
];

function getClientId(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);

  return Number.isFinite(id) && id > 0 ? id : null;
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

function getTypeDetails(
  value?: string | null
): NotificationTypeOption {
  return (
    NOTIFICATION_TYPES.find(
      (item) => item.value === value
    ) || {
      value: "update",
      label: "إشعار",
      icon: "🔔",
    }
  );
}

export default function AdminNotificationsPage() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const clientId = useMemo(
    () => getClientId(params.id),
    [params.id]
  );

  const [items, setItems] = useState<
    NotificationRow[]
  >([]);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const [type, setType] =
    useState<NotificationType>("update");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  const unreadCount = useMemo(
    () =>
      items.filter((item) => item.is_read !== true)
        .length,
    [items]
  );

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
          "id, client_id, title, message, notification_type, is_read, read_at, created_at"
        )
        .eq("client_id", clientId)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      setItems(
        (data ?? []) as NotificationRow[]
      );
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          "تعذر تحميل إشعارات المشروع"
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

  const addItem = async () => {
    if (!clientId) {
      Alert.alert(
        "خطأ",
        "رقم العميل غير صحيح"
      );
      return;
    }

    const finalTitle = title.trim();
    const finalMessage = message.trim();

    if (!finalTitle) {
      Alert.alert(
        "بيانات ناقصة",
        "أدخل عنوان الإشعار"
      );
      return;
    }

    if (!finalMessage) {
      Alert.alert(
        "بيانات ناقصة",
        "أدخل نص الإشعار"
      );
      return;
    }

    try {
      setSaving(true);

      const { error: insertError } = await supabase
        .from(TABLE_NAME)
        .insert({
          client_id: clientId,
          title: finalTitle,
          message: finalMessage,
          notification_type: type,
          is_read: false,
          read_at: null,
        });

      if (insertError) throw insertError;

      const { data: tokenRows, error: tokenError } = await supabase
        .from("client_push_tokens")
        .select("expo_push_token")
        .eq("client_id", clientId)
        .eq("is_active", true);

      if (tokenError) throw tokenError;

      const tokens = (tokenRows ?? [])
        .map((row: { expo_push_token?: string | null }) =>
          row.expo_push_token?.trim()
        )
        .filter(
          (token): token is string =>
            Boolean(token) &&
            (token.startsWith("ExponentPushToken[") ||
              token.startsWith("ExpoPushToken["))
        );

      let pushSentCount = 0;
      let pushFailedCount = 0;

      for (const token of tokens) {
        const { data: pushResult, error: pushError } =
          await supabase.functions.invoke(
            "send-project-notification",
            {
              body: {
                token,
                title: finalTitle,
                body: finalMessage,
                data: {
                  screen: "notifications",
                  clientId,
                  notificationType: type,
                },
              },
            }
          );

        const ticket = Array.isArray(pushResult?.data)
          ? pushResult.data[0]
          : pushResult?.data;

        if (pushError || ticket?.status === "error" || pushResult?.error) {
          pushFailedCount += 1;
          console.error("Push notification error:", {
            pushError,
            pushResult,
            token,
          });
        } else {
          pushSentCount += 1;
        }
      }

      setTitle("");
      setMessage("");
      setType("update");

      await loadItems();

      if (tokens.length === 0) {
        Alert.alert(
          "تم حفظ الإشعار",
          "تم حفظ الإشعار داخل بوابة العميل، لكن لا يوجد جهاز مسجل لاستقبال إشعار الهاتف."
        );
      } else if (pushSentCount > 0 && pushFailedCount === 0) {
        Alert.alert(
          "تم إرسال الإشعار",
          "تم حفظ الإشعار وإرساله إلى هاتف العميل بنجاح."
        );
      } else if (pushSentCount > 0) {
        Alert.alert(
          "تم الإرسال جزئيًا",
          `تم حفظ الإشعار وإرساله إلى ${pushSentCount} جهاز، وتعذر إرساله إلى ${pushFailedCount} جهاز.`
        );
      } else {
        Alert.alert(
          "تم حفظ الإشعار",
          "تم حفظ الإشعار داخل بوابة العميل، لكن تعذر إرسال إشعار الهاتف."
        );
      }
    } catch (error: any) {
      Alert.alert(
        "تعذر إرسال الإشعار",
        error?.message ||
          "حدث خطأ أثناء إرسال الإشعار"
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (
    item: NotificationRow
  ) => {
    Alert.alert(
      "حذف الإشعار",
      `هل تريد حذف الإشعار "${item.title}"؟`,
      [
        {
          text: "إلغاء",
          style: "cancel",
        },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => deleteItem(item),
        },
      ]
    );
  };

  const deleteItem = async (
    item: NotificationRow
  ) => {
    if (!clientId) return;

    try {
      setDeletingId(item.id);

      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq("id", item.id)
        .eq("client_id", clientId);

      if (error) throw error;

      setItems((current) =>
        current.filter(
          (row) => row.id !== item.id
        )
      );

      Alert.alert(
        "تم الحذف",
        "تم حذف الإشعار بنجاح."
      );
    } catch (error: any) {
      Alert.alert(
        "تعذر حذف الإشعار",
        error?.message ||
          "حدث خطأ أثناء الحذف"
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Header
        title="إشعارات العميل"
        count={items.length}
        unreadCount={unreadCount}
        onBack={() => router.back()}
      />

      <FlatList
        data={items}
        keyExtractor={(item) =>
          String(item.id)
        }
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
          items.length === 0 &&
            styles.emptyList,
        ]}
        ListHeaderComponent={
          <>
            <View style={styles.form}>
              <View style={styles.formHeader}>
                <Text style={styles.formIcon}>
                  🔔
                </Text>

                <View
                  style={styles.formHeaderInfo}
                >
                  <Text style={styles.formTitle}>
                    إرسال إشعار جديد
                  </Text>

                  <Text
                    style={styles.formSubtitle}
                  >
                    يظهر الإشعار مباشرة داخل
                    بوابة العميل
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>
                نوع الإشعار
              </Text>

              <View style={styles.typeRow}>
                {NOTIFICATION_TYPES.map(
                  (option) => {
                    const selected =
                      type === option.value;

                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.typeButton,
                          selected &&
                            styles.typeActive,
                        ]}
                        activeOpacity={0.8}
                        disabled={saving}
                        onPress={() =>
                          setType(option.value)
                        }
                      >
                        <Text
                          style={
                            styles.typeButtonIcon
                          }
                        >
                          {option.icon}
                        </Text>

                        <Text
                          style={[
                            styles.typeText,
                            selected &&
                              styles.typeTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>

              <Text style={styles.label}>
                عنوان الإشعار
              </Text>

              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="مثال: تم إضافة صور جديدة"
                placeholderTextColor="#718198"
                textAlign="right"
                editable={!saving}
                maxLength={120}
              />

              <Text style={styles.label}>
                نص الإشعار
              </Text>

              <TextInput
                style={styles.messageInput}
                value={message}
                onChangeText={setMessage}
                placeholder="اكتب تفاصيل الإشعار للعميل"
                placeholderTextColor="#718198"
                multiline
                textAlign="right"
                textAlignVertical="top"
                editable={!saving}
                maxLength={600}
              />

              <View
                style={styles.characterRow}
              >
                <Text
                  style={styles.characterText}
                >
                  {message.length}/600
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.goldButton,
                  saving &&
                    styles.disabledButton,
                ]}
                activeOpacity={0.8}
                disabled={saving}
                onPress={addItem}
              >
                {saving ? (
                  <View
                    style={styles.loadingRow}
                  >
                    <ActivityIndicator
                      size="small"
                      color="#07101d"
                    />

                    <Text
                      style={
                        styles.goldButtonText
                      }
                    >
                      جاري إرسال الإشعار...
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={styles.goldButtonText}
                  >
                    إرسال الإشعار
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text
                  style={styles.errorText}
                >
                  {errorMessage}
                </Text>

                <TouchableOpacity
                  onPress={loadItems}
                >
                  <Text
                    style={styles.retryText}
                  >
                    إعادة المحاولة
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View
              style={styles.sectionHeader}
            >
              <View
                style={styles.sectionStats}
              >
                <Text
                  style={styles.sectionCount}
                >
                  {items.length} إشعار
                </Text>

                <Text
                  style={styles.unreadCount}
                >
                  {unreadCount} غير مقروء
                </Text>
              </View>

              <Text
                style={styles.sectionTitle}
              >
                سجل الإشعارات
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <Loader />
          ) : (
            <Empty text="لا توجد إشعارات مرسلة لهذا العميل بعد" />
          )
        }
        renderItem={({ item }) => {
          const deleting =
            deletingId === item.id;

          const typeDetails =
            getTypeDetails(
              item.notification_type
            );

          const isRead =
            item.is_read === true;

          return (
            <View
              style={[
                styles.card,
                !isRead &&
                  styles.unreadCard,
              ]}
            >
              <View style={styles.cardTop}>
                <View
                  style={styles.notificationIconBox}
                >
                  <Text
                    style={
                      styles.notificationIcon
                    }
                  >
                    {typeDetails.icon}
                  </Text>
                </View>

                <View style={styles.cardInfo}>
                  <View
                    style={styles.cardTitleRow}
                  >
                    {!isRead ? (
                      <View
                        style={
                          styles.unreadDot
                        }
                      />
                    ) : null}

                    <Text
                      style={styles.cardTitle}
                    >
                      {item.title}
                    </Text>
                  </View>

                  <View
                    style={styles.badgesRow}
                  >
                    <View
                      style={
                        styles.typeBadge
                      }
                    >
                      <Text
                        style={
                          styles.typeBadgeText
                        }
                      >
                        {typeDetails.label}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        isRead
                          ? styles.readBadge
                          : styles.unreadBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          isRead
                            ? styles.readText
                            : styles.unreadText,
                        ]}
                      >
                        {isRead
                          ? "مقروء"
                          : "غير مقروء"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <Text style={styles.cardMessage}>
                {item.message}
              </Text>

              {item.created_at ? (
                <Text style={styles.dateText}>
                  أرسل في{" "}
                  {formatDate(
                    item.created_at
                  )}
                </Text>
              ) : null}

              {isRead && item.read_at ? (
                <Text style={styles.readDate}>
                  قُرئ في{" "}
                  {formatDate(item.read_at)}
                </Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.deleteButton,
                  deleting &&
                    styles.disabledButton,
                ]}
                disabled={deleting}
                onPress={() =>
                  confirmDelete(item)
                }
              >
                {deleting ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                  />
                ) : (
                  <Text
                    style={styles.deleteText}
                  >
                    حذف الإشعار
                  </Text>
                )}
              </TouchableOpacity>
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
  unreadCount,
  onBack,
}: {
  title: string;
  count: number;
  unreadCount: number;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
      >
        <Text style={styles.backText}>
          ‹
        </Text>
      </TouchableOpacity>

      <View style={styles.headerTitleBox}>
        <Text style={styles.headerTitle}>
          {title}
        </Text>

        <Text
          style={styles.headerSubtitle}
        >
          {unreadCount > 0
            ? `${unreadCount} إشعار غير مقروء`
            : "جميع الإشعارات مقروءة"}
        </Text>
      </View>

      <View style={styles.countBadge}>
        <Text style={styles.countValue}>
          {count}
        </Text>

        <Text style={styles.countText}>
          إشعار
        </Text>
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
        جاري تحميل الإشعارات...
      </Text>
    </View>
  );
}

function Empty({
  text,
}: {
  text: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>
        🔕
      </Text>

      <Text style={styles.emptyTitle}>
        لا توجد إشعارات
      </Text>

      <Text style={styles.emptyText}>
        {text}
      </Text>
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
    minWidth: 49,
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
    fontSize: 7,
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
    marginBottom: 18,
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
    textAlign: "right",
  },

  label: {
    color: "#c7d1df",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 7,
  },

  typeRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },

  typeButton: {
    flexGrow: 1,
    minWidth: "46%",
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
  },

  typeActive: {
    backgroundColor: "#d4a94e",
    borderColor: "#d4a94e",
  },

  typeButtonIcon: {
    fontSize: 18,
    marginLeft: 7,
  },

  typeText: {
    color: "#c5d0df",
    fontSize: 12,
    fontWeight: "700",
  },

  typeTextActive: {
    color: "#07101d",
    fontWeight: "900",
  },

  titleInput: {
    minHeight: 50,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    borderRadius: 14,
    color: "#ffffff",
    paddingHorizontal: 14,
    marginBottom: 13,
  },

  messageInput: {
    minHeight: 110,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    borderRadius: 14,
    color: "#ffffff",
    paddingHorizontal: 14,
    paddingTop: 13,
  },

  characterRow: {
    alignItems: "flex-start",
    marginTop: 6,
  },

  characterText: {
    color: "#718198",
    fontSize: 10,
  },

  goldButton: {
    height: 50,
    backgroundColor: "#d4a94e",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
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

  disabledButton: {
    opacity: 0.6,
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

  sectionStats: {
    alignItems: "flex-start",
  },

  sectionCount: {
    color: "#8192aa",
    fontSize: 12,
  },

  unreadCount: {
    color: "#d4a94e",
    fontSize: 10,
    marginTop: 3,
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

  unreadCard: {
    borderColor: "#d4a94e",
    borderWidth: 1.5,
  },

  cardTop: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },

  notificationIconBox: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: "#142641",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  notificationIcon: {
    fontSize: 27,
  },

  cardInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  cardTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },

  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#d4a94e",
    marginLeft: 8,
  },

  cardTitle: {
    flexShrink: 1,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },

  badgesRow: {
    flexDirection: "row-reverse",
    gap: 7,
    marginTop: 8,
  },

  typeBadge: {
    backgroundColor: "#263a57",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },

  typeBadgeText: {
    color: "#cbd5e1",
    fontSize: 9,
    fontWeight: "900",
  },

  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },

  readBadge: {
    backgroundColor: "#15382f",
  },

  unreadBadge: {
    backgroundColor: "#493b1d",
  },

  statusText: {
    fontSize: 9,
    fontWeight: "900",
  },

  readText: {
    color: "#80d8b8",
  },

  unreadText: {
    color: "#f5ce76",
  },

  cardMessage: {
    color: "#aebbd0",
    marginTop: 14,
    lineHeight: 22,
    textAlign: "right",
  },

  dateText: {
    color: "#7f90a8",
    fontSize: 10,
    marginTop: 9,
    textAlign: "right",
  },

  readDate: {
    color: "#64b99a",
    fontSize: 10,
    marginTop: 5,
    textAlign: "right",
  },

  deleteButton: {
    height: 42,
    backgroundColor: "#a53b4b",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  deleteText: {
    color: "#ffffff",
    fontWeight: "900",
  },

  loader: {
    paddingTop: 70,
    alignItems: "center",
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