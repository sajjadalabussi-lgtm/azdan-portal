"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type Role = "super_admin" | "admin" | "employee";

type AdminProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  is_active: boolean;
  created_at?: string | null;
};

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "مدير أعلى",
  admin: "مدير",
  employee: "موظف",
};

const ROLES: Role[] = ["super_admin", "admin", "employee"];

export default function AdminUsersPage() {
  const router = useRouter();

  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data: myProfile, error: myProfileError } = await supabase
        .from("admin_profiles")
        .select("id, full_name, email, role, is_active, created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (myProfileError) {
        setError(
          "تعذر قراءة جدول admin_profiles. شغّل ملف SQL الموجود داخل الحزمة، ثم أضف حسابك كـ super_admin."
        );
        return;
      }

      if (!myProfile) {
        setError(
          `حسابك مسجل في تسجيل الدخول، لكنه غير موجود داخل admin_profiles.\n\nUser ID:\n${user.id}\n\nانسخ هذا الرقم واستخدم أمر SQL الموجود في README.`
        );
        return;
      }

      setCurrentRole(myProfile.role as Role);

      const { data, error: listError } = await supabase
        .from("admin_profiles")
        .select("id, full_name, email, role, is_active, created_at")
        .order("created_at", { ascending: false });

      if (listError) throw listError;

      setProfiles((data ?? []) as AdminProfile[]);
    } catch (err: any) {
      setError(err?.message || "تعذر تحميل المستخدمين.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function changeRole(profile: AdminProfile, role: Role) {
    if (currentRole !== "super_admin") {
      Alert.alert("غير مسموح", "تغيير الصلاحيات متاح للمدير الأعلى فقط.");
      return;
    }

    if (profile.id === currentUserId && role !== "super_admin") {
      Alert.alert(
        "غير مسموح",
        "لا يمكنك إزالة صلاحية المدير الأعلى من حسابك الحالي."
      );
      return;
    }

    try {
      setUpdatingId(profile.id);

      const { error: updateError } = await supabase
        .from("admin_profiles")
        .update({ role })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setProfiles((current) =>
        current.map((item) =>
          item.id === profile.id ? { ...item, role } : item
        )
      );
    } catch (err: any) {
      Alert.alert("خطأ", err?.message || "تعذر تغيير الصلاحية.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleActive(profile: AdminProfile) {
    if (currentRole !== "super_admin") {
      Alert.alert("غير مسموح", "إدارة الحسابات متاحة للمدير الأعلى فقط.");
      return;
    }

    if (profile.id === currentUserId) {
      Alert.alert("غير مسموح", "لا يمكنك تعطيل حسابك الحالي.");
      return;
    }

    try {
      setUpdatingId(profile.id);

      const { error: updateError } = await supabase
        .from("admin_profiles")
        .update({ is_active: !profile.is_active })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setProfiles((current) =>
        current.map((item) =>
          item.id === profile.id
            ? { ...item, is_active: !item.is_active }
            : item
        )
      );
    } catch (err: any) {
      Alert.alert("خطأ", err?.message || "تعذر تحديث الحساب.");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>جاري تحميل المستخدمين...</Text>
      </SafeAreaView>
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
          <Text style={styles.title}>المستخدمون والصلاحيات</Text>
          <Text style={styles.subtitle}>
            الصفحة لا تعيدك لتسجيل الدخول عند نقص ملف الصلاحية
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>🔐</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadUsers();
            }}
            tintColor="#d4a94e"
          />
        }
      >
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>إعداد الصلاحيات غير مكتمل</Text>
            <Text selectable style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{profiles.length}</Text>
                <Text style={styles.summaryLabel}>جميع المستخدمين</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>
                  {profiles.filter((item) => item.is_active).length}
                </Text>
                <Text style={styles.summaryLabel}>حسابات فعالة</Text>
              </View>
            </View>

            {currentRole !== "super_admin" ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  يمكنك مشاهدة المستخدمين، لكن التعديل متاح للمدير الأعلى فقط.
                </Text>
              </View>
            ) : null}

            {profiles.map((profile) => (
              <View key={profile.id} style={styles.userCard}>
                <View style={styles.userTop}>
                  <View
                    style={[
                      styles.statusDot,
                      !profile.is_active && styles.statusDotOff,
                    ]}
                  />

                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(profile.full_name || profile.email || "م")
                        .slice(0, 1)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {profile.full_name || "مستخدم بدون اسم"}
                    </Text>
                    <Text style={styles.userEmail}>
                      {profile.email || profile.id}
                    </Text>
                    <Text style={styles.userStatus}>
                      {profile.is_active ? "حساب فعال" : "حساب معطل"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.roleLabel}>الصلاحية</Text>

                <View style={styles.rolesRow}>
                  {ROLES.map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleButton,
                        profile.role === role && styles.roleButtonActive,
                      ]}
                      onPress={() => changeRole(profile, role)}
                      disabled={
                        updatingId === profile.id ||
                        currentRole !== "super_admin"
                      }
                    >
                      <Text
                        style={[
                          styles.roleButtonText,
                          profile.role === role &&
                            styles.roleButtonTextActive,
                        ]}
                      >
                        {ROLE_LABELS[role]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.activeButton,
                    !profile.is_active && styles.activateButton,
                  ]}
                  onPress={() => toggleActive(profile)}
                  disabled={
                    updatingId === profile.id ||
                    currentRole !== "super_admin"
                  }
                >
                  {updatingId === profile.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.activeButtonText}>
                      {profile.is_active
                        ? "تعطيل الحساب"
                        : "تفعيل الحساب"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
  loadingText: { color: "#a9b5c6", marginTop: 12 },
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
  title: { color: "#fff", fontSize: 18, fontWeight: "900" },
  subtitle: {
    color: "#8291a6",
    fontSize: 8,
    marginTop: 4,
    textAlign: "right",
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconText: { fontSize: 19 },
  content: { padding: 16, paddingBottom: 45 },
  errorCard: {
    backgroundColor: "#3b241f",
    borderRadius: 18,
    padding: 18,
  },
  errorTitle: {
    color: "#ffb6aa",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },
  errorText: {
    color: "#e4b7af",
    fontSize: 10,
    lineHeight: 19,
    marginTop: 9,
    textAlign: "right",
  },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: {
    flex: 1,
    backgroundColor: "#111f33",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#263852",
    padding: 17,
    alignItems: "center",
  },
  summaryNumber: { color: "#d4a94e", fontSize: 26, fontWeight: "900" },
  summaryLabel: { color: "#9ba9bb", fontSize: 9, marginTop: 5 },
  noticeBox: {
    backgroundColor: "#3b311b",
    borderRadius: 15,
    padding: 13,
    marginTop: 12,
  },
  noticeText: {
    color: "#e2c67f",
    fontSize: 10,
    textAlign: "center",
  },
  userCard: {
    backgroundColor: "#111f33",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#263852",
    padding: 14,
    marginTop: 12,
  },
  userTop: { flexDirection: "row", alignItems: "center" },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#43bd78",
  },
  statusDotOff: { backgroundColor: "#b84e47" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 11,
  },
  avatarText: { color: "#08111f", fontSize: 18, fontWeight: "900" },
  userInfo: { flex: 1, alignItems: "flex-end" },
  userName: { color: "#fff", fontSize: 14, fontWeight: "900" },
  userEmail: { color: "#8796aa", fontSize: 9, marginTop: 5 },
  userStatus: { color: "#d4a94e", fontSize: 8, marginTop: 4 },
  roleLabel: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 15,
    marginBottom: 8,
  },
  rolesRow: { flexDirection: "row", gap: 7 },
  roleButton: {
    flex: 1,
    minHeight: 39,
    borderRadius: 11,
    backgroundColor: "#172840",
    borderWidth: 1,
    borderColor: "#30425e",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  roleButtonActive: {
    backgroundColor: "#d4a94e",
    borderColor: "#d4a94e",
  },
  roleButtonText: { color: "#a3b0c2", fontSize: 8, fontWeight: "800" },
  roleButtonTextActive: { color: "#08111f" },
  activeButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "#a94741",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  activateButton: { backgroundColor: "#2d8c5a" },
  activeButtonText: { color: "#fff", fontSize: 10, fontWeight: "900" },
});
