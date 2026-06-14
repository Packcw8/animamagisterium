import { supabase, Tables } from "../lib/supabase";

export type CombatAbility = Tables["combat_abilities"];
export type EnemyDefinition = Tables["enemy_definitions"];
export type EnemyAbility = Tables["enemy_abilities"];
export type EnemyItemDrop = Tables["enemy_item_drops"];

export type EnemyWithLoadout = EnemyDefinition & {
  abilities: Array<EnemyAbility & { ability?: CombatAbility }>;
  drops: EnemyItemDrop[];
};

export const combatAbilityTypes: CombatAbility["type"][] = ["attack", "heal", "buff", "debuff", "defense", "passive"];
export const statusEffects: CombatAbility["status_effect"][] = ["none", "poison", "burn", "regen", "shield", "weakness", "slow", "stun"];
export const linkedStats: CombatAbility["linked_stat"][] = ["strength", "endurance", "agility", "intelligence", "wisdom", "charisma", "spirit", "weapon", "item", "none"];
export const requiredAttributes: NonNullable<CombatAbility["required_attribute"]>[] = ["strength", "endurance", "agility", "intelligence", "wisdom", "charisma", "spirit"];
export const learnMethods: CombatAbility["learn_method"][] = ["level", "weapon equipped", "armor equipped", "wearable equipped", "scroll", "quest", "admin"];
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
    image_path: "/assets/abilities/",
    attack_bonus: 0,
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
    armor_rating: 0,
    xp_reward: 0,
    gold_reward: 0,
    is_active: true,
  };
}

export async function getCombatAbilities() {
  const { data, error } = await supabase.from("combat_abilities").select("*").order("created_at", { ascending: false });
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
  const { data, error } = await supabase.from("enemy_definitions").select("*").order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []) as EnemyDefinition[];
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

export async function deleteEnemy(id: string) {
  const { error } = await supabase.from("enemy_definitions").delete().eq("id", id);
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

export async function deleteEnemyAbility(id: string) {
  const { error } = await supabase.from("enemy_abilities").delete().eq("id", id);
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

export async function deleteEnemyDrop(id: string) {
  const { error } = await supabase.from("enemy_item_drops").delete().eq("id", id);
  if (error) throw error;
}

function normalizeCombatAbility(input: Partial<CombatAbility>, userId: string | null) {
  return {
    name: input.name?.trim() || "Unnamed Ability",
    type: input.type ?? "attack",
    damage: Number(input.damage) || 0,
    healing: Number(input.healing) || 0,
    defense_amount: Number(input.defense_amount) || 0,
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
    image_path: input.image_path?.trim() || null,
    attack_bonus: Number(input.attack_bonus) || 0,
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
    armor_rating: Number(input.armor_rating) || 0,
    xp_reward: Number(input.xp_reward) || 0,
    gold_reward: Number(input.gold_reward) || 0,
    is_active: input.is_active ?? true,
    created_by: input.id ? input.created_by ?? userId : userId,
    updated_at: new Date().toISOString(),
  };
}
