import { router } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { supabase } from "../lib/supabase";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const cleanPhone = phone.trim();
    const cleanAccessCode = accessCode.trim();

    if (!cleanPhone || !cleanAccessCode) {
      Alert.alert("تنبيه", "أدخل رقم الهاتف ورمز الدخول");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone, project_name, progress, status, access_code")
        .eq("phone", cleanPhone)
        .eq("access_code", cleanAccessCode)
        .maybeSingle();

      if (error) {
        console.log("Supabase error:", error);
        Alert.alert("خطأ", "حدث خطأ أثناء تسجيل الدخول");
        return;
      }

      if (!data) {
        Alert.alert("بيانات غير صحيحة", "رقم الهاتف أو رمز الدخول غير صحيح");
        return;
      }

      router.replace({
        pathname: "/client/[id]",
        params: {
          id: String(data.id),
        },
      });
    } catch (error) {
      console.log("Login error:", error);
      Alert.alert("خطأ", "تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>رجوع</Text>
          </TouchableOpacity>

          <Text style={styles.logo}>AZDAN</Text>

          <Text style={styles.title}>تسجيل الدخول</Text>

          <Text style={styles.subtitle}>
            أدخل رقم الهاتف ورمز الدخول الخاص بمشروعك
          </Text>

          <TextInput
            style={styles.input}
            placeholder="07XXXXXXXXX"
            placeholderTextColor="#94a3b8"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            textAlign="right"
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="رمز الدخول"
            placeholderTextColor="#94a3b8"
            value={accessCode}
            onChangeText={setAccessCode}
            textAlign="right"
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={styles.buttonText}>دخول</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>AZDAN General Contracting</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  backButton: {
    position: "absolute",
    top: 20,
    right: 24,
    zIndex: 1,
    padding: 10,
  },

  backText: {
    color: "#fbbf24",
    fontSize: 16,
    fontWeight: "700",
  },

  logo: {
    color: "#fbbf24",
    fontSize: 46,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 4,
    marginBottom: 16,
  },

  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },

  subtitle: {
    color: "#cbd5e1",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 30,
  },

  input: {
    width: "100%",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    color: "#ffffff",
    fontSize: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 14,
  },

  button: {
    width: "100%",
    backgroundColor: "#fbbf24",
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 4,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
  },

  footer: {
    color: "#64748b",
    textAlign: "center",
    paddingBottom: 24,
  },
});