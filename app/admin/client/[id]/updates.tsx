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

const TABLE_NAME = "project_updates";

type UpdateRow = {
  id: number;
  client_id: number;
  title: string;
  description: string | null;
  created_at: string | null;
};

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

export default function AdminUpdatesPage() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const clientId = useMemo(
    () => getClientId(params.id),
    [params.id]
  );

  const [items, setItems] = useState<UpdateRow[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
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
          "id, client_id, title, description, created_at"
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setItems((data ?? []) as UpdateRow[]);
    } catch (error: any) {
      setErrorMessage(
        error?.message || "تعذر تحميل تحديثات المشروع"
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
      Alert.alert("خطأ", "رقم العميل غير صحيح");
      return;
    }

    const finalTitle = title.trim();
    const finalDescription = description.trim();

    if (!finalTitle && !finalDescription) {
      Alert.alert(
        "بيانات ناقصة",
        "أدخل عنوان التحديث أو تفاصيله"
      );
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from(TABLE_NAME)
        .insert({
          client_id: clientId,
          title: finalTitle || "تحديث جديد للمشروع",
          description: finalDescription || null,
        });

      if (error) throw error;

      setTitle("");
      setDescription("");

      await loadItems();

      Alert.alert(
        "تمت الإضافة",
        "تمت إضافة تحديث المشروع بنجاح."
      );
    } catch (error: any) {
      Alert.alert(
        "تعذر إضافة التحديث",
        error?.message || "حدث خطأ أثناء إضافة التحديث"
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item: UpdateRow) => {
    Alert.alert(
      "حذف التحديث",
      `هل تريد حذف تحديث "${item.title}"؟`,
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

  const deleteItem = async (item: UpdateRow) => {
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
        current.filter((row) => row.id !== item.id)
      );

      Alert.alert(
        "تم الحذف",
        "تم حذف التحديث بنجاح."
      );
    } catch (error: any) {
      Alert.alert(
        "تعذر حذف التحديث",
        error?.message || "حدث خطأ أثناء الحذف"
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Header
        title="تحديثات المشروع"
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
                <Text style={styles.formIcon}>📢</Text>

                <View style={styles.formHeaderInfo}>
                  <Text style={styles.formTitle}>
                    إضافة تحديث جديد
                  </Text>

                  <Text style={styles.formSubtitle}>
                    أضف آخر أخبار ومراحل إنجاز المشروع
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>
                عنوان التحديث
              </Text>

              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="مثال: اكتمال أعمال الصب"
                placeholderTextColor="#718198"
                textAlign="right"
                editable={!saving}
              />

              <Text style={styles.label}>
                تفاصيل التحديث
              </Text>

              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="اكتب تفاصيل المرحلة أو الأعمال المنجزة"
                placeholderTextColor="#718198"
                multiline
                textAlign="right"
                textAlignVertical="top"
                editable={!saving}
              />

              <TouchableOpacity
                style={[
                  styles.goldButton,
                  saving && styles.disabledButton,
                ]}
                activeOpacity={0.8}
                disabled={saving}
                onPress={addItem}
              >
                {saving ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator
                      size="small"
                      color="#07101d"
                    />

                    <Text style={styles.goldButtonText}>
                      جاري إضافة التحديث...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.goldButtonText}>
                    إضافة التحديث
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
                {items.length} تحديث
              </Text>

              <Text style={styles.sectionTitle}>
                سجل التحديثات
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <Loader />
          ) : (
            <Empty text="لا توجد تحديثات مضافة للمشروع بعد" />
          )
        }
        renderItem={({ item, index }) => {
          const deleting = deletingId === item.id;

          return (
            <View style={styles.card}>
              <View style={styles.timelineColumn}>
                <View style={styles.timelineDot} />

                {index < items.length - 1 ? (
                  <View style={styles.timelineLine} />
                ) : null}
              </View>

              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>🏗️</Text>

                  <View style={styles.cardHeaderInfo}>
                    <Text style={styles.cardTitle}>
                      {item.title}
                    </Text>

                    {item.created_at ? (
                      <Text style={styles.dateText}>
                        {formatDate(item.created_at)}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.cardText}>
                  {item.description || "بدون تفاصيل إضافية"}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    deleting && styles.disabledButton,
                  ]}
                  disabled={deleting}
                  onPress={() => confirmDelete(item)}
                >
                  {deleting ? (
                    <ActivityIndicator
                      size="small"
                      color="#ffffff"
                    />
                  ) : (
                    <Text style={styles.deleteText}>
                      حذف التحديث
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
          متابعة وتوثيق مراحل التنفيذ
        </Text>
      </View>

      <View style={styles.countBadge}>
        <Text style={styles.countValue}>{count}</Text>
        <Text style={styles.countText}>تحديث</Text>
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
        جاري تحميل التحديثات...
      </Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>📭</Text>

      <Text style={styles.emptyTitle}>
        لا توجد تحديثات
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

  descriptionInput: {
    minHeight: 105,
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
    flexDirection: "row-reverse",
    marginBottom: 12,
  },

  timelineColumn: {
    width: 30,
    alignItems: "center",
  },

  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#d4a94e",
    borderWidth: 3,
    borderColor: "#513f1d",
    marginTop: 19,
  },

  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 95,
    backgroundColor: "#31435e",
    marginTop: 4,
  },

  cardContent: {
    flex: 1,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    borderRadius: 18,
    padding: 15,
  },

  cardHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },

  cardIcon: {
    fontSize: 27,
    marginLeft: 11,
  },

  cardHeaderInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  cardTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },

  cardText: {
    color: "#aebbd0",
    marginTop: 13,
    lineHeight: 22,
    textAlign: "right",
  },

  dateText: {
    color: "#7f90a8",
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