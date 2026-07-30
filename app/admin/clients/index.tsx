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
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../lib/supabase";
import ClientCard, {
  AdminClient,
} from "../components/ClientCard";
import SearchBar from "../components/SearchBar";

type FilterValue =
  | "all"
  | "active"
  | "review"
  | "paused"
  | "completed";

const filters: { key: FilterValue; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "active", label: "قيد التنفيذ" },
  { key: "review", label: "قيد المراجعة" },
  { key: "paused", label: "متوقف" },
  { key: "completed", label: "مكتمل" },
];

export default function AdminClientsPage() {
  const router = useRouter();

  const [clients, setClients] = useState<AdminClient[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadClients = useCallback(async () => {
    try {
      setErrorMessage("");

      const { data, error } = await supabase
        .from("clients")
        .select(
          "id, name, phone, project_name, progress, status, access_code, created_at"
        )
        .order("id", { ascending: false });

      if (error) throw error;

      setClients((data ?? []) as AdminClient[]);
    } catch (error: any) {
      setErrorMessage(
        error?.message || "تعذر تحميل قائمة العملاء"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesSearch =
        !query ||
        client.name.toLowerCase().includes(query) ||
        client.project_name.toLowerCase().includes(query) ||
        (client.phone || "").toLowerCase().includes(query) ||
        String(client.id).includes(query);

      const status = (client.status || "").trim();

      let matchesFilter = true;

      if (filter === "active") {
        matchesFilter =
          status.includes("قيد التنفيذ") ||
          (!status.includes("مكتمل") &&
            !status.includes("مراجعة") &&
            !status.includes("متوقف"));
      }

      if (filter === "review") {
        matchesFilter = status.includes("مراجعة");
      }

      if (filter === "paused") {
        matchesFilter = status.includes("متوقف");
      }

      if (filter === "completed") {
        matchesFilter = status.includes("مكتمل");
      }

      return matchesSearch && matchesFilter;
    });
  }, [clients, filter, search]);

  const completedCount = clients.filter((client) =>
    (client.status || "").includes("مكتمل")
  ).length;

  const averageProgress =
    clients.length === 0
      ? 0
      : Math.round(
          clients.reduce(
            (sum, client) =>
              sum + Number(client.progress || 0),
            0
          ) / clients.length
        );

  const refresh = () => {
    setRefreshing(true);
    loadClients();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.loadingText}>
          جاري تحميل العملاء...
        </Text>
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
            onRefresh={refresh}
            tintColor="#22C55E"
            colors={["#22C55E"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-forward" size={23} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.title}>إدارة العملاء</Text>
            <Text style={styles.subtitle}>
              عرض وبحث وتنظيم مشاريع العملاء
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() =>
              router.push("/admin/clients/new" as never)
            }
          >
            <Ionicons name="add" size={25} color="#052E16" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <MiniStat icon="people-outline" value={String(clients.length)} label="إجمالي العملاء" />

          <MiniStat icon="checkmark-done-outline" value={String(completedCount)} label="مشاريع مكتملة" />

          <MiniStat icon="trending-up-outline" value={`${averageProgress}%`} label="متوسط الإنجاز" />
        </View>

        <View style={styles.searchSection}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            onClear={() => setSearch("")}
            placeholder="ابحث باسم العميل أو المشروع أو الهاتف"
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            {filters.map((item) => {
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
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>

            <TouchableOpacity onPress={loadClients}>
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {filteredClients.length} نتيجة
          </Text>

          <Text style={styles.resultsTitle}>
            قائمة العملاء
          </Text>
        </View>

        {filteredClients.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="people-outline" size={34} color="#4ADE80" />
            </View>
            <Text style={styles.emptyTitle}>
              لا توجد نتائج
            </Text>
            <Text style={styles.emptyText}>
              غيّر البحث أو الفلتر، أو أضف عميلًا جديدًا.
            </Text>

            <TouchableOpacity
              style={styles.emptyAddButton}
              onPress={() =>
                router.push("/admin/clients/new" as never)
              }
            >
              <Text style={styles.emptyAddText}>
                إضافة عميل جديد
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onPress={() =>
                router.push(
                  `/admin/client/${client.id}` as never
                )
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniStat({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.miniStat}>
      <View style={styles.miniStatIcon}>
        <Ionicons name={icon} size={18} color="#4ADE80" />
      </View>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
  },
  center: {
    flex: 1,
    backgroundColor: "#0B1220",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#CBD5E1",
    marginTop: 14,
  },
  content: {
    paddingBottom: 45,
  },
  header: {
    backgroundColor: "#101B29",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1F3341",
  },
  backButton: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#182838",
    borderWidth: 1,
    borderColor: "#2B3E4F",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#FFFFFF",
  },
  headerInfo: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 4,
    textAlign: "right",
  },
  addButton: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 4,
  },
  addButtonText: {
    color: "#052E16",
  },
  statsRow: {
    flexDirection: "row-reverse",
    gap: 10,
    padding: 16,
    paddingBottom: 0,
  },
  miniStat: {
    flex: 1,
    minHeight: 112,
    borderRadius: 20,
    backgroundColor: "#142131",
    borderWidth: 1,
    borderColor: "#243447",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  miniStatIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(34,197,94,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  miniStatValue: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
  },
  miniStatLabel: {
    color: "#94A3B8",
    fontSize: 9,
    marginTop: 6,
    textAlign: "center",
  },
  searchSection: {
    backgroundColor: "#142131",
    borderWidth: 1,
    borderColor: "#243447",
    borderRadius: 22,
    margin: 16,
    marginBottom: 10,
    padding: 14,
  },
  filtersContent: {
    flexDirection: "row-reverse",
    gap: 8,
    paddingTop: 12,
  },
  filterButton: {
    backgroundColor: "#101B29",
    borderWidth: 1,
    borderColor: "#2B3E4F",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterButtonActive: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  filterText: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#052E16",
    fontWeight: "900",
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.28)",
    padding: 15,
    alignItems: "center",
  },
  errorText: {
    color: "#FCA5A5",
    textAlign: "center",
  },
  retryText: {
    color: "#4ADE80",
    fontWeight: "900",
    marginTop: 9,
  },
  resultsHeader: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultsTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  resultsCount: {
    color: "#64748B",
    fontSize: 12,
  },
  emptyState: {
    marginHorizontal: 16,
    backgroundColor: "#142131",
    borderWidth: 1,
    borderColor: "#243447",
    borderRadius: 22,
    padding: 28,
    alignItems: "center",
  },
  emptyIconBox: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: "rgba(34,197,94,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 13,
  },
  emptyText: {
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 7,
  },
  emptyAddButton: {
    marginTop: 17,
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyAddText: {
    color: "#052E16",
    fontWeight: "900",
  },
});
