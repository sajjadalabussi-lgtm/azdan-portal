"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

type Client = {
  id: number;
  name: string;
  project_name: string;
  progress: number | null;
  status: string | null;
  created_at?: string | null;
};

type ActivityItem = {
  id: number;
  action: string | null;
  description: string | null;
  created_at: string | null;
};

type DashboardStats = {
  clients: number;
  activeProjects: number;
  completedProjects: number;
  pendingPayments: number;
  totalRevenue: number;
  appointments: number;
};

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type DashboardButton = {
  title: string;
  subtitle: string;
  icon: IconName;
  route: string;
  tint: string;
};

const COLORS = {
  background: "#07130F",
  surface: "#0D211A",
  card: "#102A21",
  cardSoft: "#14362A",
  primary: "#22C55E",
  primaryDark: "#15803D",
  primarySoft: "#B7F7CA",
  text: "#F4FFF7",
  textMuted: "#8FAD9B",
  border: "#1F4435",
  warning: "#F59E0B",
  danger: "#F87171",
  cyan: "#2DD4BF",
  blue: "#60A5FA",
  purple: "#A78BFA",
};

const DASHBOARD_BUTTONS: DashboardButton[] = [
  { title: "العملاء والمشاريع", subtitle: "إضافة وتعديل ومتابعة العملاء", icon: "people-outline", route: "/admin/clients", tint: COLORS.primary },
  { title: "البحث الشامل", subtitle: "البحث داخل جميع بيانات النظام", icon: "search-outline", route: "/admin/search", tint: COLORS.cyan },
  { title: "التقويم والمواعيد", subtitle: "التسليم والدفعات وزيارات الموقع", icon: "calendar-outline", route: "/admin/calendar", tint: COLORS.blue },
  { title: "المستخدمون والصلاحيات", subtitle: "إدارة المدراء والموظفين", icon: "shield-checkmark-outline", route: "/admin/users", tint: COLORS.purple },
  { title: "التقارير", subtitle: "تقارير المشاريع والإيرادات", icon: "bar-chart-outline", route: "/admin/reports", tint: COLORS.warning },
  { title: "سجل النشاط", subtitle: "مراجعة العمليات داخل النظام", icon: "pulse-outline", route: "/admin/activity", tint: "#34D399" },
  { title: "تصدير البيانات", subtitle: "تصدير CSV وJSON", icon: "cloud-download-outline", route: "/admin/export", tint: "#38BDF8" },
  { title: "النسخ الاحتياطي", subtitle: "حفظ واستعادة بيانات النظام", icon: "server-outline", route: "/admin/backup", tint: "#FB7185" },
  { title: "الإعدادات والأمان", subtitle: "الحساب وكلمة المرور وتسجيل الخروج", icon: "settings-outline", route: "/admin/settings", tint: "#CBD5E1" },
];

function formatCurrency(value: number) {
  try {
    return new Intl.NumberFormat("ar-IQ").format(value);
  } catch {
    return String(value);
  }
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("ar-IQ", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function normalizeStatus(status?: string | null) {
  return (status || "").trim().toLowerCase();
}

function getStatusInfo(status?: string | null, progress = 0) {
  const value = normalizeStatus(status);
  if (progress >= 100 || value.includes("complete") || value.includes("done") || value.includes("مكتمل")) {
    return { label: "مكتمل", color: COLORS.primary, background: "rgba(34,197,94,0.14)" };
  }
  if (value.includes("hold") || value.includes("متوقف")) {
    return { label: status || "متوقف", color: COLORS.warning, background: "rgba(245,158,11,0.14)" };
  }
  return { label: status || "قيد التنفيذ", color: COLORS.cyan, background: "rgba(45,212,191,0.14)" };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("المدير");
  const [stats, setStats] = useState<DashboardStats>({ clients: 0, activeProjects: 0, completedProjects: 0, pendingPayments: 0, totalRevenue: 0, appointments: 0 });
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setError("");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const [profileResult, clientsResult, paymentsResult, eventsResult, activityResult] = await Promise.all([
        supabase.from("admin_profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("clients").select("id, name, project_name, progress, status, created_at").order("created_at", { ascending: false }).limit(1000),
        supabase.from("project_payments").select("*").limit(5000),
        supabase.from("project_events").select("id").gte("event_date", new Date().toISOString()).limit(5000),
        supabase.from("activity_logs").select("id, action, description, created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      if (profileResult.data?.full_name) setAdminName(profileResult.data.full_name);
      else if (user.email) setAdminName(user.email.split("@")[0]);

      if (clientsResult.error) throw clientsResult.error;
      const clients = (clientsResult.data ?? []) as Client[];

      const activeProjects = clients.filter((client) => {
        const status = normalizeStatus(client.status);
        return status.includes("active") || status.includes("progress") || status.includes("قيد") || status.includes("مستمر");
      }).length;

      const completedProjects = clients.filter((client) => {
        const status = normalizeStatus(client.status);
        return status.includes("complete") || status.includes("done") || status.includes("مكتمل") || Number(client.progress ?? 0) >= 100;
      }).length;

      let pendingPayments = 0;
      let totalRevenue = 0;
      if (!paymentsResult.error) {
        const payments = (paymentsResult.data ?? []) as Record<string, any>[];
        for (const payment of payments) {
          const amount = Number(payment.amount ?? payment.paid_amount ?? payment.value ?? payment.total ?? 0);
          const status = String(payment.status ?? payment.payment_status ?? "").toLowerCase();
          const isPaid = status.includes("paid") || status.includes("مكتمل") || status.includes("مدفوع") || payment.is_paid === true;
          if (isPaid) totalRevenue += Number.isFinite(amount) ? amount : 0;
          else pendingPayments += 1;
        }
      }

      setStats({
        clients: clients.length,
        activeProjects,
        completedProjects,
        pendingPayments,
        totalRevenue,
        appointments: eventsResult.error ? 0 : (eventsResult.data ?? []).length,
      });
      setRecentClients(clients.slice(0, 5));
      setRecentActivity(activityResult.error ? [] : ((activityResult.data ?? []) as ActivityItem[]));
    } catch (err: any) {
      setError(err?.message || "تعذر تحميل لوحة التحكم.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  function confirmLogout() {
    Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج من لوحة الإدارة؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "تسجيل الخروج", style: "destructive", onPress: async () => { await supabase.auth.signOut(); router.replace("/admin/login"); } },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, styles.safeArea]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <View style={styles.loadingLogoBox}>
          <Image source={require("../../assets/images/azdan-logo-white.png")} style={styles.loadingLogo} resizeMode="contain" />
        </View>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>جاري تجهيز لوحة التحكم...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, styles.safeArea]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerAction} onPress={confirmLogout} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={21} color={COLORS.danger} />
        </TouchableOpacity>

        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>لوحة الإدارة</Text>
          <Text style={styles.welcomeText} numberOfLines={1}>هلا، {adminName}</Text>
        </View>

        <View style={styles.logoFrame}>
          <Image source={require("../../assets/images/azdan-logo-white.png")} style={styles.logo} resizeMode="contain" />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.heroTopRow}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>النظام متصل</Text>
            </View>
            <Ionicons name="business-outline" size={27} color={COLORS.primarySoft} />
          </View>
          <Text style={styles.heroTitle}>كل مشروع واضح، من البداية حتى التسليم.</Text>
          <Text style={styles.heroText}>تابع العملاء والمواعيد والدفعات وآخر نشاطات فريق أزدان من مكان واحد.</Text>
          <TouchableOpacity style={styles.heroButton} activeOpacity={0.85} onPress={() => router.push("/admin/clients" as any)}>
            <Ionicons name="add" size={20} color={COLORS.background} />
            <Text style={styles.heroButtonText}>إضافة عميل جديد</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHint}>ملخص اليوم</Text>
          <Text style={styles.sectionTitle}>نظرة سريعة</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard icon="people-outline" value={stats.clients} label="العملاء" tint={COLORS.primary} />
          <StatCard icon="construct-outline" value={stats.activeProjects} label="مشاريع فعالة" tint={COLORS.cyan} />
          <StatCard icon="checkmark-done-outline" value={stats.completedProjects} label="مشاريع مكتملة" tint={COLORS.blue} />
          <StatCard icon="calendar-clear-outline" value={stats.appointments} label="مواعيد قادمة" tint={COLORS.warning} />
        </View>

        <View style={styles.financeCard}>
          <View style={styles.financeBlock}>
            <View style={[styles.smallIconBox, { backgroundColor: "rgba(34,197,94,0.14)" }]}>
              <Ionicons name="wallet-outline" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.financeLabel}>الإيرادات المسجلة</Text>
            <Text style={styles.financeValue}>{formatCurrency(stats.totalRevenue)}</Text>
            <Text style={styles.financeUnit}>دينار عراقي</Text>
          </View>
          <View style={styles.financeDivider} />
          <View style={styles.financeBlock}>
            <View style={[styles.smallIconBox, { backgroundColor: "rgba(245,158,11,0.14)" }]}>
              <Ionicons name="time-outline" size={20} color={COLORS.warning} />
            </View>
            <Text style={styles.financeLabel}>دفعات معلقة</Text>
            <Text style={styles.financeValue}>{stats.pendingPayments}</Text>
            <Text style={styles.financeUnit}>دفعة</Text>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHint}>وصول سريع</Text>
          <Text style={styles.sectionTitle}>أقسام الإدارة</Text>
        </View>

        <View style={styles.buttonsGrid}>
          {DASHBOARD_BUTTONS.map((button) => (
            <TouchableOpacity key={button.route} style={styles.menuCard} onPress={() => router.push(button.route as any)} activeOpacity={0.8}>
              <View style={[styles.menuIconBox, { backgroundColor: `${button.tint}1F` }]}>
                <Ionicons name={button.icon} size={25} color={button.tint} />
              </View>
              <Text style={styles.menuTitle}>{button.title}</Text>
              <Text style={styles.menuSubtitle}>{button.subtitle}</Text>
              <View style={styles.openRow}>
                <View style={styles.arrowCircle}><Ionicons name="chevron-back" size={15} color={COLORS.primarySoft} /></View>
                <Text style={styles.openText}>فتح القسم</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeaderRowLarge}>
          <TouchableOpacity onPress={() => router.push("/admin/clients" as any)}><Text style={styles.moreText}>عرض الكل</Text></TouchableOpacity>
          <View><Text style={styles.sectionTitle}>أحدث العملاء</Text><Text style={styles.sectionHintRight}>آخر المشاريع المضافة</Text></View>
        </View>

        {recentClients.length === 0 ? <EmptyState icon="people-outline" text="لا يوجد عملاء مسجلون حالياً." /> : recentClients.map((client) => {
          const progress = Math.max(0, Math.min(100, Number(client.progress ?? 0)));
          const status = getStatusInfo(client.status, progress);
          return (
            <TouchableOpacity key={client.id} style={styles.clientCard} onPress={() => router.push(`/admin/clients/${client.id}` as any)} activeOpacity={0.82}>
              <View style={styles.clientTopRow}>
                <View style={[styles.statusBadge, { backgroundColor: status.background }]}><Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text></View>
                <View style={styles.clientIdentity}>
                  <Text style={styles.clientName}>{client.name}</Text>
                  <Text style={styles.projectName}>{client.project_name || "بدون اسم مشروع"}</Text>
                </View>
                <View style={styles.clientAvatar}><Text style={styles.clientAvatarText}>{(client.name || "أ").trim().charAt(0)}</Text></View>
              </View>
              <View style={styles.progressHeader}><Text style={styles.progressPercent}>{progress}%</Text><Text style={styles.progressLabel}>نسبة الإنجاز</Text></View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
            </TouchableOpacity>
          );
        })}

        <View style={styles.sectionHeaderRowLarge}>
          <TouchableOpacity onPress={() => router.push("/admin/activity" as any)}><Text style={styles.moreText}>عرض الكل</Text></TouchableOpacity>
          <View><Text style={styles.sectionTitle}>آخر النشاطات</Text><Text style={styles.sectionHintRight}>ما حدث داخل النظام</Text></View>
        </View>

        {recentActivity.length === 0 ? <EmptyState icon="pulse-outline" text="لا توجد نشاطات حديثة." /> : (
          <View style={styles.timelineCard}>
            {recentActivity.map((item, index) => (
              <View key={item.id} style={styles.activityRow}>
                <View style={styles.timelineRail}>
                  <View style={styles.activityDot} />
                  {index < recentActivity.length - 1 ? <View style={styles.timelineLine} /> : null}
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>{item.action || "نشاط إداري"}</Text>
                  <Text style={styles.activityDescription}>{item.description || "تم تنفيذ عملية داخل النظام"}</Text>
                  <Text style={styles.activityDate}>{formatDate(item.created_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.logoutBottomButton} onPress={confirmLogout} activeOpacity={0.82}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutBottomText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, value, label, tint }: { icon: IconName; value: number; label: string; tint: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: `${tint}1F` }]}><Ionicons name={icon} size={23} color={tint} /></View>
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={25} color={COLORS.textMuted} /></View>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  safeArea: { paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0 },
  center: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  loadingLogoBox: { width: 92, height: 92, borderRadius: 30, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  loadingLogo: { width: 62, height: 62 },
  loadingText: { color: COLORS.textMuted, marginTop: 14, fontSize: 12 },
  header: { minHeight: 78, backgroundColor: COLORS.background, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(31,68,53,0.55)" },
  headerAction: { width: 44, height: 44, borderRadius: 15, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  headerCopy: { flex: 1, alignItems: "flex-end", paddingHorizontal: 13 },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  welcomeText: { color: COLORS.text, fontSize: 18, fontWeight: "900", marginTop: 4, maxWidth: "100%" },
  logoFrame: { width: 54, height: 54, borderRadius: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  logo: { width: 38, height: 38 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 54 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(248,113,113,0.12)", borderColor: "rgba(248,113,113,0.32)", borderWidth: 1, borderRadius: 17, padding: 14, marginBottom: 14 },
  errorText: { flex: 1, color: "#FCA5A5", textAlign: "right", fontSize: 11, lineHeight: 18 },
  heroCard: { minHeight: 205, borderRadius: 30, backgroundColor: COLORS.primaryDark, padding: 19, overflow: "hidden", borderWidth: 1, borderColor: "rgba(183,247,202,0.18)" },
  heroGlowOne: { position: "absolute", width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(183,247,202,0.10)", top: -85, left: -55 },
  heroGlowTwo: { position: "absolute", width: 145, height: 145, borderRadius: 73, backgroundColor: "rgba(6,78,59,0.28)", right: -45, bottom: -55 },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(7,19,15,0.28)" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primarySoft },
  liveText: { color: COLORS.primarySoft, fontSize: 9, fontWeight: "800" },
  heroTitle: { color: "#FFFFFF", fontSize: 21, lineHeight: 31, fontWeight: "900", textAlign: "right", marginTop: 18 },
  heroText: { color: "rgba(244,255,247,0.76)", fontSize: 11, lineHeight: 20, textAlign: "right", marginTop: 8 },
  heroButton: { alignSelf: "flex-end", minHeight: 45, borderRadius: 15, backgroundColor: COLORS.primarySoft, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 15, marginTop: 16 },
  heroButtonText: { color: COLORS.background, fontSize: 11, fontWeight: "900" },
  sectionHeaderRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 26, marginBottom: 12 },
  sectionHeaderRowLarge: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 12 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900", textAlign: "right" },
  sectionHint: { color: COLORS.textMuted, fontSize: 9 },
  sectionHintRight: { color: COLORS.textMuted, fontSize: 9, textAlign: "right", marginTop: 4 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47%", minHeight: 118, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, padding: 15, alignItems: "flex-end", justifyContent: "space-between" },
  statIconBox: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  statNumber: { color: COLORS.text, fontSize: 26, fontWeight: "900", marginTop: 12 },
  statLabel: { color: COLORS.textMuted, fontSize: 10, marginTop: 4 },
  financeCard: { flexDirection: "row", minHeight: 160, borderRadius: 24, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginTop: 10, paddingVertical: 18 },
  financeBlock: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  financeDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 5 },
  smallIconBox: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 9 },
  financeLabel: { color: COLORS.textMuted, fontSize: 9, textAlign: "center" },
  financeValue: { color: COLORS.text, fontSize: 21, fontWeight: "900", marginTop: 6, textAlign: "center" },
  financeUnit: { color: COLORS.primary, fontSize: 8, marginTop: 3 },
  buttonsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  menuCard: { width: "47%", minHeight: 172, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, padding: 15, alignItems: "flex-end" },
  menuIconBox: { width: 49, height: 49, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  menuTitle: { color: COLORS.text, fontSize: 12, fontWeight: "900", textAlign: "right", marginTop: 13 },
  menuSubtitle: { color: COLORS.textMuted, fontSize: 8.5, lineHeight: 15, textAlign: "right", marginTop: 6, minHeight: 31 },
  openRow: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 10 },
  arrowCircle: { width: 29, height: 29, borderRadius: 10, backgroundColor: COLORS.cardSoft, alignItems: "center", justifyContent: "center" },
  openText: { color: COLORS.primarySoft, fontSize: 9, fontWeight: "900" },
  moreText: { color: COLORS.primary, fontSize: 10, fontWeight: "900" },
  clientCard: { borderRadius: 22, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, padding: 15, marginBottom: 10 },
  clientTopRow: { flexDirection: "row", alignItems: "center" },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontSize: 8, fontWeight: "900" },
  clientIdentity: { flex: 1, alignItems: "flex-end", paddingHorizontal: 11 },
  clientName: { color: COLORS.text, fontSize: 13, fontWeight: "900", textAlign: "right" },
  projectName: { color: COLORS.textMuted, fontSize: 9, marginTop: 5, textAlign: "right" },
  clientAvatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: COLORS.cardSoft, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  clientAvatarText: { color: COLORS.primarySoft, fontSize: 17, fontWeight: "900" },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 7 },
  progressLabel: { color: COLORS.textMuted, fontSize: 8 },
  progressPercent: { color: COLORS.primary, fontSize: 9, fontWeight: "900" },
  progressTrack: { height: 7, borderRadius: 999, backgroundColor: COLORS.surface, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: COLORS.primary },
  emptyCard: { minHeight: 115, borderRadius: 22, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", padding: 16 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  emptyText: { color: COLORS.textMuted, fontSize: 10, textAlign: "center" },
  timelineCard: { borderRadius: 22, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 15, paddingVertical: 17 },
  activityRow: { flexDirection: "row", alignItems: "stretch" },
  timelineRail: { width: 28, alignItems: "center" },
  activityDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: COLORS.primary, borderWidth: 3, borderColor: COLORS.cardSoft, marginTop: 4, zIndex: 2 },
  timelineLine: { width: 1, flex: 1, minHeight: 55, backgroundColor: COLORS.border, marginTop: -1 },
  activityInfo: { flex: 1, alignItems: "flex-end", paddingLeft: 8, paddingBottom: 18 },
  activityTitle: { color: COLORS.text, fontSize: 11, fontWeight: "900", textAlign: "right" },
  activityDescription: { color: COLORS.textMuted, fontSize: 9, lineHeight: 16, marginTop: 4, textAlign: "right" },
  activityDate: { color: "#5F8270", fontSize: 8, marginTop: 5 },
  logoutBottomButton: { minHeight: 52, borderRadius: 17, backgroundColor: "rgba(248,113,113,0.09)", borderWidth: 1, borderColor: "rgba(248,113,113,0.20)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 26 },
  logoutBottomText: { color: COLORS.danger, fontSize: 11, fontWeight: "900" },
});
