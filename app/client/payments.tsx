import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../../lib/supabase";

type Client = {
  id: number;
  project_name: string;
};

type Payment = {
  id: number;
  client_id: number;
  amount: number | string | null;
  payment_date: string | null;
  note: string | null;
  created_at: string | null;
};

function formatIqd(value: number | string | null) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "0 د.ع";
  }

  return `${new Intl.NumberFormat("ar-IQ", {
    maximumFractionDigits: 0,
  }).format(amount)} د.ع`;
}

function formatDate(value: string | null) {
  if (!value) return "غير محدد";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function PaymentsPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const clientId = useMemo(() => {
    const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
    const parsedId = Number(rawId);

    return Number.isFinite(parsedId) ? parsedId : null;
  }, [params.id]);

  const [client, setClient] = useState<Client | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadPayments = useCallback(async () => {
    if (!clientId) {
      setErrorMessage("معرّف العميل غير صحيح");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setErrorMessage("");

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, project_name")
        .eq("id", clientId)
        .single();

      if (clientError) throw clientError;

      setClient(clientData as Client);

      const { data: paymentsData, error: paymentsError } = await supabase
        .from("project_payments")
        .select("id, client_id, amount, payment_date, note, created_at")
        .eq("client_id", clientId)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (paymentsError) throw paymentsError;

      setPayments((paymentsData as Payment[]) ?? []);
    } catch (error: any) {
      console.error("Payments error:", error);
      setErrorMessage(error?.message || "تعذر تحميل دفعات المشروع");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const totalPaid = useMemo(() => {
    return payments.reduce((sum, payment) => {
      const amount = Number(payment.amount ?? 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }, [payments]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>جاري تحميل الدفعات...</Text>
      </SafeAreaView>
    );
  }

  if (errorMessage) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="light-content" />

        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>تعذر تحميل الدفعات</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={loadPayments}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>إعادة المحاولة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>رجوع</Text>
        </TouchableOpacity>
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
          activeOpacity={0.8}
        >
          <Text style={styles.backButtonText}>رجوع</Text>
        </TouchableOpacity>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>دفعات المشروع</Text>
          <Text style={styles.headerSubtitle}>
            {client?.project_name || "المشروع"}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadPayments();
            }}
            tintColor="#d4a94e"
            colors={["#d4a94e"]}
          />
        }
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>إجمالي الدفعات المسجلة</Text>
          <Text style={styles.summaryAmount}>{formatIqd(totalPaid)}</Text>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryBottomRow}>
            <Text style={styles.summaryCount}>{payments.length}</Text>
            <Text style={styles.summaryCountLabel}>عدد الدفعات</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>سجل الدفعات</Text>

        {payments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>لا توجد دفعات حاليًا</Text>
            <Text style={styles.emptyText}>
              ستظهر هنا جميع الدفعات الخاصة بالمشروع عند إضافتها.
            </Text>
          </View>
        ) : (
          payments.map((payment, index) => (
            <View key={payment.id} style={styles.paymentCard}>
              <View style={styles.paymentHeader}>
                <View style={styles.numberBadge}>
                  <Text style={styles.numberBadgeText}>
                    {payments.length - index}
                  </Text>
                </View>

                <View style={styles.paymentHeaderText}>
                  <Text style={styles.paymentTitle}>دفعة مشروع</Text>
                  <Text style={styles.paymentDate}>
                    {formatDate(payment.payment_date)}
                  </Text>
                </View>
              </View>

              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>المبلغ</Text>
                <Text style={styles.amountValue}>
                  {formatIqd(payment.amount)}
                </Text>
              </View>

              {payment.note ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>الملاحظة</Text>
                  <Text style={styles.noteText}>{payment.note}</Text>
                </View>
              ) : null}

              {payment.created_at ? (
                <Text style={styles.createdText}>
                  تمت الإضافة: {formatDate(payment.created_at)}
                </Text>
              ) : null}
            </View>
          ))
        )}

        <Text style={styles.footerText}>© أزدان للمقاولات العامة</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08111f",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#08111f",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: "#dce6f5",
    fontSize: 15,
    marginTop: 14,
  },
  errorIcon: {
    fontSize: 54,
    marginBottom: 14,
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
  },
  errorText: {
    color: "#aebbd0",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    marginBottom: 24,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#d4a94e",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#07101d",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#31415a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#dce6f5",
    fontSize: 15,
    fontWeight: "700",
  },
  header: {
    backgroundColor: "#0d1a2c",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  backButton: {
    borderWidth: 1,
    borderColor: "#d4a94e",
    borderRadius: 13,
    paddingHorizontal: 17,
    paddingVertical: 10,
  },
  backButtonText: {
    color: "#d4a94e",
    fontSize: 14,
    fontWeight: "800",
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "flex-end",
    marginLeft: 18,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "#9eacc1",
    fontSize: 13,
    marginTop: 5,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#2a3b56",
    borderRadius: 22,
    padding: 20,
  },
  summaryLabel: {
    color: "#9eacc1",
    fontSize: 14,
    textAlign: "right",
  },
  summaryAmount: {
    color: "#d4a94e",
    fontSize: 30,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 8,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#293b55",
    marginVertical: 18,
  },
  summaryBottomRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  summaryCount: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginLeft: 8,
  },
  summaryCountLabel: {
    color: "#aebbd0",
    fontSize: 14,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 24,
    marginBottom: 14,
  },
  emptyCard: {
    minHeight: 260,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#263850",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: 14,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },
  emptyText: {
    color: "#95a5bb",
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
  },
  paymentCard: {
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#263850",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  paymentHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 16,
  },
  numberBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  numberBadgeText: {
    color: "#07101d",
    fontSize: 16,
    fontWeight: "900",
  },
  paymentHeaderText: {
    flex: 1,
    alignItems: "flex-end",
  },
  paymentTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  paymentDate: {
    color: "#8fa0b8",
    fontSize: 12,
    marginTop: 5,
  },
  amountBox: {
    backgroundColor: "#0b1727",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "#22344e",
  },
  amountLabel: {
    color: "#8fa0b8",
    fontSize: 12,
    textAlign: "right",
    marginBottom: 5,
  },
  amountValue: {
    color: "#d4a94e",
    fontSize: 23,
    fontWeight: "900",
    textAlign: "right",
  },
  noteBox: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#263850",
    paddingTop: 14,
  },
  noteLabel: {
    color: "#8fa0b8",
    fontSize: 12,
    textAlign: "right",
    marginBottom: 6,
  },
  noteText: {
    color: "#c4cfde",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
  },
  createdText: {
    color: "#687b95",
    fontSize: 11,
    textAlign: "right",
    marginTop: 13,
  },
  footerText: {
    color: "#6f7f95",
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
});