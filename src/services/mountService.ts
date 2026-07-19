import { supabase, type Tables } from "../lib/supabase";
import { resolveGameAssetUri } from "../utils/assetResolver";

export type MountDefinition = Tables["mount_definitions"];
export type PlayerMount = Tables["player_mounts"];
export type PlayerMountWithDefinition = PlayerMount & { mount: MountDefinition | null };

export function blankMountDefinition(): Partial<MountDefinition> {
  return {
    name: "",
    breed: "",
    description: "",
    image_url: "",
    rarity: "common",
    progress_multiplier: 1.2,
    is_active: true,
    season_number: 1,
    chapter_number: 1,
  };
}

export function normalizeMountMultiplier(value?: number | string | null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  return Math.max(1, Math.min(1.7, numeric));
}

export function resolveMountImageUri(imagePath?: string | null) {
  return resolveGameAssetUri(imagePath, "mount");
}

export function getActiveMountMultiplier(activeMount: PlayerMountWithDefinition | null) {
  return normalizeMountMultiplier(activeMount?.mount?.progress_multiplier);
}

export async function getMountDefinitions() {
  const { data, error } = await supabase
    .from("mount_definitions")
    .select("*")
    .order("season_number", { ascending: true })
    .order("chapter_number", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.warn("[mounts] definitions unavailable", error.message);
    return [];
  }

  return (data ?? []) as MountDefinition[];
}

export async function saveMountDefinition(input: Partial<MountDefinition>) {
  const values = {
    name: input.name?.trim() || "Unnamed Mount",
    breed: input.breed?.trim() || null,
    description: input.description?.trim() || null,
    image_url: input.image_url?.trim() || null,
    rarity: input.rarity?.trim() || "common",
    progress_multiplier: normalizeMountMultiplier(input.progress_multiplier),
    is_active: input.is_active ?? true,
    season_number: Number(input.season_number) || 1,
    chapter_number: Number(input.chapter_number) || 1,
    updated_at: new Date().toISOString(),
  };

  const request = input.id
    ? supabase.from("mount_definitions").update(values).eq("id", input.id).select().single()
    : supabase.from("mount_definitions").insert(values).select().single();
  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data as MountDefinition;
}

export async function deleteMountDefinition(mountId: string) {
  const { error } = await supabase.from("mount_definitions").delete().eq("id", mountId);

  if (error) {
    throw error;
  }
}

export async function getPlayerMounts(characterId: string) {
  const { data, error } = await supabase
    .from("player_mounts")
    .select("*, mount:mount_definitions(*)")
    .eq("character_id", characterId)
    .order("is_equipped", { ascending: false })
    .order("acquired_at", { ascending: true });

  if (error) {
    console.warn("[mounts] player mounts unavailable", error.message);
    return [];
  }

  return (data ?? []) as PlayerMountWithDefinition[];
}

export async function getActiveMount(characterId: string) {
  const { data, error } = await supabase
    .from("player_mounts")
    .select("*, mount:mount_definitions(*)")
    .eq("character_id", characterId)
    .eq("is_equipped", true)
    .maybeSingle();

  if (error) {
    console.warn("[mounts] active mount unavailable", error.message);
    return null;
  }

  return (data ?? null) as PlayerMountWithDefinition | null;
}

export async function grantMountToCharacter(characterId: string, mountId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to acquire mounts.");
  }

  const { data, error } = await supabase
    .from("player_mounts")
    .upsert(
      {
        user_id: user.id,
        character_id: characterId,
        mount_id: mountId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "character_id,mount_id" },
    )
    .select("*, mount:mount_definitions(*)")
    .single();

  if (error) {
    throw error;
  }

  return data as PlayerMountWithDefinition;
}

export async function equipMount(characterId: string, mountId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to equip mounts.");
  }

  const { error: clearError } = await supabase
    .from("player_mounts")
    .update({ is_equipped: false, updated_at: new Date().toISOString() })
    .eq("character_id", characterId)
    .eq("user_id", user.id);

  if (clearError) {
    throw clearError;
  }

  const { data, error } = await supabase
    .from("player_mounts")
    .update({ is_equipped: true, updated_at: new Date().toISOString() })
    .eq("character_id", characterId)
    .eq("user_id", user.id)
    .eq("mount_id", mountId)
    .select("*, mount:mount_definitions(*)")
    .single();

  if (error) {
    throw error;
  }

  return data as PlayerMountWithDefinition;
}

export async function unmountCharacter(characterId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to unmount.");
  }

  const { error } = await supabase
    .from("player_mounts")
    .update({ is_equipped: false, updated_at: new Date().toISOString() })
    .eq("character_id", characterId)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}
