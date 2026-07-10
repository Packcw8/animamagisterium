import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { supabase } from "../lib/supabase";

type AuthScreenProps = {
  connectionStatus: {
    ok: boolean;
    message: string;
  } | null;
};

export function AuthScreen({ connectionStatus }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setIsLoading(true);
    setMessage(null);

    try {
      const credentials = {
        email: email.trim(),
        password,
      };

      const { error } =
        mode === "signin"
          ? await supabase.auth.signInWithPassword(credentials)
          : await supabase.auth.signUp(credentials);

      if (error) {
        throw error;
      }

      setMessage(mode === "signup" ? "Account created. Check your email if confirmation is enabled." : "Signed in.");
    } catch (authError) {
      setMessage(authError instanceof Error ? authError.message : "Unable to authenticate.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardWrap}>
        <ScrollView
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <BrandLogo size={70} />
            <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
            <Text style={styles.subtitle}>Enter the first gate</Text>
            <View style={[styles.connection, connectionStatus?.ok ? styles.connected : styles.disconnected]}>
              <Text style={styles.connectionText}>{connectionStatus?.message ?? "Testing Supabase..."}</Text>
            </View>
          </View>

          <Frame style={styles.card}>
            <View style={styles.cardHeadingRow}>
              <Text style={styles.cardTitle}>{mode === "signin" ? "Sign In" : "Create Account"}</Text>
              <Text style={styles.cardBadge}>{mode === "signin" ? "RETURN" : "NEW"}</Text>
            </View>
            <Text style={styles.copy}>Save your character, portrait, inventory, and journey progress.</Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!isLoading}
              keyboardType="email-address"
              returnKeyType="next"
              textContentType="emailAddress"
              placeholder="Email"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              editable={!isLoading}
              returnKeyType="done"
              secureTextEntry
              textContentType={mode === "signin" ? "password" : "newPassword"}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />

            <Pressable style={[styles.primaryButton, (isLoading || !email || !password) && styles.disabledButton]} onPress={() => void handleSubmit()} disabled={isLoading || !email || !password}>
              {isLoading ? <ActivityIndicator color="#120e08" /> : <Text style={styles.primaryText}>{mode === "signin" ? "Sign In" : "Sign Up"}</Text>}
            </Pressable>

            <Pressable style={styles.switchButton} onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
              <Text style={styles.switchText}>{mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}</Text>
            </Pressable>

            {message ? <Text style={styles.message}>{message}</Text> : null}
          </Frame>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 18,
  },
  header: {
    paddingTop: 8,
    paddingHorizontal: 18,
    paddingBottom: 16,
    alignItems: "center",
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 23,
    letterSpacing: 0,
    marginTop: 10,
    textAlign: "center",
  },
  subtitle: {
    color: colors.muted,
    marginTop: 5,
  },
  connection: {
    marginTop: 12,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "100%",
  },
  connected: {
    borderColor: "rgba(64, 210, 68, 0.55)",
    backgroundColor: "rgba(20, 72, 34, 0.65)",
  },
  disconnected: {
    borderColor: "rgba(221, 78, 64, 0.55)",
    backgroundColor: "rgba(76, 24, 20, 0.65)",
  },
  connectionText: {
    color: colors.text,
    fontSize: 12,
    textAlign: "center",
  },
  card: {
    marginHorizontal: 10,
    marginBottom: 20,
    padding: 16,
    gap: 12,
  },
  cardHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
  },
  cardBadge: {
    color: colors.gold,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "900",
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
    marginBottom: 2,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: "rgba(0,0,0,0.3)",
    fontSize: 16,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  disabledButton: {
    opacity: 0.52,
  },
  primaryText: {
    color: "#120e08",
    fontWeight: "900",
  },
  switchButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  switchText: {
    color: colors.blue,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    color: colors.text,
    lineHeight: 20,
    textAlign: "center",
  },
});
