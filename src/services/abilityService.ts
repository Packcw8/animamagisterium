import { supabase, Tables } from "../lib/supabase";
import type { CharacterWithDetails } from "./characterService";
import type { AttributeKey } from "./trainingService";
import type { CombatAbility } from "./combatAdminService";

export type PlayerAbility = Tables["player_abilities"];
export type EquippedAbility = Tables["equipped_abilities"];
export type ItemDefinition = Tables["item_definitions"];

export type AbilityDefinition = {
  key: string;
  name: string;
  attribute: AttributeKey | null;
  unlockLevel: number;
  kind: "physical" | "magic" | "divine";
  resource: "health" | "stamina" | "magicka" | "none";
  cost: number;
  baseDamage: number;
  scaling: number;
  critBonus?: number;
  description: string;
  source: "default" | "training" | "weapon" | "admin";
  sourceWeapon?: ItemDefinition;
  adminAbility?: CombatAbility;
};

export type CharacterResources = {
  maxHp: number;
  maxStamina: number;
  maxMagicka: number;
};

export type UseContext = "battle_only" | "outside_battle_only" | "both";

export type CombatLoadout = {
  unlocked: AbilityDefinition[];
  equipped: Array<AbilityDefinition | null>;
  resources: CharacterResources;
};

export const defaultAttack: AbilityDefinition = {
  key: "default_punch",
  name: "Punch",
  attribute: "strength",
  unlockLevel: 0,
  kind: "physical",
  resource: "none",
  cost: 0,
  baseDamage: 3,
  scaling: 1,
  description: "A basic attack everyone knows. Costs nothing.",
  source: "default",
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
    source: "training",
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
    source: "training",
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
    source: "training",
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
    source: "training",
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
    source: "training",
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
    source: "training",
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
    source: "training",
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

export function clampHealth(value: number, maxHp: number) {
  return Math.max(0, Math.min(maxHp, Math.floor(Number(value) || 0)));
}

export function getCurrentHealth(character: CharacterWithDetails, resources: CharacterResources) {
  return clampHealth(character.current_health ?? resources.maxHp, resources.maxHp);
}

export function canUseAbilityInContext(ability: AbilityDefinition, context: "battle" | "outside") {
  const usage = ability.adminAbility?.usage_context ?? "battle_only";
  if (usage === "both") {
    return true;
  }
  return context === "battle" ? usage === "battle_only" : usage === "outside_battle_only";
}

export function getAbilityDamage(ability: AbilityDefinition, character: CharacterWithDetails) {
  const attributeLevel = ability.attribute ? character.attributes?.[ability.attribute] ?? 0 : 0;
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

  const [abilitiesResult, equippedResult, adminAbilitiesResult] = await Promise.all([
    supabase.from("player_abilities").select("*").eq("character_id", character.id),
    supabase.from("equipped_abilities").select("*").eq("character_id", character.id).order("slot", { ascending: true }),
    supabase.from("combat_abilities").select("*").eq("is_active", true),
  ]);

  if (abilitiesResult.error) {
    throw abilitiesResult.error;
  }

  if (equippedResult.error) {
    throw equippedResult.error;
  }

  if (adminAbilitiesResult.error) {
    throw adminAbilitiesResult.error;
  }

  const unlockedRows = (abilitiesResult.data ?? []) as PlayerAbility[];
  const equippedRows = (equippedResult.data ?? []) as EquippedAbility[];
  const adminAbilityDefinitions = ((adminAbilitiesResult.data ?? []) as CombatAbility[])
    .filter((ability) => unlockedRows.some((row) => row.ability_key === getAdminAbilityKey(ability.id)))
    .map(adminAbilityToDefinition);
  const availableAbilities = [
    defaultAttack,
    ...abilityDefinitions.filter((ability) => unlockedRows.some((row) => row.ability_key === ability.key)),
    ...adminAbilityDefinitions,
  ];
  const weaponAbility = await getEquippedWeaponAbility(character.id);
  const unlocked = weaponAbility ? [...availableAbilities, weaponAbility] : availableAbilities;
  const equipped = [1, 2, 3, 4].map((slot) => {
    const row = equippedRows.find((item) => item.slot === slot);
    return unlocked.find((ability) => ability.key === row?.ability_key) ?? null;
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

  if (abilityKey && abilityKey !== defaultAttack.key) {
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
      const weaponAbility = await getEquippedWeaponAbility(characterId);

      if (weaponAbility?.key !== abilityKey) {
        throw new Error("That ability is not unlocked yet.");
      }
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

async function getEquippedWeaponAbility(characterId: string): Promise<AbilityDefinition | null> {
  const { data: equipped, error: equippedError } = await supabase
    .from("equipped_items")
    .select("item_id")
    .eq("character_id", characterId)
    .eq("slot", "weapon")
    .maybeSingle();

  if (equippedError) {
    throw equippedError;
  }

  if (!equipped?.item_id) {
    return null;
  }

  const { data: weapon, error: weaponError } = await supabase
    .from("item_definitions")
    .select("*")
    .eq("id", equipped.item_id)
    .eq("type", "weapon")
    .maybeSingle();

  if (weaponError) {
    throw weaponError;
  }

  if (!weapon) {
    return null;
  }

  const weaponItem = weapon as ItemDefinition;

  if (weaponItem.linked_ability_id) {
    const { data: linkedAbility, error: linkedAbilityError } = await supabase
      .from("combat_abilities")
      .select("*")
      .eq("id", weaponItem.linked_ability_id)
      .maybeSingle();

    if (linkedAbilityError) {
      throw linkedAbilityError;
    }

    if (linkedAbility) {
      return {
        ...adminAbilityToDefinition(linkedAbility as CombatAbility),
        key: `weapon:${weaponItem.id}:${linkedAbility.id}`,
        source: "weapon",
        sourceWeapon: weaponItem,
      };
    }
  }

  return weaponToAbility(weaponItem);
}

function weaponToAbility(weapon: ItemDefinition): AbilityDefinition {
  const costType = weapon.ability_cost_type === "magika" ? "magicka" : weapon.ability_cost_type;
  const elementText = weapon.elemental_damage_type !== "none" && weapon.elemental_damage_amount > 0
    ? ` plus ${weapon.elemental_damage_amount} ${weapon.elemental_damage_type} damage`
    : "";

  return {
    key: `weapon:${weapon.id}`,
    name: weapon.ability_name || weapon.name,
    attribute: null,
    unlockLevel: 0,
    kind: weapon.elemental_damage_type === "holy" ? "divine" : weapon.elemental_damage_type === "none" ? "physical" : "magic",
    resource: costType,
    cost: Number(weapon.ability_cost_amount) || 0,
    baseDamage: (Number(weapon.damage_amount) || 0) + (Number(weapon.elemental_damage_amount) || 0),
    scaling: 0,
    description: `${weapon.name} attack. ${weapon.damage_amount || 0} weapon damage${elementText}.`,
    source: "weapon",
    sourceWeapon: weapon,
  };
}

export function getAbilityCostLabel(ability: AbilityDefinition) {
  if (ability.adminAbility) {
    const costs = [
      ability.adminAbility.health_cost > 0 ? `${ability.adminAbility.health_cost} Health` : null,
      ability.adminAbility.stamina_cost > 0 ? `${ability.adminAbility.stamina_cost} Stamina` : null,
      ability.adminAbility.magika_cost > 0 ? `${ability.adminAbility.magika_cost} Magika` : null,
    ].filter(Boolean);

    return costs.length > 0 ? costs.join(" + ") : "No cost";
  }

  if (ability.resource === "none" || ability.cost <= 0) {
    return "No cost";
  }

  return `${ability.cost} ${ability.resource === "magicka" ? "Magika" : ability.resource.charAt(0).toUpperCase() + ability.resource.slice(1)}`;
}

export function getAbilitySourceLabel(ability: AbilityDefinition) {
  if (ability.source === "weapon") {
    return "Weapon";
  }
  if (ability.source === "admin") {
    return "Learned";
  }
  if (ability.source === "default") {
    return "Default";
  }
  return "Training";
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

  const [adminAbilitiesResult] = await Promise.all([
    supabase
      .from("combat_abilities")
      .select("*")
      .eq("is_active", true)
      .not("required_attribute", "is", null),
  ]);

  if (adminAbilitiesResult.error) {
    throw adminAbilitiesResult.error;
  }

  const unlocked = abilityDefinitions.filter((ability) => ability.attribute && (character.attributes?.[ability.attribute] ?? 0) >= ability.unlockLevel);
  const adminUnlocked = ((adminAbilitiesResult.data ?? []) as CombatAbility[]).filter((ability) => {
    const attribute = ability.required_attribute;
    return attribute && (character.attributes?.[attribute] ?? 0) >= ability.required_attribute_level;
  });

  if (unlocked.length === 0 && adminUnlocked.length === 0) {
    return;
  }

  const { error } = await supabase.from("player_abilities").upsert(
    [
      ...unlocked.map((ability) => ({
        user_id: user.id,
        character_id: character.id,
        ability_key: ability.key,
        unlocked_by_attribute: ability.attribute,
      })),
      ...adminUnlocked.map((ability) => ({
        user_id: user.id,
        character_id: character.id,
        ability_key: getAdminAbilityKey(ability.id),
        unlocked_by_attribute: ability.required_attribute as AttributeKey,
      })),
    ],
    { onConflict: "character_id,ability_key", ignoreDuplicates: true },
  );

  if (error) {
    throw error;
  }
}

function getAdminAbilityKey(abilityId: string) {
  return `admin:${abilityId}`;
}

function adminAbilityToDefinition(ability: CombatAbility): AbilityDefinition {
  const primaryAttribute = ability.required_attribute;
  const cost = ability.magika_cost > 0 ? ability.magika_cost : ability.stamina_cost > 0 ? ability.stamina_cost : ability.health_cost > 0 ? ability.health_cost : 0;
  const resource = ability.magika_cost > 0 ? "magicka" : ability.stamina_cost > 0 ? "stamina" : ability.health_cost > 0 ? "health" : "none";
  const kind = ability.magika_cost > 0 || ability.type === "heal" || ability.status_effect !== "none" ? "magic" : "physical";

  return {
    key: getAdminAbilityKey(ability.id),
    name: ability.name,
    attribute: primaryAttribute,
    unlockLevel: ability.required_attribute_level,
    kind,
    resource,
    cost,
    baseDamage: ability.damage,
    scaling: primaryAttribute ? 2 : 0,
    critBonus: ability.critical_chance / 100,
    description: `${ability.type}. ${ability.damage} damage, ${ability.healing} healing, ${ability.defense_amount} defense.`,
    source: "admin",
    adminAbility: ability,
  };
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
