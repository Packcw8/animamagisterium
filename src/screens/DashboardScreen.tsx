import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Frame } from "../components/Frame";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import {
  CharacterDashboardData,
  createCharacter,
  loadCharacter,
  updateCharacterAttributes,
  updateCharacterXp,
} from "../services/characterService";

type DashboardScreenProps = {
  connectionStatus: {
    ok: boolean;
    message: string;
  } | null;
};

const attributeKeys = ["strength", "endurance", "knowledge", "craft", "wealth", "influence"] as const;

export function DashboardScreen({ connectionStatus }: DashboardScreenProps) {
  const [character, setCharacter] = useState<CharacterDashboardData | null>(null);
  const [name, setName] = useState("Cody Pack");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshCharacter() {
    setIsLoading(true);
    setError(null);

    try {
      setCharacter(await loadCharacter());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load character.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateCharacter() {
    setIsSaving(true);
    setError(null);

    try {
      setCharacter(await createCharacter(name.trim() || "Adventurer"));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create character.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGainXp() {
    if (!character) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      setCharacter(await updateCharacterXp(character.id, character.xp + 125));
    } catch (xpError) {
      setError(xpError instanceof Error ? xpError.message : "Unable to update XP.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTrainAttribute(attribute: (typeof attributeKeys)[number]) {
    if (!character) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const nextAttributes = await updateCharacterAttributes(character.id, {
        [attribute]: character.attributes[attribute] + 1,
      });

      setCharacter({
        ...character,
        attributes: nextAttributes,
      });
    } catch (attributeError) {
      setError(attributeError instanceof Error ? attributeError.message : "Unable to update attributes.");
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    void refreshCharacter();
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
        <Text style={styles.kicker}>Supabase Character Dashboard</Text>
        <View style={[styles.connectionPill, connectionStatus?.ok ? styles.connected : styles.disconnected]}>
          <Text style={styles.connectionText}>{connectionStatus?.message ?? "Testing Supabase..."}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.loadingText}>Loading character...</Text>
        </View>
      ) : character ? (
        <Frame style={styles.characterCard}>
          <Text style={styles.cardLabel}>Character Name</Text>
          <Text style={styles.characterName}>{character.name}</Text>

          <View style={styles.levelRow}>
            <View>
              <Text style={styles.cardLabel}>Level</Text>
              <Text style={styles.bigNumber}>{character.level}</Text>
            </View>
            <View style={styles.xpPanel}>
              <Text style={styles.cardLabel}>XP</Text>
              <Text style={styles.xpText}>{character.xp.toLocaleString()}</Text>
              <ProgressBar value={character.xp % 1000} max={1000} color={colors.blue} height={9} />
            </View>
          </View>

          <View style={styles.attributesGrid}>
            {attributeKeys.map((attribute) => (
              <Pressable
                key={attribute}
                style={styles.attributeTile}
                onPress={() => void handleTrainAttribute(attribute)}
                disabled={isSaving}
              >
                <Text style={styles.attributeName}>{attribute}</Text>
                <Text style={styles.attributeValue}>{character.attributes[attribute]}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.primaryButton} onPress={() => void handleGainXp()} disabled={isSaving}>
              <Text style={styles.primaryButtonText}>{isSaving ? "Saving..." : "Gain 125 XP"}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => void refreshCharacter()}>
              <Text style={styles.secondaryButtonText}>Reload</Text>
            </Pressable>
          </View>
        </Frame>
      ) : (
        <Frame style={styles.createCard}>
          <Text style={styles.createTitle}>Create Your Character</Text>
          <Text style={styles.createCopy}>Start a persistent Supabase-backed character for this device.</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Character name"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable style={styles.primaryButton} onPress={() => void handleCreateCharacter()} disabled={isSaving}>
            <Text style={styles.primaryButtonText}>{isSaving ? "Creating..." : "Create Character"}</Text>
          </Pressable>
        </Frame>
      )}

      {error ? (
        <Frame style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </Frame>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
    letterSpacing: 0,
    textAlign: "center",
  },
  kicker: {
    color: colors.muted,
    textAlign: "center",
    marginTop: 6,
  },
  connectionPill: {
    alignSelf: "center",
    marginTop: 14,
    maxWidth: "100%",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  loading: {
    paddingTop: 80,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
  },
  characterCard: {
    margin: 18,
    padding: 18,
    gap: 16,
  },
  cardLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: "uppercase",
  },
  characterName: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "700",
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 18,
  },
  bigNumber: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 54,
    lineHeight: 60,
  },
  xpPanel: {
    flex: 1,
    gap: 8,
  },
  xpText: {
    color: colors.text,
    fontSize: 20,
  },
  attributesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  attributeTile: {
    width: "48%",
    minHeight: 74,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(4, 6, 8, 0.45)",
  },
  attributeName: {
    color: colors.muted,
    textTransform: "capitalize",
    fontSize: 12,
  },
  attributeValue: {
    color: colors.gold,
    fontSize: 28,
    marginTop: 6,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  primaryButtonText: {
    color: "#130f08",
    fontWeight: "800",
  },
  secondaryButton: {
    width: 96,
    minHeight: 48,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  secondaryButtonText: {
    color: colors.gold,
    fontWeight: "700",
  },
  createCard: {
    margin: 18,
    padding: 18,
    gap: 14,
  },
  createTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "700",
  },
  createCopy: {
    color: colors.muted,
    lineHeight: 20,
  },
  input: {
    minHeight: 50,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  errorBox: {
    marginHorizontal: 18,
    marginBottom: 18,
    padding: 14,
    borderColor: "rgba(221, 78, 64, 0.6)",
  },
  errorText: {
    color: "#ffb4aa",
  },
});
