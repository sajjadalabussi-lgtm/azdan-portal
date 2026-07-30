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
import { supabase } from "../../../lib/supabase";

type Client = {
  id: number;
  name: string;
  project_name: string;
  progress: number | null;
  status: string | null;
};

type Payment = {
  id: number;
  client_id: number;
  amount: number | string | null;
  payment_date: string | null;
  created_at: string | null;
};

type Update = {
  id: number;
  client_id: number;
};

type Notification = {
  id: number;
  client_id: number;
  is_read: boolean | null;
};

function money(value: number) {
  return `${Math.round(value || 0).toLocaleString("ar-IQ")} د.ع`;
}

function progress(value: number | null) {
  return Math.min(100, Math.max(0, Number(value || 0)));
}

export default function AdminReportsPage() {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [imageCounts, setImageCounts] = useState<Record<number, number>>({});
  const [fileCounts, setFileCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");

  const load = useCallback(async () => {
    try {
      setErrorText("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/admin/login");
        return;
      }

      const [c, p, u, n, i, f] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, project_name, progress, status")
          .order("id", { ascending: false }),

        supabase
          .from("project_payments")
          .select("id, client_id, amount, payment_date, created_at")
          .order("created_at", { ascending: false }),

        supabase
          .from("project_updates")
          .select("id, client_id"),

        supabase
          .from("project_notifications")
          .select("id, client_id, is_read"),

        supabase.from("project_images").select("client_id"),
        supabase.from("project_files").select("client_id"),
      ]);

      if (c.error) throw c.error;
      if (p.error) throw p.error;
      if (u.error) throw u.error;
      if (n.error) throw n.error;

      setClients((c.data ?? []) as Client[]);
      setPayments((p.data ?? []) as Payment[]);
      setUpdates((u.data ?? []) as Update[]);
      setNotifications((n.data ?? []) as Notification[]);

      const images: Record<number, number> = {};
      const files: Record<number, number> = {};

      for (const row of i.data ?? []) {
        const id = Number((row as any).client_id);
        images[id] = (images[id] || 0) + 1;
      }

      for (const row of f.data ?? []) {
        const id = Number((row as any).client_id);
        files[id] = (files[id] || 0) + 1;
      }

      setImageCounts(images);
      setFileCounts(files);
    } catch (error: any) {
      setErrorText(error?.message || "تعذر تحميل التقارير");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const completed = clients.filter((item) =>
      (item.status || "").includes("مكتمل")
    ).length;

    const paused = clients.filter((item) =>
      (item.status || "").includes("متوقف")
    ).length;

    const review = clients.filter((item) =>
      (item.status || "").includes("مراجعة")
    ).length;

    const active = Math.max(0, clients.length - completed);

    const averageProgress =
      clients.length === 0
        ? 0
        : Math.round(
            clients.reduce(
              (sum, item) => sum + progress(item.progress),
              0
            ) / clients.length
          );

    const totalPayments = payments.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const images = Object.values(imageCounts).reduce(
      (sum, value) => sum + value,
      0
    );

    const files = Object.values(fileCounts).reduce(
      (sum, value) => sum + value,
      0
    );

    const statuses = [
      {
        label: "قيد التنفيذ",
        value: Math.max(0, active - paused - review),
      },
      { label: "قيد المراجعة", value: review },
      { label: "متوقف", value: paused },
      { label: "مكتمل", value: completed },
    ];

    const ranges = [
      {
        label: "0% - 24%",
        value: clients.filter((c) => progress(c.progress) < 25).length,
      },
      {
        label: "25% - 49%",
        value: clients.filter((c) => {
          const value = progress(c.progress);
          return value >= 25 && value < 50;
        }).length,
      },
      {
        label: "50% - 74%",
        value: clients.filter((c) => {
          const value = progress(c.progress);
          return value >= 50 && value < 75;
        }).length,
      },
      {
        label: "75% - 99%",
        value: clients.filter((c) => {
          const value = progress(c.progress);
          return value >= 75 && value < 100;
        }).length,
      },
      {
        label: "100%",
        value: clients.filter((c) => progress(c.progress) === 100).length,
      },
    ];

    const activity = clients
      .map((client) => ({
        ...client,
        count:
          (imageCounts[client.id] || 0) +
          (fileCounts[client.id] || 0) +
          updates.filter((item) => item.client_id === client.id).length +
          payments.filter((item) => item.client_id === client.id).length +
          notifications.filter((item) => item.client_id === client.id)
            .length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      completed,
      active,
      averageProgress,
      totalPayments,
      images,
      files,
      unread: notifications.filter((item) => !item.is_read).length,
      statuses,
      ranges,
      activity,
    };
  }, [clients, fileCounts, imageCounts, notifications, payments, updates]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>جاري إعداد التقارير...</Text>
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
              load();
            }}
            tintColor="#d4a94e"
            colors={["#d4a94e"]}
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.title}>التقارير والإحصائيات</Text>
            <Text style={styles.subtitle}>تحليل أداء مشاريع أزدان</Text>
          </View>

          <TouchableOpacity style={styles.goldButton} onPress={load}>
            <Text style={styles.refreshText}>↻</Text>
          </TouchableOpacity>
        </View>

        {errorText ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorText}</Text>
          </View>
        ) : null}

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>إجمالي الدفعات المسجلة</Text>
          <Text style={styles.heroValue}>{money(stats.totalPayments)}</Text>

          <View style={styles.heroRow}>
            <Small value={String(payments.length)} label="عدد الدفعات" />
            <Small value={`${stats.averageProgress}%`} label="متوسط الإنجاز" />
            <Small value={String(clients.length)} label="عدد العملاء" />
          </View>
        </View>

        <View style={styles.grid}>
          <Metric icon="🏗️" value={String(stats.active)} label="مشاريع نشطة" />
          <Metric icon="✅" value={String(stats.completed)} label="مشاريع مكتملة" />
          <Metric icon="📷" value={String(stats.images)} label="الصور" />
          <Metric icon="📁" value={String(stats.files)} label="الملفات" />
          <Metric icon="📝" value={String(updates.length)} label="التحديثات" />
          <Metric icon="🔔" value={String(stats.unread)} label="غير المقروءة" />
        </View>

        <Section title="حالات المشاريع" icon="📊">
          {stats.statuses.map((item) => (
            <Bar
              key={item.label}
              label={item.label}
              value={item.value}
              max={Math.max(1, ...stats.statuses.map((x) => x.value))}
            />
          ))}
        </Section>

        <Section title="توزيع نسب الإنجاز" icon="📈">
          {stats.ranges.map((item) => (
            <Bar
              key={item.label}
              label={item.label}
              value={item.value}
              max={Math.max(1, ...stats.ranges.map((x) => x.value))}
            />
          ))}
        </Section>

        <Section title="أكثر المشاريع نشاطًا" icon="⚡">
          {stats.activity.length === 0 ? (
            <Text style={styles.emptyText}>لا توجد بيانات نشاط.</Text>
          ) : (
            stats.activity.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={styles.activityRow}
                onPress={() =>
                  router.push(`/admin/client/${item.id}` as never)
                }
              >
                <View style={styles.rank}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>

                <View style={styles.activityInfo}>
                  <Text style={styles.activityName}>{item.name}</Text>
                  <Text style={styles.activityProject}>{item.project_name}</Text>
                </View>

                <View style={styles.activityValue}>
                  <Text style={styles.activityNumber}>{item.count}</Text>
                  <Text style={styles.activityLabel}>نشاط</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </Section>

        <Text style={styles.footer}>
          التقرير يعتمد على البيانات الحالية في Supabase
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricIcon}>
        <Text style={styles.metricEmoji}>{icon}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Small({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.small}>
      <Text style={styles.smallValue}>{value}</Text>
      <Text style={styles.smallLabel}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionIcon}>{icon}</Text>
      </View>
      {children}
    </View>
  );
}

function Bar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const width = value === 0 ? 0 : Math.max(8, (value / max) * 100);

  return (
    <View style={styles.barRow}>
      <View style={styles.barHeader}>
        <Text style={styles.barValue}>{value}</Text>
        <Text style={styles.barLabel}>{label}</Text>
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${width}%` }]} />
      </View>
    </View>
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
  content: { paddingBottom: 45 },
  loadingText: { color: "#c7d1df", marginTop: 14 },
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
  iconButton: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#13233a",
    borderWidth: 1,
    borderColor: "#34445d",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: "#fff", fontSize: 34, lineHeight: 37 },
  headerInfo: { flex: 1, alignItems: "flex-end", paddingHorizontal: 12 },
  title: { color: "#fff", fontSize: 21, fontWeight: "900" },
  subtitle: { color: "#9eacc1", fontSize: 11, marginTop: 4 },
  goldButton: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshText: { color: "#07101d", fontSize: 25, fontWeight: "900" },
  errorBox: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: "#3a1f28",
    borderRadius: 16,
    padding: 15,
  },
  errorText: { color: "#ffd2d8", textAlign: "center" },
  hero: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: "#d4a94e",
    borderRadius: 22,
    padding: 20,
  },
  heroLabel: { color: "#27303d", textAlign: "right", fontWeight: "800" },
  heroValue: {
    color: "#07101d",
    textAlign: "right",
    fontSize: 29,
    fontWeight: "900",
    marginTop: 7,
  },
  heroRow: { flexDirection: "row-reverse", gap: 9, marginTop: 18 },
  small: {
    flex: 1,
    minHeight: 70,
    borderRadius: 14,
    backgroundColor: "rgba(7,16,29,0.12)",
    alignItems: "center",
    justifyContent: "center",
    padding: 7,
  },
  smallValue: { color: "#07101d", fontWeight: "900" },
  smallLabel: {
    color: "#27303d",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 5,
  },
  grid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
    padding: 16,
    paddingBottom: 0,
  },
  metric: {
    width: "48%",
    flexGrow: 1,
    minHeight: 130,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    padding: 13,
  },
  metricIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  metricEmoji: { fontSize: 21 },
  metricValue: {
    color: "#fff",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 10,
  },
  metricLabel: { color: "#9eacc1", fontSize: 10, marginTop: 5 },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    borderRadius: 21,
    padding: 17,
  },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { color: "#fff", fontSize: 17, fontWeight: "900" },
  sectionIcon: { fontSize: 22, marginLeft: 9 },
  barRow: { marginBottom: 15 },
  barHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  barValue: { color: "#d4a94e", fontWeight: "900" },
  barLabel: { color: "#d9e1ec", fontSize: 12, fontWeight: "700" },
  barTrack: {
    height: 10,
    borderRadius: 10,
    backgroundColor: "#0b1728",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 10,
    backgroundColor: "#d4a94e",
  },
  activityRow: {
    minHeight: 72,
    borderRadius: 15,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    marginBottom: 10,
  },
  rank: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: "#07101d", fontWeight: "900" },
  activityInfo: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 11,
  },
  activityName: { color: "#fff", fontWeight: "900" },
  activityProject: { color: "#9eacc1", fontSize: 11, marginTop: 5 },
  activityValue: { minWidth: 55, alignItems: "center" },
  activityNumber: { color: "#d4a94e", fontSize: 18, fontWeight: "900" },
  activityLabel: { color: "#8192aa", fontSize: 9, marginTop: 3 },
  emptyText: { color: "#8192aa", textAlign: "center", paddingVertical: 20 },
  footer: {
    color: "#6f7f95",
    fontSize: 11,
    textAlign: "center",
    marginTop: 22,
  },
});
