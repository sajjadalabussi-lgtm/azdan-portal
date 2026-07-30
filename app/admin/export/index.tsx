"use client";

import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";

type ExportTable = {
  key: string;
  title: string;
  description: string;
  icon: string;
  table: string;
};

const EXPORT_TABLES: ExportTable[] = [
  {
    key: "clients",
    title: "العملاء والمشاريع",
    description: "بيانات العملاء ونسب الإنجاز والحالات",
    icon: "👥",
    table: "clients",
  },
  {
    key: "payments",
    title: "الدفعات",
    description: "جميع دفعات المشاريع المسجلة",
    icon: "💰",
    table: "project_payments",
  },
  {
    key: "updates",
    title: "تحديثات المشاريع",
    description: "سجل التحديثات المضافة للمشاريع",
    icon: "📝",
    table: "project_updates",
  },
  {
    key: "files",
    title: "ملفات المشاريع",
    description: "بيانات الملفات والروابط",
    icon: "📁",
    table: "project_files",
  },
  {
    key: "activity",
    title: "سجل النشاط",
    description: "العمليات التي نفذها فريق الإدارة",
    icon: "⚡",
    table: "activity_logs",
  },
];

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

  const header = columns.map(escapeCsv).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsv(row[column])).join(",")
  );

  return "\uFEFF" + [header, ...body].join("\n");
}

export default function AdminExportPage() {
  const router = useRouter();
  const [workingKey, setWorkingKey] = useState<string | null>(null);

  async function exportTable(item: ExportTable, format: "csv" | "json") {
    try {
      setWorkingKey(`${item.key}-${format}`);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const { data, error } = await supabase
        .from(item.table)
        .select("*")
        .limit(5000);

      if (error) throw error;

      const rows = (data ?? []) as Record<string, unknown>[];
      if (!rows.length) {
        Alert.alert("لا توجد بيانات", `جدول ${item.title} فارغ.`);
        return;
      }

      const content =
        format === "csv"
          ? rowsToCsv(rows)
          : JSON.stringify(rows, null, 2);

      await Share.share({
        title: `${item.title}.${format}`,
        message: content,
      });
    } catch (err: any) {
      Alert.alert("خطأ بالتصدير", err?.message || "تعذر تصدير البيانات.");
    } finally {
      setWorkingKey(null);
    }
  }

  async function exportCompleteReport() {
    try {
      setWorkingKey("complete");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const results = await Promise.all(
        EXPORT_TABLES.map(async (item) => {
          const { data, error } = await supabase
            .from(item.table)
            .select("*")
            .limit(5000);

          return {
            key: item.key,
            data: error ? [] : data ?? [],
            error: error?.message || null,
          };
        })
      );

      const report = {
        exported_at: new Date().toISOString(),
        app: "Azdan Admin",
        tables: Object.fromEntries(
          results.map((result) => [result.key, result.data])
        ),
        warnings: results
          .filter((result) => result.error)
          .map((result) => ({
            table: result.key,
            error: result.error,
          })),
      };

      await Share.share({
        title: "azdan-complete-export.json",
        message: JSON.stringify(report, null, 2),
      });
    } catch (err: any) {
      Alert.alert("خطأ", err?.message || "تعذر إنشاء التقرير الشامل.");
    } finally {
      setWorkingKey(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.title}>تصدير البيانات</Text>
          <Text style={styles.subtitle}>CSV وJSON بدون مكتبات إضافية</Text>
        </View>

        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>📤</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.completeButton}
          onPress={exportCompleteReport}
          disabled={workingKey !== null}
        >
          {workingKey === "complete" ? (
            <ActivityIndicator color="#08111f" />
          ) : (
            <>
              <Text style={styles.completeIcon}>📦</Text>
              <View style={styles.completeInfo}>
                <Text style={styles.completeTitle}>تصدير شامل للنظام</Text>
                <Text style={styles.completeText}>
                  يجمع الجداول الرئيسية في ملف JSON واحد
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>تصدير حسب القسم</Text>

        {EXPORT_TABLES.map((item) => (
          <View key={item.key} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.iconBox}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>

              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>
                  {item.description}
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => exportTable(item, "json")}
                disabled={workingKey !== null}
              >
                {workingKey === `${item.key}-json` ? (
                  <ActivityIndicator size="small" color="#d4a94e" />
                ) : (
                  <Text style={styles.secondaryButtonText}>JSON</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => exportTable(item, "csv")}
                disabled={workingKey !== null}
              >
                {workingKey === `${item.key}-csv` ? (
                  <ActivityIndicator size="small" color="#08111f" />
                ) : (
                  <Text style={styles.primaryButtonText}>CSV</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>ملاحظة</Text>
          <Text style={styles.noteText}>
            على الهاتف ستظهر نافذة المشاركة، ويمكنك حفظ النص في تطبيق
            الملفات أو إرساله. هذه الصفحة لا تحتاج تثبيت أي مكتبة إضافية.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#08111f" },
  header: {
    minHeight: 82,
    backgroundColor: "#0d1a2c",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#172840",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: "#fff", fontSize: 30, marginTop: -4 },
  headerText: { flex: 1, alignItems: "flex-end", paddingHorizontal: 12 },
  title: { color: "#fff", fontSize: 19, fontWeight: "900" },
  subtitle: { color: "#8291a6", fontSize: 10, marginTop: 4 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconText: { fontSize: 20 },
  content: { padding: 16, paddingBottom: 45 },
  completeButton: {
    minHeight: 91,
    borderRadius: 19,
    backgroundColor: "#d4a94e",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  completeIcon: { fontSize: 30 },
  completeInfo: { flex: 1, alignItems: "flex-end", paddingLeft: 14 },
  completeTitle: { color: "#08111f", fontSize: 16, fontWeight: "900" },
  completeText: {
    color: "#4d3c16",
    fontSize: 10,
    marginTop: 6,
    textAlign: "right",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 22,
    marginBottom: 11,
  },
  card: {
    backgroundColor: "#111f33",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#263852",
    padding: 14,
    marginBottom: 11,
  },
  cardTop: { flexDirection: "row", alignItems: "center" },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#20334e",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 22 },
  cardInfo: { flex: 1, alignItems: "flex-end", paddingLeft: 12 },
  cardTitle: { color: "#fff", fontSize: 14, fontWeight: "900" },
  cardDescription: {
    color: "#8e9db2",
    fontSize: 9,
    marginTop: 5,
    textAlign: "right",
  },
  actions: { flexDirection: "row", gap: 9, marginTop: 14 },
  primaryButton: {
    flex: 1,
    minHeight: 43,
    borderRadius: 12,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#08111f", fontWeight: "900" },
  secondaryButton: {
    flex: 1,
    minHeight: 43,
    borderRadius: 12,
    backgroundColor: "#172840",
    borderWidth: 1,
    borderColor: "#30425e",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: "#d4a94e", fontWeight: "900" },
  noteBox: {
    backgroundColor: "#17243a",
    borderRadius: 16,
    padding: 14,
    marginTop: 9,
  },
  noteTitle: {
    color: "#d4a94e",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
  },
  noteText: {
    color: "#99a7ba",
    fontSize: 10,
    lineHeight: 18,
    textAlign: "right",
    marginTop: 6,
  },
});
