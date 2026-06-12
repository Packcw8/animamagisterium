import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
    <Screen>
      <View style={styles.header}>
        <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
        <Text style={styles.subtitle}>Enter the first gate</Text>
        <View style={[styles.connection, connectionStatus?.ok ? styles.connected : styles.disconnected]}>
          <Text style={styles.connectionText}>{connectionStatus?.message ?? "Testing Supabase..."}</Text>
        </View>
      </View>

      <Frame style={styles.card}>
        <Text style={styles.cardTitle}>{mode === "signin" ? "User Login" : "Create Account"}</Text>
        <Text style={styles.copy}>Save your character, avatar choices, and progression to Supabase.</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="email"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="password"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <Pressable style={styles.primaryButton} onPress={() => void handleSubmit()} disabled={isLoading || !email || !password}>
          {isLoading ? <ActivityIndicator color="#120e08" /> : <Text style={styles.primaryText}>{mode === "signin" ? "Sign In" : "Sign Up"}</Text>}
        </Pressable>

        <Pressable style={styles.switchButton} onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
          <Text style={styles.switchText}>{mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}</Text>
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Frame>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 34,
    paddingHorizontal: 18,
    paddingBottom: 24,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 24,
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 6,
  },
  connection: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
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
    margin: 18,
    padding: 18,
    gap: 12,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 27,
    fontWeight: "800",
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
    marginBottom: 4,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 6,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
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
  },
  message: {
    color: colors.text,
    lineHeight: 20,
  },
});
