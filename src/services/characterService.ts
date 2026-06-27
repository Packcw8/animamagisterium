import { User } from "@supabase/supabase-js";
import { supabase, Tables } from "../lib/supabase";

export type AvatarAssetType = Tables["avatar_assets"]["type"];

export type CharacterWithDetails = Tables["characters"] & {
  attributes: Tables["attributes"] | null;
  appearance: Tables["character_appearance"] | null;
  appearanceAssets: Partial<Record<AvatarAssetType, Tables["avatar_assets"]>>;
};

export type CharacterCreationInput = {
  name: string;
  gender: string;
  race: string;
  origin: string;
  original_photo_url: string;
  portrait_url: string;
  appearance: {
    baseAssetId?: string;
    faceAssetId?: string;
    hairAssetId?: string;
    armorAssetId?: string;
    weaponAssetId?: string;
    cloakAssetId?: string;
    skinTone?: string;
  };
};

const appearanceSelect = `
  *,
  base:base_asset_id(*),
  face:face_asset_id(*),
  hair:hair_asset_id(*),
  armor:armor_asset_id(*),
  weapon:weapon_asset_id(*),
  cloak:cloak_asset_id(*)
`;

function getAppearanceAssets(appearance: Record<string, unknown> | null) {
  if (!appearance) {
    return {};
  }

  return {
    base: appearance.base as Tables["avatar_assets"] | undefined,
    face: appearance.face as Tables["avatar_assets"] | undefined,
    hair: appearance.hair as Tables["avatar_assets"] | undefined,
    armor: appearance.armor as Tables["avatar_assets"] | undefined,
    weapon: appearance.weapon as Tables["avatar_assets"] | undefined,
    cloak: appearance.cloak as Tables["avatar_assets"] | undefined,
  };
}

function normalizeCharacter(data: Record<string, unknown>): CharacterWithDetails {
  const attributes = Array.isArray(data.attributes) ? data.attributes[0] : data.attributes;
  const appearance = Array.isArray(data.character_appearance) ? data.character_appearance[0] : data.character_appearance;

  return {
    ...(data as Tables["characters"]),
    attributes: (attributes as Tables["attributes"] | undefined) ?? null,
    appearance: (appearance as Tables["character_appearance"] | undefined) ?? null,
    appearanceAssets: getAppearanceAssets((appearance as Record<string, unknown> | undefined) ?? null),
  };
}

export async function getCurrentUserProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (error) {
    throw error;
  }

  return data as Tables["profiles"] | null;
}

export async function createProfileIfMissing(user: User, username?: string) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        username: username || user.email?.split("@")[0] || "Adventurer",
      },
      { onConflict: "id" },
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Tables["profiles"];
}

export async function getAvatarAssets() {
  const { data, error } = await supabase
    .from("avatar_assets")
    .select("*")
    .eq("is_active", true)
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Tables["avatar_assets"][];
}

export async function getCharacter() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("characters")
    .select(`*, attributes(*), character_appearance(${appearanceSelect})`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeCharacter(data as Record<string, unknown>) : null;
}

export async function createCharacter(input: CharacterCreationInput) {
  const cleanName = input.name.trim();

  if (!cleanName) {
    throw new Error("Character name is required.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be signed in to create a character.");
  }

  await createProfileIfMissing(user);

  const existingCharacter = await getCharacter();

  if (existingCharacter) {
    throw new Error("A character already exists for this account.");
  }

  const { data: character, error: characterError } = await supabase
    .from("characters")
    .insert({
      user_id: user.id,
      name: cleanName,
      gender: input.gender,
      ancestry: input.race,
      homeland: null,
      origin: input.origin,
      path: null,
      trait: null,
      original_photo_url: input.original_photo_url,
      portrait_url: input.portrait_url,
      current_health: 30,
      gold: 10,
    })
    .select()
    .single();

  if (characterError) {
    throw characterError;
  }

  const { error: attributesError } = await supabase.from("attributes").insert({
    character_id: character.id,
    strength: 0,
    endurance: 0,
    agility: 0,
    intelligence: 0,
    wisdom: 0,
    charisma: 0,
    spirit: 0,
  });

  if (attributesError) {
    throw attributesError;
  }

  await saveCharacterAppearance(character.id, input.appearance);

  const savedCharacter = await getCharacter();

  if (!savedCharacter) {
    throw new Error("Character was created but could not be loaded.");
  }

  return savedCharacter;
}

export async function updateCharacter(
  characterId: string,
  values: Partial<
    Pick<
      Tables["characters"],
      | "name"
      | "gender"
      | "ancestry"
      | "homeland"
      | "origin"
      | "path"
      | "trait"
      | "portrait_url"
      | "original_photo_url"
      | "current_health"
      | "xp"
      | "gold"
      | "level"
    >
  >,
) {
  const { data, error } = await supabase.from("characters").update(values).eq("id", characterId).select().single();

  if (error) {
    throw error;
  }

  return data as Tables["characters"];
}

export async function updateCharacterHealth(characterId: string, currentHealth: number) {
  const safeHealth = Math.max(0, Math.floor(Number(currentHealth) || 0));
  const { data, error } = await supabase
    .from("characters")
    .update({ current_health: safeHealth })
    .eq("id", characterId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Tables["characters"];
}

export async function spendCharacterGold(characterId: string, amount: number) {
  const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));

  if (safeAmount <= 0) {
    return null;
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("spend_character_gold_atomic", {
    p_character_id: characterId,
    p_amount: safeAmount,
  });

  if (!rpcError) {
    return rpcData as Tables["characters"];
  }

  if (!isMissingRpcError(rpcError)) {
    throw rpcError;
  }

  const { data: currentCharacter, error: currentError } = await supabase
    .from("characters")
    .select("gold")
    .eq("id", characterId)
    .single();

  if (currentError) {
    throw currentError;
  }

  const currentGold = Number(currentCharacter.gold) || 0;

  if (currentGold < safeAmount) {
    throw new Error(`Requires ${safeAmount} gold.`);
  }

  const { data, error } = await supabase
    .from("characters")
    .update({ gold: currentGold - safeAmount })
    .eq("id", characterId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Tables["characters"];
}

function isMissingRpcError(error: { message?: string; code?: string } | null) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42883" || message.includes("function") && message.includes("does not exist");
}

export async function incrementCharacterDistanceWalked(characterId: string, meters: number) {
  const safeMeters = Math.max(0, Number(meters) || 0);

  if (safeMeters <= 0) {
    return null;
  }

  const { data, error } = await supabase.rpc("increment_character_distance_walked", {
    p_character_id: characterId,
    p_meters: safeMeters,
  });

  if (error) {
    console.warn("[character] could not increment lifetime distance", error.message);
    return null;
  }

  return Number(data ?? 0);
}

export async function saveCharacterAppearance(
  characterId: string,
  appearance: CharacterCreationInput["appearance"],
) {
  const { data, error } = await supabase
    .from("character_appearance")
    .upsert(
      {
        character_id: characterId,
        base_asset_id: appearance.baseAssetId ?? null,
        face_asset_id: appearance.faceAssetId ?? null,
        hair_asset_id: appearance.hairAssetId ?? null,
        armor_asset_id: appearance.armorAssetId ?? null,
        weapon_asset_id: appearance.weaponAssetId ?? null,
        cloak_asset_id: appearance.cloakAssetId ?? null,
        skin_tone: appearance.skinTone ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "character_id" },
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Tables["character_appearance"];
}

export async function getCharacterAppearance(characterId: string) {
  const { data, error } = await supabase
    .from("character_appearance")
    .select(appearanceSelect)
    .eq("character_id", characterId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as (Tables["character_appearance"] & Record<string, Tables["avatar_assets"] | null>) | null;
}
