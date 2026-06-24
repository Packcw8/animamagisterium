import { supabase, Tables } from "../lib/supabase";
import type { CharacterWithDetails } from "./characterService";
import type { CharacterResources } from "./abilityService";

export type ItemDefinition = Tables["item_definitions"];
export type PlayerInventoryRow = Tables["player_inventory"];
export type EquippedItemRow = Tables["equipped_items"];
export type GameBalanceSetting = Tables["game_balance_settings"];
export type EquipmentSlot = EquippedItemRow["slot"];

export type InventoryItem = PlayerInventoryRow & {
  item: ItemDefinition;
  equippedSlot: EquipmentSlot | null;
};

export type InventoryState = {
  items: InventoryItem[];
  definitions: ItemDefinition[];
  equipped: Record<EquipmentSlot, ItemDefinition | null>;
  totalWeight: number;
  carryCapacity: number;
};

export type CarrySettings = {
  baseCarryWeight: number;
  carryWeightPerStrengthLevel: number;
};

export const itemTypes: ItemDefinition["type"][] = ["weapon", "armor", "wearable", "potion", "revive potion", "consumable", "food", "scroll", "special", "material", "misc"];
export const equipmentSlots: EquipmentSlot[] = ["weapon", "armor", "necklace", "ring", "charm", "relic"];
export const rarityOptions = ["common", "uncommon", "rare", "epic", "legendary"];
export const costTypes: ItemDefinition["ability_cost_type"][] = ["none", "health", "stamina", "magika"];
export const elementalTypes: ItemDefinition["elemental_damage_type"][] = ["none", "fire", "ice", "poison", "lightning", "shadow", "holy"];
export const onHitEffects = ["restore health per hit", "restore stamina per hit", "restore magika per hit", "burn enemy", "poison enemy", "weaken enemy"] as const;
export const buffTargets = ["max health", "max stamina", "max magika", "strength", "agility", "intelligence", "charisma", "defense", "damage", "gold gain", "xp gain"] as const;
export const boostTargets = ["health", "stamina", "magika", "strength", "agility", "intelligence", "charisma", "defense", "damage", "gold gain", "xp gain"] as const;
export const potionTargets = ["health", "stamina", "magika"] as const;
export const usageContexts: ItemDefinition["usage_context"][] = ["battle_only", "outside_battle_only", "both"];
export const inventoryAssetBasePath = "/assets/InventoryItems/";
export const abilityAssetBasePath = "/assets/Abilities/";
export const defaultCarrySettings: CarrySettings = {
  baseCarryWeight: 50,
  carryWeightPerStrengthLevel: 10,
};

function resolveAssetImageUri(imagePath: string | null | undefined, basePath: string, folderAliases: RegExp[] = []) {
  const trimmed = imagePath?.trim();

  if (!trimmed) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replaceAll("\\", "/");
  const fixedFolder = folderAliases.reduce((current, alias) => current.replace(alias, basePath), normalized);

  if (fixedFolder.startsWith(basePath)) {
    return fixedFolder;
  }

  const relativeBasePath = basePath.replace(/^\//, "");
  if (fixedFolder.startsWith(relativeBasePath)) {
    return `/${fixedFolder}`;
  }

  if (!fixedFolder.includes("/")) {
    return `${basePath}${fixedFolder}`;
  }

  return fixedFolder.startsWith("/") ? fixedFolder : `/${fixedFolder}`;
}

export function resolveInventoryImageUri(imagePath?: string | null) {
  return resolveAssetImageUri(imagePath, inventoryAssetBasePath, [/^\/?assets\/inventory\//i]);
}

export function resolveAbilityImageUri(imagePath?: string | null) {
  return resolveAssetImageUri(imagePath, abilityAssetBasePath, [/^\/?assets\/ability\//i, /^\/?assets\/abilities\//i]);
}

export function blankItemDefinition(): Partial<ItemDefinition> {
  return {
    name: "",
    type: "misc",
    rarity: "common",
    description: "",
    image_path: inventoryAssetBasePath,
    gold_value: 0,
    weight: 0,
    stackable: false,
    sellable: true,
    usable_in_battle: false,
    usable_outside_battle: false,
    usage_context: "battle_only",
    crafting_value: null,
    equipment_slot: null,
    damage_amount: 0,
    ability_name: "",
    ability_cost_type: "none",
    ability_cost_amount: 0,
    elemental_damage_type: "none",
    elemental_damage_amount: 0,
    on_hit_effect: null,
    armor_value: 0,
    buff_target: null,
    buff_amount: 0,
    potion_target: null,
    restore_amount: 0,
    restore_percent: null,
    boost_target: null,
    boost_amount: 0,
    passive_mode: null,
    linked_ability_id: null,
    teaches_ability_id: null,
    is_active: true,
  };
}

export async function getInventoryState(characterId: string): Promise<InventoryState> {
  await ensureEquipmentSlots(characterId);

  const [definitionsResult, inventoryResult, equippedResult] = await Promise.all([
    supabase.from("item_definitions").select("*").order("created_at", { ascending: false }),
    supabase.from("player_inventory").select("*").eq("character_id", characterId).order("updated_at", { ascending: false }),
    supabase.from("equipped_items").select("*").eq("character_id", characterId).order("slot", { ascending: true }),
  ]);

  if (definitionsResult.error) {
    throw definitionsResult.error;
  }

  if (inventoryResult.error) {
    throw inventoryResult.error;
  }

  if (equippedResult.error) {
    throw equippedResult.error;
  }

  const definitions = (definitionsResult.data ?? []) as ItemDefinition[];
  const equippedRows = (equippedResult.data ?? []) as EquippedItemRow[];
  const equipped = Object.fromEntries(
    equipmentSlots.map((slot) => {
      const row = equippedRows.find((item) => item.slot === slot);
      return [slot, definitions.find((definition) => definition.id === row?.item_id) ?? null];
    }),
  ) as Record<EquipmentSlot, ItemDefinition | null>;

  const items = ((inventoryResult.data ?? []) as PlayerInventoryRow[]).map((row) => {
    const item = definitions.find((definition) => definition.id === row.item_id);
    return item
      ? {
          ...row,
          item,
          equippedSlot: equippedRows.find((equippedRow) => equippedRow.item_id === row.item_id)?.slot ?? null,
        }
      : null;
  }).filter(Boolean) as InventoryItem[];

  const [strength, carrySettings] = await Promise.all([getCharacterStrength(characterId), getCarrySettings()]);
  return {
    items,
    definitions,
    equipped,
    totalWeight: getInventoryWeight(items),
    carryCapacity: getCarryCapacity(strength, carrySettings),
  };
}

export async function getItemDefinitions() {
  const { data, error } = await supabase
    .from("item_definitions")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ItemDefinition[];
}

export async function saveItemDefinition(input: Partial<ItemDefinition>) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const values = normalizeItemInput(input, user?.id ?? null);
  const request = input.id
    ? supabase.from("item_definitions").update(values).eq("id", input.id).select().single()
    : supabase.from("item_definitions").insert(values).select().single();
  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data as ItemDefinition;
}

export async function deleteItemDefinition(itemId: string) {
  const { error } = await supabase.from("item_definitions").delete().eq("id", itemId);

  if (error) {
    throw error;
  }
}

export async function grantItemToCharacter(characterId: string, itemId: string, quantity = 1) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be signed in.");
  }

  await assertCanCarryItem(characterId, itemId, quantity);

  const { data: existing, error: existingError } = await supabase.from("player_inventory").select("*").eq("character_id", characterId).eq("item_id", itemId).maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    const { error } = await supabase
      .from("player_inventory")
      .update({ quantity: existing.quantity + quantity, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabase.from("player_inventory").insert({
    user_id: user.id,
    character_id: characterId,
    item_id: itemId,
    quantity,
  });

  if (error) {
    throw error;
  }
}

export async function equipInventoryItem(characterId: string, item: ItemDefinition) {
  if (!item.equipment_slot) {
    throw new Error("This item has no equipment slot.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be signed in.");
  }

  await ensureEquipmentSlots(characterId);
  const { error } = await supabase.from("equipped_items").upsert(
    {
      user_id: user.id,
      character_id: characterId,
      slot: item.equipment_slot,
      item_id: item.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "character_id,slot" },
  );

  if (error) {
    throw error;
  }
}

export async function unequipInventorySlot(characterId: string, slot: EquipmentSlot) {
  const { error } = await supabase.from("equipped_items").update({ item_id: null, updated_at: new Date().toISOString() }).eq("character_id", characterId).eq("slot", slot);

  if (error) {
    throw error;
  }
}

export async function sellInventoryItem(character: CharacterWithDetails, inventoryItem: InventoryItem) {
  if (!inventoryItem.item.sellable) {
    throw new Error("This item cannot be sold.");
  }

  await consumeInventoryItem(inventoryItem, 1);
  const { error } = await supabase
    .from("characters")
    .update({ gold: character.gold + inventoryItem.item.gold_value })
    .eq("id", character.id)
    .eq("user_id", character.user_id);

  if (error) {
    throw error;
  }
}

export async function consumeInventoryItem(inventoryItem: InventoryItem, amount = 1) {
  const nextQuantity = inventoryItem.quantity - amount;

  if (nextQuantity > 0) {
    const { error } = await supabase.from("player_inventory").update({ quantity: nextQuantity, updated_at: new Date().toISOString() }).eq("id", inventoryItem.id);
    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabase.from("player_inventory").delete().eq("id", inventoryItem.id);

  if (error) {
    throw error;
  }
}

export function getInventoryResourceBonuses(equipped: Record<EquipmentSlot, ItemDefinition | null>) {
  const items = Object.values(equipped).filter(Boolean) as ItemDefinition[];
  return {
    maxHp: items.filter((item) => item.buff_target === "max health").reduce((sum, item) => sum + item.buff_amount, 0),
    maxStamina: items.filter((item) => item.buff_target === "max stamina").reduce((sum, item) => sum + item.buff_amount, 0),
    maxMagicka: items.filter((item) => item.buff_target === "max magika").reduce((sum, item) => sum + item.buff_amount, 0),
    damage: items.filter((item) => item.buff_target === "damage").reduce((sum, item) => sum + item.buff_amount, 0),
    defense: items.reduce((sum, item) => sum + item.armor_value + (item.buff_target === "defense" ? item.buff_amount : 0), 0),
  };
}

export function getCarryCapacity(strengthLevel: number, settings = defaultCarrySettings) {
  return settings.baseCarryWeight + Math.max(0, strengthLevel) * settings.carryWeightPerStrengthLevel;
}

export function getInventoryWeight(items: InventoryItem[]) {
  return items.reduce((sum, entry) => sum + Number(entry.item.weight ?? 0) * entry.quantity, 0);
}

export async function getCarrySettings(): Promise<CarrySettings> {
  const { data, error } = await supabase.from("game_balance_settings").select("*").in("key", ["base_carry_weight", "carry_weight_per_strength_level"]);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as GameBalanceSetting[];
  return {
    baseCarryWeight: Number(rows.find((row) => row.key === "base_carry_weight")?.value ?? defaultCarrySettings.baseCarryWeight),
    carryWeightPerStrengthLevel: Number(rows.find((row) => row.key === "carry_weight_per_strength_level")?.value ?? defaultCarrySettings.carryWeightPerStrengthLevel),
  };
}

export async function saveCarrySettings(settings: CarrySettings) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("game_balance_settings").upsert(
    [
      { key: "base_carry_weight", value: Number(settings.baseCarryWeight) || defaultCarrySettings.baseCarryWeight, updated_at: now },
      { key: "carry_weight_per_strength_level", value: Number(settings.carryWeightPerStrengthLevel) || defaultCarrySettings.carryWeightPerStrengthLevel, updated_at: now },
    ],
    { onConflict: "key" },
  );

  if (error) {
    throw error;
  }
}

export function getBattleUsableItems(items: InventoryItem[], isDefeated: boolean) {
  return items.filter((entry) => {
    if (entry.quantity <= 0) {
      return false;
    }

    if (isDefeated) {
      return isReviveBattleItem(entry.item);
    }

    if (!canUseItemInContext(entry.item, "battle")) {
      return false;
    }

    return !isReviveBattleItem(entry.item) || entry.item.usable_in_battle;
  });
}

export function canUseItemInContext(item: ItemDefinition, context: "battle" | "outside") {
  const usage = item.usage_context ?? (item.usable_in_battle && item.usable_outside_battle ? "both" : item.usable_outside_battle ? "outside_battle_only" : "battle_only");
  if (usage === "both") {
    return true;
  }
  return context === "battle" ? usage === "battle_only" : usage === "outside_battle_only";
}

export function isHealingConsumable(item: ItemDefinition) {
  return ["potion", "revive potion", "consumable", "food"].includes(item.type) && (item.potion_target ?? "health") === "health";
}

export function isReviveBattleItem(item: ItemDefinition) {
  return item.type === "revive potion" || (item.type === "scroll" && /revive/i.test(item.name));
}

async function ensureEquipmentSlots(characterId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return;
  }

  const { error } = await supabase.from("equipped_items").upsert(
    equipmentSlots.map((slot) => ({
      user_id: user.id,
      character_id: characterId,
      slot,
      item_id: null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "character_id,slot", ignoreDuplicates: true },
  );

  if (error) {
    throw error;
  }
}

function normalizeItemInput(input: Partial<ItemDefinition>, userId: string | null) {
  const usageContext = input.usage_context ?? (input.usable_in_battle && input.usable_outside_battle ? "both" : input.usable_outside_battle ? "outside_battle_only" : "battle_only");

  return {
    name: input.name?.trim() || "Unnamed Item",
    type: input.type ?? "misc",
    rarity: input.rarity?.trim() || "common",
    description: input.description?.trim() || null,
    image_path: input.image_path?.trim() || null,
    gold_value: Number(input.gold_value) || 0,
    weight: Number(input.weight) || 0,
    stackable: Boolean(input.stackable),
    sellable: Boolean(input.sellable),
    usable_in_battle: usageContext === "battle_only" || usageContext === "both",
    usable_outside_battle: usageContext === "outside_battle_only" || usageContext === "both",
    usage_context: usageContext,
    crafting_value: input.crafting_value === null || input.crafting_value === undefined ? null : Number(input.crafting_value) || 0,
    equipment_slot: input.equipment_slot ?? null,
    damage_amount: Number(input.damage_amount) || 0,
    ability_name: input.ability_name?.trim() || null,
    ability_cost_type: input.ability_cost_type ?? "none",
    ability_cost_amount: Number(input.ability_cost_amount) || 0,
    elemental_damage_type: input.elemental_damage_type ?? "none",
    elemental_damage_amount: Number(input.elemental_damage_amount) || 0,
    on_hit_effect: input.on_hit_effect ?? null,
    armor_value: Number(input.armor_value) || 0,
    buff_target: input.buff_target ?? null,
    buff_amount: Number(input.buff_amount) || 0,
    potion_target: input.potion_target ?? null,
    restore_amount: Number(input.restore_amount) || 0,
    restore_percent: input.restore_percent === null || input.restore_percent === undefined ? null : Number(input.restore_percent) || null,
    boost_target: input.boost_target ?? null,
    boost_amount: Number(input.boost_amount) || 0,
    passive_mode: input.passive_mode ?? null,
    linked_ability_id: input.linked_ability_id ?? null,
    teaches_ability_id: input.teaches_ability_id ?? null,
    is_active: input.is_active ?? true,
    created_by: input.id ? input.created_by ?? userId : userId,
    updated_at: new Date().toISOString(),
  };
}

async function assertCanCarryItem(characterId: string, itemId: string, quantity: number) {
  const [inventoryResult, definitionsResult, strength, carrySettings] = await Promise.all([
    supabase.from("player_inventory").select("*").eq("character_id", characterId),
    supabase.from("item_definitions").select("*"),
    getCharacterStrength(characterId),
    getCarrySettings(),
  ]);

  if (inventoryResult.error) {
    throw inventoryResult.error;
  }

  if (definitionsResult.error) {
    throw definitionsResult.error;
  }

  const definitions = (definitionsResult.data ?? []) as ItemDefinition[];
  const item = definitions.find((definition) => definition.id === itemId);

  if (!item) {
    throw new Error("Item definition could not be found.");
  }

  const currentItems = ((inventoryResult.data ?? []) as PlayerInventoryRow[]).map((row) => {
    const definition = definitions.find((entry) => entry.id === row.item_id);
    return definition ? { ...row, item: definition, equippedSlot: null } : null;
  }).filter(Boolean) as InventoryItem[];
  const nextWeight = getInventoryWeight(currentItems) + Number(item.weight ?? 0) * Math.max(1, quantity);
  const capacity = getCarryCapacity(strength, carrySettings);

  if (nextWeight > capacity) {
    throw new Error(`Inventory too heavy. Inventory would be ${nextWeight.toFixed(1)} / ${capacity.toFixed(1)} weight.`);
  }
}

async function getCharacterStrength(characterId: string) {
  const { data, error } = await supabase.from("attributes").select("strength").eq("character_id", characterId).maybeSingle();

  if (error) {
    throw error;
  }

  return Number(data?.strength ?? 0);
}
