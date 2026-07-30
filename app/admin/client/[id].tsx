"use client";

import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../../lib/supabase";

type ClientRow = {
  id: number;
  name: string;
  phone: string | null;
  project_name: string;
  progress: number | null;
  status: string | null;
  access_code: string | null;
};

type CountStats = {
  images: number;
  files: number;
  updates: number;
  payments: number;
  notifications: number;
};

const initialCounts: CountStats = {
  images: 0,
  files: 0,
  updates: 0,
  payments: 0,
  notifications: 0,
};

async function countRows(table: string, clientId: number) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId);

  if (error) {
    console.warn(`${table}:`, error.message);
    return 0;
  }

  return count ?? 0;
}

function generateAccessCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";

  let code = "AZ-";

  for (let index = 0; index < 3; index += 1) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }

  code += "-";

  for (let index = 0; index < 4; index += 1) {
    code += numbers[Math.floor(Math.random() * numbers.length)];
  }

  return code;
}

function showMessage(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
}

export default function AdminClientDetailsPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const clientId = useMemo(() => {
    const raw = Array.isArray(params.id) ? params.id[0] : params.id;
    const value = Number(raw);

    return Number.isFinite(value) && value > 0 ? value : null;
  }, [params.id]);

  const [client, setClient] = useState<ClientRow | null>(null);
  const [counts, setCounts] = useState<CountStats>(initialCounts);
  const [loading, setLoading] = useState(true);
  const [changingCode, setChangingCode] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!clientId) {
      showMessage("خطأ", "رقم العميل غير صحيح");
      router.back();
      return;
    }

    try {
      const [
        clientResult,
        images,
        files,
        updates,
        payments,
        notifications,
      ] = await Promise.all([
        supabase
          .from("clients")
          .select(
            "id, name, phone, project_name, progress, status, access_code"
          )
          .eq("id", clientId)
          .single(),

        countRows("project_images", clientId),
        countRows("project_files", clientId),
        countRows("project_updates", clientId),
        countRows("project_payments", clientId),
        countRows("project_notifications", clientId),
      ]);

      if (clientResult.error) {
        throw clientResult.error;
      }

      setClient(clientResult.data as ClientRow);

      setCounts({
        images,
        files,
        updates,
        payments,
        notifications,
      });
    } catch (error: any) {
      showMessage(
        "خطأ",
        error?.message || "تعذر تحميل بيانات المشروع"
      );
    } finally {
      setLoading(false);
    }
  }, [clientId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetAccessCodeInDatabase = async (newCode: string) => {
    if (!client) return;

    try {
      setChangingCode(true);

      const { data, error } = await supabase
        .from("clients")
        .update({ access_code: newCode })
        .eq("id", client.id)
        .select("id, access_code");

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error(
          "لم يتم تغيير رمز الدخول. تأكد من صلاحية UPDATE على جدول clients."
        );
      }

      setClient((current) =>
        current
          ? {
              ...current,
              access_code: newCode,
            }
          : current
      );

      showMessage(
        "تم التغيير",
        `رمز الدخول الجديد هو:\n${newCode}`
      );
    } catch (error: any) {
      showMessage(
        "خطأ",
        error?.message || "تعذر تغيير رمز الدخول"
      );
    } finally {
      setChangingCode(false);
    }
  };

  const resetAccessCode = () => {
    if (!client || changingCode) return;

    const newCode = generateAccessCode();
    const message = `سيتم استبدال الرمز الحالي بالرمز:\n${newCode}`;

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `تغيير رمز الدخول\n\n${message}`
      );

      if (confirmed) {
        void resetAccessCodeInDatabase(newCode);
      }

      return;
    }

    Alert.alert("تغيير رمز الدخول", message, [
      {
        text: "إلغاء",
        style: "cancel",
      },
      {
        text: "تأكيد",
        onPress: () => {
          void resetAccessCodeInDatabase(newCode);
        },
      },
    ]);
  };

  const shareLogin = async () => {
    if (!client) return;

    const message =
      `بيانات الدخول إلى مشروع أزدان\n\n` +
      `العميل: ${client.name}\n` +
      `المشروع: ${client.project_name}\n` +
      `رقم الهاتف: ${client.phone || "-"}\n` +
      `رمز الدخول: ${client.access_code || "-"}`;

    try {
      if (Platform.OS === "web") {
        if (navigator.share) {
          await navigator.share({
            title: "بيانات دخول مشروع أزدان",
            text: message,
          });
        } else {
          await navigator.clipboard.writeText(message);
          showMessage(
            "تم النسخ",
            "تم نسخ بيانات الدخول إلى الحافظة."
          );
        }

        return;
      }

      await Share.share({ message });
    } catch (error: any) {
      showMessage(
        "خطأ",
        error?.message || "تعذرت مشاركة بيانات الدخول"
      );
    }
  };

  const deleteClientFromDatabase = async () => {
    if (!client || deleting) return;

    try {
      setDeleting(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(
          "جلسة المدير غير موجودة. سجل الخروج ثم ادخل مرة أخرى."
        );
      }

      const { data, error } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.id)
        .select("id");

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error(
          "لم يتم حذف العميل. تأكد من سياسة DELETE في Supabase ومن أن المستخدم مسجل دخول."
        );
      }

      if (Platform.OS === "web") {
        window.alert("تم حذف العميل بنجاح.");
        router.replace("/admin/clients" as never);
        return;
      }

      Alert.alert("تم الحذف", "تم حذف العميل بنجاح.", [
        {
          text: "حسنًا",
          onPress: () =>
            router.replace("/admin/clients" as never),
        },
      ]);
    } catch (error: any) {
      console.error("Delete client error:", error);

      showMessage(
        "تعذر الحذف",
        error?.message ||
          "تعذر حذف العميل. تأكد من صلاحيات الحذف والعلاقات المرتبطة."
      );
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteClient = () => {
    if (!client || deleting) return;

    const message =
      `هل أنت متأكد من حذف العميل "${client.name}" نهائيًا؟`;

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `حذف العميل\n\n${message}`
      );

      if (confirmed) {
        void deleteClientFromDatabase();
      }

      return;
    }

    Alert.alert("حذف العميل", message, [
      {
        text: "إلغاء",
        style: "cancel",
      },
      {
        text: "حذف نهائي",
        style: "destructive",
        onPress: () => {
          void deleteClientFromDatabase();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />

        <Text style={styles.loadingText}>
          جاري تحميل المشروع...
        </Text>
      </SafeAreaView>
    );
  }

  if (!client) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" />

        <Text style={styles.emptyText}>
          لم يتم العثور على العميل
        </Text>

        <TouchableOpacity
          style={styles.returnButton}
          onPress={() =>
            router.replace("/admin/clients" as never)
          }
        >
          <Text style={styles.returnButtonText}>
            العودة إلى العملاء
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const progress = Math.min(
    100,
    Math.max(0, Number(client.progress ?? 0))
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.brand}>أزدان</Text>

            <Text style={styles.headerSubtitle}>
              إدارة مشروع العميل
            </Text>
          </View>

          <TouchableOpacity
            style={styles.editTopButton}
            onPress={() =>
              router.push(
                `/admin/clients/${client.id}/edit` as never
              )
            }
          >
            <Text style={styles.editTopText}>تعديل</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>
                {client.name}
              </Text>

              <Text style={styles.projectName}>
                {client.project_name}
              </Text>
            </View>

            <View style={styles.progressCircle}>
              <Text style={styles.progressCircleText}>
                {progress}%
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%` },
              ]}
            />
          </View>

          <View style={styles.detailsGrid}>
            <InfoItem
              label="حالة المشروع"
              value={client.status || "قيد التنفيذ"}
            />

            <InfoItem
              label="رقم الهاتف"
              value={client.phone || "غير مسجل"}
            />

            <InfoItem
              label="رمز الدخول"
              value={client.access_code || "غير مسجل"}
            />

            <InfoItem
              label="رقم العميل"
              value={String(client.id)}
            />
          </View>

          <View style={styles.loginActions}>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={shareLogin}
            >
              <Text style={styles.shareButtonText}>
                مشاركة بيانات الدخول
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.codeButton,
                changingCode && styles.disabledButton,
              ]}
              disabled={changingCode}
              onPress={resetAccessCode}
            >
              {changingCode ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.codeButtonText}>
                  رمز دخول جديد
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          إدارة المشروع
        </Text>

        <View style={styles.managementGrid}>
          <ManagementCard
            icon="📷"
            title="الصور"
            count={counts.images}
            onPress={() =>
              router.push(
                `/admin/client/${client.id}/images` as never
              )
            }
          />

          <ManagementCard
            icon="📁"
            title="الملفات"
            count={counts.files}
            onPress={() =>
              router.push(
                `/admin/client/${client.id}/files` as never
              )
            }
          />

          <ManagementCard
            icon="📝"
            title="التحديثات"
            count={counts.updates}
            onPress={() =>
              router.push(
                `/admin/client/${client.id}/updates` as never
              )
            }
          />

          <ManagementCard
            icon="💰"
            title="الدفعات"
            count={counts.payments}
            onPress={() =>
              router.push(
                `/admin/client/${client.id}/payments` as never
              )
            }
          />

          <ManagementCard
            icon="🔔"
            title="الإشعارات"
            count={counts.notifications}
            onPress={() =>
              router.push(
                `/admin/client/${client.id}/notifications` as never
              )
            }
          />
        </View>

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>
            منطقة الإدارة الحساسة
          </Text>

          <Text style={styles.dangerText}>
            عند الحذف سيتم حذف العميل نهائيًا. يجب أن تكون
            صلاحية DELETE مفعلة في Supabase، وأن تكون العلاقات
            المرتبطة مضبوطة على ON DELETE CASCADE.
          </Text>

          <TouchableOpacity
            style={[
              styles.deleteButton,
              deleting && styles.disabledButton,
            ]}
            disabled={deleting}
            onPress={confirmDeleteClient}
          >
            {deleting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.deleteButtonText}>
                حذف العميل نهائيًا
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoValue}>{value}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

function ManagementCard({
  icon,
  title,
  count,
  onPress,
}: {
  icon: string;
  title: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.managementCard}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={styles.managementIconBox}>
        <Text style={styles.managementIcon}>{icon}</Text>
      </View>

      <Text style={styles.managementTitle}>{title}</Text>
      <Text style={styles.managementCount}>{count} عنصر</Text>
    </TouchableOpacity>
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
    padding: 20,
  },
  content: {
    paddingBottom: 45,
  },
  loadingText: {
    color: "#c7d1df",
    marginTop: 14,
  },
  emptyText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 17,
  },
  returnButton: {
    marginTop: 18,
    backgroundColor: "#d4a94e",
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  returnButtonText: {
    color: "#07101d",
    fontWeight: "900",
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
  brand: {
    color: "#d4a94e",
    fontSize: 24,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "#9eacc1",
    fontSize: 11,
    marginTop: 4,
  },
  editTopButton: {
    minWidth: 58,
    height: 43,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  editTopText: {
    color: "#07101d",
    fontWeight: "900",
  },
  summaryCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    borderRadius: 22,
    padding: 17,
  },
  summaryTop: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  clientInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  clientName: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "right",
  },
  projectName: {
    color: "#9eacc1",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    textAlign: "right",
  },
  progressCircle: {
    width: 67,
    height: 67,
    borderRadius: 21,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 14,
  },
  progressCircleText: {
    color: "#07101d",
    fontSize: 18,
    fontWeight: "900",
  },
  progressTrack: {
    height: 8,
    borderRadius: 8,
    backgroundColor: "#182941",
    overflow: "hidden",
    marginTop: 17,
  },
  progressFill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#d4a94e",
  },
  detailsGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 17,
  },
  infoItem: {
    width: "48%",
    flexGrow: 1,
    minHeight: 76,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    borderRadius: 15,
    padding: 12,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  infoValue: {
    color: "#ffffff",
    fontWeight: "900",
    textAlign: "right",
  },
  infoLabel: {
    color: "#8192aa",
    fontSize: 10,
    marginTop: 6,
  },
  loginActions: {
    flexDirection: "row-reverse",
    gap: 10,
    marginTop: 14,
  },
  shareButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  shareButtonText: {
    color: "#07101d",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  codeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#172841",
    borderWidth: 1,
    borderColor: "#2e4463",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  codeButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "right",
    marginHorizontal: 16,
    marginTop: 22,
    marginBottom: 12,
  },
  managementGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 16,
  },
  managementCard: {
    width: "48%",
    flexGrow: 1,
    minHeight: 145,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  managementIconBox: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  managementIcon: {
    fontSize: 24,
  },
  managementTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 11,
  },
  managementCount: {
    color: "#8192aa",
    fontSize: 11,
    marginTop: 5,
  },
  dangerCard: {
    margin: 16,
    marginTop: 22,
    backgroundColor: "#2c1820",
    borderWidth: 1,
    borderColor: "#63303d",
    borderRadius: 20,
    padding: 17,
  },
  dangerTitle: {
    color: "#ffd2d8",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "right",
  },
  dangerText: {
    color: "#d0a8af",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
    textAlign: "right",
  },
  deleteButton: {
    minHeight: 49,
    borderRadius: 14,
    backgroundColor: "#a53b4b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  deleteButtonText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.65,
  },
});