import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ProgressBar } from "../ProgressBar";
import { colors } from "../theme";
import { getAbilityCostLabel, type AbilityDefinition } from "../../services/abilityService";
import { resolveAbilityImageUri, resolveInventoryImageUri } from "../../services/inventoryService";

export type CombatIndicator = {
  id: string;
  target: "enemy" | "player";
  text: string;
  color: string;
};

export function ResourceMeter({ label, value, max, color, compact = false }: { label: string; value: number; max: number; color: string; compact?: boolean }) {
  const safeMax = Math.max(1, max);

  return (
    <View style={[styles.resourceMeter, compact && styles.resourceMeterCompact]}>
      <View style={styles.resourceMeterHeader}>
        <Text style={styles.resourceMeterLabel}>{label}</Text>
        <Text style={styles.resourceMeterValue}>{Math.max(0, value)} / {safeMax}</Text>
      </View>
      <ProgressBar value={value} max={safeMax} color={color} height={compact ? 5 : 8} />
    </View>
  );
}

export function BattleActionCard({
  ability,
  slotNumber,
  disabled,
  unavailableReason,
  onPress,
}: {
  ability: AbilityDefinition | null;
  slotNumber: number;
  disabled: boolean;
  unavailableReason: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.battleActionCard, pressed && !disabled && styles.battleActionPressed, disabled && styles.disabledAction]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.battleActionIconWrap}>
        {ability ? <BattleAbilityIcon ability={ability} /> : <Text style={styles.battleActionFallback}>{slotNumber}</Text>}
      </View>
      <View style={styles.battleActionInfo}>
        <Text style={styles.battleActionName}>{ability?.name ?? `Empty Slot ${slotNumber}`}</Text>
        {ability ? <Text style={styles.battleActionMeta}>{getAbilityPowerLabel(ability)}</Text> : <Text style={styles.battleActionMeta}>Equip an ability on Home</Text>}
        {ability ? <Text style={styles.actionCost}>{getAbilityCostLabel(ability)}</Text> : null}
        {unavailableReason ? <Text style={styles.battleActionWarning}>{unavailableReason}</Text> : null}
      </View>
    </Pressable>
  );
}

export function CombatIndicatorStack({ indicators }: { indicators: CombatIndicator[] }) {
  return (
    <View style={styles.combatIndicatorStack} pointerEvents="none">
      {indicators.map((indicator, index) => (
        <Text key={indicator.id} style={[styles.combatIndicator, { color: indicator.color, top: -10 - index * 24 } as object]}>
          {indicator.text}
        </Text>
      ))}
    </View>
  );
}

function BattleAbilityIcon({ ability }: { ability: AbilityDefinition }) {
  const imageUri = ability.adminAbility?.image_path
    ? resolveAbilityImageUri(ability.adminAbility.image_path)
    : ability.sourceWeapon?.image_path
      ? resolveInventoryImageUri(ability.sourceWeapon.image_path)
      : null;

  if (!imageUri) {
    return <Text style={styles.battleActionFallback}>{ability.name.slice(0, 1).toUpperCase()}</Text>;
  }

  return <Image source={{ uri: imageUri }} style={styles.battleAbilityIcon} />;
}

function getAbilityPowerLabel(ability: AbilityDefinition) {
  if (ability.adminAbility) {
    const parts = [
      ability.adminAbility.damage > 0 ? `${ability.adminAbility.damage} damage` : null,
      ability.adminAbility.healing > 0 ? `${ability.adminAbility.healing} healing` : null,
      ability.adminAbility.defense_amount > 0 ? `${ability.adminAbility.defense_amount} defense` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" / ") : ability.adminAbility.type;
  }

  if (ability.baseDamage > 0) {
    return `${ability.baseDamage} damage${ability.scaling > 0 ? ` + ${ability.attribute ?? "stat"}` : ""}`;
  }

  return ability.description;
}

const styles = StyleSheet.create({
  resourceMeter: {
    gap: 5,
  },
  resourceMeterCompact: {
    gap: 3,
  },
  resourceMeterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  resourceMeterLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  resourceMeterValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  battleActionCard: {
    flex: 1,
    minWidth: 150,
    flexBasis: "48%",
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(232, 181, 94, 0.36)",
    padding: 9,
    backgroundColor: "rgba(8, 12, 13, 0.72)",
  },
  battleActionPressed: {
    borderColor: colors.gold,
    backgroundColor: "rgba(232, 181, 94, 0.14)",
    transform: [{ scale: 0.99 }],
  },
  disabledAction: {
    opacity: 0.45,
  },
  battleActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(54, 171, 224, 0.34)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  battleActionInfo: {
    flex: 1,
    minWidth: 0,
  },
  battleActionName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 16,
  },
  battleActionMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  actionCost: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    textTransform: "capitalize",
  },
  battleActionWarning: {
    color: "#ffb4aa",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 2,
  },
  battleActionFallback: {
    color: colors.gold,
    fontFamily: "Georgia",
    fontWeight: "900",
    fontSize: 18,
  },
  battleAbilityIcon: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  combatIndicatorStack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  combatIndicator: {
    position: "absolute",
    fontWeight: "900",
    fontSize: 16,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    opacity: 0.96,
  },
});
