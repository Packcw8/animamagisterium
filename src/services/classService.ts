import { supabase, Tables } from "../lib/supabase";
import type { AttributeKey } from "./trainingService";
import type { CharacterWithDetails } from "./characterService";
import { getAttributeLevelFromXp, getAttributeLevelProgress, seasonOneAttributeLevelCap } from "./progressionService";
import { resolveGameAssetUri } from "../utils/assetResolver";

export type ClassKey =
  | "warrior"
  | "berserker"
  | "spellblade"
  | "paladin"
  | "templar"
  | "warlord"
  | "ranger"
  | "battlemage"
  | "guardian"
  | "cleric"
  | "captain"
  | "rogue"
  | "monk"
  | "assassin"
  | "bard"
  | "mage"
  | "sorcerer"
  | "enchanter"
  | "druid"
  | "priest"
  | "prophet";

export type ClassDefinition = Tables["class_definitions"];
export type ClassProgress = Tables["class_progress"];
export type PlayerClassSelection = Tables["player_class_selection"];

export type ClassCombo = {
  key: ClassKey;
  name: string;
  firstAttribute: AttributeKey;
  secondAttribute: AttributeKey;
};

export type PlayerClassState = ClassCombo & {
  firstLevel: number;
  secondLevel: number;
  unlocked: boolean;
  selected: boolean;
  classLevel: number;
  classXp: number;
  classProgress: ReturnType<typeof getAttributeLevelProgress>;
  imageUrl: string | null;
  backgroundImageUrl: string | null;
  description: string;
};

export const classUnlockLevel = 5;
export const classAssetBasePath = "/assets/classes/";

export const classCombinations: ClassCombo[] = [
  { key: "warrior", name: "Warrior", firstAttribute: "strength", secondAttribute: "endurance" },
  { key: "berserker", name: "Berserker", firstAttribute: "strength", secondAttribute: "agility" },
  { key: "spellblade", name: "Spellblade", firstAttribute: "strength", secondAttribute: "intelligence" },
  { key: "paladin", name: "Paladin", firstAttribute: "strength", secondAttribute: "wisdom" },
  { key: "templar", name: "Templar", firstAttribute: "strength", secondAttribute: "spirit" },
  { key: "warlord", name: "Warlord", firstAttribute: "strength", secondAttribute: "charisma" },
  { key: "ranger", name: "Ranger", firstAttribute: "endurance", secondAttribute: "agility" },
  { key: "battlemage", name: "Battlemage", firstAttribute: "endurance", secondAttribute: "intelligence" },
  { key: "guardian", name: "Guardian", firstAttribute: "endurance", secondAttribute: "wisdom" },
  { key: "cleric", name: "Cleric", firstAttribute: "endurance", secondAttribute: "spirit" },
  { key: "captain", name: "Captain", firstAttribute: "endurance", secondAttribute: "charisma" },
  { key: "rogue", name: "Rogue", firstAttribute: "agility", secondAttribute: "intelligence" },
  { key: "monk", name: "Monk", firstAttribute: "agility", secondAttribute: "wisdom" },
  { key: "assassin", name: "Assassin", firstAttribute: "agility", secondAttribute: "spirit" },
  { key: "bard", name: "Bard", firstAttribute: "agility", secondAttribute: "charisma" },
  { key: "mage", name: "Mage", firstAttribute: "intelligence", secondAttribute: "wisdom" },
  { key: "sorcerer", name: "Sorcerer", firstAttribute: "intelligence", secondAttribute: "spirit" },
  { key: "enchanter", name: "Enchanter", firstAttribute: "intelligence", secondAttribute: "charisma" },
  { key: "druid", name: "Druid", firstAttribute: "wisdom", secondAttribute: "spirit" },
  { key: "priest", name: "Priest", firstAttribute: "wisdom", secondAttribute: "charisma" },
  { key: "prophet", name: "Prophet", firstAttribute: "spirit", secondAttribute: "charisma" },
];

export async function getPlayerClassState(character: CharacterWithDetails): Promise<PlayerClassState[]> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw userError;
  }

  if (user) {
    await ensureClassProgress(user.id, character.id);
  }

  const [definitionsResult, selectionResult] = await Promise.all([
    supabase.from("class_definitions").select("*"),
    supabase.from("player_class_selection").select("*").eq("character_id", character.id).maybeSingle(),
  ]);

  if (definitionsResult.error && !isMissingClassTableError(definitionsResult.error)) {
    throw definitionsResult.error;
  }

  if (selectionResult.error && !isMissingClassTableError(selectionResult.error)) {
    throw selectionResult.error;
  }

  const definitions = ((definitionsResult.data ?? []) as ClassDefinition[]).reduce<Record<string, ClassDefinition>>((map, definition) => {
    map[definition.class_key] = definition;
    return map;
  }, {});
  const selectedKey = (selectionResult.data as PlayerClassSelection | null)?.class_key ?? null;
  const progressRows = user ? await getClassProgressRows(character.id) : [];
  const progressMap = progressRows.reduce<Record<string, ClassProgress>>((map, progress) => {
    map[progress.class_key] = progress;
    return map;
  }, {});

  return classCombinations.map((combo) => {
    const definition = definitions[combo.key];
    const progress = progressMap[combo.key];
    const firstLevel = Number(character.attributes?.[combo.firstAttribute] ?? 0);
    const secondLevel = Number(character.attributes?.[combo.secondAttribute] ?? 0);
    const unlocked = firstLevel >= classUnlockLevel && secondLevel >= classUnlockLevel;
    const classXp = Number(progress?.current_xp ?? 0);
    const classLevel = getAttributeLevelFromXp(classXp, seasonOneAttributeLevelCap);

    return {
      ...combo,
      name: definition?.name || combo.name,
      firstLevel,
      secondLevel,
      unlocked,
      selected: unlocked && selectedKey === combo.key,
      classLevel,
      classXp,
      classProgress: getAttributeLevelProgress(classXp, seasonOneAttributeLevelCap),
      imageUrl: definition?.image_url ?? null,
      backgroundImageUrl: definition?.background_image_url ?? null,
      description: definition?.description || `${formatAttributeName(combo.firstAttribute)} and ${formatAttributeName(combo.secondAttribute)} training unlock this path.`,
    };
  });
}

export async function selectActiveClass(character: CharacterWithDetails, classKey: ClassKey) {
  const combo = classCombinations.find((item) => item.key === classKey);

  if (!combo) {
    throw new Error("Unknown class.");
  }

  const firstLevel = Number(character.attributes?.[combo.firstAttribute] ?? 0);
  const secondLevel = Number(character.attributes?.[combo.secondAttribute] ?? 0);
  if (firstLevel < classUnlockLevel || secondLevel < classUnlockLevel) {
    throw new Error(`${combo.name} requires ${formatAttributeName(combo.firstAttribute)} ${classUnlockLevel} and ${formatAttributeName(combo.secondAttribute)} ${classUnlockLevel}.`);
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to select a class.");
  }

  const { error } = await supabase.from("player_class_selection").upsert({
    user_id: user.id,
    character_id: character.id,
    class_key: classKey,
    updated_at: new Date().toISOString(),
  }, { onConflict: "character_id" });

  if (error) {
    throw error;
  }
}

export async function ensureClassProgress(userId: string, characterId: string) {
  const now = new Date().toISOString();
  const rows = classCombinations.map((combo) => ({
    user_id: userId,
    character_id: characterId,
    class_key: combo.key,
    updated_at: now,
  }));

  const { error } = await supabase.from("class_progress").upsert(rows, { onConflict: "character_id,class_key", ignoreDuplicates: true });
  if (error && !isMissingClassTableError(error)) {
    throw error;
  }
}

export async function getClassProgressRows(characterId: string) {
  const { data, error } = await supabase
    .from("class_progress")
    .select("*")
    .eq("character_id", characterId);

  if (error) {
    if (isMissingClassTableError(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []) as ClassProgress[];
}

export async function advanceActiveClassProgress(character: CharacterWithDetails, trainedAttribute: AttributeKey) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const selectionResult = await supabase
    .from("player_class_selection")
    .select("class_key")
    .eq("character_id", character.id)
    .maybeSingle();

  if (selectionResult.error) {
    if (isMissingClassTableError(selectionResult.error)) {
      return null;
    }
    throw selectionResult.error;
  }

  const classKey = selectionResult.data?.class_key as ClassKey | undefined;
  const combo = classCombinations.find((item) => item.key === classKey);
  if (!combo || (trainedAttribute !== combo.firstAttribute && trainedAttribute !== combo.secondAttribute)) {
    return null;
  }

  await ensureClassProgress(user.id, character.id);

  const currentResult = await supabase
    .from("class_progress")
    .select("*")
    .eq("character_id", character.id)
    .eq("class_key", combo.key)
    .single();

  if (currentResult.error) {
    throw currentResult.error;
  }

  const current = currentResult.data as ClassProgress;
  const previousLevel = getAttributeLevelFromXp(Number(current.current_xp ?? 0), seasonOneAttributeLevelCap);
  const nextXp = Number(current.current_xp ?? 0) + 1;
  const nextLevel = getAttributeLevelFromXp(nextXp, seasonOneAttributeLevelCap);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("class_progress")
    .update({
      current_xp: nextXp,
      current_level: nextLevel,
      last_trained_at: now,
      updated_at: now,
    })
    .eq("id", current.id);

  if (error) {
    throw error;
  }

  return {
    classKey: combo.key,
    className: combo.name,
    previousLevel,
    nextLevel,
    leveledUp: nextLevel > previousLevel,
  };
}

export async function saveClassDefinition(input: Pick<ClassDefinition, "class_key" | "name" | "description" | "image_url" | "background_image_url">) {
  const combo = classCombinations.find((item) => item.key === input.class_key);
  if (!combo) {
    throw new Error("Choose a class to edit.");
  }

  const { data, error } = await supabase
    .from("class_definitions")
    .upsert({
      class_key: combo.key,
      name: input.name?.trim() || combo.name,
      first_attribute: combo.firstAttribute,
      second_attribute: combo.secondAttribute,
      unlock_level: classUnlockLevel,
      description: input.description?.trim() || null,
      image_url: input.image_url?.trim() || null,
      background_image_url: input.background_image_url?.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "class_key" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as ClassDefinition;
}

export function formatAttributeName(attribute: AttributeKey) {
  return attribute.slice(0, 1).toUpperCase() + attribute.slice(1);
}

export function resolveClassImageUri(imagePath?: string | null) {
  return resolveGameAssetUri(imagePath, "misc");
}

function isMissingClassTableError(error: { message?: string; code?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42P01" || message.includes("class_definitions") || message.includes("player_class_selection") || message.includes("class_progress");
}
