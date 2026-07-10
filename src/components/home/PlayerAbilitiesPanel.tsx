import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { Image, StyleSheet, Text, View } from "react-native";
import { ProgressBar } from "../ProgressBar";
import { colors, fonts } from "../theme";
import { AbilityDefinition, canUseAbilityInContext, getAbilityCostLabel } from "../../services/abilityService";
import { resolveAbilityImageUri, resolveInventoryImageUri } from "../../services/inventoryService";

export const playerAbilityTabs = ["Attack", "Heal", "Buff", "Debuff", "Defense", "Passive"] as const;
export type PlayerAbilityTab = (typeof playerAbilityTabs)[number];

type PlayerAbilitiesPanelProps = {
  abilities: AbilityDefinition[];
  equippedAbilities: Array<AbilityDefinition | null>;
  selectedAbility: AbilityDefinition | null;
  selectedAbilityKey: string | null;
  activeTab: PlayerAbilityTab;
  currentHealth: number;
  maxHealth: number;
  message: string | null;
  onSelectTab: (tab: PlayerAbilityTab) => void;
  onSelectAbility: (ability: AbilityDefinition | null) => void;
  onEquipAbility: (slot: number) => void;
  onClearSlot: (slot: number) => void;
  onUseHeal: (ability: AbilityDefinition) => void;
};

export function PlayerAbilitiesPanel({
  abilities,
  equippedAbilities,
  selectedAbility,
  selectedAbilityKey,
  activeTab,
  currentHealth,
  maxHealth,
  message,
  onSelectTab,
  onSelectAbility,
  onEquipAbility,
  onClearSlot,
  onUseHeal,
}: PlayerAbilitiesPanelProps) {
  const counts = getAbilityTypeCounts(abilities);
  const filteredAbilities = abilities.filter((ability) => getPlayerAbilityType(ability) === activeTab);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Ability Management</Text>
          <Text style={styles.copy}>Equip up to four learned or item-granted abilities before combat.</Text>
        </View>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.loadoutPanel}>
        <View style={styles.loadoutHeader}>
          <Text style={styles.subTitle}>Equipped Slots</Text>
          <Text style={styles.badge}>Battle Loadout</Text>
        </View>
        <View style={styles.equippedGrid}>
          {equippedAbilities.map((ability, index) => (
            <AbilitySlotCard
              key={`slot-${index + 1}`}
              slot={index + 1}
              ability={ability}
              canEquip={Boolean(selectedAbility)}
              onEquip={() => onEquipAbility(index + 1)}
              onClear={() => onClearSlot(index + 1)}
            />
          ))}
        </View>
      </View>

      <View style={styles.tabs}>
        {playerAbilityTabs.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => {
              onSelectTab(tab);
              onSelectAbility(null);
            }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab} ({counts[tab] ?? 0})</Text>
          </Pressable>
        ))}
      </View>

      {selectedAbility ? (
        <AbilityDetail
          ability={selectedAbility}
          currentHealth={currentHealth}
          maxHealth={maxHealth}
          onEquipAbility={onEquipAbility}
          onUseHeal={onUseHeal}
          onClose={() => onSelectAbility(null)}
        />
      ) : filteredAbilities.length === 0 ? (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>No abilities learned yet.</Text>
          <Text style={styles.copy}>Train attributes, equip weapons, or learn scrolls to fill this tab.</Text>
        </View>
      ) : (
        <View style={styles.abilityGrid}>
          {filteredAbilities.map((ability) => (
            <Pressable
              key={ability.key}
              style={[styles.abilityCard, selectedAbilityKey === ability.key && styles.activeCard]}
              onPress={() => onSelectAbility(ability)}
            >
              <View style={styles.iconShell}>
                <AbilityIcon ability={ability} />
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>{ability.name}</Text>
              <Text style={styles.cardMeta}>{getAbilityEffectSummary(ability)}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.costBadge}>{getAbilityCostLabel(ability)}</Text>
                <Text style={styles.cooldownBadge}>CD {ability.adminAbility?.cooldown_turns ?? 0}</Text>
              </View>
              <Text style={styles.sourceText}>{getAbilityDetailedSource(ability)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function AbilitySlotCard({ slot, ability, canEquip, onEquip, onClear }: { slot: number; ability: AbilityDefinition | null; canEquip: boolean; onEquip: () => void; onClear: () => void }) {
  return (
    <View style={[styles.slotCard, ability && styles.slotFilled]}>
      <View style={styles.slotTopline}>
        <Text style={styles.slotLabel}>Slot {slot}</Text>
        {ability ? <Text style={styles.equippedPill}>Equipped</Text> : <Text style={styles.emptyPill}>Empty</Text>}
      </View>
      <View style={styles.slotIcon}>{ability ? <AbilityIcon ability={ability} /> : <Text style={styles.plus}>+</Text>}</View>
      <Text style={styles.slotName} numberOfLines={2}>{ability?.name ?? "Open Slot"}</Text>
      <View style={styles.actionRow}>
        <Pressable style={[styles.smallButton, !canEquip && styles.disabledAction]} onPress={onEquip} disabled={!canEquip}>
          <Text style={styles.smallButtonText}>{ability ? "Replace" : "Equip"}</Text>
        </Pressable>
        {ability ? (
          <Pressable style={styles.smallButton} onPress={onClear}>
            <Text style={styles.smallButtonText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function AbilityDetail({ ability, currentHealth, maxHealth, onEquipAbility, onUseHeal, onClose }: { ability: AbilityDefinition; currentHealth: number; maxHealth: number; onEquipAbility: (slot: number) => void; onUseHeal: (ability: AbilityDefinition) => void; onClose: () => void }) {
  const canHealOutside = ability.adminAbility?.type === "heal" && canUseAbilityInContext(ability, "outside");

  return (
    <View style={styles.detailPanel}>
      <View style={styles.detailHeader}>
        <AbilityIcon ability={ability} large />
        <View style={styles.detailBody}>
          <Text style={styles.detailTitle}>{ability.name}</Text>
          <Text style={styles.detailTag}>{getAbilityDetailedSource(ability)}</Text>
          <Text style={styles.copy}>{ability.description}</Text>
        </View>
      </View>
      <Info label="Effect" value={getAbilityEffectSummary(ability)} />
      <Info label="Stamina Cost" value={String(ability.adminAbility?.stamina_cost ?? (ability.resource === "stamina" ? ability.cost : 0))} />
      <Info label="Mana Cost" value={String(ability.adminAbility?.magika_cost ?? (ability.resource === "magicka" ? ability.cost : 0))} />
      <Info label="Health Cost" value={String(ability.adminAbility?.health_cost ?? (ability.resource === "health" ? ability.cost : 0))} />
      <Info label="Cooldown" value={`${ability.adminAbility?.cooldown_turns ?? 0} turns`} />
      <Info label="Linked Attribute" value={ability.attribute ?? "None"} />
      <Info label="Required Level" value={String(ability.unlockLevel ?? 0)} />
      <Text style={styles.subTitle}>Equip to Slot</Text>
      <View style={styles.actionRow}>
        {[1, 2, 3, 4].map((slot) => (
          <Pressable key={slot} style={styles.smallButton} onPress={() => onEquipAbility(slot)}>
            <Text style={styles.smallButtonText}>Slot {slot}</Text>
          </Pressable>
        ))}
      </View>
      {canHealOutside ? (
        <View style={styles.healBox}>
          <Text style={styles.copy}>Health</Text>
          <ProgressBar value={currentHealth} max={Math.max(1, maxHealth)} color={colors.red} height={7} />
          <Pressable style={[styles.primaryButton, currentHealth >= maxHealth && styles.disabledAction]} onPress={() => onUseHeal(ability)} disabled={currentHealth >= maxHealth}>
            <Text style={styles.primaryButtonText}>Use Heal</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable style={styles.secondaryButton} onPress={onClose}>
        <Text style={styles.smallButtonText}>Back to Ability Tabs</Text>
      </Pressable>
    </View>
  );
}

function AbilityIcon({ ability, large = false }: { ability: AbilityDefinition; large?: boolean }) {
  const imageUri = getAbilityImageUri(ability);
  const sizeStyle = large ? styles.largeIcon : styles.icon;

  if (imageUri) {
    return <Image source={{ uri: imageUri }} style={sizeStyle} />;
  }

  return (
    <View style={[styles.iconFallback, large && styles.largeIcon]}>
      <Text style={styles.iconText}>{ability.name.slice(0, 2).toUpperCase()}</Text>
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

export function getPlayerAbilityType(ability: AbilityDefinition): PlayerAbilityTab {
  if (ability.adminAbility?.type) {
    const type = ability.adminAbility.type;
    return type === "attack" ? "Attack" : type === "heal" ? "Heal" : type === "buff" ? "Buff" : type === "debuff" ? "Debuff" : type === "defense" ? "Defense" : "Passive";
  }

  if (ability.kind === "physical" || ability.kind === "magic" || ability.kind === "divine") {
    return "Attack";
  }

  return "Passive";
}

function getAbilityTypeCounts(abilities: AbilityDefinition[]) {
  return playerAbilityTabs.reduce((counts, tab) => {
    counts[tab] = abilities.filter((ability) => getPlayerAbilityType(ability) === tab).length;
    return counts;
  }, {} as Record<PlayerAbilityTab, number>);
}

function getAbilityImageUri(ability: AbilityDefinition) {
  if (ability.adminAbility?.image_path) {
    return resolveAbilityImageUri(ability.adminAbility.image_path);
  }

  if (ability.sourceWeapon?.image_path) {
    return resolveInventoryImageUri(ability.sourceWeapon.image_path);
  }

  return null;
}

function getAbilityEffectSummary(ability: AbilityDefinition) {
  if (ability.adminAbility) {
    const parts = [
      ability.adminAbility.damage ? `${ability.adminAbility.damage} damage` : null,
      ability.adminAbility.healing ? `${ability.adminAbility.healing} healing` : null,
      ability.adminAbility.defense_amount ? `${ability.adminAbility.defense_amount} defense` : null,
      ability.adminAbility.stamina_restore ? `${ability.adminAbility.stamina_restore} stamina restore` : null,
      ability.adminAbility.magika_restore ? `${ability.adminAbility.magika_restore} mana restore` : null,
      ability.adminAbility.status_effect !== "none" ? ability.adminAbility.status_effect : null,
    ].filter(Boolean);

    return parts.join(" / ") || "No direct effect";
  }

  return `${ability.baseDamage} damage`;
}

function getAbilityDetailedSource(ability: AbilityDefinition) {
  if (ability.source === "weapon") return ability.sourceWeapon ? `Weapon: ${ability.sourceWeapon.name}` : "Weapon";
  if (ability.source === "admin") return ability.adminAbility?.learn_method ?? "Admin";
  if (ability.source === "training") return ability.attribute ? `${ability.attribute} training` : "Training";
  return "Starter";
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  subTitle: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 15,
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  message: {
    color: colors.blue,
    fontWeight: "900",
    lineHeight: 20,
  },
  loadoutPanel: {
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.26)",
  },
  loadoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    color: colors.blue,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  equippedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  slotCard: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 132,
    minHeight: 166,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(5,9,10,0.6)",
  },
  slotFilled: {
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    backgroundColor: "rgba(217,170,93,0.08)",
  },
  slotTopline: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  slotLabel: {
    color: colors.goldSoft,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  equippedPill: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "900",
  },
  emptyPill: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
  },
  slotIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  plus: {
    color: colors.muted,
    fontSize: 28,
    fontWeight: "900",
  },
  slotName: {
    color: colors.text,
    fontWeight: "900",
    textAlign: "center",
    minHeight: 36,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  smallButton: {
    flexGrow: 1,
    minHeight: 38,
    minWidth: 76,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  secondaryButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
  },
  primaryButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  primaryButtonText: {
    color: "#140e05",
    fontWeight: "900",
  },
  smallButtonText: {
    color: colors.blue,
    fontWeight: "900",
    fontSize: 12,
  },
  disabledAction: {
    opacity: 0.45,
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tab: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.66)",
  },
  tabText: {
    color: colors.muted,
    fontWeight: "900",
    fontSize: 12,
  },
  activeTabText: {
    color: colors.text,
  },
  abilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  abilityCard: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 132,
    minHeight: 172,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "rgba(0,0,0,0.26)",
  },
  activeCard: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.45)",
  },
  iconShell: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  largeIcon: {
    width: 74,
    height: 74,
    borderRadius: 12,
  },
  iconFallback: {
    width: 50,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(20, 61, 86, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 13,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 14,
    textAlign: "center",
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    textTransform: "capitalize",
  },
  cardFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  costBadge: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
  },
  cooldownBadge: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "900",
  },
  sourceText: {
    color: colors.goldSoft,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    textAlign: "center",
  },
  detailPanel: {
    gap: 10,
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(20,61,86,0.28)",
  },
  detailHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  detailBody: {
    flex: 1,
    gap: 5,
  },
  detailTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 20,
  },
  detailTag: {
    color: colors.blue,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 11,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderColor: "rgba(217,170,93,0.13)",
    paddingTop: 8,
  },
  infoLabel: {
    color: colors.muted,
    flex: 1,
  },
  infoValue: {
    color: colors.text,
    fontWeight: "900",
    flex: 1,
    textAlign: "right",
  },
  healBox: {
    gap: 8,
  },
  emptyPanel: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    padding: 14,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "900",
  },
});
