import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useOffline } from "../services/network";

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  const offline = useOffline();
  return (
    <View style={styles.screen}>
      {offline ? <Text style={styles.offline}>No network connection to the API.</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

export function Field({ value, onChangeText, placeholder, secure }: { value: string; onChangeText: (value: string) => void; placeholder: string; secure?: boolean }) {
  return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} secureTextEntry={secure} autoCapitalize="none" style={styles.input} />;
}

export function PasswordField({ value, onChangeText, placeholder = "Password" }: { value: string; onChangeText: (value: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.passwordWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={!visible}
        autoCapitalize="none"
        style={styles.passwordInput}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        onPress={() => setVisible((current) => !current)}
        style={styles.eyeButton}
      >
        <Text style={styles.eyeText}>{visible ? "🙈" : "👁"}</Text>
      </Pressable>
    </View>
  );
}

export function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={styles.button} disabled={disabled} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function Loading() {
  return <ActivityIndicator style={styles.gap} />;
}

export function ErrorText({ message }: { message: string }) {
  return <Text style={styles.error}>{message}</Text>;
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function Muted({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, backgroundColor: "#f4f1ea" },
  title: { fontSize: 26, fontWeight: "600", marginBottom: 12 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, marginBottom: 10 },
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 10,
  },
  passwordInput: { flex: 1, padding: 12 },
  eyeButton: { paddingHorizontal: 12, paddingVertical: 12 },
  eyeText: { color: "#1c1915", fontWeight: "600" },
  button: { backgroundColor: "#1c1915", borderRadius: 8, padding: 14, marginTop: 8 },
  buttonText: { color: "#fff", textAlign: "center" },
  error: { color: "#9f1239", marginVertical: 8 },
  empty: { color: "#444", marginVertical: 8 },
  offline: { backgroundColor: "#7f1d1d", color: "#fff", padding: 8, marginBottom: 8 },
  gap: { marginVertical: 16 },
});
