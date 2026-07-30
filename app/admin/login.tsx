"use client";

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          router.replace("/admin");
          return;
        }
      } catch (error) {
        console.log("Admin session check error:", error);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [router]);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim()) {
      Alert.alert(
        "بيانات ناقصة",
        "أدخل البريد الإلكتروني وكلمة المرور"
      );
      return;
    }

    try {
      setLoading(true);

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (error) throw error;

      if (!data.user) {
        throw new Error("تعذر تسجيل الدخول");
      }

      router.replace("/admin");
    } catch (error: any) {
      let message =
        error?.message ||
        "تأكد من البريد الإلكتروني وكلمة المرور";

      if (
        message.toLowerCase().includes(
          "invalid login credentials"
        )
      ) {
        message =
          "البريد الإلكتروني أو كلمة المرور غير صحيحة";
      }

      if (
        message.toLowerCase().includes(
          "email not confirmed"
        )
      ) {
        message =
          "يجب تأكيد البريد الإلكتروني قبل تسجيل الدخول";
      }

      Alert.alert("تعذر تسجيل الدخول", message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>
          جاري التحقق من الجلسة...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        style={styles.content}
        behavior={
          Platform.OS === "ios" ? "padding" : undefined
        }
      >
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.8}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.backButtonText}>
            الرجوع للرئيسية
          </Text>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>

        <View style={styles.logoBox}>
          <Text style={styles.logo}>AZDAN</Text>
          <Text style={styles.companyName}>
            أزدان للمقاولات العامة
          </Text>
          <Text style={styles.subtitle}>
            لوحة إدارة المشاريع
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.adminIcon}>🛡️</Text>

            <View style={styles.cardHeaderInfo}>
              <Text style={styles.title}>
                دخول مدير النظام
              </Text>

              <Text style={styles.cardSubtitle}>
                أدخل بيانات حساب الإدارة
              </Text>
            </View>
          </View>

          <Text style={styles.label}>
            البريد الإلكتروني
          </Text>

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="admin@example.com"
            placeholderTextColor="#6f7f95"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textAlign="right"
            editable={!loading}
            returnKeyType="next"
          />

          <Text style={styles.label}>
            كلمة المرور
          </Text>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#6f7f95"
              secureTextEntry={!showPassword}
              textAlign="right"
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <TouchableOpacity
              style={styles.showPasswordButton}
              disabled={loading}
              onPress={() =>
                setShowPassword((current) => !current)
              }
            >
              <Text style={styles.showPasswordText}>
                {showPassword ? "إخفاء" : "إظهار"}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              loading && styles.buttonDisabled,
            ]}
            activeOpacity={0.8}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator
                  size="small"
                  color="#07101d"
                />

                <Text style={styles.buttonText}>
                  جاري تسجيل الدخول...
                </Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>
                تسجيل الدخول
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  },

  loadingText: {
    color: "#c7d1df",
    marginTop: 14,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
  },

  backButton: {
    position: "absolute",
    top: 18,
    right: 22,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#2b3d58",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
  },

  backButtonText: {
    color: "#c7d1df",
    fontSize: 12,
    fontWeight: "800",
  },

  backArrow: {
    color: "#d4a94e",
    fontSize: 25,
    marginRight: 7,
    lineHeight: 28,
  },

  logoBox: {
    alignItems: "center",
    marginBottom: 28,
  },

  logo: {
    color: "#d4a94e",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 5,
  },

  companyName: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 5,
  },

  subtitle: {
    color: "#9eacc1",
    fontSize: 13,
    marginTop: 5,
  },

  card: {
    backgroundColor: "#111f33",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#243650",
    padding: 20,
  },

  cardHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 24,
  },

  adminIcon: {
    fontSize: 32,
    marginLeft: 12,
  },

  cardHeaderInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "right",
  },

  cardSubtitle: {
    color: "#8fa0b7",
    fontSize: 12,
    marginTop: 5,
    textAlign: "right",
  },

  label: {
    color: "#c7d1df",
    fontSize: 13,
    textAlign: "right",
    marginBottom: 8,
  },

  input: {
    height: 52,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    borderRadius: 14,
    color: "#ffffff",
    paddingHorizontal: 14,
    marginBottom: 16,
    fontSize: 15,
  },

  passwordContainer: {
    height: 52,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    borderRadius: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },

  passwordInput: {
    flex: 1,
    height: "100%",
    color: "#ffffff",
    paddingHorizontal: 14,
    fontSize: 15,
  },

  showPasswordButton: {
    height: "100%",
    minWidth: 65,
    alignItems: "center",
    justifyContent: "center",
  },

  showPasswordText: {
    color: "#d4a94e",
    fontSize: 12,
    fontWeight: "900",
  },

  button: {
    backgroundColor: "#d4a94e",
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  buttonText: {
    color: "#07101d",
    fontSize: 16,
    fontWeight: "900",
  },

  loadingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
  },
});