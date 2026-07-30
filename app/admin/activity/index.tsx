"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";

type RawActivity = Record<string, unknown>;

type ActivityItem = {
  id: string;
  action: string;
  description: string;
  entityType: string;
  entityId: string;
  actorEmail: string;
  createdAt: string | null;
  metadata: Record<string, unknown> | null;
};

type FilterKey = "all" | "client" | "payment" | "file" | "image" | "notification";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "client", label: "العملاء" },
  { key: "payment", label: "الدفعات" },
  { key: "file", label: "الملفات" },
  { key: "image", label: "الصور" },
  { key: "notification", label: "الإشعارات" },
];

function textValue(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function normalizeActivity(row: RawActivity, index: number): ActivityItem {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;

  return {
    id: textValue(row.id, `activity-${index}`),
    action:
      textValue(row.action) ||
      textValue(row.event) ||
      textValue(row.type) ||
      "نشاط إداري",
    description:
      textValue(row.description) ||
      textValue(row.details) ||
      textValue(row.message) ||
      "تم تنفيذ إجراء داخل النظام",
    entityType:
      textValue(row.entity_type) ||
      textValue(row.resource_type) ||
      textValue(metadata?.entity_type) ||
      "عام",
    entityId:
      textValue(row.entity_id) ||
      textValue(row.resource_id) ||
      textValue(metadata?.entity_id),
    actorEmail:
      textValue(row.actor_email) ||
      textValue(row.user_email) ||
      textValue(metadata?.actor_email) ||
      "مدير النظام",
    createdAt:
      textValue(row.created_at) ||
      textValue(row.inserted_at) ||
      textValue(row.timestamp) ||
      null,
    metadata,
  };
}

function formatDate(value: string | null) {
  if (!value) return "وقت غير محدد";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "وقت غير محدد";

  try {
    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function iconFor(item: ActivityItem) {
  const value = `${item.action} ${item.entityType}`.toLowerCase();

  if (value.includes("client") || value.includes("عميل")) return "👤";
  if (value.includes("payment") || value.includes("دفعة")) return "💰";
  if (value.includes("file") || value.includes("ملف")) return "📁";
  if (value.includes("image") || value.includes("صورة")) return "📷";
  if (value.includes("notification") || value.includes("إشعار")) return "🔔";
  if (value.includes("delete") || value.includes("حذف")) return "🗑️";
  if (value.includes("update") || value.includes("تعديل")) return "✏️";
  if (value.includes("create") || value.includes("إضافة")) return "➕";

  return "⚡";
}

function matchesFilter(item: ActivityItem, filter: FilterKey) {
  if (filter === "all") return true;

  const value = `${item.action} ${item.entityType} ${item.description}`.toLowerCase();

  const aliases: Record<Exclude<FilterKey, "all">, string[]> = {
    client: ["client", "عميل"],
    payment: ["payment", "دفعة", "دفع"],
    file: ["file", "ملف"],
    image: ["image", "صورة"],
    notification: ["notification", "إشعار"],
  };

  return aliases[filter].some((alias) => value.includes(alias));
}

export default function AdminActivityPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isDesktop = width >= 900;

  const loadActivities = useCallback(async () => {
    try {
      setErrorMessage("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/admin/login");
        return;
      }

      const result = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250);

      if (result.error) throw result.error;

      setActivities(
        (result.data ?? []).map((row, index) =>
          normalizeActivity(row as RawActivity, index)
        )
      );
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          "تعذر تحميل سجل النشاط. تأكد من إنشاء جدول activity_logs."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activities.filter((item) => {
      if (!matchesFilter(item, filter)) return false;

      if (!query) return true;

      const haystack = [
        item.action,
        item.description,
        item.entityType,
        item.entityId,
        item.actorEmail,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [activities, filter, search]);

  const summary = useMemo(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

    const todayCount = activities.filter((item) => {
      if (!item.createdAt) return false;

      const date = new Date(item.createdAt);

      if (Number.isNaN(date.getTime())) return false;

      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` === todayKey;
    }).length;

    const deleteCount = activities.filter((item) =>
      `${item.action} ${item.description}`.toLowerCase().match(/delete|حذف/)
    ).length;

    const createCount = activities.filter((item) =>
      `${item.action} ${item.description}`.toLowerCase().match(/create|add|إضافة/)
    ).length;

    return {
      total: activities.length,
      today: todayCount,
      deletes: deleteCount,
      creates: createCount,
    };
  }, [activities]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>جاري تحميل سجل النشاط...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadActivities();
            }}
            tintColor="#d4a94e"
            colors={["#d4a94e"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.title}>سجل النشاط</Text>
            <Text style={styles.subtitle}>متابعة جميع العمليات الإدارية</Text>
          </View>

          <TouchableOpacity style={styles.refreshButton} onPress={loadActivities}>
            <Text style={styles.refreshText}>↻</Text>
          </TouchableOpacity>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity onPress={loadActivities}>
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.summaryGrid}>
          <SummaryCard
            icon="⚡"
            label="إجمالي النشاطات"
            value={String(summary.total)}
            wide={isDesktop}
          />
          <SummaryCard
            icon="📅"
            label="نشاطات اليوم"
            value={String(summary.today)}
            wide={isDesktop}
          />
          <SummaryCard
            icon="➕"
            label="عمليات الإضافة"
            value={String(summary.creates)}
            wide={isDesktop}
          />
          <SummaryCard
            icon="🗑️"
            label="عمليات الحذف"
            value={String(summary.deletes)}
            wide={isDesktop}
          />
        </View>

        <View style={styles.searchCard}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث في العمليات أو الوصف أو المستخدم..."
            placeholderTextColor="#718199"
            style={styles.searchInput}
            textAlign="right"
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {FILTERS.map((item) => {
              const active = filter === item.key;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.filterButton, active && styles.filterButtonActive]}
                  onPress={() => setFilter(item.key)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      active && styles.filterTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.resultCount}>
              {filteredActivities.length.toLocaleString("ar-IQ")} نتيجة
            </Text>
            <Text style={styles.listTitle}>العمليات المسجلة</Text>
          </View>

          {filteredActivities.length === 0 ? (
            <Text style={styles.emptyText}>لا توجد نشاطات مطابقة.</Text>
          ) : (
            filteredActivities.map((item) => (
              <View key={item.id} style={styles.activityRow}>
                <View style={styles.activityIconBox}>
                  <Text style={styles.activityIcon}>{iconFor(item)}</Text>
                </View>

                <View style={styles.activityInfo}>
                  <Text style={styles.activityAction}>{item.action}</Text>

                  <Text style={styles.activityDescription}>
                    {item.description}
                  </Text>

                  <View style={styles.activityMetaRow}>
                    <Text style={styles.activityMeta}>
                      {item.actorEmail}
                    </Text>

                    {item.entityId ? (
                      <Text style={styles.activityMeta}>
                        #{item.entityId}
                      </Text>
                    ) : null}

                    <Text style={styles.entityBadge}>{item.entityType}</Text>
                  </View>
                </View>

                <Text style={styles.activityDate}>
                  {formatDate(item.createdAt)}
                </Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footer}>
          يتم عرض آخر 250 عملية محفوظة في جدول activity_logs
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  wide,
}: {
  icon: string;
  label: string;
  value: string;
  wide: boolean;
}) {
  return (
    <View style={[styles.summaryCard, wide && styles.summaryCardWide]}>
      <View style={styles.summaryIconBox}>
        <Text style={styles.summaryIcon}>{icon}</Text>
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08111f",
  },
  center: {
    flex: 1,
    backgroundColor: "#08111f",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingBottom: 50,
  },
  loadingText: {
    color: "#c7d1df",
    marginTop: 14,
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
  },
  refreshButton: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshText: {
    color: "#07101d",
    fontSize: 25,
    fontWeight: "900",
  },
  errorBox: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#3a1f28",
    borderRadius: 16,
    padding: 15,
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
  summaryGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
    padding: 16,
    paddingBottom: 0,
  },
  summaryCard: {
    width: "48%",
    flexGrow: 1,
    minHeight: 126,
    borderRadius: 19,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    alignItems: "center",
    justifyContent: "center",
    padding: 13,
  },
  summaryCardWide: {
    width: "23.5%",
  },
  summaryIconBox: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryIcon: {
    fontSize: 20,
  },
  summaryValue: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 9,
  },
  summaryLabel: {
    color: "#9eacc1",
    fontSize: 10,
    marginTop: 5,
  },
  searchCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    padding: 14,
  },
  searchInput: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    color: "#ffffff",
    paddingHorizontal: 14,
    fontSize: 13,
  },
  filters: {
    gap: 8,
    paddingTop: 12,
  },
  filterButton: {
    height: 38,
    borderRadius: 12,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  filterButtonActive: {
    backgroundColor: "#d4a94e",
    borderColor: "#d4a94e",
  },
  filterText: {
    color: "#b8c3d3",
    fontSize: 11,
    fontWeight: "800",
  },
  filterTextActive: {
    color: "#07101d",
  },
  listCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 21,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    padding: 16,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  listTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  resultCount: {
    color: "#d4a94e",
    fontSize: 11,
    fontWeight: "900",
  },
  activityRow: {
    minHeight: 92,
    borderRadius: 15,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    marginBottom: 10,
  },
  activityIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  activityIcon: {
    fontSize: 21,
  },
  activityInfo: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 10,
  },
  activityAction: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },
  activityDescription: {
    color: "#a9b5c7",
    fontSize: 11,
    lineHeight: 18,
    marginTop: 4,
    textAlign: "right",
  },
  activityMetaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 7,
  },
  activityMeta: {
    color: "#718199",
    fontSize: 9,
  },
  entityBadge: {
    color: "#d4a94e",
    fontSize: 9,
    fontWeight: "900",
  },
  activityDate: {
    color: "#718199",
    fontSize: 9,
    width: 80,
    textAlign: "center",
    lineHeight: 15,
  },
  emptyText: {
    color: "#8192aa",
    textAlign: "center",
    paddingVertical: 30,
  },
  footer: {
    color: "#6f7f95",
    fontSize: 11,
    textAlign: "center",
    marginTop: 22,
    paddingHorizontal: 16,
  },
});
