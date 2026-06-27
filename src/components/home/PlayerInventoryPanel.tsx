import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ProgressBar } from "../ProgressBar";
import { colors, fonts } from "../theme";
import {
  canUseItemInContext,
  equipmentSlots,
  InventoryItem,
  isHealingConsumable,
  ItemDefinition,
  resolveInventoryImageUri,
} from "../../services/inventoryService";

export const playerInventoryTabs = ["Weapons", "Armor", "Wearables", "Consumables", "Materials", "Special", "Misc"] as const;
export type PlayerInventoryTab = (typeof playerInventoryTabs)[number];
type EquipmentSlot = (typeof equipmentSlots)[number];

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
  onEquipItem: (entry: InventoryItem) => void;
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
  const filteredItems = items.filter((entry) => itemMatchesCategory(entry.item, activeTab));
  const overCapacity = totalWeight > carryCapacity;

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
        <View style={styles.equipmentGrid}>
          {equipmentSlots.map((slot) => (
            <EquipmentSlotCard
              key={slot}
              slot={slot}
              item={equippedItems[slot] ?? null}
              onUnequip={() => onUnequipSlot(slot)}
            />
          ))}
        </View>
      </View>

      <View style={styles.tabs}>
        {playerInventoryTabs.map((tab) => (
          <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => onSelectTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
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

function EquipmentSlotCard({ slot, item, onUnequip }: { slot: EquipmentSlot; item: ItemDefinition | null; onUnequip: () => void }) {
  const uri = resolveInventoryImageUri(item?.image_path);

  return (
    <View style={[styles.slotCard, item && styles.slotFilled]}>
      <Text style={styles.slotLabel}>{slot}</Text>
      <View style={styles.slotIcon}>
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
  onEquipItem: (entry: InventoryItem) => void;
  onUnequipSlot: (slot: EquipmentSlot) => void;
  onUseItem: (entry: InventoryItem) => void;
  onUseScroll: (entry: InventoryItem) => void;
  onDropItem: (entry: InventoryItem) => void;
  onClose: () => void;
}) {
  const imageUri = resolveInventoryImageUri(entry.item.image_path);
  const canUseOutside = canUseItemOutsideBattle(entry);
  const isScroll = entry.item.type === "scroll" && Boolean(entry.item.teaches_ability_id);

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
      {entry.item.restore_amount ? <Info label="Restore" value={`${entry.item.restore_amount} ${entry.item.potion_target ?? ""}`} /> : null}
      {canUseOutside ? (
        <View style={styles.healBox}>
          <Text style={styles.copy}>Health {currentHealth} / {maxHealth}</Text>
          <ProgressBar value={currentHealth} max={Math.max(1, maxHealth)} color={colors.red} height={7} />
        </View>
      ) : null}
      <View style={styles.actionRow}>
        {entry.item.equipment_slot ? <Pressable style={styles.smallButton} onPress={() => onEquipItem(entry)}><Text style={styles.smallButtonText}>Equip</Text></Pressable> : null}
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
  if (category === "Weapons") return item.type === "weapon";
  if (category === "Armor") return item.type === "armor";
  if (category === "Wearables") return item.type === "wearable";
  if (category === "Consumables") return ["potion", "revive potion", "consumable", "food", "scroll"].includes(item.type);
  if (category === "Materials") return item.type === "material";
  if (category === "Special") return item.type === "special";
  return item.type === "misc";
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
  slotCard: {
    flexGrow: 1,
    flexBasis: 120,
    minWidth: 112,
    minHeight: 148,
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
    backgroundColor: "rgba(217,170,93,0.08)",
  },
  slotLabel: {
    color: colors.goldSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  slotIcon: {
    width: 54,
    height: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  slotImage: {
    width: 54,
    height: 54,
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
