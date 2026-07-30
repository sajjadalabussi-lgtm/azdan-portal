"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../../lib/supabase";
import ClientForm, {
  ClientFormValues,
} from "../../components/ClientForm";

type ClientRow = {
  id: number;
  name: string;
  phone: string | null;
  project_name: string;
  progress: number | null;
  status: string | null;
  access_code: string | null;
};

export default function EditAdminClientPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const clientId = Number(rawId);

  const [client, setClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadClient = useCallback(async () => {
    if (!Number.isFinite(clientId) || clientId <= 0) {
      Alert.alert("خطأ", "رقم العميل غير صحيح");
      router.back();
      return;
    }

    try {
      const { data, error } = await supabase
        .from("clients")
        .select(
          "id, name, phone, project_name, progress, status, access_code"
        )
        .eq("id", clientId)
        .single();

      if (error) throw error;

      setClient(data as ClientRow);
    } catch (error: any) {
      Alert.alert(
        "خطأ",
        error?.message || "تعذر تحميل بيانات العميل"
      );
    } finally {
      setLoading(false);
    }
  }, [clientId, router]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  const updateClient = async (values: ClientFormValues) => {
    if (!client) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("clients")
        .update({
          name: values.name,
          phone: values.phone,
          project_name: values.project_name,
          progress: Number(values.progress),
          status: values.status,
          access_code: values.access_code,
        })
        .eq("id", client.id);

      if (error) throw error;

      Alert.alert(
        "تم التحديث",
        "تم حفظ بيانات العميل والمشروع بنجاح.",
        [
          {
            text: "رجوع للمشروع",
            onPress: () =>
              router.replace(
                `/admin/client/${client.id}` as never
              ),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        "خطأ",
        error?.message || "تعذر تحديث بيانات العميل"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>
          جاري تحميل بيانات العميل...
        </Text>
      </SafeAreaView>
    );
  }

  if (!client) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyText}>لم يتم العثور على العميل</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
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
            <Text style={styles.title}>تعديل العميل</Text>
            <Text style={styles.subtitle}>
              حدّث بيانات العميل والمشروع ورمز الدخول
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.formCard}>
          <ClientForm
            key={client.id}
            submitTitle="حفظ التعديلات"
            loading={saving}
            initialValues={{
              name: client.name,
              phone: client.phone || "",
              project_name: client.project_name,
              progress: String(client.progress ?? 0),
              status: client.status || "قيد التنفيذ",
              access_code: client.access_code || "",
            }}
            onSubmit={updateClient}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
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
  title: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
  },
  subtitle: {
    color: "#9eacc1",
    fontSize: 11,
    marginTop: 4,
    textAlign: "right",
  },
  headerSpacer: {
    width: 45,
  },
  formCard: {
    margin: 16,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#243650",
    borderRadius: 21,
    padding: 17,
  },
});
