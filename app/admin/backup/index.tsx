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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";

const BACKUP_TABLES = [
  "clients",
  "project_images",
  "project_updates",
  "project_tasks",
  "project_notifications",
  "project_payments",
  "project_finances",
  "project_files",
  "project_events",
  "activity_logs",
];

type BackupPayload = {
  version: number;
  app: string;
  created_at: string;
  tables: Record<string, unknown[]>;
  warnings?: { table: string; error: string }[];
};

export default function AdminBackupPage() {
  const router = useRouter();

  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreText, setRestoreText] = useState("");
  const [showRestore, setShowRestore] = useState(false);

  async function requireUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/admin/login");
      return false;
    }

    return true;
  }

  async function createBackup() {
    try {
      setCreating(true);

      if (!(await requireUser())) return;

      const results = await Promise.all(
        BACKUP_TABLES.map(async (table) => {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .limit(10000);

          return {
            table,
            rows: error ? [] : data ?? [],
            error: error?.message || null,
          };
        })
      );

      const payload: BackupPayload = {
        version: 1,
        app: "Azdan Admin",
        created_at: new Date().toISOString(),
        tables: Object.fromEntries(
          results.map((result) => [result.table, result.rows])
        ),
        warnings: results
          .filter((result) => result.error)
          .map((result) => ({
            table: result.table,
            error: result.error as string,
          })),
      };

      await Share.share({
        title: `azdan-backup-${Date.now()}.json`,
        message: JSON.stringify(payload, null, 2),
      });
    } catch (err: any) {
      Alert.alert("خطأ", err?.message || "تعذر إنشاء النسخة الاحتياطية.");
    } finally {
      setCreating(false);
    }
  }

  function validateBackup(value: unknown): value is BackupPayload {
    if (!value || typeof value !== "object") return false;

    const payload = value as BackupPayload;
    return (
      payload.app === "Azdan Admin" &&
      typeof payload.version === "number" &&
      !!payload.tables &&
      typeof payload.tables === "object"
    );
  }

  async function restoreBackup() {
    if (!restoreText.trim()) {
      Alert.alert("تنبيه", "الصق محتوى ملف النسخة الاحتياطية أولًا.");
      return;
    }

    let payload: BackupPayload;

    try {
      const parsed = JSON.parse(restoreText);
      if (!validateBackup(parsed)) {
        Alert.alert("ملف غير صالح", "هذا الملف ليس نسخة أزدان صحيحة.");
        return;
      }
      payload = parsed;
    } catch {
      Alert.alert("JSON غير صالح", "تحقق من نسخ الملف بالكامل.");
      return;
    }

    Alert.alert(
      "تأكيد الاستعادة",
      "سيتم إدخال وتحديث البيانات الموجودة في النسخة. هل تريد الاستمرار؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "استعادة",
          style: "destructive",
          onPress: async () => {
            try {
              setRestoring(true);

              if (!(await requireUser())) return;

              const order = [
                "clients",
                "project_images",
                "project_updates",
                "project_tasks",
                "project_notifications",
                "project_payments",
                "project_finances",
                "project_files",
                "project_events",
                "activity_logs",
              ];

              const errors: string[] = [];
              let restoredRows = 0;

              for (const table of order) {
                const rows = payload.tables[table];
                if (!Array.isArray(rows) || rows.length === 0) continue;

                const { error } = await supabase
                  .from(table)
                  .upsert(rows as any[], {
                    onConflict: "id",
                  });

                if (error) {
                  errors.push(`${table}: ${error.message}`);
                } else {
                  restoredRows += rows.length;
                }
              }

              if (errors.length) {
                Alert.alert(
                  "استعادة جزئية",
                  `تمت استعادة ${restoredRows} سجل.\n\nبعض الجداول فشلت:\n${errors
                    .slice(0, 4)
                    .join("\n")}`
                );
              } else {
                Alert.alert(
                  "تمت الاستعادة",
                  `تمت استعادة ${restoredRows} سجل بنجاح.`
                );
                setRestoreText("");
                setShowRestore(false);
              }
            } catch (err: any) {
              Alert.alert("خطأ", err?.message || "تعذرت الاستعادة.");
            } finally {
              setRestoring(false);
            }
          },
        },
      ]
    );
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
          <Text style={styles.title}>النسخ الاحتياطي</Text>
          <Text style={styles.subtitle}>حفظ واستعادة بيانات النظام</Text>
        </View>

        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>💾</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroIcon}>🛡️</Text>
          <Text style={styles.heroTitle}>حماية بيانات شركة أزدان</Text>
          <Text style={styles.heroText}>
            أنشئ نسخة JSON من الجداول الرئيسية واحتفظ بها في مكان آمن.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryCard}
          onPress={createBackup}
          disabled={creating || restoring}
        >
          {creating ? (
            <ActivityIndicator size="large" color="#08111f" />
          ) : (
            <>
              <View style={styles.primaryIconBox}>
                <Text style={styles.primaryIcon}>📤</Text>
              </View>
              <View style={styles.primaryInfo}>
                <Text style={styles.primaryTitle}>
                  إنشاء نسخة احتياطية الآن
                </Text>
                <Text style={styles.primaryText}>
                  تصدير العملاء والمشاريع والدفعات والملفات والنشاطات
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.restoreToggle}
          onPress={() => setShowRestore((current) => !current)}
        >
          <Text style={styles.restoreToggleIcon}>📥</Text>
          <View style={styles.restoreToggleInfo}>
            <Text style={styles.restoreToggleTitle}>
              استعادة نسخة احتياطية
            </Text>
            <Text style={styles.restoreToggleText}>
              الصق محتوى ملف JSON المحفوظ
            </Text>
          </View>
          <Text style={styles.chevron}>{showRestore ? "⌃" : "⌄"}</Text>
        </TouchableOpacity>

        {showRestore ? (
          <View style={styles.restoreBox}>
            <Text style={styles.label}>محتوى النسخة الاحتياطية</Text>
            <TextInput
              style={styles.textArea}
              value={restoreText}
              onChangeText={setRestoreText}
              multiline
              textAlignVertical="top"
              placeholder='الصق النص الذي يبدأ بـ {"version":1,...}'
              placeholderTextColor="#63738a"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={restoreBackup}
              disabled={restoring || creating}
            >
              {restoring ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.restoreButtonText}>
                  التحقق والاستعادة
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>تنبيه مهم</Text>
          <Text style={styles.warningText}>
            لا تشارك ملف النسخة الاحتياطية مع أي شخص؛ لأنه قد يحتوي على
            بيانات العملاء والمشاريع. الاستعادة تستخدم upsert ولا تحذف
            البيانات غير الموجودة في النسخة.
          </Text>
        </View>

        <View style={styles.tablesCard}>
          <Text style={styles.tablesTitle}>الجداول المشمولة</Text>
          <Text style={styles.tablesText}>{BACKUP_TABLES.join(" • ")}</Text>
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
  heroCard: {
    backgroundColor: "#111f33",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#263852",
    padding: 22,
    alignItems: "center",
  },
  heroIcon: { fontSize: 40 },
  heroTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 12,
    textAlign: "center",
  },
  heroText: {
    color: "#92a0b3",
    fontSize: 10,
    lineHeight: 18,
    marginTop: 7,
    textAlign: "center",
  },
  primaryCard: {
    minHeight: 102,
    borderRadius: 19,
    backgroundColor: "#d4a94e",
    padding: 16,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  primaryIconBox: {
    width: 56,
    height: 56,
    borderRadius: 17,
    backgroundColor: "rgba(8,17,31,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryIcon: { fontSize: 25 },
  primaryInfo: { flex: 1, alignItems: "flex-end", paddingLeft: 13 },
  primaryTitle: { color: "#08111f", fontSize: 15, fontWeight: "900" },
  primaryText: {
    color: "#4f3d16",
    fontSize: 9,
    lineHeight: 16,
    marginTop: 6,
    textAlign: "right",
  },
  restoreToggle: {
    minHeight: 84,
    borderRadius: 18,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#263852",
    padding: 14,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  restoreToggleIcon: { fontSize: 25 },
  restoreToggleInfo: { flex: 1, alignItems: "flex-end", paddingHorizontal: 12 },
  restoreToggleTitle: { color: "#fff", fontSize: 14, fontWeight: "900" },
  restoreToggleText: { color: "#8796aa", fontSize: 9, marginTop: 5 },
  chevron: { color: "#d4a94e", fontSize: 20 },
  restoreBox: {
    backgroundColor: "#111f33",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#263852",
    padding: 14,
    marginTop: 10,
  },
  label: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "right",
    marginBottom: 8,
  },
  textArea: {
    minHeight: 180,
    borderRadius: 14,
    backgroundColor: "#08111f",
    borderWidth: 1,
    borderColor: "#30425e",
    color: "#fff",
    padding: 12,
    fontSize: 10,
  },
  restoreButton: {
    minHeight: 49,
    borderRadius: 14,
    backgroundColor: "#b8473f",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  restoreButtonText: { color: "#fff", fontWeight: "900" },
  warningBox: {
    backgroundColor: "#3a301b",
    borderRadius: 17,
    padding: 15,
    marginTop: 13,
  },
  warningTitle: {
    color: "#f3ce7b",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
  },
  warningText: {
    color: "#d4bd8f",
    fontSize: 9,
    lineHeight: 17,
    marginTop: 7,
    textAlign: "right",
  },
  tablesCard: {
    backgroundColor: "#111f33",
    borderRadius: 17,
    padding: 15,
    marginTop: 12,
  },
  tablesTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
  },
  tablesText: {
    color: "#78889e",
    fontSize: 9,
    lineHeight: 17,
    marginTop: 7,
    textAlign: "right",
  },
});
