import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ProgressBar } from "../ProgressBar";
import { colors, fonts } from "../theme";
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

export function CombatPortraitFrame({
  imageUri,
  fallbackText,
  name,
  subtitle,
  hp,
  maxHp,
  stamina,
  maxStamina,
  mana,
  maxMana,
  accent,
  active,
  compact = false,
  indicators,
  imageFailed,
  onImageError,
}: {
  imageUri: string | null;
  fallbackText: string;
  name: string;
  subtitle: string;
  hp: number;
  maxHp: number;
  stamina?: number;
  maxStamina?: number;
  mana?: number;
  maxMana?: number;
  accent: "player" | "enemy";
  active: boolean;
  compact?: boolean;
  indicators?: CombatIndicator[];
  imageFailed?: boolean;
  onImageError?: () => void;
}) {
  const hpPercent = getPercent(hp, maxHp);
  const staminaPercent = getPercent(stamina ?? 0, maxStamina ?? 1);
  const manaPercent = getPercent(mana ?? 0, maxMana ?? 1);
  const frameSize = compact ? 104 : 132;
  const portraitSize = compact ? 78 : 98;
  const ringSize = frameSize - 2;
  const ringRadius = frameSize / 2 - 9;

  return (
    <View style={[styles.portraitFrameWrap, active && styles.portraitFrameActive, accent === "enemy" && styles.enemyPortraitGlow]}>
      <View style={[styles.portraitFrame, { width: frameSize, height: frameSize, borderRadius: frameSize / 2 } as object]}>
        <CircularResourceArcs size={ringSize} radius={ringRadius} hpPercent={hpPercent} staminaPercent={staminaPercent} manaPercent={manaPercent} />
        <View style={[styles.portraitInner, { width: portraitSize, height: portraitSize, borderRadius: portraitSize / 2 } as object]}>
          {imageUri && !imageFailed ? (
            <Image source={{ uri: imageUri }} style={[styles.portraitImage, { width: portraitSize, height: portraitSize, borderRadius: portraitSize / 2 } as object]} onError={onImageError} />
          ) : (
            <Text style={styles.portraitFallback}>{fallbackText.slice(0, 2).toUpperCase()}</Text>
          )}
        </View>
        <CombatIndicatorStack indicators={indicators ?? []} />
      </View>
      <Text style={styles.portraitName} numberOfLines={1}>{name}</Text>
      <Text style={styles.portraitSubtitle} numberOfLines={1}>{subtitle}</Text>
      <View style={styles.miniResourceRow}>
        <Text style={[styles.miniResourceText, { color: colors.red }]}>HP {Math.max(0, hp)} / {Math.max(1, maxHp)}</Text>
        {stamina != null && maxStamina != null ? <Text style={[styles.miniResourceText, { color: colors.gold }]}>ST {Math.max(0, stamina)} / {Math.max(1, maxStamina)}</Text> : null}
        {mana != null && maxMana != null ? <Text style={[styles.miniResourceText, { color: colors.blue }]}>MN {Math.max(0, mana)} / {Math.max(1, maxMana)}</Text> : null}
      </View>
    </View>
  );
}

export function CircularResourceArcs({
  size,
  radius,
  hpPercent,
  staminaPercent,
  manaPercent,
}: {
  size: number;
  radius: number;
  hpPercent: number;
  staminaPercent: number;
  manaPercent: number;
}) {
  const center = size / 2;
  const strokeWidth = 7;

  return (
    <Svg width={size} height={size} style={styles.resourceArcSvg} pointerEvents="none">
      <Path d={describeArc(center, center, radius, 142, 218)} stroke="rgba(232,181,94,0.16)" strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
      <Path d={describeArc(center, center, radius, 322, 398)} stroke="rgba(54,171,224,0.16)" strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
      <Path d={describeArc(center, center, radius, 205, 335)} stroke="rgba(255,255,255,0.12)" strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />

      {staminaPercent > 0 ? <Path d={describeArc(center, center, radius, 142, 142 + 76 * (staminaPercent / 100))} stroke={colors.gold} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" /> : null}
      {manaPercent > 0 ? <Path d={describeArc(center, center, radius, 322, 322 + 76 * (manaPercent / 100))} stroke={colors.blue} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" /> : null}
      {hpPercent > 0 ? <Path d={describeArc(center, center, radius, 205, 205 + 130 * (hpPercent / 100))} stroke={colors.red} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" /> : null}
    </Svg>
  );
}

export function EnemyTargetCard({
  name,
  subtitle,
  hp,
  maxHp,
  imageUri,
  active,
  targetSelected = true,
}: {
  name: string;
  subtitle: string;
  hp: number;
  maxHp: number;
  imageUri: string | null;
  active: boolean;
  targetSelected?: boolean;
}) {
  return (
    <View style={[styles.enemyTargetCard, targetSelected && styles.enemyTargetSelected]}>
      <View style={styles.enemyTargetImageWrap}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.enemyTargetImage} /> : <Text style={styles.battleActionFallback}>{name.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.enemyTargetBody}>
        <View style={styles.enemyTargetHeader}>
          <Text style={styles.enemyTargetName} numberOfLines={1}>{name}</Text>
          {active ? <Text style={styles.turnChip}>Target</Text> : null}
        </View>
        <Text style={styles.enemyTargetSub} numberOfLines={1}>{subtitle}</Text>
        <ProgressBar value={hp} max={Math.max(1, maxHp)} color={colors.red} height={5} />
      </View>
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

function getPercent(value: number, max: number) {
  return Math.max(0, Math.min(100, (Number(value) / Math.max(1, Number(max) || 1)) * 100));
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(centerX, centerY, radius, startAngle);
  const end = polarToCartesian(centerX, centerY, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
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
  portraitFrameWrap: {
    alignItems: "center",
    gap: 4,
    padding: 4,
  },
  portraitFrameActive: {
    transform: [{ scale: 1.03 }],
  },
  enemyPortraitGlow: {
    shadowColor: colors.red,
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  portraitFrame: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(232,181,94,0.28)",
    backgroundColor: "rgba(0,0,0,0.35)",
    overflow: "visible",
  },
  resourceArcSvg: {
    position: "absolute",
    zIndex: 3,
  },
  portraitInner: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(54,171,224,0.74)",
    overflow: "hidden",
    backgroundColor: "rgba(5,9,10,0.82)",
    zIndex: 4,
  },
  portraitImage: {
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  portraitFallback: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
    fontWeight: "900",
  },
  portraitName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 13,
    maxWidth: 150,
  },
  portraitSubtitle: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    maxWidth: 150,
  },
  miniResourceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 5,
    maxWidth: 160,
  },
  miniResourceText: {
    fontSize: 9,
    fontWeight: "900",
  },
  enemyTargetCard: {
    minWidth: 170,
    flexGrow: 1,
    flexBasis: 170,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,180,170,0.28)",
    padding: 8,
    backgroundColor: "rgba(12,8,8,0.64)",
  },
  enemyTargetSelected: {
    borderColor: "#ffb4aa",
    backgroundColor: "rgba(62,15,15,0.46)",
  },
  enemyTargetImageWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ffb4aa",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  enemyTargetImage: {
    width: 44,
    height: 44,
  },
  enemyTargetBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  enemyTargetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  enemyTargetName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    flex: 1,
  },
  enemyTargetSub: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  turnChip: {
    color: "#1a0705",
    backgroundColor: "#ffb4aa",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 9,
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
    top: -12,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 20,
    elevation: 20,
  },
  combatIndicator: {
    position: "absolute",
    fontWeight: "900",
    fontSize: 19,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    opacity: 0.96,
  },
});
