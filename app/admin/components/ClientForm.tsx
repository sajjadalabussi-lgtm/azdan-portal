"use client";

import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export type ClientFormValues = {
  name: string;
  phone: string;
  project_name: string;
  progress: string;
  status: string;
  access_code: string;
};

type Props = {
  initialValues?: Partial<ClientFormValues>;
  submitTitle: string;
  loading?: boolean;
  onSubmit: (values: ClientFormValues) => Promise<void> | void;
};

const defaultValues: ClientFormValues = {
  name: "",
  phone: "",
  project_name: "",
  progress: "0",
  status: "قيد التنفيذ",
  access_code: "",
};

const statuses = [
  "قيد التنفيذ",
  "متوقف مؤقتًا",
  "قيد المراجعة",
  "مكتمل",
];

function normalizeProgress(value: string) {
  const numeric = Number(value.replace(/[^\d.]/g, ""));

  if (!Number.isFinite(numeric)) return 0;

  return Math.min(100, Math.max(0, Math.round(numeric)));
}

export default function ClientForm({
  initialValues,
  submitTitle,
  loading = false,
  onSubmit,
}: Props) {
  const mergedValues = useMemo(
    () => ({ ...defaultValues, ...initialValues }),
    [initialValues]
  );

  const [name, setName] = useState(mergedValues.name);
  const [phone, setPhone] = useState(mergedValues.phone);
  const [projectName, setProjectName] = useState(
    mergedValues.project_name
  );
  const [progress, setProgress] = useState(
    mergedValues.progress
  );
  const [status, setStatus] = useState(mergedValues.status);
  const [accessCode, setAccessCode] = useState(
    mergedValues.access_code
  );

  const validateAndSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("تنبيه", "أدخل اسم العميل");
      return;
    }

    if (!projectName.trim()) {
      Alert.alert("تنبيه", "أدخل اسم المشروع");
      return;
    }

    if (!phone.trim()) {
      Alert.alert("تنبيه", "أدخل رقم هاتف العميل");
      return;
    }

    if (!accessCode.trim()) {
      Alert.alert("تنبيه", "أدخل رمز دخول العميل");
      return;
    }

    await onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      project_name: projectName.trim(),
      progress: String(normalizeProgress(progress)),
      status: status.trim() || "قيد التنفيذ",
      access_code: accessCode.trim(),
    });
  };

  return (
    <View style={styles.form}>
      <FormInput
        label="اسم العميل"
        value={name}
        onChangeText={setName}
        placeholder="مثال: أحمد محمد"
      />

      <FormInput
        label="رقم الهاتف"
        value={phone}
        onChangeText={setPhone}
        placeholder="07XXXXXXXXX"
        keyboardType="phone-pad"
      />

      <FormInput
        label="اسم المشروع"
        value={projectName}
        onChangeText={setProjectName}
        placeholder="مثال: إنشاء منزل سكني"
      />

      <FormInput
        label="نسبة الإنجاز"
        value={progress}
        onChangeText={setProgress}
        placeholder="0 إلى 100"
        keyboardType="numeric"
      />

      <Text style={styles.label}>حالة المشروع</Text>

      <View style={styles.statusGrid}>
        {statuses.map((item) => {
          const active = status === item;

          return (
            <TouchableOpacity
              key={item}
              style={[
                styles.statusButton,
                active && styles.statusButtonActive,
              ]}
              onPress={() => setStatus(item)}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  active && styles.statusButtonTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FormInput
        label="رمز دخول العميل"
        value={accessCode}
        onChangeText={setAccessCode}
        placeholder="مثال: AZDAN2026"
        autoCapitalize="characters"
      />

      <TouchableOpacity
        style={[
          styles.submitButton,
          loading && styles.disabledButton,
        ]}
        disabled={loading}
        onPress={validateAndSubmit}
      >
        {loading ? (
          <ActivityIndicator color="#07101d" />
        ) : (
          <Text style={styles.submitText}>{submitTitle}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "sentences",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#718198"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        textAlign="right"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 14,
  },
  label: {
    color: "#d9e1ec",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 7,
  },
  input: {
    minHeight: 52,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    borderRadius: 14,
    color: "#ffffff",
    paddingHorizontal: 14,
  },
  statusGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 9,
  },
  statusButton: {
    minWidth: "47%",
    flexGrow: 1,
    minHeight: 43,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  statusButtonActive: {
    backgroundColor: "#d4a94e",
    borderColor: "#d4a94e",
  },
  statusButtonText: {
    color: "#bec9d8",
    fontSize: 12,
    fontWeight: "700",
  },
  statusButtonTextActive: {
    color: "#07101d",
    fontWeight: "900",
  },
  submitButton: {
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: "#d4a94e",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  disabledButton: {
    opacity: 0.65,
  },
  submitText: {
    color: "#07101d",
    fontSize: 15,
    fontWeight: "900",
  },
});
