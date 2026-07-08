import { supabase, Tables } from "../lib/supabase";
import {
  AbilityDefinition,
  getCharacterResources,
  getCombatLoadout,
  getCurrentHealth,
} from "./abilityService";
import type { CharacterWithDetails } from "./characterService";
import {
  EquipmentSlot,
  getInventoryResourceBonuses,
  getInventoryState,
  ItemDefinition,
} from "./inventoryService";

export type PlayerBattleSnapshot = Tables["player_battle_snapshots"];
export type BattleSnapshotSource = PlayerBattleSnapshot["snapshot_source"];

type AttributeSnapshot = {
  strength: number;
  endurance: number;
  agility: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  spirit: number;
};

const emptyAttributes: AttributeSnapshot = {
  strength: 0,
  endurance: 0,
  agility: 0,
  intelligence: 0,
  wisdom: 0,
  charisma: 0,
  spirit: 0,
};

export async function createCurrentPlayerBattleSnapshot(
  character: CharacterWithDetails,
  source: BattleSnapshotSource = "manual",
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user || user.id !== character.user_id) {
    throw new Error("You can only create a battle snapshot for your own character.");
  }

  const payload = await buildBattleSnapshotPayload(character, source);

  if (source === "system") {
    return upsertSystemBattleSnapshot(character.id, payload);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("player_battle_snapshots")
    .insert({ ...payload, is_current: false })
    .select("*")
    .single();

  if (insertError) {
    throw insertError;
  }

  const { error: retireError } = await supabase
    .from("player_battle_snapshots")
    .update({ is_current: false })
    .eq("character_id", character.id)
    .eq("snapshot_source", source)
    .eq("is_current", true);

  if (retireError) {
    throw retireError;
  }

  const { data: current, error: currentError } = await supabase
    .from("player_battle_snapshots")
    .update({ is_current: true })
    .eq("id", inserted.id)
    .select("*")
    .single();

  if (currentError) {
    throw currentError;
  }

  return current as PlayerBattleSnapshot;
}

export async function getCurrentBattleSnapshotForCharacter(characterId: string) {
  const { data, error } = await supabase
    .from("player_battle_snapshots")
    .select("*")
    .eq("character_id", characterId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlayerBattleSnapshot | null;
}

export async function getCurrentBattleSnapshotsForUsers(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("player_battle_snapshots")
    .select("*")
    .in("user_id", uniqueIds)
    .eq("is_current", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as PlayerBattleSnapshot[];
}

async function buildBattleSnapshotPayload(character: CharacterWithDetails, source: BattleSnapshotSource) {
  const [inventory, loadout, activeClassKey] = await Promise.all([
    getInventoryState(character.id),
    getCombatLoadout(character),
    getActiveClassKey(character.id),
  ]);
  const attributes = normalizeAttributes(character.attributes);
  const equipmentBonuses = getInventoryResourceBonuses(inventory.equipped);
  const resources = getCharacterResources(character, equipmentBonuses);

  return {
    user_id: character.user_id,
    character_id: character.id,
    snapshot_source: source,
    character_name: character.name,
    portrait_url: character.portrait_url,
    level: Math.max(1, Number(character.level) || 1),
    xp: Math.max(0, Number(character.xp) || 0),
    active_class_key: activeClassKey,
    max_health: resources.maxHp,
    max_stamina: resources.maxStamina,
    max_magika: resources.maxMagicka,
    current_health: getCurrentHealth(character, resources),
    defense: 10 + equipmentBonuses.defense,
    attack_bonus: Math.max(0, Math.floor(attributes.strength)),
    damage_bonus: equipmentBonuses.damage,
    attributes,
    equipped_items: snapshotEquippedItems(inventory.equipped),
    equipped_abilities: loadout.equipped.map(snapshotAbility).filter(Boolean),
    inventory_summary: {
      itemCount: inventory.items.reduce((sum, entry) => sum + entry.quantity, 0),
      totalWeight: inventory.totalWeight,
      carryCapacity: inventory.carryCapacity,
    },
    is_current: true,
    updated_at: new Date().toISOString(),
  };
}

async function upsertSystemBattleSnapshot(
  characterId: string,
  payload: Awaited<ReturnType<typeof buildBattleSnapshotPayload>>,
) {
  const { data: existing, error: existingError } = await supabase
    .from("player_battle_snapshots")
    .select("id")
    .eq("character_id", characterId)
    .eq("snapshot_source", "system")
    .eq("is_current", true)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from("player_battle_snapshots")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as PlayerBattleSnapshot;
  }

  const { data, error } = await supabase
    .from("player_battle_snapshots")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as PlayerBattleSnapshot;
}

function normalizeAttributes(attributes: CharacterWithDetails["attributes"]): AttributeSnapshot {
  return {
    strength: Number(attributes?.strength ?? emptyAttributes.strength),
    endurance: Number(attributes?.endurance ?? emptyAttributes.endurance),
    agility: Number(attributes?.agility ?? emptyAttributes.agility),
    intelligence: Number(attributes?.intelligence ?? emptyAttributes.intelligence),
    wisdom: Number(attributes?.wisdom ?? emptyAttributes.wisdom),
    charisma: Number(attributes?.charisma ?? emptyAttributes.charisma),
    spirit: Number(attributes?.spirit ?? emptyAttributes.spirit),
  };
}

function snapshotEquippedItems(equipped: Record<EquipmentSlot, ItemDefinition | null>) {
  return Object.fromEntries(
    Object.entries(equipped).map(([slot, item]) => [
      slot,
      item
        ? {
          id: item.id,
          name: item.name,
          type: item.type,
          rarity: item.rarity,
          imagePath: item.image_path,
          damageAmount: item.damage_amount,
          armorValue: item.armor_value,
          buffTarget: item.buff_target,
          buffAmount: item.buff_amount,
          linkedAbilityId: item.linked_ability_id,
        }
        : null,
    ]),
  );
}

function snapshotAbility(ability: AbilityDefinition | null) {
  if (!ability) {
    return null;
  }

  return {
    key: ability.key,
    id: ability.adminAbility?.id ?? null,
    name: ability.name,
    type: ability.adminAbility?.type ?? ability.kind,
    attribute: ability.attribute,
    source: ability.source,
    imagePath: ability.adminAbility?.image_path ?? ability.sourceWeapon?.image_path ?? null,
    description: ability.description,
    damage: ability.adminAbility?.damage ?? ability.baseDamage,
    healing: ability.adminAbility?.healing ?? 0,
    defenseAmount: ability.adminAbility?.defense_amount ?? 0,
    staminaRestore: ability.adminAbility?.stamina_restore ?? 0,
    magikaRestore: ability.adminAbility?.magika_restore ?? 0,
    staminaCost: ability.adminAbility?.stamina_cost ?? (ability.resource === "stamina" ? ability.cost : 0),
    magikaCost: ability.adminAbility?.magika_cost ?? (ability.resource === "magicka" ? ability.cost : 0),
    healthCost: ability.adminAbility?.health_cost ?? (ability.resource === "health" ? ability.cost : 0),
    attackBonus: ability.adminAbility?.attack_bonus ?? 0,
    criticalChance: ability.adminAbility?.critical_chance ?? Math.round((ability.critBonus ?? 0) * 100),
    criticalMultiplier: ability.adminAbility?.critical_multiplier ?? 2,
    statusEffect: ability.adminAbility?.status_effect ?? "none",
    effectAmount: ability.adminAbility?.effect_amount ?? 0,
    effectDuration: ability.adminAbility?.effect_duration ?? 0,
  };
}

async function getActiveClassKey(characterId: string) {
  const { data, error } = await supabase
    .from("player_class_selection")
    .select("class_key")
    .eq("character_id", characterId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.class_key ?? null;
}
