import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { ProgressBar } from "../ProgressBar";
import { colors, fonts } from "../theme";
import {
  canUseItemInContext,
  equipmentSlots,
  formatEquipmentSlotLabel,
  getCompatibleEquipmentSlots,
  getInventoryResourceBonuses,
  InventoryItem,
  isHealingConsumable,
  ItemDefinition,
  resolveInventoryImageUri,
} from "../../services/inventoryService";

export const playerInventoryTabs = ["All", "Weapons", "Armor Sets", "Armor Pieces", "Wearables", "Consumables", "Materials", "Special", "Misc"] as const;
export type PlayerInventoryTab = (typeof playerInventoryTabs)[number];
type EquipmentSlot = (typeof equipmentSlots)[number];
type InventorySort = "newest" | "rarity" | "equipped" | "set" | "name";

type PlayerInventoryPanelProps = {
  items: InventoryItem[];
  equippedItems: Record<string, ItemDefinition | null>;
  selectedItem: InventoryItem | null;
  activeTab: PlayerInventoryTab;
  totalWeight: number;
  carryCapacity: number;
  currentHealth: number;
  maxHealth: number;
  message: string | null;
  onSelectTab: (tab: PlayerInventoryTab) => void;
  onSelectItem: (itemId: string | null) => void;
  onEquipItem: (entry: InventoryItem, slot?: EquipmentSlot) => void;
  onUnequipSlot: (slot: EquipmentSlot) => void;
  onUseItem: (entry: InventoryItem) => void;
  onUseScroll: (entry: InventoryItem) => void;
  onDropItem: (entry: InventoryItem) => void;
};

export function PlayerInventoryPanel({
  items,
  equippedItems,
  selectedItem,
  activeTab,
  totalWeight,
  carryCapacity,
  currentHealth,
  maxHealth,
  message,
  onSelectTab,
  onSelectItem,
  onEquipItem,
  onUnequipSlot,
  onUseItem,
  onUseScroll,
  onDropItem,
}: PlayerInventoryPanelProps) {
  const [sortMode, setSortMode] = useState<InventorySort>("equipped");
  const filteredItems = useMemo(() => sortInventoryItems(
    items.filter((entry) => itemMatchesCategory(entry.item, activeTab)),
    sortMode,
  ), [activeTab, items, sortMode]);
  const overCapacity = totalWeight > carryCapacity;
  const equipmentBonuses = getInventoryResourceBonuses(equippedItems as Record<EquipmentSlot, ItemDefinition | null>);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Inventory</Text>
          <Text style={styles.copy}>Manage gear, consumables, materials, and carry weight.</Text>
        </View>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.weightPanel}>
        <View style={styles.weightHeader}>
          <Text style={styles.subTitle}>Carry Weight</Text>
          <Text style={[styles.weightValue, overCapacity && styles.warningText]}>{totalWeight.toFixed(1)} / {carryCapacity.toFixed(1)}</Text>
        </View>
        <ProgressBar value={Math.min(totalWeight, carryCapacity)} max={Math.max(1, carryCapacity)} color={overCapacity ? colors.red : colors.gold} height={8} />
        {overCapacity ? <Text style={styles.warningText}>Inventory too heavy. Drop weight before collecting more items.</Text> : null}
      </View>

      <View style={styles.loadoutPanel}>
        <View style={styles.loadoutHeader}>
          <Text style={styles.subTitle}>Equipped</Text>
          <Text style={styles.badge}>Loadout</Text>
        </View>
        <GearSilhouette equippedItems={equippedItems} onUnequipSlot={onUnequipSlot} />
        {equipmentBonuses.completedArmorSets.length > 0 ? (
          <View style={styles.setBonusPanel}>
            <Text style={styles.subTitle}>Completed Armor Sets</Text>
            {equipmentBonuses.completedArmorSets.map((set) => (
              <Text key={set.key} style={styles.copy}>
                {set.name}{set.bonusTarget && set.bonusAmount ? `: +${set.bonusAmount} ${set.bonusTarget}` : ""}
                {set.penaltyTarget && set.penaltyAmount ? ` / -${set.penaltyAmount} ${set.penaltyTarget}` : ""}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {playerInventoryTabs.map((tab) => (
          <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => onSelectTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.sortBar}>
        {(["equipped", "rarity", "set", "name", "newest"] as InventorySort[]).map((mode) => (
          <Pressable key={mode} style={[styles.sortButton, sortMode === mode && styles.activeSortButton]} onPress={() => setSortMode(mode)}>
            <Text style={[styles.sortText, sortMode === mode && styles.activeSortText]}>{formatSortLabel(mode)}</Text>
          </Pressable>
        ))}
      </View>

      {selectedItem ? (
        <ItemDetail
          entry={selectedItem}
          currentHealth={currentHealth}
          maxHealth={maxHealth}
          onEquipItem={onEquipItem}
          onUnequipSlot={onUnequipSlot}
          onUseItem={onUseItem}
          onUseScroll={onUseScroll}
          onDropItem={onDropItem}
          onClose={() => onSelectItem(null)}
        />
      ) : null}

      <View style={styles.inventoryGrid}>
        {filteredItems.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No items in this category yet.</Text>
            <Text style={styles.copy}>Rewards, market purchases, and drops will appear here.</Text>
          </View>
        ) : null}
        {filteredItems.map((entry) => (
          <Pressable
            key={entry.id}
            style={[styles.itemCard, selectedItem?.id === entry.id && styles.activeCard, getRarityStyle(entry.item.rarity)]}
            onPress={() => onSelectItem(entry.id)}
          >
            <View style={styles.itemImageShell}>
              {resolveInventoryImageUri(entry.item.image_path) ? (
                <Image source={{ uri: resolveInventoryImageUri(entry.item.image_path) ?? "" }} style={styles.itemImage} />
              ) : (
                <View style={styles.itemPlaceholder}><Text style={styles.itemInitial}>{entry.item.name.slice(0, 1).toUpperCase()}</Text></View>
              )}
              <Text style={styles.qtyBadge}>{entry.quantity}</Text>
              {entry.equippedSlot ? <Text style={styles.equippedBadge}>Equipped</Text> : null}
            </View>
            <Text style={styles.cardTitle} numberOfLines={2}>{entry.item.name}</Text>
            <Text style={styles.cardMeta}>{entry.item.rarity}</Text>
            <Text style={styles.cardMeta}>{Number(entry.item.weight ?? 0).toFixed(1)} wt</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function GearSilhouette({ equippedItems, onUnequipSlot }: { equippedItems: Record<string, ItemDefinition | null>; onUnequipSlot: (slot: EquipmentSlot) => void }) {
  const leftSlots: EquipmentSlot[] = ["main_hand", "helmet", "gloves", "legs"];
  const rightSlots: EquipmentSlot[] = ["off_hand", "chest", "boots", "necklace"];
  const bottomSlots: EquipmentSlot[] = ["ring", "charm", "relic"];

  return (
    <View style={styles.gearPanel}>
      <View style={styles.gearColumn}>
        {leftSlots.map((slot) => (
          <EquipmentSlotCard key={slot} slot={slot} item={equippedItems[slot] ?? null} onUnequip={() => onUnequipSlot(slot)} />
        ))}
      </View>
      <View style={styles.silhouetteBody}>
        <View style={styles.silhouetteHead} />
        <View style={styles.silhouetteTorso}>
          <Text style={styles.silhouetteText}>GEAR</Text>
        </View>
        <View style={styles.silhouetteLegs}>
          <View style={styles.silhouetteLeg} />
          <View style={styles.silhouetteLeg} />
        </View>
      </View>
      <View style={styles.gearColumn}>
        {rightSlots.map((slot) => (
          <EquipmentSlotCard key={slot} slot={slot} item={equippedItems[slot] ?? null} onUnequip={() => onUnequipSlot(slot)} />
        ))}
      </View>
      <View style={styles.gearBottomRow}>
        {bottomSlots.map((slot) => (
          <EquipmentSlotCard key={slot} slot={slot} item={equippedItems[slot] ?? null} onUnequip={() => onUnequipSlot(slot)} compact />
        ))}
      </View>
    </View>
  );
}

function EquipmentSlotCard({ slot, item, onUnequip, compact = false }: { slot: EquipmentSlot; item: ItemDefinition | null; onUnequip: () => void; compact?: boolean }) {
  const uri = resolveInventoryImageUri(item?.image_path);

  return (
    <View style={[styles.slotCard, compact && styles.compactSlotCard, item && styles.slotFilled]}>
      <Text style={styles.slotLabel}>{formatEquipmentSlotLabel(slot)}</Text>
      <View style={[styles.slotIcon, compact && styles.compactSlotIcon]}>
        {uri ? <Image source={{ uri }} style={styles.slotImage} /> : <Text style={styles.slotInitial}>{slot.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <Text style={styles.slotName} numberOfLines={2}>{item?.name ?? "Empty"}</Text>
      {item ? (
        <Pressable style={styles.smallButton} onPress={onUnequip}>
          <Text style={styles.smallButtonText}>Unequip</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ItemDetail({ entry, currentHealth, maxHealth, onEquipItem, onUnequipSlot, onUseItem, onUseScroll, onDropItem, onClose }: {
  entry: InventoryItem;
  currentHealth: number;
  maxHealth: number;
  onEquipItem: (entry: InventoryItem, slot?: EquipmentSlot) => void;
  onUnequipSlot: (slot: EquipmentSlot) => void;
  onUseItem: (entry: InventoryItem) => void;
  onUseScroll: (entry: InventoryItem) => void;
  onDropItem: (entry: InventoryItem) => void;
  onClose: () => void;
}) {
  const imageUri = resolveInventoryImageUri(entry.item.image_path);
  const canUseOutside = canUseItemOutsideBattle(entry);
  const isScroll = entry.item.type === "scroll" && Boolean(entry.item.teaches_ability_id);
  const compatibleSlots = getCompatibleEquipmentSlots(entry.item) as EquipmentSlot[];

  return (
    <View style={styles.detailPanel}>
      <View style={styles.detailHeader}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.detailImage} /> : <View style={styles.detailPlaceholder}><Text style={styles.itemInitial}>{entry.item.name.slice(0, 1).toUpperCase()}</Text></View>}
        <View style={styles.detailBody}>
          <Text style={styles.detailTitle}>{entry.item.name}</Text>
          <Text style={styles.detailTag}>{entry.equippedSlot ? `Equipped: ${entry.equippedSlot}` : entry.item.rarity}</Text>
          <Text style={styles.copy}>{entry.item.description ?? "No description."}</Text>
        </View>
      </View>
      <Info label="Type" value={entry.item.type} />
      <Info label="Quantity" value={String(entry.quantity)} />
      <Info label="Value" value={`${entry.item.gold_value} gold`} />
      <Info label="Weight" value={`${(Number(entry.item.weight ?? 0) * entry.quantity).toFixed(1)} total`} />
      {entry.item.damage_amount ? <Info label="Damage" value={String(entry.item.damage_amount)} /> : null}
      {entry.item.armor_value ? <Info label="Armor" value={String(entry.item.armor_value)} /> : null}
      {entry.item.armor_piece_slot ? <Info label="Armor Piece" value={entry.item.armor_piece_slot} /> : null}
      {entry.item.armor_set_name || entry.item.armor_set_key ? <Info label="Armor Set" value={entry.item.armor_set_name ?? entry.item.armor_set_key ?? ""} /> : null}
      {entry.item.equip_penalty_target && entry.item.equip_penalty_amount ? <Info label="Equip Penalty" value={`-${entry.item.equip_penalty_amount} ${entry.item.equip_penalty_target}`} /> : null}
      {entry.item.set_bonus_target && entry.item.set_bonus_amount ? <Info label="Full Set Bonus" value={`+${entry.item.set_bonus_amount} ${entry.item.set_bonus_target}`} /> : null}
      {entry.item.restore_amount ? <Info label="Restore" value={`${entry.item.restore_amount} ${entry.item.potion_target ?? ""}`} /> : null}
      {canUseOutside ? (
        <View style={styles.healBox}>
          <Text style={styles.copy}>Health {currentHealth} / {maxHealth}</Text>
          <ProgressBar value={currentHealth} max={Math.max(1, maxHealth)} color={colors.red} height={7} />
        </View>
      ) : null}
      <View style={styles.actionRow}>
        {compatibleSlots.map((slot) => (
          <Pressable key={slot} style={styles.smallButton} onPress={() => onEquipItem(entry, slot)}>
            <Text style={styles.smallButtonText}>Equip {formatEquipmentSlotLabel(slot)}</Text>
          </Pressable>
        ))}
        {entry.equippedSlot ? <Pressable style={styles.smallButton} onPress={() => onUnequipSlot(entry.equippedSlot as EquipmentSlot)}><Text style={styles.smallButtonText}>Unequip</Text></Pressable> : null}
        {isScroll ? <Pressable style={styles.smallButton} onPress={() => onUseScroll(entry)}><Text style={styles.smallButtonText}>Use Scroll</Text></Pressable> : null}
        {canUseOutside ? <Pressable style={[styles.smallButton, currentHealth >= maxHealth && styles.disabledAction]} onPress={() => onUseItem(entry)} disabled={currentHealth >= maxHealth}><Text style={styles.smallButtonText}>Use</Text></Pressable> : null}
        <Pressable style={[styles.smallButton, styles.dropButton]} onPress={() => onDropItem(entry)}><Text style={styles.dropButtonText}>Drop</Text></Pressable>
      </View>
      <Pressable style={styles.secondaryButton} onPress={onClose}>
        <Text style={styles.smallButtonText}>Close Item</Text>
      </Pressable>
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

export function itemMatchesCategory(item: ItemDefinition, category: PlayerInventoryTab) {
  if (category === "All") return true;
  if (category === "Weapons") return item.type === "weapon";
  if (category === "Armor Sets") return item.type === "armor" && Boolean(item.armor_set_key || item.armor_set_name);
  if (category === "Armor Pieces") return item.type === "armor";
  if (category === "Wearables") return item.type === "wearable";
  if (category === "Consumables") return ["potion", "revive potion", "consumable", "food", "scroll"].includes(item.type);
  if (category === "Materials") return item.type === "material";
  if (category === "Special") return item.type === "special";
  return item.type === "misc";
}

function sortInventoryItems(items: InventoryItem[], sortMode: InventorySort) {
  const rarityRank: Record<string, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
  return [...items].sort((a, b) => {
    if (sortMode === "equipped") {
      return Number(Boolean(b.equippedSlot)) - Number(Boolean(a.equippedSlot)) || a.item.name.localeCompare(b.item.name);
    }
    if (sortMode === "rarity") {
      return (rarityRank[b.item.rarity ?? "common"] ?? 0) - (rarityRank[a.item.rarity ?? "common"] ?? 0) || a.item.name.localeCompare(b.item.name);
    }
    if (sortMode === "set") {
      return (a.item.armor_set_name ?? a.item.armor_set_key ?? "zzz").localeCompare(b.item.armor_set_name ?? b.item.armor_set_key ?? "zzz") || a.item.name.localeCompare(b.item.name);
    }
    if (sortMode === "name") {
      return a.item.name.localeCompare(b.item.name);
    }
    return new Date(b.updated_at ?? b.acquired_at).getTime() - new Date(a.updated_at ?? a.acquired_at).getTime();
  });
}

function formatSortLabel(mode: InventorySort) {
  if (mode === "newest") return "Newest";
  if (mode === "rarity") return "Rarity";
  if (mode === "equipped") return "Equipped";
  if (mode === "set") return "Set";
  return "Name";
}

function canUseItemOutsideBattle(entry: InventoryItem) {
  return entry.quantity > 0 && isHealingConsumable(entry.item) && canUseItemInContext(entry.item, "outside");
}

function getRarityStyle(rarity: string | null) {
  if (rarity === "legendary") return styles.legendary;
  if (rarity === "epic") return styles.epic;
  if (rarity === "rare") return styles.rare;
  if (rarity === "uncommon") return styles.uncommon;
  return null;
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
  weightPanel: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  weightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  weightValue: {
    color: colors.text,
    fontWeight: "900",
  },
  warningText: {
    color: colors.red,
    fontWeight: "900",
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
  equipmentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gearPanel: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 4,
  },
  gearColumn: {
    flex: 1,
    minWidth: 104,
    gap: 8,
  },
  silhouetteBody: {
    width: 92,
    minHeight: 250,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  silhouetteHead: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "rgba(217,164,65,0.55)",
    backgroundColor: "rgba(217,164,65,0.08)",
  },
  silhouetteTorso: {
    width: 76,
    height: 116,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(217,164,65,0.45)",
    backgroundColor: "rgba(20,61,86,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  silhouetteText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
  },
  silhouetteLegs: {
    flexDirection: "row",
    gap: 8,
  },
  silhouetteLeg: {
    width: 24,
    height: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(217,164,65,0.35)",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  gearBottomRow: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
  },
  setBonusPanel: {
    gap: 5,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(217,164,65,0.35)",
    borderRadius: 10,
    backgroundColor: "rgba(217,164,65,0.08)",
  },
  slotCard: {
    flexGrow: 1,
    flexBasis: 96,
    minWidth: 96,
    minHeight: 118,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(5,9,10,0.6)",
  },
  compactSlotCard: {
    flexBasis: 92,
    minWidth: 92,
    minHeight: 108,
  },
  slotFilled: {
    borderColor: colors.gold,
    backgroundColor: "rgba(217,170,93,0.08)",
  },
  slotLabel: {
    color: colors.goldSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  slotIcon: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  compactSlotIcon: {
    width: 40,
    height: 40,
    borderRadius: 9,
  },
  slotImage: {
    width: "100%",
    height: "100%",
  },
  slotInitial: {
    color: colors.muted,
    fontWeight: "900",
    fontSize: 20,
  },
  slotName: {
    color: colors.text,
    fontWeight: "900",
    textAlign: "center",
    minHeight: 34,
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sortBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  sortButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  activeSortButton: {
    borderColor: colors.gold,
    backgroundColor: "rgba(217,164,65,0.12)",
  },
  sortText: {
    color: colors.muted,
    fontWeight: "900",
    fontSize: 11,
  },
  activeSortText: {
    color: colors.gold,
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
    backgroundColor: "rgba(20,61,86,0.66)",
  },
  tabText: {
    color: colors.muted,
    fontWeight: "900",
    fontSize: 12,
  },
  activeTabText: {
    color: colors.text,
  },
  inventoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  itemCard: {
    flexGrow: 1,
    flexBasis: 118,
    minWidth: 108,
    minHeight: 152,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.26)",
  },
  activeCard: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20,61,86,0.45)",
  },
  uncommon: {
    borderColor: "#6fcf6a",
  },
  rare: {
    borderColor: colors.blue,
  },
  epic: {
    borderColor: "#b56cff",
  },
  legendary: {
    borderColor: colors.gold,
  },
  itemImageShell: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  itemPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  itemInitial: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 20,
  },
  qtyBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 24,
    minHeight: 24,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.82)",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.text,
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "900",
  },
  equippedBadge: {
    position: "absolute",
    left: -6,
    bottom: -6,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.blue,
    color: "#001018",
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 6,
    paddingVertical: 2,
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
  detailImage: {
    width: 82,
    height: 82,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  detailPlaceholder: {
    width: 82,
    height: 82,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
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
  smallButtonText: {
    color: colors.blue,
    fontWeight: "900",
    fontSize: 12,
  },
  dropButton: {
    borderColor: "rgba(255, 120, 120, 0.55)",
    backgroundColor: "rgba(80, 10, 10, 0.22)",
  },
  dropButtonText: {
    color: "#ffb1a9",
    fontWeight: "900",
    fontSize: 12,
  },
  disabledAction: {
    opacity: 0.45,
  },
  emptyPanel: {
    flex: 1,
    minWidth: "100%",
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
