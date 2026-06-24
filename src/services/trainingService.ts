import { supabase, Tables } from "../lib/supabase";
import { CharacterWithDetails, getCharacter } from "./characterService";
import { syncUnlockedAbilities } from "./abilityService";
import { recordSocialContribution } from "./partyGuildService";
import {
  applyCharacterXpGold,
  attributeKeys,
  defaultTrainingConfigs,
  formatTrainingGoal,
  getAttributeLevelFromXp,
  getAttributeLevelProgress,
  getNextGoalValue,
  getProgressionSettings,
  getTrainingConfigs,
  TrainingAttributeConfig,
} from "./progressionService";

export type AttributeKey = Tables["attribute_progress"]["attribute_key"];
export type AttributeProgress = Tables["attribute_progress"];
export type TrainingSession = Tables["training_sessions"];

export type TrainingCardState = {
  key: AttributeKey;
  name: string;
  effect: string;
  activities: string;
  unit: string;
  goalLabel: string;
  currentLevel: number;
  currentXp: number;
  nextGoalValue: number;
  levelCap: number;
  cooldownUntil: string | null;
  lastCompletedAt: string | null;
  history: TrainingSession[];
};

export function getTodayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function getTrainingState(character: CharacterWithDetails) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be signed in to train.");
  }

  const [settings, configs] = await Promise.all([getProgressionSettings(), getTrainingConfigs()]);
  const configMap = getConfigMap(configs);

  await ensureAttributeProgress(user.id, character.id, configMap);

  const today = getTodayKey();
  const [progressResult, sessionsResult, dailyResult] = await Promise.all([
    supabase.from("attribute_progress").select("*").eq("user_id", user.id).eq("character_id", character.id),
    supabase
      .from("training_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("character_id", character.id)
      .order("completed_at", { ascending: false })
      .limit(30),
    supabase
      .from("training_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("character_id", character.id)
      .eq("training_date", today),
  ]);

  if (progressResult.error) {
    throw progressResult.error;
  }

  if (sessionsResult.error) {
    throw sessionsResult.error;
  }

  if (dailyResult.error) {
    throw dailyResult.error;
  }

  const progressRows = (progressResult.data ?? []) as AttributeProgress[];
  const sessions = (sessionsResult.data ?? []) as TrainingSession[];

  return {
    cards: attributeKeys.map((key) => {
      const config = configMap[key];
      const progress = progressRows.find((row) => row.attribute_key === key);
      const nextGoalValue = Number(progress?.next_goal_value ?? config.starting_goal);

      return {
        key,
        name: config.name,
        effect: config.effect,
        activities: config.activities,
        unit: config.unit,
        goalLabel: formatTrainingGoal(config, nextGoalValue),
        currentLevel: progress?.current_level ?? 0,
        currentXp: progress?.current_xp ?? 0,
        nextGoalValue,
        levelCap: config.level_cap || settings.default_attribute_level_cap,
        cooldownUntil: progress?.cooldown_until ?? null,
        lastCompletedAt: progress?.last_completed_at ?? null,
        history: sessions.filter((session) => session.attribute_key === key).slice(0, 3),
      };
    }),
    dailyCompleted: dailyResult.count ?? 0,
    dailyLimit: settings.daily_training_limit,
  };
}

export async function completeTrainingSession(character: CharacterWithDetails, attributeKey: AttributeKey) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be signed in to train.");
  }

  const today = getTodayKey();
  const { count, error: countError } = await supabase
    .from("training_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("character_id", character.id)
    .eq("training_date", today);

  if (countError) {
    throw countError;
  }

  const [settings, configs] = await Promise.all([getProgressionSettings(), getTrainingConfigs()]);
  const configMap = getConfigMap(configs);

  if ((count ?? 0) >= settings.daily_training_limit) {
    throw new Error(`Daily training limit reached. You can complete ${settings.daily_training_limit} full session${settings.daily_training_limit === 1 ? "" : "s"} per day.`);
  }

  await ensureAttributeProgress(user.id, character.id, configMap);

  const { data: progress, error: progressError } = await supabase
    .from("attribute_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("character_id", character.id)
    .eq("attribute_key", attributeKey)
    .single();

  if (progressError) {
    throw progressError;
  }

  const currentProgress = progress as AttributeProgress;
  const now = new Date();
  const cooldownUntil = currentProgress.cooldown_until ? new Date(currentProgress.cooldown_until) : null;

  if (cooldownUntil && cooldownUntil.getTime() > now.getTime()) {
    throw new Error(`Training is cooling down until ${cooldownUntil.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`);
  }

  const config = configMap[attributeKey];
  const currentGoal = Number(currentProgress.next_goal_value || config.starting_goal);
  const nextGoal = getNextGoalValue(config, currentGoal);
  const nextAttributeXp = currentProgress.current_xp + config.attribute_xp_reward;
  const nextAttributeLevel = getAttributeLevelFromXp(nextAttributeXp, config.level_cap || settings.default_attribute_level_cap);
  const nextCooldown = new Date(now.getTime() + settings.training_cooldown_minutes * 60 * 1000).toISOString();

  const { error: sessionError } = await supabase.from("training_sessions").insert({
    user_id: user.id,
    character_id: character.id,
    attribute_key: attributeKey,
    activity_label: formatTrainingGoal(config, currentGoal),
    goal_value: currentGoal,
    goal_unit: config.unit,
    attribute_xp: config.attribute_xp_reward,
    character_xp: config.character_xp_reward,
    training_date: today,
    completed_at: now.toISOString(),
  });

  if (sessionError) {
    throw sessionError;
  }

  const { error: progressUpdateError } = await supabase
    .from("attribute_progress")
    .update({
      current_xp: nextAttributeXp,
      current_level: nextAttributeLevel,
      next_goal_value: nextGoal,
      last_completed_at: now.toISOString(),
      cooldown_until: nextCooldown,
      updated_at: now.toISOString(),
    })
    .eq("id", currentProgress.id);

  if (progressUpdateError) {
    throw progressUpdateError;
  }

  await applyCharacterXpGold(character, config.character_xp_reward, 0);
  await recordSocialContribution({
    userId: user.id,
    metricType: "training_sessions",
    metricFilter: attributeKey,
    amount: 1,
    sourceType: "training",
    sourceId: attributeKey,
  });

  const { error: attributeError } = await supabase
    .from("attributes")
    .update({ [attributeKey]: nextAttributeLevel })
    .eq("character_id", character.id);

  if (attributeError) {
    throw attributeError;
  }

  const updatedCharacter = await getCharacter();

  if (!updatedCharacter) {
    throw new Error("Training completed, but character could not be reloaded.");
  }

  await syncUnlockedAbilities(updatedCharacter);

  return {
    character: updatedCharacter,
    message: `${config.name} training complete. ${config.name} is now level ${nextAttributeLevel}. +${config.character_xp_reward} character XP.`,
  };
}

export function getTrainingLevelProgress(completions: number, levelCap = 100) {
  return getAttributeLevelProgress(completions, levelCap);
}

async function ensureAttributeProgress(userId: string, characterId: string, configs?: Record<AttributeKey, TrainingAttributeConfig>) {
  const configMap = configs ?? defaultTrainingConfigs;
  const rows = attributeKeys.map((key) => ({
    user_id: userId,
    character_id: characterId,
    attribute_key: key,
    next_goal_value: configMap[key].starting_goal,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("attribute_progress").upsert(rows, { onConflict: "character_id,attribute_key", ignoreDuplicates: true });

  if (error) {
    throw error;
  }
}

function getConfigMap(configs: TrainingAttributeConfig[]) {
  return attributeKeys.reduce<Record<AttributeKey, TrainingAttributeConfig>>((map, key) => {
    map[key] = configs.find((config) => config.attribute_key === key) ?? defaultTrainingConfigs[key];
    return map;
  }, {} as Record<AttributeKey, TrainingAttributeConfig>);
}
