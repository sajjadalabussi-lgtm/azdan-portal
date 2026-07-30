import { useLocalSearchParams, useRouter } from "expo-router";
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
import { supabase } from "../../lib/supabase";

type ProjectUpdate = {
  id: number;
  client_id: number;
  title: string | null;
  description: string | null;
  created_at: string | null;
};

type Client = {
  id: number;
  project_name: string;
};

function formatDate(dateValue: string | null) {
  if (!dateValue) return "بدون تاريخ";

  try {
    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(dateValue));
  } catch {
    return "بدون تاريخ";
  }
}

export default function ProjectUpdatesPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const clientId = useMemo(() => {
    const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
    const parsedId = Number(rawId);

    return Number.isFinite(parsedId) ? parsedId : null;
  }, [params.id]);

  const [client, setClient] = useState<Client | null>(null);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadUpdates = useCallback(async () => {
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
        .select("id, project_name")
        .eq("id", clientId)
        .single();

      if (clientError) {
        throw clientError;
      }

      setClient(clientData as Client);

      const { data: updatesData, error: updatesError } = await supabase
        .from("project_updates")
        .select("id, client_id, title, description, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (updatesError) {
        throw updatesError;
      }

      setUpdates((updatesData as ProjectUpdate[]) ?? []);
    } catch (error: any) {
      console.error("Project updates error:", error);
      setErrorMessage(error?.message || "تعذر تحميل تحديثات المشروع");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadUpdates();
  }, [loadUpdates]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadUpdates();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>جاري تحميل التحديثات...</Text>
      </SafeAreaView>
    );
  }

  if (errorMessage) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="light-content" />

        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>تعذر تحميل التحديثات</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>

        <TouchableOpacity style={styles.retryButton} onPress={loadUpdates}>
          <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>رجوع</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          activeOpacity={0.8}
          onPress={() => router.back()}
        >
          <Text style={styles.headerBackText}>رجوع</Text>
        </TouchableOpacity>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>تحديثات المشروع</Text>
          <Text style={styles.headerSubtitle}>
            {client?.project_name || "المشروع"}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
        <View style={styles.countCard}>
          <Text style={styles.countNumber}>{updates.length}</Text>
          <Text style={styles.countLabel}>تحديث مضاف إلى المشروع</Text>
        </View>

        {updates.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyTitle}>لا توجد تحديثات حاليًا</Text>
            <Text style={styles.emptyDescription}>
              ستظهر هنا جميع مراحل العمل والتحديثات الجديدة عند إضافتها.
            </Text>
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            {updates.map((update, index) => (
              <View key={update.id} style={styles.timelineRow}>
                <View style={styles.timelineSide}>
                  <View style={styles.timelineDot} />
                  {index !== updates.length - 1 ? (
                    <View style={styles.timelineLine} />
                  ) : null}
                </View>

                <View style={styles.updateCard}>
                  <View style={styles.updateTopRow}>
                    <Text style={styles.updateDate}>
                      {formatDate(update.created_at)}
                    </Text>

                    <View style={styles.updateBadge}>
                      <Text style={styles.updateBadgeText}>تحديث</Text>
                    </View>
                  </View>

                  <Text style={styles.updateTitle}>
                    {update.title || "تحديث جديد للمشروع"}
                  </Text>

                  {update.description ? (
                    <Text style={styles.updateDescription}>
                      {update.description}
                    </Text>
                  ) : (
                    <Text style={styles.updateDescriptionMuted}>
                      لا يوجد وصف مضاف لهذا التحديث.
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: "#08111f",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  loadingText: {
    color: "#dce6f5",
    fontSize: 15,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#08111f",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  errorIcon: {
    fontSize: 52,
    marginBottom: 12,
  },
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
  retryButtonText: {
    color: "#07101d",
    fontSize: 16,
    fontWeight: "800",
  },
  backButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#31415a",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  backButtonText: {
    color: "#dce6f5",
    fontSize: 15,
    fontWeight: "700",
  },
  header: {
    backgroundColor: "#0d1a2c",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerBackButton: {
    borderWidth: 1,
    borderColor: "#d4a94e",
    borderRadius: 13,
    paddingHorizontal: 17,
    paddingVertical: 10,
  },
  headerBackText: {
    color: "#d4a94e",
    fontSize: 15,
    fontWeight: "800",
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "flex-end",
    marginLeft: 18,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "right",
  },
  headerSubtitle: {
    color: "#9eacc1",
    fontSize: 13,
    textAlign: "right",
    marginTop: 5,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 40,
  },
  countCard: {
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#2a3b56",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },
  countNumber: {
    color: "#d4a94e",
    fontSize: 32,
    fontWeight: "900",
  },
  countLabel: {
    color: "#e1e8f3",
    fontSize: 15,
    fontWeight: "700",
  },
  timelineContainer: {
    paddingTop: 4,
  },
  timelineRow: {
    flexDirection: "row-reverse",
    alignItems: "stretch",
  },
  timelineSide: {
    width: 28,
    alignItems: "center",
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#d4a94e",
    borderWidth: 3,
    borderColor: "#4d421f",
    marginTop: 24,
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 40,
    backgroundColor: "#2c3c55",
  },
  updateCard: {
    flex: 1,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#263850",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    marginRight: 8,
  },
  updateTopRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  updateDate: {
    color: "#8fa0b8",
    fontSize: 12,
  },
  updateBadge: {
    backgroundColor: "#332d1b",
    borderWidth: 1,
    borderColor: "#6a5724",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  updateBadgeText: {
    color: "#d4a94e",
    fontSize: 11,
    fontWeight: "800",
  },
  updateTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "right",
    lineHeight: 27,
    marginBottom: 9,
  },
  updateDescription: {
    color: "#b5c0d1",
    fontSize: 14,
    lineHeight: 23,
    textAlign: "right",
  },
  updateDescriptionMuted: {
    color: "#73849b",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    fontStyle: "italic",
  },
  emptyCard: {
    minHeight: 280,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#263850",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },
  emptyDescription: {
    color: "#95a5bb",
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
  },
  footerText: {
    color: "#66778e",
    fontSize: 12,
    textAlign: "center",
    marginTop: 28,
  },
});