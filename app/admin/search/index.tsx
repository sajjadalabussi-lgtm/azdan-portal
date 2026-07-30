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

type SearchCategory =
  | "all"
  | "clients"
  | "updates"
  | "payments"
  | "files"
  | "images"
  | "notifications"
  | "activity";

type SearchResult = {
  id: string;
  sourceId: string;
  category: Exclude<SearchCategory, "all">;
  title: string;
  subtitle: string;
  meta: string;
  clientId: number | null;
  createdAt: string | null;
  route: string | null;
};

const FILTERS: { key: SearchCategory; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "clients", label: "العملاء" },
  { key: "updates", label: "التحديثات" },
  { key: "payments", label: "الدفعات" },
  { key: "files", label: "الملفات" },
  { key: "images", label: "الصور" },
  { key: "notifications", label: "الإشعارات" },
  { key: "activity", label: "النشاط" },
];

function textValue(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: string | null) {
  if (!value) return "غير محدد";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "غير محدد";

  try {
    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount)) return "0 د.ع";

  return `${Math.round(amount).toLocaleString("ar-IQ")} د.ع`;
}

function categoryIcon(category: SearchResult["category"]) {
  const icons: Record<SearchResult["category"], string> = {
    clients: "👤",
    updates: "📝",
    payments: "💰",
    files: "📁",
    images: "📷",
    notifications: "🔔",
    activity: "⚡",
  };

  return icons[category];
}

function categoryLabel(category: SearchResult["category"]) {
  const labels: Record<SearchResult["category"], string> = {
    clients: "عميل",
    updates: "تحديث",
    payments: "دفعة",
    files: "ملف",
    images: "صورة",
    notifications: "إشعار",
    activity: "نشاط",
  };

  return labels[category];
}

export default function AdminGlobalSearchPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchCategory>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searched, setSearched] = useState(false);

  const isDesktop = width >= 900;

  const runSearch = useCallback(
    async (searchText?: string) => {
      const value = (searchText ?? query).trim();

      if (value.length < 2) {
        setResults([]);
        setSearched(false);
        setInitialLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.replace("/admin/login");
          return;
        }

        const pattern = `%${value}%`;

        const [
          clientsResult,
          updatesResult,
          paymentsResult,
          filesResult,
          imagesResult,
          notificationsResult,
          activityResult,
        ] = await Promise.all([
          supabase
            .from("clients")
            .select("id, name, phone, project_name, status, progress, created_at")
            .or(
              `name.ilike.${pattern},phone.ilike.${pattern},project_name.ilike.${pattern},status.ilike.${pattern}`
            )
            .limit(30),

          supabase
            .from("project_updates")
            .select("id, client_id, title, description, created_at")
            .or(`title.ilike.${pattern},description.ilike.${pattern}`)
            .limit(30),

          supabase
            .from("project_payments")
            .select("id, client_id, amount, note, payment_date, created_at")
            .or(`note.ilike.${pattern}`)
            .limit(30),

          supabase
            .from("project_files")
            .select("id, client_id, name, file_name, description, created_at")
            .or(
              `name.ilike.${pattern},file_name.ilike.${pattern},description.ilike.${pattern}`
            )
            .limit(30),

          supabase
            .from("project_images")
            .select("id, client_id, name, caption, created_at")
            .or(`name.ilike.${pattern},caption.ilike.${pattern}`)
            .limit(30),

          supabase
            .from("project_notifications")
            .select("id, client_id, title, message, created_at")
            .or(`title.ilike.${pattern},message.ilike.${pattern}`)
            .limit(30),

          supabase
            .from("activity_logs")
            .select("id, action, description, entity_type, entity_id, created_at")
            .or(
              `action.ilike.${pattern},description.ilike.${pattern},entity_type.ilike.${pattern},entity_id.ilike.${pattern}`
            )
            .limit(30),
        ]);

        const combined: SearchResult[] = [];

        if (!clientsResult.error) {
          for (const row of clientsResult.data ?? []) {
            const id = numberValue(row.id);

            combined.push({
              id: `client-${row.id}`,
              sourceId: textValue(row.id),
              category: "clients",
              title: textValue(row.name, "عميل بدون اسم"),
              subtitle: textValue(row.project_name, "مشروع غير محدد"),
              meta: [
                textValue(row.phone),
                textValue(row.status),
                row.progress !== null && row.progress !== undefined
                  ? `${row.progress}%`
                  : "",
              ]
                .filter(Boolean)
                .join(" • "),
              clientId: id,
              createdAt: textValue(row.created_at) || null,
              route: id ? `/admin/client/${id}` : null,
            });
          }
        }

        if (!updatesResult.error) {
          for (const row of updatesResult.data ?? []) {
            const clientId = numberValue(row.client_id);

            combined.push({
              id: `update-${row.id}`,
              sourceId: textValue(row.id),
              category: "updates",
              title: textValue(row.title, "تحديث مشروع"),
              subtitle: textValue(row.description, "بدون وصف"),
              meta: clientId ? `العميل #${clientId}` : "بدون عميل",
              clientId,
              createdAt: textValue(row.created_at) || null,
              route: clientId ? `/admin/client/${clientId}` : null,
            });
          }
        }

        if (!paymentsResult.error) {
          for (const row of paymentsResult.data ?? []) {
            const clientId = numberValue(row.client_id);

            combined.push({
              id: `payment-${row.id}`,
              sourceId: textValue(row.id),
              category: "payments",
              title: formatMoney(row.amount),
              subtitle: textValue(row.note, "دفعة مشروع"),
              meta: clientId ? `العميل #${clientId}` : "بدون عميل",
              clientId,
              createdAt:
                textValue(row.payment_date) ||
                textValue(row.created_at) ||
                null,
              route: clientId ? `/admin/client/${clientId}` : null,
            });
          }
        }

        if (!filesResult.error) {
          for (const row of filesResult.data ?? []) {
            const clientId = numberValue(row.client_id);

            combined.push({
              id: `file-${row.id}`,
              sourceId: textValue(row.id),
              category: "files",
              title:
                textValue(row.name) ||
                textValue(row.file_name) ||
                "ملف مشروع",
              subtitle: textValue(row.description, "ملف مرفوع للمشروع"),
              meta: clientId ? `العميل #${clientId}` : "بدون عميل",
              clientId,
              createdAt: textValue(row.created_at) || null,
              route: clientId ? `/admin/client/${clientId}` : null,
            });
          }
        }

        if (!imagesResult.error) {
          for (const row of imagesResult.data ?? []) {
            const clientId = numberValue(row.client_id);

            combined.push({
              id: `image-${row.id}`,
              sourceId: textValue(row.id),
              category: "images",
              title: textValue(row.name, "صورة مشروع"),
              subtitle: textValue(row.caption, "صورة مرفوعة للمشروع"),
              meta: clientId ? `العميل #${clientId}` : "بدون عميل",
              clientId,
              createdAt: textValue(row.created_at) || null,
              route: clientId ? `/admin/client/${clientId}` : null,
            });
          }
        }

        if (!notificationsResult.error) {
          for (const row of notificationsResult.data ?? []) {
            const clientId = numberValue(row.client_id);

            combined.push({
              id: `notification-${row.id}`,
              sourceId: textValue(row.id),
              category: "notifications",
              title: textValue(row.title, "إشعار مشروع"),
              subtitle: textValue(row.message, "بدون نص"),
              meta: clientId ? `العميل #${clientId}` : "بدون عميل",
              clientId,
              createdAt: textValue(row.created_at) || null,
              route: clientId ? `/admin/client/${clientId}` : null,
            });
          }
        }

        if (!activityResult.error) {
          for (const row of activityResult.data ?? []) {
            const entityId = textValue(row.entity_id);
            const entityType = textValue(row.entity_type);
            const clientId =
              entityType.toLowerCase().includes("client")
                ? numberValue(entityId)
                : null;

            combined.push({
              id: `activity-${row.id}`,
              sourceId: textValue(row.id),
              category: "activity",
              title: textValue(row.action, "نشاط إداري"),
              subtitle: textValue(row.description, "بدون تفاصيل"),
              meta: entityType || "نشاط عام",
              clientId,
              createdAt: textValue(row.created_at) || null,
              route: "/admin/activity",
            });
          }
        }

        combined.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

          return bTime - aTime;
        });

        setResults(combined);
        setSearched(true);

        const errors = [
          clientsResult.error,
          updatesResult.error,
          paymentsResult.error,
          filesResult.error,
          imagesResult.error,
          notificationsResult.error,
          activityResult.error,
        ].filter(Boolean);

        if (errors.length === 7) {
          throw errors[0];
        }

        if (errors.length > 0) {
          setErrorMessage(
            "تم عرض النتائج المتاحة، لكن بعض الجداول لم تُبحث بسبب اختلاف أسماء الأعمدة."
          );
        }
      } catch (error: any) {
        setResults([]);
        setSearched(true);
        setErrorMessage(error?.message || "تعذر تنفيذ البحث");
      } finally {
        setLoading(false);
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [query, router]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      runSearch(query);
    }, 450);

    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const filteredResults = useMemo(() => {
    if (filter === "all") return results;
    return results.filter((item) => item.category === filter);
  }, [filter, results]);

  const categoryCounts = useMemo(() => {
    const counts: Record<SearchCategory, number> = {
      all: results.length,
      clients: 0,
      updates: 0,
      payments: 0,
      files: 0,
      images: 0,
      notifications: 0,
      activity: 0,
    };

    for (const result of results) {
      counts[result.category] += 1;
    }

    return counts;
  }, [results]);

  const openResult = (result: SearchResult) => {
    if (result.route) {
      router.push(result.route as never);
    }
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>تجهيز البحث العالمي...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              runSearch();
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
            <Text style={styles.title}>البحث العالمي</Text>
            <Text style={styles.subtitle}>ابحث في جميع بيانات النظام</Text>
          </View>

          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>⌕</Text>
          </View>
        </View>

        <View style={styles.searchCard}>
          <View style={styles.searchBox}>
            {loading ? (
              <ActivityIndicator size="small" color="#d4a94e" />
            ) : (
              <Text style={styles.searchIcon}>⌕</Text>
            )}

            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => runSearch()}
              placeholder="اسم العميل، الهاتف، المشروع، الملف..."
              placeholderTextColor="#718199"
              style={styles.searchInput}
              textAlign="right"
              returnKeyType="search"
              autoFocus
            />

            {query.length > 0 ? (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  setQuery("");
                  setResults([]);
                  setSearched(false);
                }}
              >
                <Text style={styles.clearText}>×</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.searchHint}>
            اكتب حرفين على الأقل، وسيتم البحث تلقائيًا.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{errorMessage}</Text>
          </View>
        ) : null}

        {searched ? (
          <>
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
                    style={[
                      styles.filterButton,
                      active && styles.filterButtonActive,
                    ]}
                    onPress={() => setFilter(item.key)}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        active && styles.filterTextActive,
                      ]}
                    >
                      {item.label} ({categoryCounts[item.key]})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.resultsHeader}>
              <Text style={styles.resultCount}>
                {filteredResults.length.toLocaleString("ar-IQ")} نتيجة
              </Text>
              <Text style={styles.resultsTitle}>نتائج البحث</Text>
            </View>

            {filteredResults.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>⌕</Text>
                <Text style={styles.emptyTitle}>لا توجد نتائج مطابقة</Text>
                <Text style={styles.emptyText}>
                  جرّب اسمًا آخر أو رقم هاتف أو اسم مشروع.
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.resultsGrid,
                  isDesktop && styles.resultsGridDesktop,
                ]}
              >
                {filteredResults.map((result) => (
                  <TouchableOpacity
                    key={result.id}
                    style={[
                      styles.resultCard,
                      isDesktop && styles.resultCardDesktop,
                    ]}
                    onPress={() => openResult(result)}
                    disabled={!result.route}
                  >
                    <View style={styles.resultTopRow}>
                      <View style={styles.resultIconBox}>
                        <Text style={styles.resultIcon}>
                          {categoryIcon(result.category)}
                        </Text>
                      </View>

                      <View style={styles.resultMain}>
                        <Text style={styles.resultTitle} numberOfLines={1}>
                          {result.title}
                        </Text>
                        <Text style={styles.resultSubtitle} numberOfLines={2}>
                          {result.subtitle}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.resultBottomRow}>
                      <Text style={styles.resultDate}>
                        {formatDate(result.createdAt)}
                      </Text>

                      <Text style={styles.resultMeta} numberOfLines={1}>
                        {result.meta || `#${result.sourceId}`}
                      </Text>

                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>
                          {categoryLabel(result.category)}
                        </Text>
                      </View>
                    </View>

                    {result.route ? (
                      <Text style={styles.openText}>فتح النتيجة ←</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.introCard}>
            <Text style={styles.introIcon}>⌕</Text>
            <Text style={styles.introTitle}>بحث واحد لكل النظام</Text>
            <Text style={styles.introText}>
              يمكنك البحث في العملاء وأرقام الهواتف وأسماء المشاريع والتحديثات
              والدفعات والملفات والصور والإشعارات وسجل النشاط.
            </Text>

            <View style={styles.examples}>
              <Example text="مثال: أحمد" />
              <Example text="مثال: مشروع بغداد" />
              <Example text="مثال: 0770" />
              <Example text="مثال: مخطط" />
            </View>
          </View>
        )}

        <Text style={styles.footer}>
          البحث مرتبط مباشرة بجداول Supabase ويعرض النتائج الأحدث أولًا.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Example({ text }: { text: string }) {
  return (
    <View style={styles.exampleChip}>
      <Text style={styles.exampleText}>{text}</Text>
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
  headerIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconText: {
    color: "#07101d",
    fontSize: 25,
    fontWeight: "900",
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
  searchBox: {
    minHeight: 56,
    borderRadius: 15,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  searchIcon: {
    color: "#d4a94e",
    fontSize: 23,
    fontWeight: "900",
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#23344d",
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 24,
  },
  searchHint: {
    color: "#718199",
    fontSize: 10,
    textAlign: "right",
    marginTop: 9,
  },
  warningBox: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: "#3c301b",
    padding: 13,
  },
  warningText: {
    color: "#f4d89b",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 18,
  },
  filters: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  filterButton: {
    height: 40,
    borderRadius: 12,
    backgroundColor: "#111f33",
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
    fontSize: 10,
    fontWeight: "800",
  },
  filterTextActive: {
    color: "#07101d",
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 2,
  },
  resultsTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  resultCount: {
    color: "#d4a94e",
    fontSize: 11,
    fontWeight: "900",
  },
  resultsGrid: {
    paddingHorizontal: 16,
  },
  resultsGridDesktop: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 12,
  },
  resultCard: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    padding: 14,
  },
  resultCardDesktop: {
    width: "48.8%",
    marginTop: 0,
    flexGrow: 1,
  },
  resultTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultIconBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  resultIcon: {
    fontSize: 22,
  },
  resultMain: {
    flex: 1,
    alignItems: "flex-end",
    paddingLeft: 12,
  },
  resultTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
    maxWidth: "100%",
  },
  resultSubtitle: {
    color: "#a9b5c7",
    fontSize: 11,
    lineHeight: 18,
    marginTop: 5,
    textAlign: "right",
    maxWidth: "100%",
  },
  resultBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 13,
  },
  resultDate: {
    color: "#718199",
    fontSize: 9,
  },
  resultMeta: {
    flex: 1,
    color: "#8e9db2",
    fontSize: 9,
    textAlign: "right",
  },
  categoryBadge: {
    borderRadius: 20,
    backgroundColor: "#24344c",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  categoryBadgeText: {
    color: "#d4a94e",
    fontSize: 9,
    fontWeight: "900",
  },
  openText: {
    color: "#d4a94e",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 11,
  },
  emptyCard: {
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    padding: 34,
    alignItems: "center",
  },
  emptyIcon: {
    color: "#d4a94e",
    fontSize: 48,
    fontWeight: "900",
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 12,
  },
  emptyText: {
    color: "#8796aa",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  introCard: {
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    padding: 26,
    alignItems: "center",
  },
  introIcon: {
    color: "#d4a94e",
    fontSize: 55,
    fontWeight: "900",
  },
  introTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 8,
  },
  introText: {
    color: "#9eacc1",
    fontSize: 12,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 650,
  },
  examples: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  exampleChip: {
    borderRadius: 20,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exampleText: {
    color: "#c9d3e0",
    fontSize: 10,
  },
  footer: {
    color: "#6f7f95",
    fontSize: 11,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 16,
  },
});
