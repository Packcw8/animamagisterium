import { supabase, Tables } from "../lib/supabase";
import type { AttributeKey } from "./trainingService";
import type { CharacterWithDetails } from "./characterService";

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

  return classCombinations.map((combo) => {
    const definition = definitions[combo.key];
    const firstLevel = Number(character.attributes?.[combo.firstAttribute] ?? 0);
    const secondLevel = Number(character.attributes?.[combo.secondAttribute] ?? 0);
    const unlocked = firstLevel >= classUnlockLevel && secondLevel >= classUnlockLevel;

    return {
      ...combo,
      name: definition?.name || combo.name,
      firstLevel,
      secondLevel,
      unlocked,
      selected: unlocked && selectedKey === combo.key,
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
  const trimmed = imagePath?.trim();
  if (!trimmed) {
    return null;
  }
  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.replaceAll("\\", "/").replace(/^\/?assets\/classes\//i, classAssetBasePath);
  if (normalized.startsWith(classAssetBasePath)) {
    return normalized;
  }
  if (!normalized.includes("/")) {
    return `${classAssetBasePath}${normalized}`;
  }
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function isMissingClassTableError(error: { message?: string; code?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42P01" || message.includes("class_definitions") || message.includes("player_class_selection");
}
