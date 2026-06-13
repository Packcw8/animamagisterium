import { supabase, Tables } from "../lib/supabase";
import type { CharacterWithDetails } from "./characterService";
import type { AttributeKey } from "./trainingService";

export type PlayerAbility = Tables["player_abilities"];
export type EquippedAbility = Tables["equipped_abilities"];

export type AbilityDefinition = {
  key: string;
  name: string;
  attribute: AttributeKey;
  unlockLevel: number;
  kind: "physical" | "magic" | "divine";
  resource: "stamina" | "magicka";
  cost: number;
  baseDamage: number;
  scaling: number;
  critBonus?: number;
  description: string;
};

export type CharacterResources = {
  maxHp: number;
  maxStamina: number;
  maxMagicka: number;
};

export type CombatLoadout = {
  unlocked: AbilityDefinition[];
  equipped: Array<AbilityDefinition | null>;
  resources: CharacterResources;
};

export const abilityDefinitions: AbilityDefinition[] = [
  {
    key: "power_strike",
    name: "Power Strike",
    attribute: "strength",
    unlockLevel: 1,
    kind: "physical",
    resource: "stamina",
    cost: 5,
    baseDamage: 8,
    scaling: 2,
    description: "Physical attack. 8 damage plus Strength scaling.",
  },
  {
    key: "iron_bash",
    name: "Iron Bash",
    attribute: "endurance",
    unlockLevel: 1,
    kind: "physical",
    resource: "stamina",
    cost: 4,
    baseDamage: 7,
    scaling: 2,
    description: "Physical attack. 7 damage plus Endurance scaling.",
  },
  {
    key: "swift_slash",
    name: "Swift Slash",
    attribute: "agility",
    unlockLevel: 1,
    kind: "physical",
    resource: "stamina",
    cost: 3,
    baseDamage: 6,
    scaling: 2,
    critBonus: 0.1,
    description: "Physical attack. 6 damage plus Agility scaling with a small crit bonus.",
  },
  {
    key: "arcane_bolt",
    name: "Arcane Bolt",
    attribute: "intelligence",
    unlockLevel: 1,
    kind: "magic",
    resource: "magicka",
    cost: 5,
    baseDamage: 8,
    scaling: 2,
    description: "Magic attack. 8 damage plus Intelligence scaling.",
  },
  {
    key: "mind_lance",
    name: "Mind Lance",
    attribute: "wisdom",
    unlockLevel: 1,
    kind: "magic",
    resource: "magicka",
    cost: 4,
    baseDamage: 7,
    scaling: 2,
    description: "Magic attack. 7 damage plus Wisdom scaling.",
  },
  {
    key: "inspiring_shout",
    name: "Inspiring Shout",
    attribute: "charisma",
    unlockLevel: 1,
    kind: "physical",
    resource: "stamina",
    cost: 3,
    baseDamage: 7,
    scaling: 2,
    description: "Attack. 7 damage plus Charisma scaling.",
  },
  {
    key: "holy_spark",
    name: "Holy Spark",
    attribute: "spirit",
    unlockLevel: 1,
    kind: "divine",
    resource: "magicka",
    cost: 5,
    baseDamage: 8,
    scaling: 2,
    description: "Divine attack. 8 damage plus Spirit scaling.",
  },
];

export function getCharacterResources(character: CharacterWithDetails, bonuses?: Partial<CharacterResources>): CharacterResources {
  const attributes = character.attributes;
  const strength = attributes?.strength ?? 0;
  const endurance = attributes?.endurance ?? 0;
  const intelligence = attributes?.intelligence ?? 0;
  const wisdom = attributes?.wisdom ?? 0;
  const spirit = attributes?.spirit ?? 0;

  return {
    maxHp: 30 + endurance * 8 + strength * 2 + (bonuses?.maxHp ?? 0),
    maxStamina: 12 + strength * 3 + endurance * 4 + (bonuses?.maxStamina ?? 0),
    maxMagicka: 10 + intelligence * 4 + wisdom * 3 + spirit * 4 + (bonuses?.maxMagicka ?? 0),
  };
}

export function getAbilityDamage(ability: AbilityDefinition, character: CharacterWithDetails) {
  const attributeLevel = character.attributes?.[ability.attribute] ?? 0;
  const base = ability.baseDamage + attributeLevel * ability.scaling;
  const crit = ability.critBonus ? Math.random() < ability.critBonus + attributeLevel * 0.01 : false;
  return {
    damage: crit ? Math.ceil(base * 1.5) : base,
    crit,
  };
}

export async function getCombatLoadout(character: CharacterWithDetails): Promise<CombatLoadout> {
  await syncUnlockedAbilities(character);
  await ensureEquippedSlots(character.id);

  const [abilitiesResult, equippedResult] = await Promise.all([
    supabase.from("player_abilities").select("*").eq("character_id", character.id),
    supabase.from("equipped_abilities").select("*").eq("character_id", character.id).order("slot", { ascending: true }),
  ]);

  if (abilitiesResult.error) {
    throw abilitiesResult.error;
  }

  if (equippedResult.error) {
    throw equippedResult.error;
  }

  const unlockedRows = (abilitiesResult.data ?? []) as PlayerAbility[];
  const equippedRows = (equippedResult.data ?? []) as EquippedAbility[];
  const unlocked = abilityDefinitions.filter((ability) => unlockedRows.some((row) => row.ability_key === ability.key));
  const equipped = [1, 2, 3, 4].map((slot) => {
    const row = equippedRows.find((item) => item.slot === slot);
    return abilityDefinitions.find((ability) => ability.key === row?.ability_key) ?? null;
  });

  return {
    unlocked,
    equipped,
    resources: getCharacterResources(character),
  };
}

export async function equipAbility(characterId: string, slot: number, abilityKey: string | null) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be signed in to equip abilities.");
  }

  if (abilityKey) {
    const { data: owned, error: ownedError } = await supabase
      .from("player_abilities")
      .select("id")
      .eq("user_id", user.id)
      .eq("character_id", characterId)
      .eq("ability_key", abilityKey)
      .maybeSingle();

    if (ownedError) {
      throw ownedError;
    }

    if (!owned) {
      throw new Error("That ability is not unlocked yet.");
    }
  }

  const { error } = await supabase.from("equipped_abilities").upsert(
    {
      user_id: user.id,
      character_id: characterId,
      slot,
      ability_key: abilityKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "character_id,slot" },
  );

  if (error) {
    throw error;
  }
}

export async function syncUnlockedAbilities(character: CharacterWithDetails) {
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

  const unlocked = abilityDefinitions.filter((ability) => (character.attributes?.[ability.attribute] ?? 0) >= ability.unlockLevel);

  if (unlocked.length === 0) {
    return;
  }

  const { error } = await supabase.from("player_abilities").upsert(
    unlocked.map((ability) => ({
      user_id: user.id,
      character_id: character.id,
      ability_key: ability.key,
      unlocked_by_attribute: ability.attribute,
    })),
    { onConflict: "character_id,ability_key", ignoreDuplicates: true },
  );

  if (error) {
    throw error;
  }
}

async function ensureEquippedSlots(characterId: string) {
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

  const { error } = await supabase.from("equipped_abilities").upsert(
    [1, 2, 3, 4].map((slot) => ({
      user_id: user.id,
      character_id: characterId,
      slot,
      ability_key: null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "character_id,slot", ignoreDuplicates: true },
  );

  if (error) {
    throw error;
  }
}
