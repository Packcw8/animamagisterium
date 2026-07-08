import { supabase, Tables } from "../lib/supabase";
import { classCombinations } from "./classService";

export type CombatAbility = Tables["combat_abilities"];
export type EnemyDefinition = Tables["enemy_definitions"];
export type EnemyAbility = Tables["enemy_abilities"];
export type EnemyItemDrop = Tables["enemy_item_drops"];
export type NpcDefinition = Tables["npc_definitions"];
export type NpcAbility = Tables["npc_abilities"];
export type NpcItemDrop = Tables["npc_item_drops"];

export type EnemyWithLoadout = EnemyDefinition & {
  abilities: Array<EnemyAbility & { ability?: CombatAbility }>;
  drops: EnemyItemDrop[];
};

export type NpcWithLoadout = NpcDefinition & {
  abilities: Array<NpcAbility & { ability?: CombatAbility }>;
  drops: NpcItemDrop[];
};

export const combatAbilityTypes: CombatAbility["type"][] = ["attack", "heal", "buff", "debuff", "defense", "passive", "summon", "conjure"];
export const abilityTargetModes: CombatAbility["target_mode"][] = ["single_enemy", "all_enemies", "random_enemy", "self", "all_allies"];
export const summonKinds: NonNullable<CombatAbility["summon_kind"]>[] = ["enemy", "npc"];
export const statusEffects: CombatAbility["status_effect"][] = ["none", "poison", "burn", "regen", "shield", "weakness", "slow", "stun"];
export const linkedStats: CombatAbility["linked_stat"][] = ["strength", "endurance", "agility", "intelligence", "wisdom", "charisma", "spirit", "weapon", "item", "none"];
export const requiredAttributes: NonNullable<CombatAbility["required_attribute"]>[] = ["strength", "endurance", "agility", "intelligence", "wisdom", "charisma", "spirit"];
export const requiredClassKeys = classCombinations.map((combo) => combo.key);
export const learnMethods: CombatAbility["learn_method"][] = ["starter", "level", "weapon equipped", "armor equipped", "wearable equipped", "scroll", "quest", "admin"];
export const usageContexts: CombatAbility["usage_context"][] = ["battle_only", "outside_battle_only", "both"];
export const enemyAssetBasePath = "/assets/Enemies/";

export function resolveEnemyImageUri(imagePath?: string | null) {
  const trimmed = imagePath?.trim();

  if (!trimmed) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replaceAll("\\", "/").replace(/^\/?assets\/enemy\//i, enemyAssetBasePath).replace(/^\/?assets\/enemies\//i, enemyAssetBasePath);

  if (normalized.startsWith(enemyAssetBasePath)) {
    return normalized;
  }

  if (normalized.startsWith("assets/Enemies/")) {
    return `/${normalized}`;
  }

  if (!normalized.includes("/")) {
    return `${enemyAssetBasePath}${normalized}`;
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export function blankCombatAbility(): Partial<CombatAbility> {
  return {
    name: "",
    type: "attack",
    damage: 0,
    healing: 0,
    defense_amount: 0,
    stamina_restore: 0,
    magika_restore: 0,
    stamina_cost: 0,
    magika_cost: 0,
    health_cost: 0,
    hit_chance: 75,
    critical_chance: 5,
    critical_multiplier: 2,
    cooldown_turns: 0,
    duration_turns: 0,
    status_effect: "none",
    effect_amount: 0,
    effect_duration: 0,
    linked_stat: "none",
    learn_method: "admin",
    required_level: 0,
    required_attribute: null,
    required_attribute_level: 0,
    required_class_key: null,
    image_path: "/assets/abilities/",
    usage_context: "battle_only",
    attack_bonus: 0,
    target_mode: "single_enemy",
    summon_kind: null,
    summon_enemy_id: null,
    summon_npc_id: null,
    summon_count: 1,
    summon_duration_turns: 3,
    season_number: 1,
    chapter_number: 1,
    is_active: true,
  };
}

export function blankEnemy(): Partial<EnemyDefinition> {
  return {
    name: "",
    type: "",
    image_url: "",
    health: 20,
    stamina: 10,
    magika: 0,
    strength: 0,
    endurance: 0,
    agility: 0,
    intelligence: 0,
    wisdom: 0,
    charisma: 0,
    spirit: 0,
    defense: 10,
    attack_bonus: 2,
    armor_rating: 0,
    xp_reward: 0,
    gold_reward: 0,
    season_number: 1,
    chapter_number: 1,
    is_active: true,
  };
}

export function blankNpc(): Partial<NpcDefinition> {
  return {
    name: "",
    type: "",
    description: "",
    image_url: "",
    can_battle: false,
    health: 20,
    stamina: 10,
    magika: 0,
    strength: 0,
    endurance: 0,
    agility: 0,
    intelligence: 0,
    wisdom: 0,
    charisma: 0,
    spirit: 0,
    defense: 10,
    attack_bonus: 2,
    armor_rating: 0,
    xp_reward: 0,
    gold_reward: 0,
    season_number: 1,
    chapter_number: 1,
    is_active: true,
  };
}

export async function getCombatAbilities() {
  const { data, error } = await supabase
    .from("combat_abilities")
    .select("*")
    .order("season_number", { ascending: true })
    .order("chapter_number", { ascending: true })
    .order("type", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []) as CombatAbility[];
}

export async function saveCombatAbility(input: Partial<CombatAbility>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const values = normalizeCombatAbility(input, user?.id ?? null);
  const request = input.id
    ? supabase.from("combat_abilities").update(values).eq("id", input.id).select().single()
    : supabase.from("combat_abilities").insert(values).select().single();
  const { data, error } = await request;
  if (error) {
    throw error;
  }
  return data as CombatAbility;
}

export async function deleteCombatAbility(id: string) {
  const { error } = await supabase.from("combat_abilities").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function getEnemies() {
  const { data, error } = await supabase
    .from("enemy_definitions")
    .select("*")
    .order("season_number", { ascending: true })
    .order("chapter_number", { ascending: true })
    .order("type", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []) as EnemyDefinition[];
}

export async function getNpcs() {
  const { data, error } = await supabase
    .from("npc_definitions")
    .select("*")
    .order("season_number", { ascending: true })
    .order("chapter_number", { ascending: true })
    .order("type", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []) as NpcDefinition[];
}

export async function getEnemyLoadout(enemyId: string): Promise<EnemyWithLoadout | null> {
  const [enemyResult, abilityRowsResult, abilitiesResult, dropsResult] = await Promise.all([
    supabase.from("enemy_definitions").select("*").eq("id", enemyId).maybeSingle(),
    supabase.from("enemy_abilities").select("*").eq("enemy_id", enemyId),
    supabase.from("combat_abilities").select("*"),
    supabase.from("enemy_item_drops").select("*").eq("enemy_id", enemyId),
  ]);

  if (enemyResult.error) throw enemyResult.error;
  if (abilityRowsResult.error) throw abilityRowsResult.error;
  if (abilitiesResult.error) throw abilitiesResult.error;
  if (dropsResult.error) throw dropsResult.error;
  if (!enemyResult.data) return null;

  const abilities = (abilitiesResult.data ?? []) as CombatAbility[];
  return {
    ...(enemyResult.data as EnemyDefinition),
    abilities: ((abilityRowsResult.data ?? []) as EnemyAbility[]).map((row) => ({
      ...row,
      ability: abilities.find((ability) => ability.id === row.ability_id),
    })),
    drops: (dropsResult.data ?? []) as EnemyItemDrop[],
  };
}

export async function getNpcLoadout(npcId: string): Promise<NpcWithLoadout | null> {
  const [npcResult, abilityRowsResult, abilitiesResult, dropsResult] = await Promise.all([
    supabase.from("npc_definitions").select("*").eq("id", npcId).maybeSingle(),
    supabase.from("npc_abilities").select("*").eq("npc_id", npcId),
    supabase.from("combat_abilities").select("*"),
    supabase.from("npc_item_drops").select("*").eq("npc_id", npcId),
  ]);

  if (npcResult.error) throw npcResult.error;
  if (abilityRowsResult.error) throw abilityRowsResult.error;
  if (abilitiesResult.error) throw abilitiesResult.error;
  if (dropsResult.error) throw dropsResult.error;
  if (!npcResult.data) return null;

  const abilities = (abilitiesResult.data ?? []) as CombatAbility[];
  return {
    ...(npcResult.data as NpcDefinition),
    abilities: ((abilityRowsResult.data ?? []) as NpcAbility[]).map((row) => ({
      ...row,
      ability: abilities.find((ability) => ability.id === row.ability_id),
    })),
    drops: (dropsResult.data ?? []) as NpcItemDrop[],
  };
}

export async function saveEnemy(input: Partial<EnemyDefinition>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const values = normalizeEnemy(input, user?.id ?? null);
  const request = input.id
    ? supabase.from("enemy_definitions").update(values).eq("id", input.id).select().single()
    : supabase.from("enemy_definitions").insert(values).select().single();
  const { data, error } = await request;
  if (error) {
    throw error;
  }
  return data as EnemyDefinition;
}

export async function saveNpc(input: Partial<NpcDefinition>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const values = normalizeNpc(input, user?.id ?? null);
  const request = input.id
    ? supabase.from("npc_definitions").update(values).eq("id", input.id).select().single()
    : supabase.from("npc_definitions").insert(values).select().single();
  const { data, error } = await request;
  if (error) {
    throw error;
  }
  return data as NpcDefinition;
}

export async function deleteEnemy(id: string) {
  const { error } = await supabase.from("enemy_definitions").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function deleteNpc(id: string) {
  const { error } = await supabase.from("npc_definitions").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function saveEnemyAbility(enemyId: string, abilityId: string, useWeight: number) {
  const { data, error } = await supabase
    .from("enemy_abilities")
    .upsert({ enemy_id: enemyId, ability_id: abilityId, use_weight: Math.max(1, Number(useWeight) || 1), updated_at: new Date().toISOString() }, { onConflict: "enemy_id,ability_id" })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data as EnemyAbility;
}

export async function saveNpcAbility(npcId: string, abilityId: string, useWeight: number) {
  const { data, error } = await supabase
    .from("npc_abilities")
    .upsert({ npc_id: npcId, ability_id: abilityId, use_weight: Math.max(1, Number(useWeight) || 1), updated_at: new Date().toISOString() }, { onConflict: "npc_id,ability_id" })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data as NpcAbility;
}

export async function deleteEnemyAbility(id: string) {
  const { error } = await supabase.from("enemy_abilities").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteNpcAbility(id: string) {
  const { error } = await supabase.from("npc_abilities").delete().eq("id", id);
  if (error) throw error;
}

export async function saveEnemyDrop(enemyId: string, itemId: string, quantity: number, dropChance: number) {
  const { data, error } = await supabase
    .from("enemy_item_drops")
    .upsert({ enemy_id: enemyId, item_id: itemId, quantity: Math.max(1, Number(quantity) || 1), drop_chance: Math.max(0, Math.min(100, Number(dropChance) || 0)), updated_at: new Date().toISOString() }, { onConflict: "enemy_id,item_id" })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data as EnemyItemDrop;
}

export async function saveNpcDrop(npcId: string, itemId: string, quantity: number, dropChance: number) {
  const { data, error } = await supabase
    .from("npc_item_drops")
    .upsert({ npc_id: npcId, item_id: itemId, quantity: Math.max(1, Number(quantity) || 1), drop_chance: Math.max(0, Math.min(100, Number(dropChance) || 0)), updated_at: new Date().toISOString() }, { onConflict: "npc_id,item_id" })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data as NpcItemDrop;
}

export async function deleteEnemyDrop(id: string) {
  const { error } = await supabase.from("enemy_item_drops").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteNpcDrop(id: string) {
  const { error } = await supabase.from("npc_item_drops").delete().eq("id", id);
  if (error) throw error;
}

function normalizeCombatAbility(input: Partial<CombatAbility>, userId: string | null) {
  return {
    name: input.name?.trim() || "Unnamed Ability",
    type: input.type ?? "attack",
    damage: Number(input.damage) || 0,
    healing: Number(input.healing) || 0,
    defense_amount: Number(input.defense_amount) || 0,
    stamina_restore: Number(input.stamina_restore) || 0,
    magika_restore: Number(input.magika_restore) || 0,
    stamina_cost: Number(input.stamina_cost) || 0,
    magika_cost: Number(input.magika_cost) || 0,
    health_cost: Number(input.health_cost) || 0,
    hit_chance: Number(input.hit_chance) || 75,
    critical_chance: Number(input.critical_chance) || 5,
    critical_multiplier: Number(input.critical_multiplier) || 2,
    cooldown_turns: Number(input.cooldown_turns) || 0,
    duration_turns: Number(input.duration_turns) || 0,
    status_effect: input.status_effect ?? "none",
    effect_amount: Number(input.effect_amount) || 0,
    effect_duration: Number(input.effect_duration) || 0,
    linked_stat: input.linked_stat ?? "none",
    learn_method: input.learn_method ?? "admin",
    required_level: Number(input.required_level) || 0,
    required_attribute: input.required_attribute ?? null,
    required_attribute_level: Number(input.required_attribute_level) || 0,
    required_class_key: input.required_class_key?.trim() || null,
    image_path: input.image_path?.trim() || null,
    usage_context: input.usage_context ?? "battle_only",
    attack_bonus: Number(input.attack_bonus) || 0,
    target_mode: input.target_mode ?? "single_enemy",
    summon_kind: input.summon_kind ?? null,
    summon_enemy_id: input.summon_kind === "enemy" ? input.summon_enemy_id ?? null : null,
    summon_npc_id: input.summon_kind === "npc" ? input.summon_npc_id ?? null : null,
    summon_count: Math.max(1, Number(input.summon_count) || 1),
    summon_duration_turns: Math.max(1, Number(input.summon_duration_turns) || 3),
    season_number: Number(input.season_number) || 1,
    chapter_number: Number(input.chapter_number) || 1,
    is_active: input.is_active ?? true,
    created_by: input.id ? input.created_by ?? userId : userId,
    updated_at: new Date().toISOString(),
  };
}

function normalizeEnemy(input: Partial<EnemyDefinition>, userId: string | null) {
  return {
    name: input.name?.trim() || "Unnamed Enemy",
    type: input.type?.trim() || null,
    image_url: input.image_url?.trim() || null,
    health: Number(input.health) || 20,
    stamina: Number(input.stamina) || 0,
    magika: Number(input.magika) || 0,
    strength: Number(input.strength) || 0,
    endurance: Number(input.endurance) || 0,
    agility: Number(input.agility) || 0,
    intelligence: Number(input.intelligence) || 0,
    wisdom: Number(input.wisdom) || 0,
    charisma: Number(input.charisma) || 0,
    spirit: Number(input.spirit) || 0,
    defense: Number(input.defense) || 10,
    attack_bonus: Number(input.attack_bonus) || 0,
    armor_rating: Number(input.armor_rating) || 0,
    xp_reward: Number(input.xp_reward) || 0,
    gold_reward: Number(input.gold_reward) || 0,
    season_number: Number(input.season_number) || 1,
    chapter_number: Number(input.chapter_number) || 1,
    is_active: input.is_active ?? true,
    created_by: input.id ? input.created_by ?? userId : userId,
    updated_at: new Date().toISOString(),
  };
}

function normalizeNpc(input: Partial<NpcDefinition>, userId: string | null) {
  return {
    name: input.name?.trim() || "Unnamed NPC",
    type: input.type?.trim() || null,
    description: input.description?.trim() || null,
    image_url: input.image_url?.trim() || null,
    can_battle: input.can_battle ?? false,
    health: Number(input.health) || 20,
    stamina: Number(input.stamina) || 0,
    magika: Number(input.magika) || 0,
    strength: Number(input.strength) || 0,
    endurance: Number(input.endurance) || 0,
    agility: Number(input.agility) || 0,
    intelligence: Number(input.intelligence) || 0,
    wisdom: Number(input.wisdom) || 0,
    charisma: Number(input.charisma) || 0,
    spirit: Number(input.spirit) || 0,
    defense: Number(input.defense) || 10,
    attack_bonus: Number(input.attack_bonus) || 0,
    armor_rating: Number(input.armor_rating) || 0,
    xp_reward: Number(input.xp_reward) || 0,
    gold_reward: Number(input.gold_reward) || 0,
    season_number: Number(input.season_number) || 1,
    chapter_number: Number(input.chapter_number) || 1,
    is_active: input.is_active ?? true,
    created_by: input.id ? input.created_by ?? userId : userId,
    updated_at: new Date().toISOString(),
  };
}
