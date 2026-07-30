"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../../lib/supabase";

function useClientId() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  return useMemo(() => {
    const raw = Array.isArray(params.id) ? params.id[0] : params.id;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [params.id]);
}


type PaymentRow = {
  id: number;
  client_id: number;
  amount: number;
  payment_date: string | null;
  note: string | null;
  created_at: string | null;
};

export default function AdminPaymentsPage() {
  const router = useRouter();
  const clientId = useClientId();
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    if (!clientId) return;
    try {
      const { data, error } = await supabase
        .from("project_payments")
        .select("id, client_id, amount, payment_date, note, created_at")
        .eq("client_id", clientId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      setItems((data ?? []) as PaymentRow[]);
    } catch (error: any) {
      Alert.alert("خطأ", error?.message || "تعذر تحميل الدفعات");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const addItem = async () => {
    if (!clientId) return;
    const numericAmount = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert("تنبيه", "أدخل مبلغًا صحيحًا");
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase.from("project_payments").insert({
        client_id: clientId,
        amount: numericAmount,
        payment_date: new Date().toISOString().slice(0, 10),
        note: note.trim() || null,
      });
      if (error) throw error;
      setAmount("");
      setNote("");
      await loadItems();
    } catch (error: any) {
      Alert.alert("خطأ", error?.message || "تعذر تسجيل الدفعة");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = (id: number) => {
    Alert.alert("حذف الدفعة", "هل تريد حذف هذه الدفعة؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف", style: "destructive", onPress: async () => {
          const { error } = await supabase.from("project_payments").delete().eq("id", id);
          if (error) Alert.alert("خطأ", error.message);
          else setItems((current) => current.filter((item) => item.id !== id));
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Header title="الدفعات" onBack={() => router.back()} />
      <View style={styles.totalBox}>
        <Text style={styles.totalValue}>{total.toLocaleString("ar-IQ")} د.ع</Text>
        <Text style={styles.totalLabel}>إجمالي الدفعات المسجلة</Text>
      </View>
      <View style={styles.form}>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="المبلغ بالدينار العراقي" placeholderTextColor="#718198" keyboardType="numeric" textAlign="right" />
        <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="ملاحظة الدفعة" placeholderTextColor="#718198" textAlign="right" />
        <GoldButton title="تسجيل الدفعة" loading={saving} onPress={addItem} />
      </View>
      {loading ? <Loader /> : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Empty text="لا توجد دفعات" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.money}>{Number(item.amount).toLocaleString("ar-IQ")} د.ع</Text>
              <Text style={styles.cardText}>{item.note || "بدون ملاحظة"}</Text>
              <Text style={styles.dateText}>{item.payment_date || ""}</Text>
              <TouchableOpacity style={styles.delete} onPress={() => deleteItem(item.id)}>
                <Text style={styles.deleteText}>حذف</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backText}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function GoldButton({ title, loading, onPress }: { title: string; loading: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.goldButton, loading && { opacity: 0.65 }]} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator color="#07101d" /> : <Text style={styles.goldButtonText}>{title}</Text>}
    </TouchableOpacity>
  );
}

function Loader() {
  return <View style={styles.loader}><ActivityIndicator size="large" color="#d4a94e" /></View>;
}

function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><Text style={styles.emptyIcon}>📭</Text><Text style={styles.emptyText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#08111f" },
  header: { backgroundColor: "#0d1a2c", padding: 16, flexDirection: "row", alignItems: "center", borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#13233a", borderWidth: 1, borderColor: "#34445d", alignItems: "center", justifyContent: "center" },
  backText: { color: "#fff", fontSize: 34, lineHeight: 37 },
  headerTitle: { flex: 1, color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center" },
  headerSpacer: { width: 44 },
  form: { margin: 16, backgroundColor: "#111f33", borderWidth: 1, borderColor: "#243650", borderRadius: 20, padding: 16, gap: 12 },
  input: { minHeight: 50, backgroundColor: "#0b1728", borderWidth: 1, borderColor: "#2b3d58", borderRadius: 14, color: "#fff", paddingHorizontal: 14 },
  multiline: { minHeight: 95, paddingTop: 12 },
  goldButton: { height: 50, backgroundColor: "#d4a94e", borderRadius: 14, alignItems: "center", justifyContent: "center" },
  goldButtonText: { color: "#07101d", fontWeight: "900", fontSize: 15 },
  list: { padding: 16, paddingTop: 0, paddingBottom: 40 },
  card: { backgroundColor: "#111f33", borderWidth: 1, borderColor: "#243650", borderRadius: 18, padding: 15, marginBottom: 12 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "900", textAlign: "right" },
  cardText: { color: "#aebbd0", marginTop: 7, lineHeight: 21, textAlign: "right" },
  dateText: { color: "#7f90a8", fontSize: 11, marginTop: 7, textAlign: "right" },
  money: { color: "#d4a94e", fontSize: 20, fontWeight: "900", textAlign: "right" },
  delete: { height: 42, backgroundColor: "#a53b4b", borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 12 },
  deleteText: { color: "#fff", fontWeight: "900" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 70 },
  emptyIcon: { fontSize: 42 },
  emptyText: { color: "#95a6be", marginTop: 12 },
  totalBox: { margin: 16, marginBottom: 0, backgroundColor: "#111f33", borderWidth: 1, borderColor: "#243650", borderRadius: 20, padding: 18, alignItems: "center" },
  totalValue: { color: "#d4a94e", fontSize: 24, fontWeight: "900" },
  totalLabel: { color: "#9eacc1", marginTop: 5 },
  typeRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  typeButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, backgroundColor: "#0b1728", borderWidth: 1, borderColor: "#2b3d58" },
  typeActive: { backgroundColor: "#d4a94e", borderColor: "#d4a94e" },
  typeText: { color: "#c5d0df", fontSize: 11 },
  typeTextActive: { color: "#07101d", fontWeight: "900" },
  row: { flexDirection: "row-reverse", gap: 10, marginTop: 12 },
  open: { flex: 1, height: 42, backgroundColor: "#d4a94e", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  openText: { color: "#07101d", fontWeight: "900" },
  deleteSmall: { flex: 1, height: 42, backgroundColor: "#a53b4b", borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
