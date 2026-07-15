import { supabase, type Tables } from "../lib/supabase";
import { normalizeMountMultiplier, resolveMountImageUri } from "./mountService";

export type TravelMode = Tables["travel_modes"];

export function blankTravelMode(): Partial<TravelMode> {
  return {
    name: "",
    mode_type: "",
    description: "",
    image_url: "",
    progress_multiplier: 1,
    is_active: true,
    season_number: 1,
    chapter_number: 1,
  };
}

export function normalizeTravelModeMultiplier(value?: number | string | null) {
  return normalizeMountMultiplier(value);
}

export function resolveTravelModeImageUri(imagePath?: string | null) {
  return resolveMountImageUri(imagePath);
}

export async function getTravelModes() {
  const { data, error } = await supabase
    .from("travel_modes")
    .select("*")
    .order("season_number", { ascending: true })
    .order("chapter_number", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.warn("[travel modes] unavailable", error.message);
    return [];
  }

  return (data ?? []) as TravelMode[];
}

export async function saveTravelMode(input: Partial<TravelMode>) {
  const values = {
    name: input.name?.trim() || "Unnamed Travel Mode",
    mode_type: input.mode_type?.trim() || null,
    description: input.description?.trim() || null,
    image_url: input.image_url?.trim() || null,
    progress_multiplier: normalizeTravelModeMultiplier(input.progress_multiplier),
    is_active: input.is_active ?? true,
    season_number: Number(input.season_number) || 1,
    chapter_number: Number(input.chapter_number) || 1,
    updated_at: new Date().toISOString(),
  };

  const request = input.id
    ? supabase.from("travel_modes").update(values).eq("id", input.id).select().single()
    : supabase.from("travel_modes").insert(values).select().single();
  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data as TravelMode;
}

export async function deleteTravelMode(travelModeId: string) {
  const { error } = await supabase.from("travel_modes").delete().eq("id", travelModeId);

  if (error) {
    throw error;
  }
}
