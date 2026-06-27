import { Pressable, StyleSheet, Text, View } from "react-native";
import { PlayerAbilitiesPanel, type PlayerAbilityTab } from "../home/PlayerAbilitiesPanel";
import { Screen } from "../Screen";
import { colors, fonts } from "../theme";
import type { AbilityDefinition } from "../../services/abilityService";

type CharacterAbilitiesSheetProps = {
  abilities: AbilityDefinition[];
  equippedAbilities: Array<AbilityDefinition | null>;
  selectedAbility: AbilityDefinition | null;
  selectedAbilityKey: string | null;
  activeTab: PlayerAbilityTab;
  currentHealth: number;
  maxHealth: number;
  message: string | null;
  onClose: () => void;
  onSelectTab: (tab: PlayerAbilityTab) => void;
  onSelectAbility: (ability: AbilityDefinition | null) => void;
  onEquipAbility: (slot: number) => void;
  onClearSlot: (slot: number) => void;
  onUseHeal: (ability: AbilityDefinition) => void;
};

export function CharacterAbilitiesSheet(props: CharacterAbilitiesSheetProps) {
  return (
    <Screen>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Battle Loadout</Text>
            <Text style={styles.title}>Abilities</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={props.onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        <PlayerAbilitiesPanel
          abilities={props.abilities}
          equippedAbilities={props.equippedAbilities}
          selectedAbility={props.selectedAbility}
          selectedAbilityKey={props.selectedAbilityKey}
          activeTab={props.activeTab}
          currentHealth={props.currentHealth}
          maxHealth={props.maxHealth}
          message={props.message}
          onSelectTab={props.onSelectTab}
          onSelectAbility={props.onSelectAbility}
          onEquipAbility={props.onEquipAbility}
          onClearSlot={props.onClearSlot}
          onUseHeal={props.onUseHeal}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: 14,
    padding: 14,
    paddingBottom: 96,
  },
  header: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  eyebrow: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 28,
  },
  closeButton: {
    minHeight: 42,
    minWidth: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  closeText: {
    color: colors.blue,
    fontWeight: "900",
  },
});
