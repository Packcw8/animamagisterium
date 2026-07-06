import { supabase, type Tables } from "../lib/supabase";

export type GameToastDefinition = Tables["game_toasts"];
export type GameToastTriggerType = GameToastDefinition["trigger_type"];

export const gameToastTriggerTypes: GameToastTriggerType[] = [
  "opening_game",
  "entering_area",
  "leaving_area",
  "starting_path",
  "completing_path",
  "unlocking_marker",
  "completing_chapter",
  "receiving_reward",
  "learning_ability",
  "discovering_npc_enemy",
];

export function blankGameToastDefinition(): Omit<GameToastDefinition, "id" | "created_at" | "updated_at" | "created_by"> {
  return {
    trigger_type: "entering_area",
    trigger_key: null,
    title: "",
    body: "",
    icon_image_url: null,
    sound_url: null,
    button_text: "OK",
    display_once: false,
    trigger_condition: null,
    sort_order: 0,
    season_number: 1,
    chapter_number: 1,
    is_active: true,
  };
}

export async function getGameToasts() {
  const { data, error } = await supabase
    .from("game_toasts")
    .select("*")
    .order("season_number", { ascending: true })
    .order("chapter_number", { ascending: true })
    .order("trigger_type", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("[toasts] authored toasts unavailable", error.message);
    return [];
  }

  return (data ?? []) as GameToastDefinition[];
}

export async function saveGameToast(input: Partial<GameToastDefinition> & Pick<GameToastDefinition, "trigger_type" | "title" | "body">) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const payload = {
    trigger_type: input.trigger_type,
    trigger_key: input.trigger_key?.trim() || null,
    title: input.title.trim(),
    body: input.body.trim(),
    icon_image_url: input.icon_image_url?.trim() || null,
    sound_url: input.sound_url?.trim() || null,
    button_text: input.button_text?.trim() || "OK",
    display_once: Boolean(input.display_once),
    trigger_condition: input.trigger_condition?.trim() || null,
    sort_order: Math.round(Number(input.sort_order) || 0),
    season_number: Math.max(1, Math.round(Number(input.season_number) || 1)),
    chapter_number: Math.max(1, Math.round(Number(input.chapter_number) || 1)),
    is_active: input.is_active ?? true,
    created_by: user?.id ?? input.created_by ?? null,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabase.from("game_toasts").update(payload).eq("id", input.id).select("*").single()
    : supabase.from("game_toasts").insert(payload).select("*").single();
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data as GameToastDefinition;
}

export async function deleteGameToast(toastId: string) {
  const { error } = await supabase.from("game_toasts").delete().eq("id", toastId);
  if (error) {
    throw error;
  }
}

export function findAuthoredToast(
  toasts: GameToastDefinition[],
  triggerType: GameToastTriggerType,
  options?: { triggerKey?: string | null; seasonNumber?: number | null; chapterNumber?: number | null },
) {
  const triggerKey = options?.triggerKey?.trim() || null;
  const seasonNumber = Math.max(1, Math.round(Number(options?.seasonNumber) || 1));
  const chapterNumber = Math.max(1, Math.round(Number(options?.chapterNumber) || 1));

  return toasts
    .filter((toast) => toast.is_active)
    .filter((toast) => toast.trigger_type === triggerType)
    .filter((toast) => Number(toast.season_number ?? 1) === seasonNumber && Number(toast.chapter_number ?? 1) === chapterNumber)
    .filter((toast) => !toast.trigger_key || toast.trigger_key === triggerKey)
    .sort((a, b) => {
      const aSpecific = a.trigger_key ? 0 : 1;
      const bSpecific = b.trigger_key ? 0 : 1;
      return aSpecific - bSpecific || Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
    })[0] ?? null;
}

export function getToastSeenFlagKey(toast: Pick<GameToastDefinition, "id" | "trigger_type" | "trigger_key">) {
  return `toast_seen_${toast.trigger_type}_${toast.trigger_key || toast.id}`;
}

export function resolveToastAssetUri(path?: string | null) {
  const trimmed = path?.trim();
  if (!trimmed) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replaceAll("\\", "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}
