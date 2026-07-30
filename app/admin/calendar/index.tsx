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

type Client = {
  id: number;
  name: string;
  project_name: string;
};

type ProjectEvent = {
  id: number;
  client_id: number | null;
  title: string;
  event_type: string | null;
  event_date: string;
  notes: string | null;
  clients?: {
    name?: string | null;
    project_name?: string | null;
  } | null;
};

const EVENT_TYPES = [
  { value: "general", label: "عام", icon: "📌" },
  { value: "delivery", label: "تسليم", icon: "🏗️" },
  { value: "payment", label: "دفعة", icon: "💰" },
  { value: "visit", label: "زيارة موقع", icon: "🚗" },
  { value: "meeting", label: "اجتماع", icon: "🤝" },
];

function eventTypeLabel(value?: string | null) {
  return EVENT_TYPES.find((item) => item.value === value)?.label || "عام";
}

function eventTypeIcon(value?: string | null) {
  return EVENT_TYPES.find((item) => item.value === value)?.icon || "📌";
}

function toInputDate(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  try {
    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export default function AdminCalendarPage() {
  const router = useRouter();

  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("general");
  const [eventDate, setEventDate] = useState(toInputDate());
  const [notes, setNotes] = useState("");
  const [clientId, setClientId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const [eventsResult, clientsResult] = await Promise.all([
        supabase
          .from("project_events")
          .select(
            "id, client_id, title, event_type, event_date, notes, clients(name, project_name)"
          )
          .order("event_date", { ascending: true }),
        supabase
          .from("clients")
          .select("id, name, project_name")
          .order("name", { ascending: true }),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (clientsResult.error) throw clientsResult.error;

      setEvents((eventsResult.data ?? []) as unknown as ProjectEvent[]);
      setClients((clientsResult.data ?? []) as Client[]);
    } catch (err: any) {
      setError(
        err?.message?.includes("project_events")
          ? "جدول project_events غير موجود. شغّل ملف SQL الموجود داخل الحزمة."
          : err?.message || "تعذر تحميل المواعيد."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function saveEvent() {
    if (!title.trim()) {
      Alert.alert("تنبيه", "اكتب عنوان الموعد.");
      return;
    }

    const parsedDate = new Date(eventDate);
    if (Number.isNaN(parsedDate.getTime())) {
      Alert.alert("تنبيه", "صيغة التاريخ غير صحيحة.");
      return;
    }

    try {
      setSaving(true);

      const { error: insertError } = await supabase
        .from("project_events")
        .insert({
          client_id: clientId,
          title: title.trim(),
          event_type: eventType,
          event_date: parsedDate.toISOString(),
          notes: notes.trim() || null,
        });

      if (insertError) throw insertError;

      setTitle("");
      setNotes("");
      setClientId(null);
      setEventType("general");
      setEventDate(toInputDate());
      setFormVisible(false);
      await loadData();
    } catch (err: any) {
      Alert.alert("خطأ", err?.message || "تعذر حفظ الموعد.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: number) {
    Alert.alert("حذف الموعد", "هل تريد حذف هذا الموعد؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          const { error: deleteError } = await supabase
            .from("project_events")
            .delete()
            .eq("id", id);

          if (deleteError) {
            Alert.alert("خطأ", deleteError.message);
            return;
          }

          setEvents((current) => current.filter((item) => item.id !== id));
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#d4a94e" />
        <Text style={styles.loadingText}>جاري تحميل المواعيد...</Text>
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
          <Text style={styles.title}>التقويم والمواعيد</Text>
          <Text style={styles.subtitle}>التسليم والدفعات والزيارات</Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setFormVisible(true)}
        >
          <Text style={styles.addButtonText}>＋</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor="#d4a94e"
          />
        }
      >
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{events.length}</Text>
          <Text style={styles.summaryLabel}>إجمالي المواعيد المسجلة</Text>
        </View>

        {events.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>لا توجد مواعيد</Text>
            <Text style={styles.emptyText}>
              اضغط زر الإضافة لإنشاء أول موعد.
            </Text>
          </View>
        ) : (
          events.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              onLongPress={() => deleteEvent(event.id)}
            >
              <View style={styles.eventIconBox}>
                <Text style={styles.eventIcon}>
                  {eventTypeIcon(event.event_type)}
                </Text>
              </View>

              <View style={styles.eventInfo}>
                <View style={styles.eventTopRow}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>
                      {eventTypeLabel(event.event_type)}
                    </Text>
                  </View>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                </View>

                <Text style={styles.eventDate}>
                  {formatDate(event.event_date)}
                </Text>

                {event.clients ? (
                  <Text style={styles.clientText}>
                    {event.clients.name || "عميل"} —{" "}
                    {event.clients.project_name || "مشروع"}
                  </Text>
                ) : null}

                {event.notes ? (
                  <Text style={styles.notesText}>{event.notes}</Text>
                ) : null}

                <Text style={styles.hintText}>اضغط مطولًا للحذف</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal
        visible={formVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFormVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setFormVisible(false)}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>إضافة موعد جديد</Text>
              </View>

              <Text style={styles.label}>عنوان الموعد</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="مثال: زيارة موقع المشروع"
                placeholderTextColor="#66768c"
                textAlign="right"
              />

              <Text style={styles.label}>نوع الموعد</Text>
              <View style={styles.optionsWrap}>
                {EVENT_TYPES.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.optionButton,
                      eventType === item.value && styles.optionButtonActive,
                    ]}
                    onPress={() => setEventType(item.value)}
                  >
                    <Text style={styles.optionText}>
                      {item.icon} {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>العميل والمشروع</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.clientOptions}
              >
                <TouchableOpacity
                  style={[
                    styles.clientOption,
                    clientId === null && styles.clientOptionActive,
                  ]}
                  onPress={() => setClientId(null)}
                >
                  <Text style={styles.clientOptionText}>بدون عميل</Text>
                </TouchableOpacity>

                {clients.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    style={[
                      styles.clientOption,
                      clientId === client.id && styles.clientOptionActive,
                    ]}
                    onPress={() => setClientId(client.id)}
                  >
                    <Text style={styles.clientOptionText}>
                      {client.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>التاريخ والوقت</Text>
              <TextInput
                style={styles.input}
                value={eventDate}
                onChangeText={setEventDate}
                placeholder="2026-07-25T15:00"
                placeholderTextColor="#66768c"
                autoCapitalize="none"
              />

              <Text style={styles.dateHint}>
                الصيغة: 2026-07-25T15:00
              </Text>

              <Text style={styles.label}>ملاحظات</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="ملاحظات اختيارية"
                placeholderTextColor="#66768c"
                multiline
                textAlignVertical="top"
                textAlign="right"
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveEvent}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#08111f" />
                ) : (
                  <Text style={styles.saveButtonText}>حفظ الموعد</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
  headerText: { flex: 1, alignItems: "flex-end", paddingHorizontal: 12 },
  title: { color: "#fff", fontSize: 19, fontWeight: "900" },
  subtitle: { color: "#8291a6", fontSize: 10, marginTop: 4 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: { color: "#08111f", fontSize: 25, fontWeight: "900" },
  content: { padding: 16, paddingBottom: 50 },
  errorBox: {
    backgroundColor: "#40251f",
    borderRadius: 15,
    padding: 14,
    marginBottom: 14,
  },
  errorText: { color: "#ffb5a7", textAlign: "right", lineHeight: 20 },
  summaryCard: {
    backgroundColor: "#111f33",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#263852",
    padding: 18,
    alignItems: "center",
    marginBottom: 14,
  },
  summaryNumber: { color: "#d4a94e", fontSize: 32, fontWeight: "900" },
  summaryLabel: { color: "#9ba9bb", fontSize: 11, marginTop: 5 },
  emptyCard: {
    backgroundColor: "#111f33",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
  },
  emptyIcon: { fontSize: 42 },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 12 },
  emptyText: { color: "#8796aa", marginTop: 7, textAlign: "center" },
  eventCard: {
    backgroundColor: "#111f33",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#263852",
    padding: 13,
    marginBottom: 11,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  eventIconBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
  },
  eventIcon: { fontSize: 21 },
  eventInfo: { flex: 1, paddingLeft: 12, alignItems: "flex-end" },
  eventTopRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    flex: 1,
    textAlign: "right",
  },
  typeBadge: {
    backgroundColor: "#20334e",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    marginRight: 8,
  },
  typeBadgeText: { color: "#d4a94e", fontSize: 9, fontWeight: "900" },
  eventDate: { color: "#9ba9bb", fontSize: 10, marginTop: 8 },
  clientText: { color: "#d4a94e", fontSize: 10, marginTop: 7 },
  notesText: { color: "#a9b5c6", fontSize: 10, lineHeight: 17, marginTop: 7 },
  hintText: { color: "#52637a", fontSize: 8, marginTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "92%",
    backgroundColor: "#0d1a2c",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  closeText: { color: "#fff", fontSize: 20 },
  label: {
    color: "#d7deea",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 7,
    marginTop: 12,
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#30425e",
    color: "#fff",
    paddingHorizontal: 13,
  },
  notesInput: { minHeight: 95, paddingTop: 13 },
  dateHint: { color: "#66768c", fontSize: 9, textAlign: "right", marginTop: 5 },
  optionsWrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  optionButton: {
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#30425e",
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  optionButtonActive: { borderColor: "#d4a94e", backgroundColor: "#342c1d" },
  optionText: { color: "#fff", fontSize: 10 },
  clientOptions: { gap: 8, paddingVertical: 2 },
  clientOption: {
    backgroundColor: "#111f33",
    borderWidth: 1,
    borderColor: "#30425e",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clientOptionActive: { borderColor: "#d4a94e", backgroundColor: "#342c1d" },
  clientOptionText: { color: "#fff", fontSize: 10 },
  saveButton: {
    minHeight: 53,
    borderRadius: 15,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    marginBottom: 24,
  },
  saveButtonText: { color: "#08111f", fontSize: 14, fontWeight: "900" },
});
