import { supabase, type Tables } from "../lib/supabase";
import type { InventoryItem, ItemDefinition } from "./inventoryService";

export type FarmingLootPool = Tables["farming_loot_pools"];
export type FarmingLootPoolItem = Tables["farming_loot_pool_items"];
export type FarmingActivity = FarmingLootPool["activity_type"];
export type FarmingPoolWithItems = FarmingLootPool & {
  items: Array<FarmingLootPoolItem & { item?: ItemDefinition | null; requiredUtility?: ItemDefinition | null }>;
};

export const farmingActivities: FarmingActivity[] = ["general", "fishing", "mining", "hunting", "foraging"];
export const farmingRarities: FarmingLootPoolItem["rarity"][] = ["common", "uncommon", "rare", "epic", "legendary"];

export function blankFarmingLootPool(): Partial<FarmingLootPool> {
  return {
    name: "",
    pool_key: "",
    activity_type: "general",
    description: "",
    required_item_id: null,
    content_scope: "chapter",
    season_number: 1,
    chapter_number: 1,
    is_active: true,
  };
}

export function blankFarmingLootPoolItem(poolId?: string | null): Partial<FarmingLootPoolItem> {
  return {
    pool_id: poolId ?? "",
    item_id: "",
    rarity: "common",
    drop_weight: 1,
    min_quantity: 1,
    max_quantity: 1,
    required_utility_item_id: null,
    bonus_weight_if_utility: 0,
    sort_order: 0,
    is_active: true,
  };
}

export async function getFarmingLootPools() {
  const [poolsResult, itemsResult] = await Promise.all([
    supabase.from("farming_loot_pools").select("*").order("season_number", { ascending: true }).order("chapter_number", { ascending: true }).order("name", { ascending: true }),
    supabase.from("farming_loot_pool_items").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
  ]);

  if (poolsResult.error) throw poolsResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const items = (itemsResult.data ?? []) as FarmingLootPoolItem[];
  return ((poolsResult.data ?? []) as FarmingLootPool[]).map((pool) => ({
    ...pool,
    items: items.filter((item) => item.pool_id === pool.id),
  })) as FarmingPoolWithItems[];
}

export async function saveFarmingLootPool(input: Partial<FarmingLootPool>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const contentScope = input.content_scope === "universal" ? "universal" : "chapter";
  const values = {
    name: input.name?.trim() || "New Loot Pool",
    pool_key: input.pool_key?.trim() || slugify(input.name || "loot_pool"),
    activity_type: input.activity_type ?? "general",
    description: input.description?.trim() || null,
    required_item_id: input.required_item_id || null,
    content_scope: contentScope,
    season_number: contentScope === "chapter" ? Number(input.season_number) || 1 : 1,
    chapter_number: contentScope === "chapter" ? Number(input.chapter_number) || 1 : 1,
    is_active: input.is_active ?? true,
    created_by: input.id ? input.created_by ?? user?.id ?? null : user?.id ?? null,
    updated_at: new Date().toISOString(),
  };

  const request = input.id
    ? supabase.from("farming_loot_pools").update(values).eq("id", input.id).select("*").single()
    : supabase.from("farming_loot_pools").insert(values).select("*").single();
  const { data, error } = await request;
  if (error) throw error;
  return data as FarmingLootPool;
}

export async function deleteFarmingLootPool(poolId: string) {
  const { error } = await supabase.from("farming_loot_pools").delete().eq("id", poolId);
  if (error) throw error;
}

export async function saveFarmingLootPoolItem(input: Partial<FarmingLootPoolItem>) {
  const values = {
    pool_id: input.pool_id,
    item_id: input.item_id,
    rarity: input.rarity ?? "common",
    drop_weight: Math.max(0, Number(input.drop_weight) || 0),
    min_quantity: Math.max(1, Number(input.min_quantity) || 1),
    max_quantity: Math.max(Math.max(1, Number(input.min_quantity) || 1), Number(input.max_quantity) || 1),
    required_utility_item_id: input.required_utility_item_id || null,
    bonus_weight_if_utility: Math.max(0, Number(input.bonus_weight_if_utility) || 0),
    sort_order: Number(input.sort_order) || 0,
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  const request = input.id
    ? supabase.from("farming_loot_pool_items").update(values).eq("id", input.id).select("*").single()
    : supabase.from("farming_loot_pool_items").insert(values).select("*").single();
  const { data, error } = await request;
  if (error) throw error;
  return data as FarmingLootPoolItem;
}

export async function deleteFarmingLootPoolItem(poolItemId: string) {
  const { error } = await supabase.from("farming_loot_pool_items").delete().eq("id", poolItemId);
  if (error) throw error;
}

export function getOwnedUtilityItemIds(inventoryItems: InventoryItem[]) {
  return new Set(inventoryItems.filter((entry) => Number(entry.quantity ?? 0) > 0).map((entry) => entry.item_id));
}

export function rollFarmingLoot(pool: FarmingPoolWithItems, inventoryItems: InventoryItem[]) {
  const ownedUtilityIds = getOwnedUtilityItemIds(inventoryItems);
  const candidates = pool.items
    .filter((item) => item.is_active)
    .filter((item) => !item.required_utility_item_id || ownedUtilityIds.has(item.required_utility_item_id))
    .map((item) => ({
      item,
      weight: Math.max(0, Number(item.drop_weight ?? 0) + (item.required_utility_item_id && ownedUtilityIds.has(item.required_utility_item_id) ? Number(item.bonus_weight_if_utility ?? 0) : 0)),
    }))
    .filter((entry) => entry.weight > 0);

  const totalWeight = candidates.reduce((total, entry) => total + entry.weight, 0);
  if (!candidates.length || totalWeight <= 0) {
    return null;
  }

  let roll = Math.random() * totalWeight;
  const selected = candidates.find((entry) => {
    roll -= entry.weight;
    return roll <= 0;
  }) ?? candidates[candidates.length - 1];

  const minQuantity = Math.max(1, Number(selected.item.min_quantity ?? 1) || 1);
  const maxQuantity = Math.max(minQuantity, Number(selected.item.max_quantity ?? minQuantity) || minQuantity);
  const quantity = minQuantity + Math.floor(Math.random() * (maxQuantity - minQuantity + 1));
  return { poolItem: selected.item, quantity };
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "loot_pool";
}
