"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";

type AdminProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "super_admin" | "admin" | "employee";
  is_active: boolean;
};

const ROLE_LABELS = {
  super_admin: "مدير أعلى",
  admin: "مدير",
  employee: "موظف",
};

export default function AdminSettingsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      setAuthEmail(user.email || "");

      const { data, error } = await supabase
        .from("admin_profiles")
        .select("id, full_name, email, role, is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile((data ?? null) as AdminProfile | null);
    } catch (error: any) {
      Alert.alert(
        "خطأ",
        error?.message || "تعذر تحميل إعدادات الحساب."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function updatePassword() {
    if (newPassword.length < 8) {
      Alert.alert("تنبيه", "كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("تنبيه", "كلمتا المرور غير متطابقتين.");
      return;
    }

    try {
      setSavingPassword(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      setPasswordModal(false);
      Alert.alert("تم", "تم تغيير كلمة المرور بنجاح.");
    } catch (error: any) {
      Alert.alert(
        "خطأ",
        error?.message || "تعذر تغيير كلمة المرور."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  function confirmLogout() {
    Alert.alert(
      "تسجيل الخروج",
      "هل تريد تسجيل الخروج من لوحة الإدارة؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تسجيل الخروج",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace("/admin/login");
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>جاري تحميل الإعدادات...</Text>
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
          <Text style={styles.title}>الإعدادات والأمان</Text>
          <Text style={styles.subtitle}>إدارة حساب لوحة أزدان</Text>
        </View>

        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>⚙️</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadProfile();
            }}
            tintColor="#d4a94e"
          />
        }
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.full_name || authEmail || "س")
                .slice(0, 1)
                .toUpperCase()}
            </Text>
          </View>

          <Text style={styles.profileName}>
            {profile?.full_name || "مستخدم الإدارة"}
          </Text>

          <Text style={styles.profileEmail}>
            {profile?.email || authEmail || "لا يوجد إيميل محفوظ"}
          </Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {profile
                ? ROLE_LABELS[profile.role]
                : "لم يتم إنشاء ملف الصلاحية"}
            </Text>
          </View>

          {profile && !profile.is_active ? (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveText}>الحساب معطل</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>الأمان</Text>

        <TouchableOpacity
          style={styles.item}
          onPress={() => setPasswordModal(true)}
        >
          <View style={styles.itemIcon}>
            <Text style={styles.itemIconText}>🔑</Text>
          </View>

          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>تغيير كلمة المرور</Text>
            <Text style={styles.itemDescription}>
              استخدم كلمة مرور قوية لا تقل عن 8 أحرف
            </Text>
          </View>

          <Text style={styles.chevron}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={loadProfile}
        >
          <View style={styles.itemIcon}>
            <Text style={styles.itemIconText}>🔄</Text>
          </View>

          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>تحديث بيانات الحساب</Text>
            <Text style={styles.itemDescription}>
              إعادة قراءة الجلسة والصلاحيات من Supabase
            </Text>
          </View>

          <Text style={styles.chevron}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>إدارة النظام</Text>

        <TouchableOpacity
          style={styles.item}
          onPress={() => router.push("/admin/users")}
        >
          <View style={styles.itemIcon}>
            <Text style={styles.itemIconText}>👥</Text>
          </View>

          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>المستخدمون والصلاحيات</Text>
            <Text style={styles.itemDescription}>
              إدارة أدوار فريق الإدارة
            </Text>
          </View>

          <Text style={styles.chevron}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() => router.push("/admin/backup")}
        >
          <View style={styles.itemIcon}>
            <Text style={styles.itemIconText}>💾</Text>
          </View>

          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>النسخ الاحتياطي</Text>
            <Text style={styles.itemDescription}>
              حفظ واستعادة بيانات النظام
            </Text>
          </View>

          <Text style={styles.chevron}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() => router.push("/admin/export")}
        >
          <View style={styles.itemIcon}>
            <Text style={styles.itemIconText}>📤</Text>
          </View>

          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>تصدير البيانات</Text>
            <Text style={styles.itemDescription}>
              تصدير CSV وJSON
            </Text>
          </View>

          <Text style={styles.chevron}>‹</Text>
        </TouchableOpacity>

        <View style={styles.appCard}>
          <Text style={styles.appTitle}>Azdan Admin</Text>
          <Text style={styles.appVersion}>Stage 5A — Settings & Security</Text>
          <Text style={styles.appText}>
            لوحة إدارة المشاريع والعملاء لشركة أزدان للمقاولات العامة.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={confirmLogout}
        >
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={passwordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setPasswordModal(false)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>

              <Text style={styles.modalTitle}>تغيير كلمة المرور</Text>
            </View>

            <Text style={styles.label}>كلمة المرور الجديدة</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="8 أحرف على الأقل"
              placeholderTextColor="#66768c"
              textAlign="right"
            />

            <Text style={styles.label}>تأكيد كلمة المرور</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="أعد كتابة كلمة المرور"
              placeholderTextColor="#66768c"
              textAlign="right"
            />

            <TouchableOpacity
              style={styles.saveButton}
              onPress={updatePassword}
              disabled={savingPassword}
            >
              {savingPassword ? (
                <ActivityIndicator color="#08111f" />
              ) : (
                <Text style={styles.saveText}>حفظ كلمة المرور</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerText: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 12,
  },
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
  profileCard: {
    backgroundColor: "#111f33",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#263852",
    padding: 22,
    alignItems: "center",
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 23,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#08111f",
    fontSize: 28,
    fontWeight: "900",
  },
  profileName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 13,
  },
  profileEmail: {
    color: "#8e9db2",
    fontSize: 10,
    marginTop: 5,
  },
  roleBadge: {
    backgroundColor: "#20334e",
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 7,
    marginTop: 11,
  },
  roleText: {
    color: "#d4a94e",
    fontSize: 10,
    fontWeight: "900",
  },
  inactiveBadge: {
    backgroundColor: "#4a2422",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  inactiveText: { color: "#ffaaa3", fontSize: 9 },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 22,
    marginBottom: 10,
  },
  item: {
    minHeight: 76,
    backgroundColor: "#111f33",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#263852",
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  itemIcon: {
    width: 47,
    height: 47,
    borderRadius: 14,
    backgroundColor: "#20334e",
    alignItems: "center",
    justifyContent: "center",
  },
  itemIconText: { fontSize: 20 },
  itemInfo: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 12,
  },
  itemTitle: { color: "#fff", fontSize: 13, fontWeight: "900" },
  itemDescription: {
    color: "#8291a6",
    fontSize: 9,
    marginTop: 5,
    textAlign: "right",
  },
  chevron: { color: "#d4a94e", fontSize: 24 },
  appCard: {
    backgroundColor: "#17243a",
    borderRadius: 17,
    padding: 17,
    marginTop: 15,
    alignItems: "center",
  },
  appTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  appVersion: { color: "#d4a94e", fontSize: 9, marginTop: 5 },
  appText: {
    color: "#8f9db0",
    fontSize: 9,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 8,
  },
  logoutButton: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: "#a94741",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 13,
  },
  logoutText: { color: "#fff", fontWeight: "900" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#0d1a2c",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 19,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  closeText: { color: "#fff", fontSize: 20 },
  label: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 12,
    marginBottom: 7,
  },
  input: {
    minHeight: 50,
    backgroundColor: "#111f33",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#30425e",
    color: "#fff",
    paddingHorizontal: 13,
  },
  saveButton: {
    minHeight: 52,
    backgroundColor: "#d4a94e",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  saveText: { color: "#08111f", fontWeight: "900" },
});
