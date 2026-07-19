import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  blankFarmingLootPool,
  blankFarmingLootPoolItem,
  deleteFarmingLootPool,
  deleteFarmingLootPoolItem,
  farmingActivities,
  farmingRarities,
  getFarmingLootPools,
  saveFarmingLootPool,
  saveFarmingLootPoolItem,
  type FarmingLootPool,
  type FarmingLootPoolItem,
  type FarmingPoolWithItems,
} from "../../services/farmingService";
import type { ItemDefinition } from "../../services/inventoryService";
import { colors, fonts } from "../theme";

type FarmingAdminPanelProps = {
  itemDefinitions: ItemDefinition[];
  seasonNumber: number;
  chapterNumber: number;
  onMessage: (message: string) => void;
};

export function FarmingAdminPanel({ itemDefinitions, seasonNumber, chapterNumber, onMessage }: FarmingAdminPanelProps) {
  const [pools, setPools] = useState<FarmingPoolWithItems[]>([]);
  const [poolForm, setPoolForm] = useState<Partial<FarmingLootPool>>({ ...blankFarmingLootPool(), season_number: seasonNumber, chapter_number: chapterNumber });
  const [itemForm, setItemForm] = useState<Partial<FarmingLootPoolItem>>(blankFarmingLootPoolItem());
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [editingPoolItemId, setEditingPoolItemId] = useState<string | null>(null);

  const scopedPools = useMemo(
    () => pools.filter((pool) => pool.content_scope === "universal" || (Number(pool.season_number) === seasonNumber && Number(pool.chapter_number) === chapterNumber)),
    [chapterNumber, pools, seasonNumber],
  );
  const selectedPool = useMemo(() => pools.find((pool) => pool.id === itemForm.pool_id) ?? scopedPools[0] ?? null, [itemForm.pool_id, pools, scopedPools]);
  const utilityItems = useMemo(() => itemDefinitions.filter((item) => ["tool", "utility", "bait", "weapon", "special"].includes(item.type)), [itemDefinitions]);

  useEffect(() => {
    void loadPools();
  }, []);

  useEffect(() => {
    if (!editingPoolId) {
      setPoolForm((current) => ({ ...current, season_number: seasonNumber, chapter_number: chapterNumber }));
    }
  }, [chapterNumber, editingPoolId, seasonNumber]);

  async function loadPools() {
    try {
      const nextPools = await getFarmingLootPools();
      setPools(nextPools);
      if (!itemForm.pool_id && nextPools[0]) {
        setItemForm((current) => ({ ...current, pool_id: nextPools[0].id }));
      }
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to load farming loot pools. Run the farming migration first.");
    }
  }

  async function savePool() {
    try {
      const saved = await saveFarmingLootPool({
        ...poolForm,
        id: editingPoolId ?? undefined,
        season_number: seasonNumber,
        chapter_number: chapterNumber,
      });
      onMessage(`Saved loot pool: ${saved.name}.`);
      setEditingPoolId(null);
      setPoolForm({ ...blankFarmingLootPool(), season_number: seasonNumber, chapter_number: chapterNumber });
      await loadPools();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to save loot pool.");
    }
  }

  async function removePool(poolId: string) {
    try {
      await deleteFarmingLootPool(poolId);
      onMessage("Loot pool deleted.");
      await loadPools();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to delete loot pool.");
    }
  }

  async function savePoolItem() {
    if (!itemForm.pool_id || !itemForm.item_id) {
      onMessage("Choose a loot pool and an item before saving a drop.");
      return;
    }

    try {
      await saveFarmingLootPoolItem({ ...itemForm, id: editingPoolItemId ?? undefined });
      onMessage("Loot pool drop saved.");
      setEditingPoolItemId(null);
      setItemForm(blankFarmingLootPoolItem(itemForm.pool_id));
      await loadPools();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to save loot pool drop.");
    }
  }

  async function removePoolItem(poolItemId: string) {
    try {
      await deleteFarmingLootPoolItem(poolItemId);
      onMessage("Loot pool drop deleted.");
      await loadPools();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Unable to delete loot pool drop.");
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Farming Loot Pools</Text>
      <Text style={styles.muted}>Use these for fishing, mining, hunting, and repeatable farming trails. Link a pool from the walking path editor.</Text>
      <View style={styles.builder}>
        <TextInput value={poolForm.name ?? ""} onChangeText={(value) => setPoolForm((current) => ({ ...current, name: value }))} placeholder="Pool name" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={poolForm.pool_key ?? ""} onChangeText={(value) => setPoolForm((current) => ({ ...current, pool_key: value }))} placeholder="Pool key, example fishing_whisper_creek" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={poolForm.description ?? ""} onChangeText={(value) => setPoolForm((current) => ({ ...current, description: value }))} placeholder="Admin notes / player hint" placeholderTextColor={colors.muted} style={styles.input} />
        <ChoiceRow label="Activity" options={farmingActivities} value={poolForm.activity_type ?? "general"} onSelect={(value) => setPoolForm((current) => ({ ...current, activity_type: value }))} />
        <ChoiceRow label="Scope" options={["chapter", "universal"]} value={poolForm.content_scope ?? "chapter"} onSelect={(value) => setPoolForm((current) => ({ ...current, content_scope: value as FarmingLootPool["content_scope"] }))} />
        <ItemChoice label="Pool required item" items={utilityItems} value={poolForm.required_item_id ?? ""} onSelect={(value) => setPoolForm((current) => ({ ...current, required_item_id: value || null }))} />
        <Pressable style={styles.primaryButton} onPress={() => void savePool()}>
          <Text style={styles.primaryText}>{editingPoolId ? "Update Loot Pool" : "Create Loot Pool"}</Text>
        </Pressable>
      </View>

      <Text style={styles.subTitle}>Drops</Text>
      <ChoiceRow label="Editing Pool" options={scopedPools.map((pool) => pool.id)} value={itemForm.pool_id ?? selectedPool?.id ?? ""} labels={Object.fromEntries(scopedPools.map((pool) => [pool.id, pool.name]))} onSelect={(value) => setItemForm((current) => ({ ...current, pool_id: value }))} />
      <ItemChoice label="Dropped item" items={itemDefinitions} value={itemForm.item_id ?? ""} onSelect={(value) => setItemForm((current) => ({ ...current, item_id: value }))} />
      <ChoiceRow label="Rarity" options={farmingRarities} value={itemForm.rarity ?? "common"} onSelect={(value) => setItemForm((current) => ({ ...current, rarity: value }))} />
      <View style={styles.grid}>
        <AdminNumber label="Drop weight" value={itemForm.drop_weight ?? 1} onChange={(value) => setItemForm((current) => ({ ...current, drop_weight: value }))} />
        <AdminNumber label="Min qty" value={itemForm.min_quantity ?? 1} onChange={(value) => setItemForm((current) => ({ ...current, min_quantity: value }))} />
        <AdminNumber label="Max qty" value={itemForm.max_quantity ?? 1} onChange={(value) => setItemForm((current) => ({ ...current, max_quantity: value }))} />
        <AdminNumber label="Sort" value={itemForm.sort_order ?? 0} onChange={(value) => setItemForm((current) => ({ ...current, sort_order: value }))} />
      </View>
      <ItemChoice label="Bonus utility item" items={utilityItems} value={itemForm.required_utility_item_id ?? ""} onSelect={(value) => setItemForm((current) => ({ ...current, required_utility_item_id: value || null }))} />
      <AdminNumber label="Bonus weight if owned" value={itemForm.bonus_weight_if_utility ?? 0} onChange={(value) => setItemForm((current) => ({ ...current, bonus_weight_if_utility: value }))} />
      <Pressable style={styles.primaryButton} onPress={() => void savePoolItem()}>
        <Text style={styles.primaryText}>{editingPoolItemId ? "Update Drop" : "Add Drop"}</Text>
      </Pressable>

      {scopedPools.map((pool) => (
        <View key={pool.id} style={styles.card}>
          <Text style={styles.cardTitle}>{pool.name}</Text>
          <Text style={styles.muted}>{pool.activity_type} / {pool.content_scope === "universal" ? "Universal" : `Season ${pool.season_number} Chapter ${pool.chapter_number}`}</Text>
          {pool.description ? <Text style={styles.copy}>{pool.description}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.smallButton} onPress={() => {
              setEditingPoolId(pool.id);
              setPoolForm(pool);
            }}>
              <Text style={styles.smallText}>Edit Pool</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={() => void removePool(pool.id)}>
              <Text style={styles.smallText}>Delete Pool</Text>
            </Pressable>
          </View>
          {pool.items.length === 0 ? <Text style={styles.muted}>No drops yet.</Text> : null}
          {pool.items.map((entry) => (
            <View key={entry.id} style={styles.dropRow}>
              <View style={styles.dropBody}>
                <Text style={styles.copy}>{getItemName(itemDefinitions, entry.item_id)} x{entry.min_quantity}-{entry.max_quantity}</Text>
                <Text style={styles.muted}>{entry.rarity} / weight {entry.drop_weight}</Text>
              </View>
              <Pressable style={styles.smallButton} onPress={() => {
                setEditingPoolItemId(entry.id);
                setItemForm(entry);
              }}>
                <Text style={styles.smallText}>Edit</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => void removePoolItem(entry.id)}>
                <Text style={styles.smallText}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function AdminNumber({ label, value, onChange }: { label: string; value: string | number; onChange: (value: number) => void }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.infoLabel}>{label}</Text>
      <TextInput value={String(value ?? "")} onChangeText={(text) => onChange(Number(text) || 0)} placeholder={label} placeholderTextColor={colors.muted} style={styles.input} keyboardType="numeric" />
    </View>
  );
}

function ChoiceRow<T extends string>({ label, options, value, labels, onSelect }: { label: string; options: readonly T[]; value: string; labels?: Record<string, string>; onSelect: (value: T) => void }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => (
          <Pressable key={option || "none"} style={[styles.choiceButton, value === option && styles.choiceButtonActive]} onPress={() => onSelect(option)}>
            <Text style={styles.choiceText}>{labels?.[option] ?? (option || "None")}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ItemChoice({ label, items, value, onSelect }: { label: string; items: ItemDefinition[]; value: string; onSelect: (value: string) => void }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        <Pressable style={[styles.choiceButton, !value && styles.choiceButtonActive]} onPress={() => onSelect("")}>
          <Text style={styles.choiceText}>None</Text>
        </Pressable>
        {items.map((item) => (
          <Pressable key={item.id} style={[styles.choiceButton, value === item.id && styles.choiceButtonActive]} onPress={() => onSelect(item.id)}>
            <Text style={styles.choiceText}>{item.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function getItemName(items: ItemDefinition[], itemId: string | null | undefined) {
  return items.find((item) => item.id === itemId)?.name ?? "Unknown item";
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  builder: { gap: 8, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: "#070604" },
  sectionTitle: { color: colors.gold, fontFamily: fonts.title, fontSize: 20 },
  subTitle: { color: colors.gold, fontFamily: fonts.title, fontSize: 16 },
  muted: { color: colors.muted, fontSize: 12 },
  copy: { color: colors.text, fontSize: 13 },
  inputGroup: { gap: 6 },
  infoLabel: { color: colors.gold, fontFamily: fonts.title, fontSize: 13 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text, minHeight: 44 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#070604" },
  choiceButtonActive: { borderColor: colors.blue, backgroundColor: "#083045" },
  choiceText: { color: colors.text, fontSize: 12 },
  primaryButton: { borderRadius: 8, padding: 12, alignItems: "center", backgroundColor: colors.gold },
  primaryText: { color: "#050402", fontFamily: fonts.title, fontSize: 14 },
  card: { gap: 8, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: "#050402" },
  cardTitle: { color: colors.text, fontFamily: fonts.title, fontSize: 16 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  smallButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  smallText: { color: colors.blue, fontFamily: fonts.title, fontSize: 12 },
  dropRow: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  dropBody: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
