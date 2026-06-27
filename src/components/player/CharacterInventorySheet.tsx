import { Pressable, StyleSheet, Text, View } from "react-native";
import { PlayerInventoryPanel, type PlayerInventoryTab } from "../home/PlayerInventoryPanel";
import { Screen } from "../Screen";
import { colors, fonts } from "../theme";
import type { EquipmentSlot, InventoryItem, ItemDefinition } from "../../services/inventoryService";

type CharacterInventorySheetProps = {
  items: InventoryItem[];
  equippedItems: Record<string, ItemDefinition | null>;
  selectedItem: InventoryItem | null;
  activeTab: PlayerInventoryTab;
  totalWeight: number;
  carryCapacity: number;
  currentHealth: number;
  maxHealth: number;
  message: string | null;
  onClose: () => void;
  onSelectTab: (tab: PlayerInventoryTab) => void;
  onSelectItem: (itemId: string | null) => void;
  onEquipItem: (entry: InventoryItem) => void;
  onUnequipSlot: (slot: EquipmentSlot) => void;
  onUseItem: (entry: InventoryItem) => void;
  onUseScroll: (entry: InventoryItem) => void;
  onDropItem: (entry: InventoryItem) => void;
};

export function CharacterInventorySheet(props: CharacterInventorySheetProps) {
  return (
    <Screen>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Pack</Text>
            <Text style={styles.title}>Inventory</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={props.onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        <PlayerInventoryPanel
          items={props.items}
          equippedItems={props.equippedItems}
          selectedItem={props.selectedItem}
          activeTab={props.activeTab}
          totalWeight={props.totalWeight}
          carryCapacity={props.carryCapacity}
          currentHealth={props.currentHealth}
          maxHealth={props.maxHealth}
          message={props.message}
          onSelectTab={props.onSelectTab}
          onSelectItem={props.onSelectItem}
          onEquipItem={props.onEquipItem}
          onUnequipSlot={props.onUnequipSlot}
          onUseItem={props.onUseItem}
          onUseScroll={props.onUseScroll}
          onDropItem={props.onDropItem}
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
