import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, Tables } from "../lib/supabase";

const PROFILE_ID_KEY = "animamagisterium.profile_id";
const CHARACTER_ID_KEY = "animamagisterium.character_id";

export type CharacterDashboardData = Tables["characters"] & {
  attributes: Tables["attributes"];
};

function createUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

async function getOrCreateProfile(username = "Adventurer") {
  const storedProfileId = await AsyncStorage.getItem(PROFILE_ID_KEY);

  if (storedProfileId) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", storedProfileId).maybeSingle();

    if (data) {
      return data as Tables["profiles"];
    }

    if (error && error.code !== "PGRST116") {
      throw error;
    }
  }

  const profileId = createUuid();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: profileId,
      username,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  await AsyncStorage.setItem(PROFILE_ID_KEY, profileId);
  return data as Tables["profiles"];
}

export async function loadCharacter() {
  const storedCharacterId = await AsyncStorage.getItem(CHARACTER_ID_KEY);
  const storedProfileId = await AsyncStorage.getItem(PROFILE_ID_KEY);

  let query = supabase.from("characters").select("*, attributes(*)").limit(1);

  if (storedCharacterId) {
    query = query.eq("id", storedCharacterId);
  } else if (storedProfileId) {
    query = query.eq("user_id", storedProfileId);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  await AsyncStorage.setItem(CHARACTER_ID_KEY, data.id);
  await AsyncStorage.setItem(PROFILE_ID_KEY, data.user_id);

  const attributes = Array.isArray(data.attributes) ? data.attributes[0] : data.attributes;

  return {
    ...data,
    attributes,
  } as CharacterDashboardData;
}

export async function createCharacter(name: string) {
  const profile = await getOrCreateProfile(name);
  const characterId = createUuid();

  const { data: character, error: characterError } = await supabase
    .from("characters")
    .insert({
      id: characterId,
      user_id: profile.id,
      name,
    })
    .select()
    .single();

  if (characterError) {
    throw characterError;
  }

  const { data: attributes, error: attributesError } = await supabase
    .from("attributes")
    .insert({
      id: createUuid(),
      character_id: character.id,
      strength: 8,
      endurance: 7,
      knowledge: 6,
      craft: 5,
      wealth: 4,
      influence: 3,
    })
    .select()
    .single();

  if (attributesError) {
    throw attributesError;
  }

  await AsyncStorage.setItem(CHARACTER_ID_KEY, character.id);
  await AsyncStorage.setItem(PROFILE_ID_KEY, profile.id);

  return {
    ...character,
    attributes,
  } as CharacterDashboardData;
}

export async function updateCharacterXp(characterId: string, xp: number) {
  const nextLevel = Math.max(1, Math.floor(xp / 1000) + 1);
  const { data, error } = await supabase
    .from("characters")
    .update({
      xp,
      level: nextLevel,
    })
    .eq("id", characterId)
    .select("*, attributes(*)")
    .single();

  if (error) {
    throw error;
  }

  const attributes = Array.isArray(data.attributes) ? data.attributes[0] : data.attributes;

  return {
    ...data,
    attributes,
  } as CharacterDashboardData;
}

export async function updateCharacterAttributes(
  characterId: string,
  attributes: Partial<Omit<Tables["attributes"], "id" | "character_id">>,
) {
  const { data, error } = await supabase
    .from("attributes")
    .update(attributes)
    .eq("character_id", characterId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Tables["attributes"];
}
