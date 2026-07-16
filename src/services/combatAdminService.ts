import { supabase, Tables } from "../lib/supabase";
import { classCombinations } from "./classService";

export type CombatAbility = Tables["combat_abilities"];
export type EnemyDefinition = Tables["enemy_definitions"];
export type EnemyAbility = Tables["enemy_abilities"];
export type EnemyItemDrop = Tables["enemy_item_drops"];
export type EnemyTrophySetting = Tables["enemy_trophy_settings"];
export type EnemyTrophyDrop = Tables["enemy_trophy_drop_pool"];
export type PlayerTrophyHarvest = Tables["player_trophy_harvests"];
export type NpcDefinition = Tables["npc_definitions"];
export type NpcAbility = Tables["npc_abilities"];
export type NpcItemDrop = Tables["npc_item_drops"];

export type EnemyWithLoadout = EnemyDefinition & {
  abilities: Array<EnemyAbility & { ability?: CombatAbility }>;
  drops: EnemyItemDrop[];
  trophy?: EnemyTrophySetting | null;
  trophyDrops?: EnemyTrophyDrop[];
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
export const learnMethods: CombatAbility["learn_method"][] = ["starter", "level", "class level", "weapon equipped", "armor equipped", "wearable equipped", "scroll", "quest", "admin"];
export const usageContexts: CombatAbility["usage_context"][] = ["battle_only", "outside_battle_only", "both"];
export const trophyScoreFormulas: EnemyTrophySetting["score_formula"][] = ["combined", "weight", "antlers", "horns", "skull", "pelt"];
export const enemyAssetBasePath = "/assets/Enemies/";

export type TrophyHarvestRoll = {
  harvest: PlayerTrophyHarvest;
  drops: Array<{ item_id: string; quantity: number }>;
};

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
    required_class_level: 0,
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

export function blankEnemyTrophySetting(enemyId = ""): Partial<EnemyTrophySetting> {
  return {
    enemy_id: enemyId,
    trophy_enabled: false,
    species: "",
    leaderboard_enabled: true,
    score_formula: "combined",
    min_weight: 0,
    max_weight: 0,
    min_antler_spread: 0,
    max_antler_spread: 0,
    min_horn_length: 0,
    max_horn_length: 0,
    min_skull_size: 0,
    max_skull_size: 0,
    min_pelt_quality: 50,
    max_pelt_quality: 100,
    rarity_bonus: 0,
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
  const [enemyResult, abilityRowsResult, abilitiesResult, dropsResult, trophyResult, trophyDropsResult] = await Promise.all([
    supabase.from("enemy_definitions").select("*").eq("id", enemyId).maybeSingle(),
    supabase.from("enemy_abilities").select("*").eq("enemy_id", enemyId),
    supabase.from("combat_abilities").select("*"),
    supabase.from("enemy_item_drops").select("*").eq("enemy_id", enemyId),
    supabase.from("enemy_trophy_settings").select("*").eq("enemy_id", enemyId).maybeSingle(),
    supabase.from("enemy_trophy_drop_pool").select("*").eq("enemy_id", enemyId),
  ]);

  if (enemyResult.error) throw enemyResult.error;
  if (abilityRowsResult.error) throw abilityRowsResult.error;
  if (abilitiesResult.error) throw abilitiesResult.error;
  if (dropsResult.error) throw dropsResult.error;
  if (trophyResult.error) throw trophyResult.error;
  if (trophyDropsResult.error) throw trophyDropsResult.error;
  if (!enemyResult.data) return null;

  const abilities = (abilitiesResult.data ?? []) as CombatAbility[];
  return {
    ...(enemyResult.data as EnemyDefinition),
    abilities: ((abilityRowsResult.data ?? []) as EnemyAbility[]).map((row) => ({
      ...row,
      ability: abilities.find((ability) => ability.id === row.ability_id),
    })),
    drops: (dropsResult.data ?? []) as EnemyItemDrop[],
    trophy: (trophyResult.data ?? null) as EnemyTrophySetting | null,
    trophyDrops: (trophyDropsResult.data ?? []) as EnemyTrophyDrop[],
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

export async function saveEnemyTrophySetting(enemyId: string, input: Partial<EnemyTrophySetting>) {
  const values = normalizeEnemyTrophySetting(enemyId, input);
  const { data, error } = await supabase
    .from("enemy_trophy_settings")
    .upsert(values, { onConflict: "enemy_id" })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data as EnemyTrophySetting;
}

export async function saveEnemyTrophyDrop(enemyId: string, itemId: string, minQuantity: number, maxQuantity: number, dropChance: number) {
  const safeMin = Math.max(1, Number(minQuantity) || 1);
  const safeMax = Math.max(safeMin, Number(maxQuantity) || safeMin);
  const { data, error } = await supabase
    .from("enemy_trophy_drop_pool")
    .upsert({
      enemy_id: enemyId,
      item_id: itemId,
      min_quantity: safeMin,
      max_quantity: safeMax,
      drop_chance: Math.max(0, Math.min(100, Number(dropChance) || 0)),
      updated_at: new Date().toISOString(),
    }, { onConflict: "enemy_id,item_id" })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data as EnemyTrophyDrop;
}

export async function deleteEnemyTrophyDrop(id: string) {
  const { error } = await supabase.from("enemy_trophy_drop_pool").delete().eq("id", id);
  if (error) throw error;
}

export async function rollAndSaveTrophyHarvest(input: {
  userId: string;
  characterId: string;
  enemy: EnemyWithLoadout | NpcWithLoadout | null;
  battleEventId?: string | null;
  markerId?: string | null;
}): Promise<TrophyHarvestRoll | null> {
  const enemy = input.enemy as EnemyWithLoadout | null;

  if (!enemy?.id || !enemy.trophy?.trophy_enabled) {
    return null;
  }

  const trophy = enemy.trophy;
  const weight = rollRange(trophy.min_weight, trophy.max_weight);
  const antlerSpread = rollRange(trophy.min_antler_spread, trophy.max_antler_spread);
  const hornLength = rollRange(trophy.min_horn_length, trophy.max_horn_length);
  const skullSize = rollRange(trophy.min_skull_size, trophy.max_skull_size);
  const peltQuality = Math.round(rollRange(trophy.min_pelt_quality, trophy.max_pelt_quality));
  const rarityBonus = Number(trophy.rarity_bonus) || 0;
  const trophyScore = calculateTrophyScore(trophy.score_formula, {
    weight,
    antlerSpread,
    hornLength,
    skullSize,
    peltQuality,
    rarityBonus,
  });
  const drops = rollTrophyDrops(enemy.trophyDrops ?? []);

  const harvestPayload = {
    user_id: input.userId,
    character_id: input.characterId,
    enemy_id: enemy.id,
    battle_event_id: input.battleEventId ?? null,
    marker_id: input.markerId ?? null,
    species: trophy.species || enemy.type || enemy.name,
    enemy_name: enemy.name,
    weight,
    antler_spread: antlerSpread,
    horn_length: hornLength,
    skull_size: skullSize,
    pelt_quality: peltQuality,
    rarity_bonus: rarityBonus,
    trophy_score: trophyScore,
    drops,
  };

  let { data, error } = await supabase
    .from("player_trophy_harvests")
    .insert(harvestPayload)
    .select()
    .single();

  if (error && (harvestPayload.battle_event_id || harvestPayload.marker_id) && isTrophyLinkConstraintError(error)) {
    const retry = await supabase
      .from("player_trophy_harvests")
      .insert({
        ...harvestPayload,
        battle_event_id: null,
        marker_id: null,
      })
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw error;
  }

  return {
    harvest: data as PlayerTrophyHarvest,
    drops,
  };
}

function isTrophyLinkConstraintError(error: unknown) {
  const maybeError = error as { code?: string; message?: string; details?: string } | null;
  const text = `${maybeError?.message ?? ""} ${maybeError?.details ?? ""}`.toLowerCase();
  return maybeError?.code === "23503" || text.includes("battle_event_id") || text.includes("marker_id") || text.includes("foreign key");
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
    required_class_level: Number(input.required_class_level) || 0,
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

function normalizeEnemyTrophySetting(enemyId: string, input: Partial<EnemyTrophySetting>) {
  const minWeight = Math.max(0, Number(input.min_weight) || 0);
  const minAntlerSpread = Math.max(0, Number(input.min_antler_spread) || 0);
  const minHornLength = Math.max(0, Number(input.min_horn_length) || 0);
  const minSkullSize = Math.max(0, Number(input.min_skull_size) || 0);
  const minPeltQuality = Math.max(0, Math.min(100, Number(input.min_pelt_quality) || 0));

  return {
    enemy_id: enemyId,
    trophy_enabled: input.trophy_enabled ?? false,
    species: input.species?.trim() || null,
    leaderboard_enabled: input.leaderboard_enabled ?? true,
    score_formula: input.score_formula ?? "combined",
    min_weight: minWeight,
    max_weight: Math.max(minWeight, Number(input.max_weight) || minWeight),
    min_antler_spread: minAntlerSpread,
    max_antler_spread: Math.max(minAntlerSpread, Number(input.max_antler_spread) || minAntlerSpread),
    min_horn_length: minHornLength,
    max_horn_length: Math.max(minHornLength, Number(input.max_horn_length) || minHornLength),
    min_skull_size: minSkullSize,
    max_skull_size: Math.max(minSkullSize, Number(input.max_skull_size) || minSkullSize),
    min_pelt_quality: minPeltQuality,
    max_pelt_quality: Math.max(minPeltQuality, Math.min(100, Number(input.max_pelt_quality) || minPeltQuality)),
    rarity_bonus: Math.max(0, Number(input.rarity_bonus) || 0),
    updated_at: new Date().toISOString(),
  };
}

function rollRange(min: number, max: number) {
  const safeMin = Number(min) || 0;
  const safeMax = Math.max(safeMin, Number(max) || safeMin);
  const value = safeMin + Math.random() * (safeMax - safeMin);

  return Math.round(value * 100) / 100;
}

function rollTrophyDrops(drops: EnemyTrophyDrop[]) {
  return drops.reduce<Array<{ item_id: string; quantity: number }>>((rolled, drop) => {
    if (Math.random() * 100 > Number(drop.drop_chance)) {
      return rolled;
    }

    const min = Math.max(1, Number(drop.min_quantity) || 1);
    const max = Math.max(min, Number(drop.max_quantity) || min);
    const quantity = Math.floor(min + Math.random() * (max - min + 1));
    rolled.push({ item_id: drop.item_id, quantity });
    return rolled;
  }, []);
}

function calculateTrophyScore(
  formula: EnemyTrophySetting["score_formula"],
  values: { weight: number; antlerSpread: number; hornLength: number; skullSize: number; peltQuality: number; rarityBonus: number },
) {
  const score = (() => {
    if (formula === "weight") return values.weight;
    if (formula === "antlers") return values.antlerSpread * 10;
    if (formula === "horns") return values.hornLength * 10;
    if (formula === "skull") return values.skullSize * 10;
    if (formula === "pelt") return values.peltQuality;

    return values.weight + values.antlerSpread * 3 + values.hornLength * 2 + values.skullSize * 2 + values.peltQuality + values.rarityBonus;
  })();

  return Math.round(score * 100) / 100;
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
