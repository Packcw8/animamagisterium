import { supabase, Tables } from "../lib/supabase";
import type { CharacterWithDetails } from "./characterService";
import type { CharacterResources } from "./abilityService";
import { resolveGameAssetUri } from "../utils/assetResolver";

export type ItemDefinition = Tables["item_definitions"];
export type PlayerInventoryRow = Tables["player_inventory"];
export type EquippedItemRow = Tables["equipped_items"];
export type GameBalanceSetting = Tables["game_balance_settings"];
export type EquipmentSlot = EquippedItemRow["slot"];
export type WeaponEquipmentSlot = "main_hand" | "off_hand" | "weapon";
export type ArmorPieceSlot = "helmet" | "chest" | "gloves" | "legs" | "boots";

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

export const itemTypes: ItemDefinition["type"][] = ["weapon", "armor", "wearable", "potion", "revive potion", "consumable", "food", "scroll", "special", "material", "tool", "utility", "bait", "misc"];
export const utilityActivities: NonNullable<ItemDefinition["utility_activity"]>[] = ["general", "fishing", "mining", "hunting", "foraging"];
export const weaponEquipmentSlots: WeaponEquipmentSlot[] = ["main_hand", "off_hand", "weapon"];
export const armorPieceSlots: ArmorPieceSlot[] = ["helmet", "chest", "gloves", "legs", "boots"];
export const equipmentSlots: EquipmentSlot[] = ["main_hand", "off_hand", ...armorPieceSlots, "armor", "weapon", "necklace", "ring", "charm", "relic"];
export const rarityOptions = ["common", "uncommon", "rare", "epic", "legendary"];
export const costTypes: ItemDefinition["ability_cost_type"][] = ["none", "health", "stamina", "magika"];
export const elementalTypes: ItemDefinition["elemental_damage_type"][] = ["none", "fire", "ice", "poison", "lightning", "shadow", "holy"];
export const onHitEffects = ["restore health per hit", "restore stamina per hit", "restore magika per hit", "burn enemy", "poison enemy", "weaken enemy"] as const;
export const equipmentBonusTargets = ["max health", "max stamina", "max magika", "strength", "endurance", "agility", "intelligence", "wisdom", "charisma", "spirit", "defense", "damage", "gold gain", "xp gain"] as const;
export const buffTargets = equipmentBonusTargets;
export const boostTargets = ["health", "stamina", "magika", "strength", "endurance", "agility", "intelligence", "wisdom", "charisma", "spirit", "defense", "damage", "gold gain", "xp gain"] as const;
export const potionTargets = ["health", "stamina", "magika"] as const;
export const usageContexts: ItemDefinition["usage_context"][] = ["battle_only", "outside_battle_only", "both"];
export const inventoryAssetBasePath = "/assets/InventoryItems/";
export const abilityAssetBasePath = "/assets/Abilities/";
export const defaultCarrySettings: CarrySettings = {
  baseCarryWeight: 50,
  carryWeightPerStrengthLevel: 10,
};

export function resolveInventoryImageUri(imagePath?: string | null) {
  return resolveGameAssetUri(imagePath, "item");
}

export function resolveInventoryThumbnailUri(item?: Pick<ItemDefinition, "thumbnail_path" | "image_path"> | null) {
  return resolveGameAssetUri(item?.thumbnail_path || item?.image_path, "item");
}

export function resolveAbilityImageUri(imagePath?: string | null) {
  return resolveGameAssetUri(imagePath, "ability");
}

export function resolveAbilityThumbnailUri(ability?: Pick<CombatAbilityLike, "image_thumb_path" | "image_path"> | null) {
  return resolveGameAssetUri(ability?.image_thumb_path || ability?.image_path, "ability");
}

type CombatAbilityLike = Tables["combat_abilities"];

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
    attack_bonus: 0,
    ability_name: "",
    ability_cost_type: "none",
    ability_cost_amount: 0,
    elemental_damage_type: "none",
    elemental_damage_amount: 0,
    on_hit_effect: null,
    armor_value: 0,
    buff_target: null,
    buff_amount: 0,
    equip_penalty_target: null,
    equip_penalty_amount: 0,
    armor_set_key: null,
    armor_set_name: null,
    armor_piece_slot: null,
    set_bonus_target: null,
    set_bonus_amount: 0,
    set_penalty_target: null,
    set_penalty_amount: 0,
    potion_target: null,
    restore_amount: 0,
    restore_percent: null,
    boost_target: null,
    boost_amount: 0,
    passive_mode: null,
    utility_activity: null,
    rarity_bonus_percent: 0,
    extra_roll_chance_percent: 0,
    loot_pool_key: null,
    break_chance_percent: 0,
    utility_uses: null,
    linked_ability_id: null,
    teaches_ability_id: null,
    season_number: 1,
    chapter_number: 1,
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
    .order("season_number", { ascending: true })
    .order("chapter_number", { ascending: true })
    .order("type", { ascending: true })
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

  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  await assertCanCarryItem(characterId, itemId, safeQuantity);

  const { error: rpcError } = await supabase.rpc("grant_item_to_character_atomic", {
    p_character_id: characterId,
    p_item_id: itemId,
    p_quantity: safeQuantity,
  });

  if (!rpcError) {
    return;
  }

  if (!isMissingRpcError(rpcError)) {
    throw rpcError;
  }

  const { data: existing, error: existingError } = await supabase.from("player_inventory").select("*").eq("character_id", characterId).eq("item_id", itemId).maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    const { error } = await supabase
      .from("player_inventory")
      .update({ quantity: existing.quantity + safeQuantity, updated_at: new Date().toISOString() })
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
    quantity: safeQuantity,
  });

  if (error) {
    throw error;
  }
}

function isMissingRpcError(error: { message?: string; code?: string } | null) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42883" || message.includes("function") && message.includes("does not exist");
}

export async function equipInventoryItem(characterId: string, item: ItemDefinition, slotOverride?: EquipmentSlot) {
  const targetSlot = slotOverride ?? (item.type === "weapon" ? normalizeWeaponSlot(item.equipment_slot) : item.equipment_slot);

  if (!targetSlot) {
    throw new Error("This item has no equipment slot.");
  }

  if (!isItemCompatibleWithSlot(item, targetSlot)) {
    throw new Error(`${item.name} cannot be equipped in ${formatEquipmentSlotLabel(targetSlot)}.`);
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
  await assertCanEquipItemInAdditionalSlot(characterId, item, targetSlot);
  await clearConflictingWeaponSlots(characterId, targetSlot);
  const { error } = await supabase.from("equipped_items").upsert(
    {
      user_id: user.id,
      character_id: characterId,
      slot: targetSlot,
      item_id: item.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "character_id,slot" },
  );

  if (error) {
    throw error;
  }
}

export function getCompatibleEquipmentSlots(item: ItemDefinition): EquipmentSlot[] {
  if (item.type === "weapon") {
    if (item.equipment_slot === "main_hand") {
      return ["main_hand"];
    }
    if (item.equipment_slot === "off_hand") {
      return ["off_hand"];
    }
    if (item.equipment_slot === "weapon") {
      return ["weapon"];
    }
    return ["main_hand"];
  }

  if (item.type === "armor") {
    const armorSlot = item.armor_piece_slot ?? item.equipment_slot;
    if (armorSlot && armorPieceSlots.includes(armorSlot as ArmorPieceSlot)) {
      return [armorSlot as EquipmentSlot];
    }
    return ["chest"];
  }

  if (item.equipment_slot) {
    return [item.equipment_slot];
  }

  return [];
}

export function formatEquipmentSlotLabel(slot: EquipmentSlot | string) {
  const labels: Record<string, string> = {
    main_hand: "Main Hand",
    off_hand: "Off Hand",
    weapon: "Two-Handed",
    helmet: "Helmet",
    chest: "Chest",
    gloves: "Gloves",
    legs: "Legs",
    boots: "Boots",
    armor: "Legacy Armor",
    necklace: "Necklace",
    ring: "Ring",
    charm: "Charm",
    relic: "Relic",
  };
  return labels[slot] ?? slot.replaceAll("_", " ");
}

function isItemCompatibleWithSlot(item: ItemDefinition, slot: EquipmentSlot) {
  return getCompatibleEquipmentSlots(item).includes(slot);
}

function normalizeWeaponSlot(slot: ItemDefinition["equipment_slot"]): EquipmentSlot {
  if (slot === "off_hand" || slot === "weapon") {
    return slot;
  }
  return "main_hand";
}

async function clearConflictingWeaponSlots(characterId: string, targetSlot: EquipmentSlot) {
  if (targetSlot === "weapon") {
    const { error } = await supabase
      .from("equipped_items")
      .update({ item_id: null, updated_at: new Date().toISOString() })
      .eq("character_id", characterId)
      .in("slot", ["main_hand", "off_hand"]);

    if (error) {
      throw error;
    }
    return;
  }

  if (targetSlot === "main_hand" || targetSlot === "off_hand") {
    const { error } = await supabase
      .from("equipped_items")
      .update({ item_id: null, updated_at: new Date().toISOString() })
      .eq("character_id", characterId)
      .eq("slot", "weapon");

    if (error) {
      throw error;
    }
  }
}

async function assertCanEquipItemInAdditionalSlot(characterId: string, item: ItemDefinition, targetSlot: EquipmentSlot) {
  const [inventoryResult, equippedResult] = await Promise.all([
    supabase.from("player_inventory").select("quantity").eq("character_id", characterId).eq("item_id", item.id).maybeSingle(),
    supabase.from("equipped_items").select("slot,item_id").eq("character_id", characterId).eq("item_id", item.id),
  ]);

  if (inventoryResult.error) {
    throw inventoryResult.error;
  }

  if (equippedResult.error) {
    throw equippedResult.error;
  }

  const ownedQuantity = Math.max(0, Number(inventoryResult.data?.quantity ?? 0));
  const equippedInOtherSlots = (equippedResult.data ?? []).filter((row) => row.slot !== targetSlot).length;

  if (ownedQuantity > 0 && equippedInOtherSlots >= ownedQuantity) {
    const { error } = await supabase
      .from("equipped_items")
      .update({ item_id: null, updated_at: new Date().toISOString() })
      .eq("character_id", characterId)
      .eq("item_id", item.id);

    if (error) {
      throw error;
    }
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
  if (inventoryItem.equippedSlot) {
    throw new Error("Unequip this item before selling it.");
  }

  await consumeInventoryItem(inventoryItem, 1);
  return addCharacterGold(character, inventoryItem.item.gold_value);
}

export async function consumeInventoryItem(inventoryItem: InventoryItem, amount = 1) {
  const safeAmount = Math.max(1, Math.floor(Number(amount) || 1));
  const { data: currentRow, error: currentError } = await supabase
    .from("player_inventory")
    .select("*")
    .eq("id", inventoryItem.id)
    .maybeSingle();

  if (currentError) {
    throw currentError;
  }

  if (!currentRow) {
    throw new Error("This item is no longer in your inventory.");
  }

  const currentQuantity = Math.max(0, Number(currentRow.quantity) || 0);
  if (currentQuantity < safeAmount) {
    throw new Error("Not enough items remaining.");
  }

  const nextQuantity = currentQuantity - safeAmount;

  if (nextQuantity > 0) {
    const { data, error } = await supabase
      .from("player_inventory")
      .update({ quantity: nextQuantity, updated_at: new Date().toISOString() })
      .eq("id", inventoryItem.id)
      .eq("quantity", currentQuantity)
      .select("id")
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error("Inventory changed. Try again.");
    }
    return;
  }

  await clearEquippedItemReferences(currentRow.character_id, currentRow.item_id);
  const { data, error } = await supabase
    .from("player_inventory")
    .delete()
    .eq("id", inventoryItem.id)
    .eq("quantity", currentQuantity)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("Inventory changed. Try again.");
  }
}

async function clearEquippedItemReferences(characterId: string, itemId: string) {
  const { error } = await supabase
    .from("equipped_items")
    .update({ item_id: null, updated_at: new Date().toISOString() })
    .eq("character_id", characterId)
    .eq("item_id", itemId);

  if (error) {
    throw error;
  }
}

export async function addCharacterGold(character: CharacterWithDetails, goldAmount: number) {
  const safeGold = Math.max(0, Math.floor(Number(goldAmount) || 0));
  const { data: rpcCharacter, error: rpcError } = await supabase.rpc("apply_character_xp_gold_atomic", {
    p_character_id: character.id,
    p_xp: 0,
    p_gold: safeGold,
  });

  if (!rpcError) {
    return { gold: Number((rpcCharacter as CharacterWithDetails | null)?.gold ?? Number(character.gold) + safeGold) };
  }

  if (!isMissingRpcError(rpcError)) {
    throw rpcError;
  }

  const { data: currentCharacter, error: characterError } = await supabase
    .from("characters")
    .select("gold")
    .eq("id", character.id)
    .eq("user_id", character.user_id)
    .single();

  if (characterError) {
    throw characterError;
  }

  const nextGold = Number(currentCharacter.gold) + safeGold;
  const { error } = await supabase
    .from("characters")
    .update({ gold: nextGold })
    .eq("id", character.id)
    .eq("user_id", character.user_id);

  if (error) {
    throw error;
  }

  return { gold: nextGold };
}

export function getInventoryResourceBonuses(equipped: Record<EquipmentSlot, ItemDefinition | null>) {
  const items = Object.values(equipped).filter(Boolean) as ItemDefinition[];
  const bonuses = {
    maxHp: 0,
    maxStamina: 0,
    maxMagicka: 0,
    damage: 0,
    defense: 0,
    strength: 0,
    endurance: 0,
    agility: 0,
    intelligence: 0,
    wisdom: 0,
    charisma: 0,
    spirit: 0,
    goldGain: 0,
    xpGain: 0,
    completedArmorSets: [] as Array<{ key: string; name: string; bonusTarget: string | null; bonusAmount: number; penaltyTarget: string | null; penaltyAmount: number }>,
  };

  const setGroups = new Map<string, { name: string; pieces: Set<ArmorPieceSlot>; sourceItems: ItemDefinition[] }>();

  for (const item of items) {
    bonuses.defense += Number(item.armor_value ?? 0);
    applyEquipmentBonus(bonuses, item.buff_target, Number(item.buff_amount ?? 0));
    applyEquipmentBonus(bonuses, item.equip_penalty_target, -Math.abs(Number(item.equip_penalty_amount ?? 0)));

    const setKey = item.armor_set_key?.trim();
    const pieceSlot = getArmorPieceSlot(item);
    if (setKey && pieceSlot) {
      const current = setGroups.get(setKey) ?? {
        name: item.armor_set_name?.trim() || setKey,
        pieces: new Set<ArmorPieceSlot>(),
        sourceItems: [],
      };
      current.name = item.armor_set_name?.trim() || current.name;
      current.pieces.add(pieceSlot);
      current.sourceItems.push(item);
      setGroups.set(setKey, current);
    }
  }

  for (const [key, group] of setGroups) {
    const hasFullSet = armorPieceSlots.every((slot) => group.pieces.has(slot));
    if (!hasFullSet) {
      continue;
    }

    const source = group.sourceItems.find((item) => item.set_bonus_target || item.set_penalty_target) ?? group.sourceItems[0];
    const bonusTarget = source?.set_bonus_target ?? null;
    const bonusAmount = Number(source?.set_bonus_amount ?? 0);
    const penaltyTarget = source?.set_penalty_target ?? null;
    const penaltyAmount = Math.abs(Number(source?.set_penalty_amount ?? 0));
    applyEquipmentBonus(bonuses, bonusTarget, bonusAmount);
    applyEquipmentBonus(bonuses, penaltyTarget, -penaltyAmount);
    bonuses.completedArmorSets.push({
      key,
      name: group.name,
      bonusTarget,
      bonusAmount,
      penaltyTarget,
      penaltyAmount,
    });
  }

  return bonuses;
}

function getArmorPieceSlot(item: ItemDefinition): ArmorPieceSlot | null {
  const explicitSlot = item.armor_piece_slot;
  if (explicitSlot && armorPieceSlots.includes(explicitSlot as ArmorPieceSlot)) {
    return explicitSlot as ArmorPieceSlot;
  }

  if (item.equipment_slot && armorPieceSlots.includes(item.equipment_slot as ArmorPieceSlot)) {
    return item.equipment_slot as ArmorPieceSlot;
  }

  return null;
}

function applyEquipmentBonus(
  bonuses: ReturnType<typeof createBonusAccumulator>,
  target: string | null | undefined,
  amount: number,
) {
  if (!target || !Number.isFinite(amount) || amount === 0) {
    return;
  }

  if (target === "max health") bonuses.maxHp += amount;
  else if (target === "max stamina") bonuses.maxStamina += amount;
  else if (target === "max magika") bonuses.maxMagicka += amount;
  else if (target === "damage") bonuses.damage += amount;
  else if (target === "defense") bonuses.defense += amount;
  else if (target === "strength") bonuses.strength += amount;
  else if (target === "endurance") bonuses.endurance += amount;
  else if (target === "agility") bonuses.agility += amount;
  else if (target === "intelligence") bonuses.intelligence += amount;
  else if (target === "wisdom") bonuses.wisdom += amount;
  else if (target === "charisma") bonuses.charisma += amount;
  else if (target === "spirit") bonuses.spirit += amount;
  else if (target === "gold gain") bonuses.goldGain += amount;
  else if (target === "xp gain") bonuses.xpGain += amount;
}

function createBonusAccumulator() {
  return {
    maxHp: 0,
    maxStamina: 0,
    maxMagicka: 0,
    damage: 0,
    defense: 0,
    strength: 0,
    endurance: 0,
    agility: 0,
    intelligence: 0,
    wisdom: 0,
    charisma: 0,
    spirit: 0,
    goldGain: 0,
    xpGain: 0,
    completedArmorSets: [] as Array<{ key: string; name: string; bonusTarget: string | null; bonusAmount: number; penaltyTarget: string | null; penaltyAmount: number }>,
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
    attack_bonus: Number(input.attack_bonus) || 0,
    ability_name: input.ability_name?.trim() || null,
    ability_cost_type: input.ability_cost_type ?? "none",
    ability_cost_amount: Number(input.ability_cost_amount) || 0,
    elemental_damage_type: input.elemental_damage_type ?? "none",
    elemental_damage_amount: Number(input.elemental_damage_amount) || 0,
    on_hit_effect: input.on_hit_effect ?? null,
    armor_value: Number(input.armor_value) || 0,
    buff_target: input.buff_target ?? null,
    buff_amount: Number(input.buff_amount) || 0,
    equip_penalty_target: input.equip_penalty_target ?? null,
    equip_penalty_amount: Number(input.equip_penalty_amount) || 0,
    armor_set_key: input.armor_set_key?.trim() || null,
    armor_set_name: input.armor_set_name?.trim() || null,
    armor_piece_slot: input.armor_piece_slot ?? null,
    set_bonus_target: input.set_bonus_target ?? null,
    set_bonus_amount: Number(input.set_bonus_amount) || 0,
    set_penalty_target: input.set_penalty_target ?? null,
    set_penalty_amount: Number(input.set_penalty_amount) || 0,
    potion_target: input.potion_target ?? null,
    restore_amount: Number(input.restore_amount) || 0,
    restore_percent: input.restore_percent === null || input.restore_percent === undefined ? null : Number(input.restore_percent) || null,
    boost_target: input.boost_target ?? null,
    boost_amount: Number(input.boost_amount) || 0,
    passive_mode: input.passive_mode ?? null,
    utility_activity: input.utility_activity ?? null,
    rarity_bonus_percent: Math.max(0, Number(input.rarity_bonus_percent) || 0),
    extra_roll_chance_percent: Math.max(0, Number(input.extra_roll_chance_percent) || 0),
    loot_pool_key: input.loot_pool_key?.trim() || null,
    break_chance_percent: Math.max(0, Number(input.break_chance_percent) || 0),
    utility_uses: input.utility_uses === null || input.utility_uses === undefined ? null : Math.max(0, Number(input.utility_uses) || 0),
    linked_ability_id: input.linked_ability_id ?? null,
    teaches_ability_id: input.teaches_ability_id ?? null,
    season_number: Number(input.season_number) || 1,
    chapter_number: Number(input.chapter_number) || 1,
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
