"use client";

import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type AdminClient = {
  id: number;
  name: string;
  phone: string | null;
  project_name: string;
  progress: number | null;
  status: string | null;
  access_code?: string | null;
  created_at?: string | null;
};

type Props = {
  client: AdminClient;
  onPress: () => void;
};

function getStatusStyle(status?: string | null) {
  const value = (status || "قيد التنفيذ").trim();

  if (value.includes("مكتمل")) {
    return {
      label: value,
      backgroundColor: "rgba(34,197,94,0.14)",
      borderColor: "rgba(34,197,94,0.35)",
      color: "#4ADE80",
    };
  }

  if (value.includes("مراجعة")) {
    return {
      label: value,
      backgroundColor: "rgba(245,158,11,0.14)",
      borderColor: "rgba(245,158,11,0.35)",
      color: "#FBBF24",
    };
  }

  if (value.includes("متوقف")) {
    return {
      label: value,
      backgroundColor: "rgba(239,68,68,0.14)",
      borderColor: "rgba(239,68,68,0.35)",
      color: "#F87171",
    };
  }

  return {
    label: value,
    backgroundColor: "rgba(22,163,74,0.14)",
    borderColor: "rgba(34,197,94,0.3)",
    color: "#4ADE80",
  };
}

export default function ClientCard({ client, onPress }: Props) {
  const progress = Math.min(100, Math.max(0, Number(client.progress ?? 0)));
  const statusStyle = getStatusStyle(client.status);
  const initial = client.name?.trim()?.charAt(0) || "ع";

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.84} onPress={onPress}>
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.mainInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {client.name}
          </Text>

          <View style={styles.projectRow}>
            <Ionicons name="business-outline" size={14} color="#94A3B8" />
            <Text style={styles.project} numberOfLines={1}>
              {client.project_name || "بدون اسم مشروع"}
            </Text>
          </View>
        </View>

        <View style={styles.arrowBox}>
          <Ionicons name="chevron-back" size={18} color="#86EFAC" />
        </View>
      </View>

      <View style={styles.progressHeader}>
        <Text style={styles.progressValue}>{progress}%</Text>
        <Text style={styles.progressLabel}>نسبة الإنجاز</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.phoneRow}>
          <Ionicons name="call-outline" size={14} color="#64748B" />
          <Text style={styles.phone} numberOfLines={1}>
            {client.phone || "بدون رقم هاتف"}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: statusStyle.backgroundColor,
              borderColor: statusStyle.borderColor,
            },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: statusStyle.color }]} />
          <Text style={[styles.statusText, { color: statusStyle.color }]}>
            {statusStyle.label}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#142131",
    borderWidth: 1,
    borderColor: "#243447",
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 3,
  },
  topRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(34,197,94,0.14)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#86EFAC",
    fontSize: 19,
    fontWeight: "900",
  },
  mainInfo: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 12,
  },
  name: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },
  projectRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginTop: 7,
    gap: 6,
    maxWidth: "100%",
  },
  project: {
    color: "#94A3B8",
    fontSize: 12,
    textAlign: "right",
    flexShrink: 1,
  },
  arrowBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#1B2A3B",
    alignItems: "center",
    justifyContent: "center",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  progressValue: {
    color: "#4ADE80",
    fontSize: 12,
    fontWeight: "900",
  },
  progressLabel: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "700",
  },
  progressTrack: {
    height: 7,
    borderRadius: 7,
    backgroundColor: "#213044",
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 7,
    backgroundColor: "#22C55E",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 10,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  phone: {
    color: "#64748B",
    fontSize: 11,
    flexShrink: 1,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "900",
  },
});
