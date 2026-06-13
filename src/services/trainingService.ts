import { supabase, Tables } from "../lib/supabase";
import { CharacterWithDetails, getCharacter } from "./characterService";

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
  cooldownUntil: string | null;
  lastCompletedAt: string | null;
  history: TrainingSession[];
};

const characterXpPerSession = 25;
const dailyTrainingLimit = 2;
const cooldownMinutes = 60;

export const trainingConfig: Record<
  AttributeKey,
  {
    name: string;
    effect: string;
    activities: string;
    unit: string;
    startingGoal: number;
    nextGoal: (current: number) => number;
    formatGoal: (value: number) => string;
  }
> = {
  strength: {
    name: "Strength",
    effect: "Increases melee damage and carry power.",
    activities: "Workouts, pushups, weights, bodyweight training, physical labor",
    unit: "pushups",
    startingGoal: 5,
    nextGoal: (current) => current + 5,
    formatGoal: (value) => `${Math.round(value)} pushups or equivalent strength work`,
  },
  endurance: {
    name: "Endurance",
    effect: "Increases HP and stamina.",
    activities: "Walking, hiking, labor, long physical activity",
    unit: "steps",
    startingGoal: 1000,
    nextGoal: (current) => current + 1000,
    formatGoal: (value) => `${Math.round(value).toLocaleString()} steps or equivalent endurance work`,
  },
  agility: {
    name: "Agility",
    effect: "Increases dodge, speed, and critical chance.",
    activities: "Running, basketball, martial arts, jump rope",
    unit: "miles",
    startingGoal: 0.25,
    nextGoal: (current) => (current < 0.5 ? 0.5 : current < 1 ? 1 : current + 0.5),
    formatGoal: (value) => `${value.toFixed(value < 1 ? 2 : 1)} mile run or agility practice`,
  },
  intelligence: {
    name: "Intelligence",
    effect: "Increases magic power and crafting knowledge.",
    activities: "Reading, studying, learning a language, taking a course",
    unit: "pages",
    startingGoal: 5,
    nextGoal: (current) => current + 5,
    formatGoal: (value) => `${Math.round(value)} pages read or focused study`,
  },
  wisdom: {
    name: "Wisdom",
    effect: "Increases mana, focus, and resistance.",
    activities: "Meditation, journaling, breathing, yoga",
    unit: "minutes",
    startingGoal: 3,
    nextGoal: (current) => (current < 5 ? 5 : current < 10 ? 10 : current + 5),
    formatGoal: (value) => `${Math.round(value)} minutes meditation, journaling, or breathwork`,
  },
  charisma: {
    name: "Charisma",
    effect: "Increases merchant discounts, reputation, and leadership.",
    activities: "Social practice, talking to a stranger, calling someone, community activity",
    unit: "interactions",
    startingGoal: 1,
    nextGoal: (current) => current + 1,
    formatGoal: (value) => `${Math.round(value)} meaningful social interaction${Math.round(value) === 1 ? "" : "s"}`,
  },
  spirit: {
    name: "Spirit",
    effect: "Increases blessing power, corruption resistance, and special story choices.",
    activities: "Kindness, helping someone, prayer, faith activity, reflection, service",
    unit: "acts",
    startingGoal: 1,
    nextGoal: (current) => current + 1,
    formatGoal: (value) => `${Math.round(value)} act${Math.round(value) === 1 ? "" : "s"} of kindness, service, or reflection`,
  },
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

  await ensureAttributeProgress(user.id, character.id);

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
    cards: (Object.keys(trainingConfig) as AttributeKey[]).map((key) => {
      const config = trainingConfig[key];
      const progress = progressRows.find((row) => row.attribute_key === key);
      const nextGoalValue = Number(progress?.next_goal_value ?? config.startingGoal);

      return {
        key,
        name: config.name,
        effect: config.effect,
        activities: config.activities,
        unit: config.unit,
        goalLabel: config.formatGoal(nextGoalValue),
        currentLevel: progress?.current_level ?? 0,
        currentXp: progress?.current_xp ?? 0,
        nextGoalValue,
        cooldownUntil: progress?.cooldown_until ?? null,
        lastCompletedAt: progress?.last_completed_at ?? null,
        history: sessions.filter((session) => session.attribute_key === key).slice(0, 3),
      };
    }),
    dailyCompleted: dailyResult.count ?? 0,
    dailyLimit: dailyTrainingLimit,
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

  if ((count ?? 0) >= dailyTrainingLimit) {
    throw new Error("Daily training limit reached. You can complete 2 full sessions per day.");
  }

  await ensureAttributeProgress(user.id, character.id);

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

  const config = trainingConfig[attributeKey];
  const currentGoal = Number(currentProgress.next_goal_value || config.startingGoal);
  const nextGoal = config.nextGoal(currentGoal);
  const nextAttributeXp = currentProgress.current_xp + 1;
  const nextAttributeLevel = getLevelFromTrainingCompletions(nextAttributeXp);
  const nextCooldown = new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString();

  const { error: sessionError } = await supabase.from("training_sessions").insert({
    user_id: user.id,
    character_id: character.id,
    attribute_key: attributeKey,
    activity_label: config.formatGoal(currentGoal),
    goal_value: currentGoal,
    goal_unit: config.unit,
    attribute_xp: 1,
    character_xp: characterXpPerSession,
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

  const nextCharacterXp = character.xp + characterXpPerSession;
  const nextCharacterLevel = Math.floor(nextCharacterXp / 100) + 1;
  const { error: characterError } = await supabase
    .from("characters")
    .update({
      xp: nextCharacterXp,
      level: Math.max(character.level, nextCharacterLevel),
    })
    .eq("id", character.id)
    .eq("user_id", user.id);

  if (characterError) {
    throw characterError;
  }

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

  return {
    character: updatedCharacter,
    message: `${config.name} training complete. ${config.name} is now level ${nextAttributeLevel}. +${characterXpPerSession} character XP.`,
  };
}

function getLevelFromTrainingCompletions(completions: number) {
  let level = 0;
  let remaining = completions;
  let required = 1;

  while (remaining >= required) {
    level += 1;
    remaining -= required;
    required += 1;
  }

  return level;
}

export function getTrainingLevelProgress(completions: number) {
  let level = 0;
  let remaining = completions;
  let required = 1;

  while (remaining >= required) {
    level += 1;
    remaining -= required;
    required += 1;
  }

  return {
    level,
    progress: remaining,
    required,
  };
}

async function ensureAttributeProgress(userId: string, characterId: string) {
  const rows = (Object.keys(trainingConfig) as AttributeKey[]).map((key) => ({
    user_id: userId,
    character_id: characterId,
    attribute_key: key,
    next_goal_value: trainingConfig[key].startingGoal,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("attribute_progress").upsert(rows, { onConflict: "character_id,attribute_key", ignoreDuplicates: true });

  if (error) {
    throw error;
  }
}
