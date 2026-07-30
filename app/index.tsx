import { router } from "expo-router";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.content}>
        <View style={styles.logoBox}>
          <Text style={styles.logo}>AZDAN</Text>
          <Text style={styles.logoSubtitle}>
            للمقاولات العامة
          </Text>
        </View>

        <Text style={styles.title}>
          أهلاً بك في تطبيق أزدان
        </Text>

        <Text style={styles.subtitle}>
          اختر نوع الدخول للمتابعة
        </Text>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.adminButton}
            activeOpacity={0.8}
            onPress={() => router.push("/admin/login")}
          >
            <View style={styles.buttonIconBox}>
              <Text style={styles.buttonIcon}>🛡️</Text>
            </View>

            <View style={styles.buttonInfo}>
              <Text style={styles.adminButtonTitle}>
                دخول مدير النظام
              </Text>

              <Text style={styles.adminButtonSubtitle}>
                إدارة العملاء والمشاريع والدفعات
              </Text>
            </View>

            <Text style={styles.arrow}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clientButton}
            activeOpacity={0.8}
            onPress={() => router.push("/login")}
          >
            <View style={styles.buttonIconBox}>
              <Text style={styles.buttonIcon}>🏗️</Text>
            </View>

            <View style={styles.buttonInfo}>
              <Text style={styles.clientButtonTitle}>
                بوابة العميل
              </Text>

              <Text style={styles.clientButtonSubtitle}>
                متابعة مراحل الإنجاز والصور والدفعات
              </Text>
            </View>

            <Text style={styles.clientArrow}>‹</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.footer}>
        نبني بثقة، ونسلّم بجودة
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08111f",
  },

  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
  },

  logoBox: {
    alignItems: "center",
    marginBottom: 40,
  },

  logo: {
    fontSize: 54,
    fontWeight: "900",
    color: "#fbbf24",
    letterSpacing: 6,
  },

  logoSubtitle: {
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 5,
  },

  title: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    color: "#94a3b8",
    fontSize: 16,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 30,
  },

  buttonsContainer: {
    gap: 16,
  },

  adminButton: {
    minHeight: 105,
    backgroundColor: "#fbbf24",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: "row-reverse",
    alignItems: "center",
  },

  clientButton: {
    minHeight: 105,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#31435e",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: "row-reverse",
    alignItems: "center",
  },

  buttonIconBox: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 13,
  },

  buttonIcon: {
    fontSize: 28,
  },

  buttonInfo: {
    flex: 1,
    alignItems: "flex-end",
  },

  adminButtonTitle: {
    color: "#08111f",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "right",
  },

  adminButtonSubtitle: {
    color: "#27364a",
    fontSize: 12,
    marginTop: 6,
    textAlign: "right",
  },

  clientButtonTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "right",
  },

  clientButtonSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 6,
    textAlign: "right",
  },

  arrow: {
    color: "#08111f",
    fontSize: 34,
    marginRight: 8,
  },

  clientArrow: {
    color: "#fbbf24",
    fontSize: 34,
    marginRight: 8,
  },

  footer: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    paddingBottom: 24,
  },
});