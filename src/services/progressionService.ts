import { supabase, Tables } from "../lib/supabase";
import type { CharacterWithDetails } from "./characterService";
import { recordSocialContribution } from "./partyGuildService";

export type AttributeKey = Tables["attribute_progress"]["attribute_key"];
export type GameProgressionSettings = Tables["game_progression_settings"];
export type TrainingAttributeConfig = Tables["training_attribute_configs"];
export type EnemyKillLog = Tables["enemy_kill_log"];
export type PlayerEnemyKillStat = Tables["player_enemy_kill_stats"];
export type PlayerEnemyTypeKillStat = Tables["player_enemy_type_kill_stats"];

export type EnemyKillInput = {
  userId: string;
  characterId: string;
  enemyId?: string | null;
  npcId?: string | null;
  enemyName: string;
  enemyType?: string | null;
  enemySource: EnemyKillLog["enemy_source"];
  routeId?: string | null;
  mapEventId?: string | null;
  seasonNumber?: number;
  chapterNumber?: number;
};

export const attributeKeys: AttributeKey[] = ["strength", "endurance", "agility", "intelligence", "wisdom", "charisma", "spirit"];
export const dailyTrainingSessionLimit = 2;
export const seasonOneAttributeLevelCap = 10;

export const defaultProgressionSettings: GameProgressionSettings = {
  id: true,
  character_level_cap: 100,
  character_xp_base: 100,
  character_xp_growth: 0,
  default_attribute_level_cap: seasonOneAttributeLevelCap,
  daily_training_limit: dailyTrainingSessionLimit,
  training_cooldown_minutes: 60,
  updated_at: new Date(0).toISOString(),
};

export const defaultTrainingConfigs: Record<AttributeKey, TrainingAttributeConfig> = {
  strength: makeDefaultTrainingConfig("strength", "Strength", "Builds physical power for attack bonus and carrying capacity.", "30 minutes of strength training, lifting heavy things, weighted exercise, bodyweight work, or physical labor.", "minutes", "30 minute strength session", 30, 0),
  endurance: makeDefaultTrainingConfig("endurance", "Endurance", "Builds stamina for longer journeys and sustained effort.", "30 minutes of hiking, jogging, power walking, long walks, or steady physical work.", "minutes", "30 minute endurance session", 30, 0),
  agility: makeDefaultTrainingConfig("agility", "Agility", "Improves initiative, hit chance, critical chance, and evasion.", "30 minutes of stretching, yoga, sprint intervals, balance drills, mobility work, or sport practice.", "minutes", "30 minute agility session", 30, 0),
  intelligence: makeDefaultTrainingConfig("intelligence", "Intelligence", "Improves magical knowledge, learning, and problem solving.", "30 minutes of reading, studying, language learning, courses, writing notes, or focused research.", "minutes", "30 minute study session", 30, 0),
  wisdom: makeDefaultTrainingConfig("wisdom", "Wisdom", "Improves healing, focus, insight, and calm decision making.", "30 minutes of meditation, journaling, breathing practice, reflection, slow walks, or mindful rest.", "minutes", "30 minute wisdom session", 30, 0),
  charisma: makeDefaultTrainingConfig("charisma", "Charisma", "Improves social confidence, reputation, and leadership.", "30 minutes of going out, socializing, calling someone, community activity, conversation practice, or encouraging others.", "minutes", "30 minute charisma session", 30, 0),
  spirit: makeDefaultTrainingConfig("spirit", "Spirit", "Improves resolve, support power, resistance, and inner discipline.", "30 minutes of prayer, faith study, religious study, gratitude practice, kindness, service, or personal reflection.", "minutes", "30 minute spirit session", 30, 0),
};

export async function getProgressionSettings() {
  const { data, error } = await supabase.from("game_progression_settings").select("*").eq("id", true).maybeSingle();
  if (error) {
    if (error.message.toLowerCase().includes("game_progression_settings")) {
      return defaultProgressionSettings;
    }
    throw error;
  }

  return {
    ...defaultProgressionSettings,
    ...(data as GameProgressionSettings | null ?? {}),
    default_attribute_level_cap: seasonOneAttributeLevelCap,
    daily_training_limit: dailyTrainingSessionLimit,
  };
}

export async function saveProgressionSettings(input: Partial<GameProgressionSettings>) {
  const values = normalizeProgressionSettings(input);
  const { data, error } = await supabase
    .from("game_progression_settings")
    .upsert({ ...values, id: true, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as GameProgressionSettings;
}

export async function getTrainingConfigs() {
  const { data, error } = await supabase.from("training_attribute_configs").select("*").order("attribute_key", { ascending: true });
  if (error) {
    if (error.message.toLowerCase().includes("training_attribute_configs")) {
      return attributeKeys.map((key) => defaultTrainingConfigs[key]);
    }
    throw error;
  }

  const rows = (data ?? []) as TrainingAttributeConfig[];
  return attributeKeys.map((key) => ({
    ...defaultTrainingConfigs[key],
    ...(rows.find((row) => row.attribute_key === key) ?? {}),
    level_cap: seasonOneAttributeLevelCap,
    starting_goal: 30,
    goal_increment: 0,
  }));
}

export async function saveTrainingConfig(input: Partial<TrainingAttributeConfig>) {
  const attributeKey = input.attribute_key as AttributeKey;
  if (!attributeKeys.includes(attributeKey)) {
    throw new Error("Select an attribute to save training balance.");
  }

  const values = normalizeTrainingConfig({ ...defaultTrainingConfigs[attributeKey], ...input, attribute_key: attributeKey });
  const { data, error } = await supabase
    .from("training_attribute_configs")
    .upsert({ ...values, updated_at: new Date().toISOString() }, { onConflict: "attribute_key" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as TrainingAttributeConfig;
}

export function getCharacterLevelFromXp(xp: number, settings = defaultProgressionSettings) {
  const levelCap = Math.max(1, Number(settings.character_level_cap) || 1);
  let level = 1;
  let spent = 0;

  while (level < levelCap) {
    const needed = getXpNeededForLevel(level, settings);
    if (xp < spent + needed) {
      break;
    }
    spent += needed;
    level += 1;
  }

  return level;
}

export function getCharacterXpProgress(xp: number, settings = defaultProgressionSettings) {
  const level = getCharacterLevelFromXp(xp, settings);
  const levelCap = Math.max(1, Number(settings.character_level_cap) || 1);
  let spent = 0;

  for (let current = 1; current < level; current += 1) {
    spent += getXpNeededForLevel(current, settings);
  }

  const required = level >= levelCap ? 1 : getXpNeededForLevel(level, settings);
  const progress = level >= levelCap ? required : Math.max(0, xp - spent);

  return {
    level,
    progress,
    required,
    isCapped: level >= levelCap,
  };
}

export function getAttributeLevelFromXp(xp: number, levelCap: number) {
  let level = 0;
  const sessions = Math.max(0, Math.floor(Number(xp) || 0));
  const cap = Math.min(seasonOneAttributeLevelCap, Math.max(0, Math.floor(Number(levelCap) || 0)));

  while (level < cap && sessions >= getTotalSessionsForAttributeLevel(level + 1)) {
    level += 1;
  }

  return level;
}

export function getAttributeLevelProgress(xp: number, levelCap: number) {
  const sessions = Math.max(0, Math.floor(Number(xp) || 0));
  const cap = Math.min(seasonOneAttributeLevelCap, Math.max(0, Math.floor(Number(levelCap) || 0)));
  const level = getAttributeLevelFromXp(sessions, cap);
  const currentLevelTotal = getTotalSessionsForAttributeLevel(level);
  const nextLevelTotal = getTotalSessionsForAttributeLevel(level + 1);
  const required = Math.max(1, nextLevelTotal - currentLevelTotal);
  const progress = Math.max(0, sessions - currentLevelTotal);

  return {
    level,
    progress: level >= cap ? required : progress,
    required,
    isCapped: level >= cap,
  };
}

export function getTotalSessionsForAttributeLevel(level: number) {
  if (level <= 0) {
    return 0;
  }

  return Math.pow(2, level) - 1;
}

export async function applyCharacterXpGold(character: CharacterWithDetails, xpReward = 0, goldReward = 0) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to update character progress.");
  }

  const safeXp = Math.max(0, Number(xpReward) || 0);
  const safeGold = Math.max(0, Number(goldReward) || 0);
  const { error: rpcError } = await supabase.rpc("apply_character_xp_gold_atomic", {
    p_character_id: character.id,
    p_xp: safeXp,
    p_gold: safeGold,
  });

  if (!rpcError) {
    await recordXpGoldContributions(user.id, character.id, safeXp, safeGold);
    return;
  }

  if (!isMissingRpcError(rpcError)) {
    throw rpcError;
  }

  const { data: currentCharacter, error: characterError } = await supabase
    .from("characters")
    .select("xp,gold,level")
    .eq("id", character.id)
    .eq("user_id", user.id)
    .single();

  if (characterError) {
    throw characterError;
  }

  const settings = await getProgressionSettings();
  const nextXp = Math.max(0, Number(currentCharacter.xp) + Math.max(0, Number(xpReward) || 0));
  const nextLevel = getCharacterLevelFromXp(nextXp, settings);
  const nextGold = Math.max(0, Number(currentCharacter.gold) + Math.max(0, Number(goldReward) || 0));

  const { error } = await supabase
    .from("characters")
    .update({
      xp: nextXp,
      level: Math.max(Number(currentCharacter.level) || 1, nextLevel),
      gold: nextGold,
    })
    .eq("id", character.id)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }

  await recordXpGoldContributions(user.id, character.id, Math.max(0, Number(xpReward) || 0), Math.max(0, Number(goldReward) || 0));
}

async function recordXpGoldContributions(userId: string, characterId: string, xpReward: number, goldReward: number) {
  await Promise.all([
    xpReward > 0 ? recordSocialContribution({
      userId,
      metricType: "xp_earned",
      amount: xpReward,
      sourceType: "character_progress",
      sourceId: characterId,
    }) : Promise.resolve(),
    goldReward > 0 ? recordSocialContribution({
      userId,
      metricType: "gold_earned",
      amount: goldReward,
      sourceType: "character_progress",
      sourceId: characterId,
    }) : Promise.resolve(),
  ]);
}

function isMissingRpcError(error: { message?: string; code?: string } | null) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42883" || message.includes("function") && message.includes("does not exist");
}

export function formatTrainingGoal(config: TrainingAttributeConfig, value: number) {
  const formattedValue = Number.isInteger(value) ? Math.round(value).toLocaleString() : value.toFixed(value < 1 ? 2 : 1);
  return config.goal_template
    .replaceAll("{value}", formattedValue)
    .replaceAll("{unit}", config.unit)
    .replaceAll("{attribute}", config.name);
}

export function getNextGoalValue(config: TrainingAttributeConfig, currentGoal: number) {
  return Math.max(0, Number(currentGoal) + Number(config.goal_increment || 0));
}

function getXpNeededForLevel(level: number, settings: GameProgressionSettings) {
  return Math.max(1, Math.floor(Number(settings.character_xp_base) + Math.max(0, level - 1) * Number(settings.character_xp_growth)));
}

function normalizeProgressionSettings(input: Partial<GameProgressionSettings>) {
  return {
    character_level_cap: Math.max(1, Math.floor(Number(input.character_level_cap) || defaultProgressionSettings.character_level_cap)),
    character_xp_base: Math.max(1, Math.floor(Number(input.character_xp_base) || defaultProgressionSettings.character_xp_base)),
    character_xp_growth: Math.max(0, Math.floor(Number(input.character_xp_growth) || 0)),
    default_attribute_level_cap: seasonOneAttributeLevelCap,
    daily_training_limit: dailyTrainingSessionLimit,
    training_cooldown_minutes: Math.max(0, Math.floor(Number(input.training_cooldown_minutes) || 0)),
  };
}

function normalizeTrainingConfig(input: TrainingAttributeConfig) {
  return {
    attribute_key: input.attribute_key,
    name: input.name?.trim() || defaultTrainingConfigs[input.attribute_key].name,
    effect: input.effect?.trim() || defaultTrainingConfigs[input.attribute_key].effect,
    activities: input.activities?.trim() || defaultTrainingConfigs[input.attribute_key].activities,
    image_url: input.image_url?.trim() || null,
    background_image_url: input.background_image_url?.trim() || null,
    unit: "minutes",
    goal_template: defaultTrainingConfigs[input.attribute_key].goal_template,
    starting_goal: 30,
    goal_increment: 0,
    character_xp_reward: Math.max(0, Math.floor(Number(input.character_xp_reward) || 0)),
    attribute_xp_reward: Math.max(1, Math.floor(Number(input.attribute_xp_reward) || 1)),
    level_cap: seasonOneAttributeLevelCap,
    is_active: input.is_active ?? true,
  };
}

function makeDefaultTrainingConfig(
  attributeKey: AttributeKey,
  name: string,
  effect: string,
  activities: string,
  unit: string,
  goalTemplate: string,
  startingGoal: number,
  goalIncrement: number,
): TrainingAttributeConfig {
  return {
    attribute_key: attributeKey,
    name,
    effect,
    activities,
    image_url: null,
    background_image_url: null,
    unit,
    goal_template: goalTemplate,
    starting_goal: startingGoal,
    goal_increment: goalIncrement,
    character_xp_reward: 25,
    attribute_xp_reward: 1,
    level_cap: seasonOneAttributeLevelCap,
    is_active: true,
    updated_at: new Date(0).toISOString(),
  };
}

export async function recordEnemyKill(input: EnemyKillInput) {
  const now = new Date().toISOString();
  const enemyName = input.enemyName.trim() || "Unknown Enemy";
  const enemyType = input.enemyType?.trim() || "Unknown";
  const enemyKey = getEnemyKey(input.enemySource, input.enemyId, input.npcId, enemyName);

  const { error: logError } = await supabase.from("enemy_kill_log").insert({
    user_id: input.userId,
    character_id: input.characterId,
    enemy_key: enemyKey,
    enemy_id: input.enemyId ?? null,
    npc_id: input.npcId ?? null,
    enemy_name: enemyName,
    enemy_type: enemyType,
    enemy_source: input.enemySource,
    route_id: input.routeId ?? null,
    map_event_id: input.mapEventId ?? null,
    season_number: Number(input.seasonNumber) || 1,
    chapter_number: Number(input.chapterNumber) || 1,
    killed_at: now,
  });

  if (logError) {
    throw logError;
  }

  const [enemyStat, typeStat] = await Promise.all([
    getEnemyKillStat(input.characterId, enemyKey),
    getEnemyTypeKillStat(input.characterId, enemyType),
  ]);

  const enemyPayload = {
    user_id: input.userId,
    character_id: input.characterId,
    enemy_key: enemyKey,
    enemy_id: input.enemyId ?? null,
    npc_id: input.npcId ?? null,
    enemy_name: enemyName,
    enemy_type: enemyType,
    enemy_source: input.enemySource,
    kill_count: Number(enemyStat?.kill_count ?? 0) + 1,
    last_killed_at: now,
  };

  const typePayload = {
    user_id: input.userId,
    character_id: input.characterId,
    enemy_type: enemyType,
    kill_count: Number(typeStat?.kill_count ?? 0) + 1,
    last_killed_at: now,
  };

  const [enemyUpsert, typeUpsert] = await Promise.all([
    supabase.from("player_enemy_kill_stats").upsert(enemyPayload, { onConflict: "character_id,enemy_key" }),
    supabase.from("player_enemy_type_kill_stats").upsert(typePayload, { onConflict: "character_id,enemy_type" }),
  ]);

  if (enemyUpsert.error) {
    throw enemyUpsert.error;
  }

  if (typeUpsert.error) {
    throw typeUpsert.error;
  }

  await Promise.all([
    recordSocialContribution({
      userId: input.userId,
      metricType: "enemy_kills",
      amount: 1,
      sourceType: input.enemySource,
      sourceId: enemyKey,
    }),
    recordSocialContribution({
      userId: input.userId,
      metricType: "enemy_name_kills",
      metricFilter: enemyName,
      amount: 1,
      sourceType: input.enemySource,
      sourceId: enemyKey,
    }),
    recordSocialContribution({
      userId: input.userId,
      metricType: "enemy_type_kills",
      metricFilter: enemyType,
      amount: 1,
      sourceType: input.enemySource,
      sourceId: enemyKey,
    }),
  ]);

  return {
    enemyKey,
    enemyName,
    enemyType,
    enemyKillCount: enemyPayload.kill_count,
    typeKillCount: typePayload.kill_count,
  };
}

async function getEnemyKillStat(characterId: string, enemyKey: string) {
  const { data, error } = await supabase
    .from("player_enemy_kill_stats")
    .select("*")
    .eq("character_id", characterId)
    .eq("enemy_key", enemyKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlayerEnemyKillStat | null;
}

async function getEnemyTypeKillStat(characterId: string, enemyType: string) {
  const { data, error } = await supabase
    .from("player_enemy_type_kill_stats")
    .select("*")
    .eq("character_id", characterId)
    .eq("enemy_type", enemyType)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlayerEnemyTypeKillStat | null;
}

function getEnemyKey(source: EnemyKillLog["enemy_source"], enemyId: string | null | undefined, npcId: string | null | undefined, enemyName: string) {
  if (source === "enemy" && enemyId) {
    return `enemy:${enemyId}`;
  }

  if (source === "npc" && npcId) {
    return `npc:${npcId}`;
  }

  return `manual:${enemyName.trim().toLowerCase().replace(/\s+/g, "-") || "unknown"}`;
}
