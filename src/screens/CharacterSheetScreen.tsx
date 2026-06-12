import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Frame } from "../components/Frame";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { supabase } from "../lib/supabase";
import { CharacterWithDetails } from "../services/characterService";

type CharacterSheetScreenProps = {
  character: CharacterWithDetails;
  onRefresh: () => void;
};

const attributeKeys = ["strength", "endurance", "knowledge", "craft", "wealth", "influence", "exploration", "spirit"] as const;

export function CharacterSheetScreen({ character, onRefresh }: CharacterSheetScreenProps) {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
        <Text style={styles.subtitle}>Character Sheet</Text>
      </View>

      <Frame style={styles.heroCard}>
        <View style={styles.avatarPreview}>
          {character.portrait_url ? (
            <Image source={{ uri: character.portrait_url }} style={styles.portrait} />
          ) : (
            <>
              <Text style={styles.avatarInitial}>{character.name.slice(0, 1).toUpperCase()}</Text>
              <Text style={styles.avatarMeta}>No portrait</Text>
            </>
          )}
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>{character.name}</Text>
          <Text style={styles.line}>{character.gender ?? "Unknown"} {character.ancestry ?? "Adventurer"}</Text>
          <Text style={styles.line}>{character.homeland ?? "Unknown Homeland"}</Text>
          <Text style={styles.line}>{character.origin ?? "Unknown Origin"} / {character.path ?? "Unknown Path"}</Text>
          <Text style={styles.trait}>{character.trait ?? "No trait selected"}</Text>
          <View style={styles.statStrip}>
            <Text style={styles.gold}>{character.gold} gold</Text>
            <Text style={styles.level}>Level {character.level}</Text>
          </View>
          <Text style={styles.xp}>{character.xp.toLocaleString()} XP</Text>
          <ProgressBar value={character.xp % 1000} max={1000} color={colors.blue} height={9} />
        </View>
      </Frame>

      <Frame style={styles.section}>
        <Text style={styles.sectionTitle}>Identity</Text>
        <InfoRow label="Gender" value={character.gender ?? "Not set"} />
        <InfoRow label="Ancestry" value={character.ancestry ?? "Not set"} />
        <InfoRow label="Homeland" value={character.homeland ?? "Not set"} />
        <InfoRow label="Origin" value={character.origin ?? "Not set"} />
        <InfoRow label="Path" value={character.path ?? "Not set"} />
        <InfoRow label="Trait" value={character.trait ?? "Not set"} />
      </Frame>

      <Frame style={styles.section}>
        <Text style={styles.sectionTitle}>Attributes</Text>
        <View style={styles.attributeGrid}>
          {attributeKeys.map((key) => (
            <View key={key} style={styles.attribute}>
              <Text style={styles.attributeName}>{key}</Text>
              <Text style={styles.attributeValue}>{character.attributes?.[key] ?? 0}</Text>
            </View>
          ))}
        </View>
      </Frame>

      <Frame style={styles.section}>
        <Text style={styles.sectionTitle}>Selected Appearance</Text>
        {(["base", "face", "hair", "armor", "weapon", "cloak"] as const).map((type) => (
          <View key={type} style={styles.appearanceRow}>
            <Text style={styles.appearanceType}>{type}</Text>
            <Text style={styles.appearanceValue}>{character.appearanceAssets[type]?.name ?? "Not selected"}</Text>
          </View>
        ))}
        <Pressable style={styles.editButton} onPress={onRefresh}>
          <Text style={styles.editText}>Edit Appearance Later</Text>
        </Pressable>
      </Frame>

      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={onRefresh}>
          <Text style={styles.secondaryText}>Reload Character</Text>
        </Pressable>
        <Pressable style={styles.signOutButton} onPress={() => void supabase.auth.signOut()}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.appearanceRow}>
      <Text style={styles.appearanceType}>{label}</Text>
      <Text style={styles.appearanceValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 22,
    paddingHorizontal: 18,
    paddingBottom: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 23,
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.blue,
    marginTop: 8,
    fontWeight: "800",
  },
  heroCard: {
    margin: 14,
    padding: 14,
    flexDirection: "row",
    gap: 14,
  },
  avatarPreview: {
    width: 132,
    minHeight: 176,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(9, 24, 34, 0.9)",
    overflow: "hidden",
  },
  portrait: {
    width: "100%",
    height: "100%",
  },
  avatarInitial: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 56,
  },
  avatarMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 8,
  },
  identity: {
    flex: 1,
    gap: 8,
  },
  name: {
    color: colors.text,
    fontSize: 29,
    fontWeight: "900",
  },
  line: {
    color: colors.gold,
  },
  trait: {
    color: colors.blue,
    fontWeight: "800",
  },
  statStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  gold: {
    color: colors.gold,
  },
  level: {
    color: colors.text,
    fontWeight: "800",
  },
  xp: {
    color: colors.muted,
  },
  section: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 14,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  attributeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  attribute: {
    width: "48%",
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  attributeName: {
    color: colors.muted,
    textTransform: "capitalize",
  },
  attributeValue: {
    color: colors.gold,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4,
  },
  appearanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  appearanceType: {
    color: colors.muted,
    textTransform: "capitalize",
  },
  appearanceValue: {
    color: colors.text,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  editButton: {
    marginTop: 14,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 6,
    borderColor: colors.borderSoft,
  },
  editText: {
    color: colors.blue,
    fontWeight: "800",
  },
  actions: {
    marginHorizontal: 14,
    marginBottom: 18,
    gap: 10,
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "rgba(30, 168, 236, 0.84)",
  },
  secondaryText: {
    color: "#031018",
    fontWeight: "900",
  },
  signOutButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: {
    color: colors.muted,
    fontWeight: "700",
  },
});
