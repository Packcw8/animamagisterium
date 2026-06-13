import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { CharacterWithDetails } from "../services/characterService";
import { AbilityDefinition, equipAbility, getCombatLoadout, getCharacterResources } from "../services/abilityService";

type HomeScreenProps = {
  character: CharacterWithDetails;
};

const homeTabs = ["Overview", "Identity", "Attributes", "Abilities", "Inventory"] as const;
const attributeKeys = ["strength", "endurance", "agility", "intelligence", "wisdom", "charisma", "spirit"] as const;

export function HomeScreen({ character }: HomeScreenProps) {
  const [activeTab, setActiveTab] = useState<(typeof homeTabs)[number]>("Overview");
  const [unlockedAbilities, setUnlockedAbilities] = useState<AbilityDefinition[]>([]);
  const [equippedAbilities, setEquippedAbilities] = useState<Array<AbilityDefinition | null>>([null, null, null, null]);
  const [selectedAbilityKey, setSelectedAbilityKey] = useState<string | null>(null);
  const [abilityMessage, setAbilityMessage] = useState<string | null>(null);
  const resources = getCharacterResources(character);

  useEffect(() => {
    void loadAbilities();
  }, [character.id, character.attributes]);

  async function loadAbilities() {
    try {
      const loadout = await getCombatLoadout(character);
      setUnlockedAbilities(loadout.unlocked);
      setEquippedAbilities(loadout.equipped);
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to load abilities.");
    }
  }

  async function equipSelectedAbility(slot: number) {
    if (!selectedAbilityKey) {
      setAbilityMessage("Select an unlocked ability first.");
      return;
    }

    try {
      await equipAbility(character.id, slot, selectedAbilityKey);
      await loadAbilities();
      setAbilityMessage("Ability equipped.");
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to equip ability.");
    }
  }

  async function clearSlot(slot: number) {
    try {
      await equipAbility(character.id, slot, null);
      await loadAbilities();
      setAbilityMessage("Slot cleared.");
    } catch (error) {
      setAbilityMessage(error instanceof Error ? error.message : "Unable to clear slot.");
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <BrandLogo size={54} />
        <View style={styles.headerText}>
          <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
          <Text style={styles.subtitle}>Adventurer Ledger</Text>
        </View>
      </View>

      <Frame style={styles.hero}>
        {character.portrait_url ? (
          <Image source={{ uri: character.portrait_url }} style={styles.portrait} />
        ) : (
          <View style={styles.noPortrait}>
            <Text style={styles.noPortraitText}>Portrait pending</Text>
          </View>
        )}
        <View style={styles.heroInfo}>
          <Text style={styles.name}>{character.name}</Text>
          <Text style={styles.identity}>{character.ancestry ?? "Adventurer"} / {character.origin ?? "Unknown Origin"}</Text>
          <View style={styles.statLine}>
            <Text style={styles.statPill}>Level {character.level}</Text>
            <Text style={styles.statPill}>{character.gold} Gold</Text>
          </View>
          <Text style={styles.xpText}>{character.xp.toLocaleString()} XP</Text>
          <ProgressBar value={character.xp % 1000} max={1000} color={colors.blue} height={9} />
          <View style={styles.resourceGrid}>
            <Resource label="HP" value={resources.maxHp} color={colors.red} />
            <Resource label="Stamina" value={resources.maxStamina} color={colors.gold} />
            <Resource label="Magicka" value={resources.maxMagicka} color={colors.blue} />
          </View>
        </View>
      </Frame>

      <View style={styles.tabs}>
        {homeTabs.map((tab) => (
          <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      <Frame style={styles.card}>
        {activeTab === "Overview" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Info label="Race" value={character.ancestry ?? "Not set"} />
            <Info label="Origin" value={character.origin ?? "Not set"} />
            <Text style={styles.muted}>Progression comes from your actions after entering the world, not from onboarding choices.</Text>
          </View>
        ) : activeTab === "Identity" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Identity</Text>
            <Info label="Gender" value={character.gender ?? "Not set"} />
            <Info label="Race" value={character.ancestry ?? "Not set"} />
            <Info label="Origin" value={character.origin ?? "Not set"} />
          </View>
        ) : activeTab === "Attributes" ? (
          <View style={styles.attributeGrid}>
            {attributeKeys.map((key) => (
              <View key={key} style={styles.attribute}>
                <Text style={styles.attributeName}>{key}</Text>
                <Text style={styles.attributeValue}>{character.attributes?.[key] ?? 0}</Text>
              </View>
            ))}
          </View>
        ) : activeTab === "Abilities" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ability Management</Text>
            <Text style={styles.muted}>Level 1 training unlocks abilities. Equip up to four before combat.</Text>
            {abilityMessage ? <Text style={styles.abilityMessage}>{abilityMessage}</Text> : null}
            <Text style={styles.subTitle}>Equipped Slots</Text>
            <View style={styles.slotGrid}>
              {equippedAbilities.map((ability, index) => (
                <View key={`slot-${index + 1}`} style={styles.slotCard}>
                  <Text style={styles.slotTitle}>Slot {index + 1}</Text>
                  <Text style={styles.slotName}>{ability?.name ?? "Empty"}</Text>
                  <View style={styles.slotActions}>
                    <Pressable style={styles.smallButton} onPress={() => void equipSelectedAbility(index + 1)}>
                      <Text style={styles.smallButtonText}>Equip Here</Text>
                    </Pressable>
                    <Pressable style={styles.smallButton} onPress={() => void clearSlot(index + 1)}>
                      <Text style={styles.smallButtonText}>Clear</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.subTitle}>Unlocked Abilities</Text>
            {unlockedAbilities.length === 0 ? (
              <Text style={styles.muted}>Train an attribute to level 1 to unlock its first ability.</Text>
            ) : (
              <View style={styles.abilityList}>
                {unlockedAbilities.map((ability) => (
                  <Pressable
                    key={ability.key}
                    style={[styles.abilityCard, selectedAbilityKey === ability.key && styles.abilityCardActive]}
                    onPress={() => setSelectedAbilityKey(ability.key)}
                  >
                    <Text style={styles.abilityName}>{ability.name}</Text>
                    <Text style={styles.muted}>{ability.description}</Text>
                    <Text style={styles.abilityCost}>{ability.cost} {ability.resource}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inventory</Text>
            <Text style={styles.muted}>Inventory will appear here once equipment is earned.</Text>
          </View>
        )}
      </Frame>
    </Screen>
  );
}

function Resource({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.resourcePill, { borderColor: color }]}>
      <Text style={[styles.resourceLabel, { color }]}>{label}</Text>
      <Text style={styles.resourceValue}>{value}</Text>
    </View>
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
  headerText: {
    flex: 1,
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 19,
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 3,
  },
  hero: {
    margin: 12,
    padding: 12,
    gap: 12,
  },
  portrait: {
    width: "100%",
    height: 330,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  noPortrait: {
    width: "100%",
    height: 220,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  noPortraitText: {
    color: colors.muted,
  },
  heroInfo: {
    gap: 8,
  },
  name: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
  },
  identity: {
    color: colors.gold,
    fontWeight: "700",
  },
  statLine: {
    flexDirection: "row",
    gap: 8,
  },
  statPill: {
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: "hidden",
  },
  xpText: {
    color: colors.muted,
  },
  resourceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  resourcePill: {
    flex: 1,
    minWidth: 96,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  resourceLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  resourceValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  tab: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: "rgba(8, 8, 7, 0.9)",
  },
  activeTab: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.7)",
  },
  tabText: {
    color: colors.muted,
    fontWeight: "800",
  },
  activeTabText: {
    color: colors.text,
  },
  card: {
    margin: 12,
    padding: 14,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: "uppercase",
  },
  subTitle: {
    color: colors.gold,
    fontWeight: "900",
    marginTop: 8,
  },
  abilityMessage: {
    color: colors.blue,
    fontWeight: "800",
    lineHeight: 20,
  },
  slotGrid: {
    gap: 8,
  },
  slotCard: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  slotTitle: {
    color: colors.muted,
    fontWeight: "800",
  },
  slotName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  slotActions: {
    flexDirection: "row",
    gap: 8,
  },
  smallButton: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
  },
  smallButtonText: {
    color: colors.blue,
    fontWeight: "900",
    fontSize: 12,
  },
  abilityList: {
    gap: 8,
  },
  abilityCard: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  abilityCardActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.45)",
  },
  abilityName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
  },
  abilityCost: {
    color: colors.gold,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  infoRow: {
    gap: 4,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  infoLabel: {
    color: colors.muted,
  },
  infoValue: {
    color: colors.text,
    fontWeight: "800",
  },
  attributeGrid: {
    gap: 10,
  },
  attribute: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  attributeName: {
    color: colors.muted,
    textTransform: "capitalize",
  },
  attributeValue: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: "900",
  },
  muted: {
    color: colors.muted,
    lineHeight: 20,
  },
});
