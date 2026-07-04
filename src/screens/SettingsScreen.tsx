import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { supabase } from "../lib/supabase";
import type { CharacterWithDetails } from "../services/characterService";
import { getCurrentRole, Role } from "../services/mapService";

type SettingsScreenProps = {
  character: CharacterWithDetails;
  onBack: () => void;
  onOpenAdmin?: () => void;
};

export function SettingsScreen({ character, onBack, onOpenAdmin }: SettingsScreenProps) {
  const [email, setEmail] = useState<string>("Unknown account");
  const [role, setRole] = useState<Role>("player");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? "Unknown account"));
    getCurrentRole().then(setRole).catch(() => setRole("player"));
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <BrandLogo size={54} />
        <View style={styles.headerText}>
          <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
          <Text style={styles.subtitle}>Settings</Text>
        </View>
      </View>

      <Frame style={styles.card}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.description}>Manage account settings, app preferences, privacy controls, support, and sign out.</Text>
      </Frame>

      <Frame style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Info label="Email" value={email} />
        <Info label="Character" value={character.name} />
        <Info label="Role" value={role} />
        <Info label="Portrait" value={character.portrait_url ? "Generated" : "Missing"} />
      </Frame>

      <Frame style={styles.card}>
        <Text style={styles.sectionTitle}>App Preferences</Text>
        <Text style={styles.description}>Notification, privacy, support, and gameplay preferences can expand here as the app grows.</Text>
      </Frame>

      {role === "admin" && onOpenAdmin ? (
        <Frame style={styles.card}>
          <Text style={styles.sectionTitle}>Admin</Text>
          <Text style={styles.description}>Open the dedicated admin hub for content, systems, maps, and publishing tools.</Text>
          <Pressable style={styles.adminButton} onPress={onOpenAdmin}>
            <Text style={styles.adminButtonText}>Open Admin Hub</Text>
          </Pressable>
        </Frame>
      ) : null}

      <Frame style={styles.card}>
        <Text style={styles.sectionTitle}>Session</Text>
        <Pressable style={styles.signOutButton} onPress={() => void supabase.auth.signOut()}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </Frame>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  backButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: colors.blue,
    fontWeight: "900",
  },
  headerText: {
    flex: 1,
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 3,
  },
  card: {
    margin: 12,
    padding: 16,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 28,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 20,
  },
  description: {
    color: colors.muted,
    lineHeight: 21,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderColor: colors.borderSoft,
    paddingTop: 10,
  },
  infoLabel: {
    color: colors.muted,
  },
  infoValue: {
    color: colors.text,
    flex: 1,
    textAlign: "right",
    fontWeight: "800",
  },
  signOutButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  adminButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(30, 168, 236, 0.16)",
  },
  adminButtonText: {
    color: colors.blue,
    fontWeight: "900",
  },
  signOutText: {
    color: "#120e08",
    fontWeight: "900",
  },
});
