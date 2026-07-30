"use client";

import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
};

export default function SearchBar({
  value,
  onChangeText,
  onClear,
  placeholder = "ابحث...",
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⌕</Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#718198"
        textAlign="right"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {value ? (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={onClear}
        >
          <Text style={styles.clearText}>×</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#2b3d58",
    borderRadius: 15,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 13,
  },
  icon: {
    color: "#d4a94e",
    fontSize: 25,
    marginLeft: 10,
  },
  input: {
    flex: 1,
    color: "#ffffff",
    minHeight: 50,
    paddingHorizontal: 4,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#172841",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  clearText: {
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 24,
  },
});
