import { supabase, Tables } from "../lib/supabase";
import { updateCharacterHealth, type CharacterWithDetails } from "./characterService";
import { consumeInventoryItem, grantItemToCharacter, type InventoryItem } from "./inventoryService";
import { recordSocialContribution } from "./partyGuildService";
import { applyCharacterXpGold } from "./progressionService";
import { getDefaultChapterRuleFields, normalizeChapterRules } from "../utils/mapProgress";

export type MapRoute = Tables["map_routes"];
export type MapSeason = Tables["map_seasons"];
export type MapChapter = Tables["map_chapters"];
export type RouteProgress = Tables["route_progress"];
export type PlayerMapState = Tables["player_map_state"];
export type PlayerMarkerUnlock = Tables["player_marker_unlocks"];
export type PlayerDialogueChoiceHistory = Tables["player_dialogue_choice_history"];
export type MapMarker = Tables["map_markers"];
export type MarkerLegendItem = Tables["marker_legend_items"];
export type WorldMapSetting = Tables["world_map_settings"];
export type MarkerRouteLink = Tables["marker_route_links"];
export type MiniMap = Tables["mini_maps"];
export type TutorialStep = Tables["tutorial_steps"];
export type MarkerMarketItem = Tables["marker_market_items"];
export type PlayerMarketPurchase = Tables["player_market_purchases"];
export type MarketListingMode = MarkerMarketItem["listing_mode"];
export const marketListingModes: MarketListingMode[] = ["buy_and_sell", "buy_only", "sell_only"];
export type MapStoryInstance = Tables["map_story_instances"];
export type MapEvent = Tables["map_events"];
export type MapEventCompletion = Tables["map_event_completions"];
export type StoryMarkerCompletion = Tables["story_marker_completions"];
export type StoryMarkerStart = Tables["story_marker_starts"];
export type StoryDialogueNode = Tables["story_dialogue_nodes"];
export type StoryDialogueChoice = Tables["story_dialogue_choices"];
export type DialogueChoiceReward = Tables["dialogue_choice_rewards"];
export type PlayerStoryFlag = Tables["player_story_flags"];
export type PlayerTutorialCompletion = Tables["player_tutorial_completions"];
export type PlayerAttributeCheck = Tables["player_attribute_checks"];
export type Role = Tables["profiles"]["role"];

export const fallbackRoute: MapRoute = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Grayfen Road to Hollow Watch",
  sort_order: 1,
  terrain: "Mire road, broken stone, low fog",
  danger_level: "Moderate",
  distance_required_meters: 5000,
  estimated_encounters: 3,
  path_points: [
    { x: 33.8, y: 73.81 },
    { x: 28, y: 62 },
    { x: 42, y: 54 },
    { x: 56, y: 41 },
    { x: 68, y: 38 },
  ],
  path_segments: [],
  image_url: null,
  journal_title: null,
  journal_body: null,
  journal_image_url: null,
  journal_sort_order: 1,
  mini_map_id: null,
  parent_marker_id: null,
  lock_type: "public",
  lock_message: null,
  season_number: 1,
  chapter_number: 1,
  is_active: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

export const fallbackMarkers: MapMarker[] = [];
let playerMapStateAvailable: boolean | null = null;
let playerMarkerUnlocksAvailable: boolean | null = null;
let playerDialogueChoiceHistoryAvailable: boolean | null = null;

function normalizeSeasonChapter<T extends { season_number?: number | null; chapter_number?: number | null }>(values: T, fillMissing = true) {
  const next = { ...values };
  if (fillMissing || values.season_number !== undefined) {
    next.season_number = Math.max(1, Math.round(Number(values.season_number) || 1));
  }
  if (fillMissing || values.chapter_number !== undefined) {
    next.chapter_number = Math.max(1, Math.round(Number(values.chapter_number) || 1));
  }

  return next;
}

function normalizeUpdateScope<T extends { season_number?: number | null; chapter_number?: number | null }>(values: T) {
  return normalizeSeasonChapter(values, false);
}

function normalizeCreateScope<T extends { season_number?: number | null; chapter_number?: number | null }>(values: T) {
  return {
    ...normalizeSeasonChapter(values, true),
  };
}

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "PGRST205" || error?.code === "42P01" || message.includes("could not find the table") || message.includes("schema cache");
}

function markPlayerMapStateUnavailable(error: { code?: string; message?: string } | null | undefined) {
  if (isMissingRelationError(error)) {
    playerMapStateAvailable = false;
    return true;
  }

  return false;
}

function markPlayerMarkerUnlocksUnavailable(error: { code?: string; message?: string } | null | undefined) {
  if (isMissingRelationError(error)) {
    playerMarkerUnlocksAvailable = false;
    return true;
  }

  return false;
}

function markPlayerDialogueChoiceHistoryUnavailable(error: { code?: string; message?: string } | null | undefined) {
  if (isMissingRelationError(error)) {
    playerDialogueChoiceHistoryAvailable = false;
    return true;
  }

  return false;
}

const seededMarkerTitles = new Set([
  "Mirehold Crossing",
  "Wolf Track Bend",
  "Copper Cart Waystation",
  "Broken Moon Cairn",
  "Hollow Watch",
]);

function isSeededMarker(marker: MapMarker) {
  return !marker.created_by || seededMarkerTitles.has(marker.title);
}

export async function getCurrentRole(): Promise<Role> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (["pack8cw@gmail.com", "packcw8@gmail.com"].includes(user?.email?.toLowerCase() ?? "")) {
    return "admin";
  }

  const { data } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  return (data?.role as Role | undefined) ?? "player";
}

export async function getActiveRoute() {
  const { data, error } = await supabase
    .from("map_routes")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[map] falling back to local route", error.message);
    return fallbackRoute;
  }

  return (data as MapRoute | null) ?? fallbackRoute;
}

export async function getMapRoutes() {
  const { data, error } = await supabase
    .from("map_routes")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[map] falling back to local route list", error.message);
    return [fallbackRoute];
  }

  const routes = (data ?? []) as MapRoute[];
  return routes.length > 0 ? routes : [fallbackRoute];
}

export async function getMapMarkers() {
  const { data, error } = await supabase.from("map_markers").select("*").order("created_at", { ascending: true });

  if (error) {
    console.warn("[map] falling back to local markers", error.message);
    return fallbackMarkers;
  }

  return ((data ?? []) as MapMarker[]).filter((marker) => !isSeededMarker(marker));
}

export async function getMapSeasons() {
  const { data, error } = await supabase.from("map_seasons").select("*").order("season_number", { ascending: true });

  if (error) {
    console.warn("[map] seasons unavailable", error.message);
    return [{ id: "local-season-1", season_number: 1, name: "Season 1", description: null, is_active: true, created_by: null, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString() }] as MapSeason[];
  }

  const seasons = (data ?? []) as MapSeason[];
  return seasons.length > 0 ? seasons : [{ id: "local-season-1", season_number: 1, name: "Season 1", description: null, is_active: true, created_by: null, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString() }];
}

export async function getMapChapters() {
  const { data, error } = await supabase.from("map_chapters").select("*").order("season_number", { ascending: true }).order("chapter_number", { ascending: true });

  if (error) {
    console.warn("[map] chapters unavailable", error.message);
    return [
      normalizeChapterRules({
        id: "local-chapter-1-1",
        season_number: 1,
        chapter_number: 1,
        name: "Chapter 1",
        description: null,
        ...getDefaultChapterRuleFields(),
        is_active: true,
        created_by: null,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      } as MapChapter),
    ];
  }

  const chapters = ((data ?? []) as MapChapter[]).map(normalizeChapterRules);
  return chapters.length > 0
    ? chapters
    : [
        normalizeChapterRules({
          id: "local-chapter-1-1",
          season_number: 1,
          chapter_number: 1,
          name: "Chapter 1",
          description: null,
          ...getDefaultChapterRuleFields(),
          is_active: true,
          created_by: null,
          created_at: new Date(0).toISOString(),
          updated_at: new Date(0).toISOString(),
        } as MapChapter),
      ];
}

export async function saveMapSeason(input: Partial<MapSeason>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const values = {
    season_number: Number(input.season_number) || 1,
    name: input.name?.trim() || `Season ${Number(input.season_number) || 1}`,
    description: input.description?.trim() || null,
    is_active: input.is_active ?? true,
    created_by: input.id ? input.created_by ?? user?.id ?? null : user?.id ?? null,
    updated_at: new Date().toISOString(),
  };
  const request = input.id
    ? supabase.from("map_seasons").update(values).eq("id", input.id).select().single()
    : supabase.from("map_seasons").insert(values).select().single();
  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data as MapSeason;
}

export async function saveMapChapter(input: Partial<MapChapter>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const values = {
    season_number: Number(input.season_number) || 1,
    chapter_number: Number(input.chapter_number) || 1,
    name: input.name?.trim() || `Chapter ${Number(input.chapter_number) || 1}`,
    description: input.description?.trim() || null,
    access_type: input.access_type ?? "free",
    unlock_story_flag_key: input.unlock_story_flag_key?.trim() || null,
    unlock_story_flag_value: input.unlock_story_flag_value ?? true,
    completion_story_flag_key: input.completion_story_flag_key?.trim() || null,
    completion_story_flag_value: input.completion_story_flag_value ?? true,
    transition_title: input.transition_title?.trim() || null,
    transition_body: input.transition_body?.trim() || null,
    unlock_message: input.unlock_message?.trim() || null,
    subscription_prompt: input.subscription_prompt?.trim() || null,
    is_active: input.is_active ?? true,
    created_by: input.id ? input.created_by ?? user?.id ?? null : user?.id ?? null,
    updated_at: new Date().toISOString(),
  };
  const request = input.id
    ? supabase.from("map_chapters").update(values).eq("id", input.id).select().single()
    : supabase.from("map_chapters").insert(values).select().single();
  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return normalizeChapterRules(data as MapChapter);
}

export async function getMiniMaps() {
  const { data, error } = await supabase
    .from("mini_maps")
    .select("*")
    .order("season_number", { ascending: true })
    .order("chapter_number", { ascending: true })
    .order("area_name", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.warn("[map] mini maps unavailable", error.message);
    return [];
  }

  return (data ?? []) as MiniMap[];
}

export async function getMarkerLegendItems() {
  const { data, error } = await supabase.from("marker_legend_items").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });

  if (error) {
    console.warn("[map] marker legend unavailable", error.message);
    return [];
  }

  return (data ?? []) as MarkerLegendItem[];
}

export async function getWorldMapSettings() {
  const { data, error } = await supabase
    .from("world_map_settings")
    .select("*")
    .order("season_number", { ascending: true })
    .order("chapter_number", { ascending: true });

  if (error) {
    console.warn("[map] world map settings unavailable", error.message);
    return [] as WorldMapSetting[];
  }

  return (data ?? []) as WorldMapSetting[];
}

export async function saveWorldMapSetting(input: Partial<WorldMapSetting>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const values = {
    season_number: Number(input.season_number) || 1,
    chapter_number: Number(input.chapter_number) || 1,
    name: input.name?.trim() || "Overworld Map",
    image_url: input.image_url?.trim() || null,
    draft_image_url: input.draft_image_url?.trim() || null,
    notes: input.notes?.trim() || null,
    aspect_ratio: input.aspect_ratio?.trim() || "current",
    width: Math.max(320, Number(input.width) || 1800),
    height: Math.max(320, Number(input.height) || 1400),
    is_active: input.is_active ?? true,
    created_by: input.id ? input.created_by ?? user?.id ?? null : user?.id ?? null,
    updated_at: new Date().toISOString(),
  };
  const request = input.id
    ? supabase.from("world_map_settings").update(values).eq("id", input.id).select().single()
    : supabase.from("world_map_settings").upsert(values, { onConflict: "season_number,chapter_number" }).select().single();
  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data as WorldMapSetting;
}

export async function saveMarkerLegendItem(input: Partial<MarkerLegendItem>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const values = {
    marker_type: input.marker_type?.trim() || "Custom",
    title: input.title?.trim() || "Untitled Legend Item",
    description: input.description?.trim() || null,
    icon_label: input.icon_label?.trim() || null,
    icon_image_url: input.icon_image_url?.trim() || null,
    icon_color: input.icon_color?.trim() || null,
    sort_order: Number(input.sort_order) || 0,
    is_active: input.is_active ?? true,
    season_number: Number(input.season_number) || 1,
    chapter_number: Number(input.chapter_number) || 1,
    created_by: input.id ? input.created_by ?? user?.id ?? null : user?.id ?? null,
    updated_at: new Date().toISOString(),
  };
  const request = input.id
    ? supabase.from("marker_legend_items").update(values).eq("id", input.id).select().single()
    : supabase.from("marker_legend_items").insert(values).select().single();
  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data as MarkerLegendItem;
}

export async function deleteMarkerLegendItem(legendItemId: string) {
  const { error } = await supabase.from("marker_legend_items").delete().eq("id", legendItemId);

  if (error) {
    throw error;
  }
}

export async function saveMiniMap(input: Partial<MiniMap>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const values = {
    name: input.name?.trim() || "Untitled Mini Map",
    type: input.type ?? "area",
    area_key: input.area_key?.trim() || null,
    area_name: input.area_name?.trim() || null,
    background_image_url: input.background_image_url?.trim() || null,
    description: input.description?.trim() || null,
    width: Math.max(320, Number(input.width) || 900),
    height: Math.max(280, Number(input.height) || 650),
    sort_order: Number(input.sort_order) || 0,
    is_active: input.is_active ?? true,
    season_number: Number(input.season_number) || 1,
    chapter_number: Number(input.chapter_number) || 1,
    created_by: input.id ? input.created_by ?? user?.id ?? null : user?.id ?? null,
    updated_at: new Date().toISOString(),
  };
  const request = input.id
    ? supabase.from("mini_maps").update(values).eq("id", input.id).select().single()
    : supabase.from("mini_maps").insert(values).select().single();
  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data as MiniMap;
}

export async function deleteMiniMap(miniMapId: string) {
  const { error } = await supabase.from("mini_maps").delete().eq("id", miniMapId);

  if (error) {
    throw error;
  }
}

export async function getTutorialSteps() {
  const { data, error } = await supabase.from("tutorial_steps").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });

  if (error) {
    console.warn("[map] tutorial steps unavailable", error.message);
    return [];
  }

  return (data ?? []) as TutorialStep[];
}

export async function saveTutorialStep(input: Partial<TutorialStep>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const values = {
    title: input.title?.trim() || "Untitled Tutorial",
    description: input.description?.trim() || null,
    image_url: input.image_url?.trim() || null,
    marker_id: input.marker_id ?? null,
    mini_map_id: input.mini_map_id ?? null,
    route_id: input.route_id ?? null,
    reward_xp: Number(input.reward_xp) || 0,
    reward_gold: Number(input.reward_gold) || 0,
    reward_item_id: input.reward_item_id ?? null,
    reward_item_quantity: Math.max(1, Number(input.reward_item_quantity) || 1),
    sort_order: Number(input.sort_order) || 0,
    is_active: input.is_active ?? true,
    season_number: Number(input.season_number) || 1,
    chapter_number: Number(input.chapter_number) || 1,
    created_by: input.id ? input.created_by ?? user?.id ?? null : user?.id ?? null,
    updated_at: new Date().toISOString(),
  };
  const request = input.id
    ? supabase.from("tutorial_steps").update(values).eq("id", input.id).select().single()
    : supabase.from("tutorial_steps").insert(values).select().single();
  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data as TutorialStep;
}

export async function deleteTutorialStep(stepId: string) {
  const { error } = await supabase.from("tutorial_steps").delete().eq("id", stepId);

  if (error) {
    throw error;
  }
}

export async function getRouteProgress(routeId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to track route progress.");
  }

  const { data, error } = await supabase
    .from("route_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("route_id", routeId)
    .maybeSingle();

  if (error) {
    console.warn("[map] progress table unavailable", error.message);
    return null;
  }

  return data as RouteProgress | null;
}

export async function getRouteProgressForRoutes(routeIds: string[]) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || routeIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("route_progress")
    .select("*")
    .eq("user_id", user.id)
    .in("route_id", routeIds);

  if (error) {
    console.warn("[map] route progress list unavailable", error.message);
    return [];
  }

  return (data ?? []) as RouteProgress[];
}

export async function getCurrentRouteProgress() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("route_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    console.warn("[map] current route progress unavailable", error.message);
    return null;
  }

  return data as RouteProgress | null;
}

export async function getPlayerMapState() {
  if (playerMapStateAvailable === false) {
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("player_map_state")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (markPlayerMapStateUnavailable(error)) {
      console.warn("[map] player map state table is unavailable; run the player_map_state migration to enable saved mini-map positions.");
      return null;
    }

    console.warn("[map] player map state unavailable", error.message);
    return null;
  }

  playerMapStateAvailable = true;
  return data as PlayerMapState | null;
}

export async function savePlayerMapState(values: Pick<PlayerMapState, "active_mini_map_id" | "current_x_percent" | "current_y_percent">) {
  if (playerMapStateAvailable === false) {
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to save map state.");
  }

  const { data, error } = await supabase
    .from("player_map_state")
    .upsert(
      {
        user_id: user.id,
        active_mini_map_id: values.active_mini_map_id,
        current_x_percent: values.current_x_percent,
        current_y_percent: values.current_y_percent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();

  if (error) {
    if (markPlayerMapStateUnavailable(error)) {
      return null;
    }

    console.warn("[map] could not save player map state", error.message);
    return null;
  }

  playerMapStateAvailable = true;
  return data as PlayerMapState;
}

export async function clearPlayerMapState() {
  if (playerMapStateAvailable === false) {
    return;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return;
  }

  const { error } = await supabase.from("player_map_state").delete().eq("user_id", user.id);

  if (error) {
    if (markPlayerMapStateUnavailable(error)) {
      return;
    }

    console.warn("[map] could not clear player map state", error.message);
  }
}

export async function getPlayerMarkerUnlocks() {
  if (playerMarkerUnlocksAvailable === false) {
    return [];
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from("player_marker_unlocks")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    if (markPlayerMarkerUnlocksUnavailable(error)) {
      console.warn("[map] player marker unlocks table is unavailable; run the dialogue marker unlocks migration.");
      return [];
    }

    console.warn("[map] player marker unlocks unavailable", error.message);
    return [];
  }

  playerMarkerUnlocksAvailable = true;
  return (data ?? []) as PlayerMarkerUnlock[];
}

export async function unlockPlayerMarker(markerId: string, sourceChoiceId?: string | null) {
  if (playerMarkerUnlocksAvailable === false) {
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to unlock map markers.");
  }

  const { data, error } = await supabase
    .from("player_marker_unlocks")
    .upsert(
      {
        user_id: user.id,
        marker_id: markerId,
        source_choice_id: sourceChoiceId ?? null,
        unlocked_at: new Date().toISOString(),
      },
      { onConflict: "user_id,marker_id" },
    )
    .select()
    .single();

  if (error) {
    if (markPlayerMarkerUnlocksUnavailable(error)) {
      return null;
    }

    throw error;
  }

  playerMarkerUnlocksAvailable = true;
  return data as PlayerMarkerUnlock;
}

export async function getPlayerDialogueChoiceHistory(choiceIds: string[]) {
  if (playerDialogueChoiceHistoryAvailable === false) {
    return new Set<string>();
  }

  const uniqueChoiceIds = Array.from(new Set(choiceIds.filter(Boolean)));
  if (uniqueChoiceIds.length === 0) {
    return new Set<string>();
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from("player_dialogue_choice_history")
    .select("choice_id")
    .eq("user_id", user.id)
    .in("choice_id", uniqueChoiceIds);

  if (error) {
    if (markPlayerDialogueChoiceHistoryUnavailable(error)) {
      console.warn("[dialogue] player choice history table is unavailable; run the dialogue choice history migration.");
      return new Set<string>();
    }

    console.warn("[dialogue] player choice history unavailable", error.message);
    return new Set<string>();
  }

  playerDialogueChoiceHistoryAvailable = true;
  return new Set((data ?? []).map((row) => row.choice_id));
}

export async function recordPlayerDialogueChoice(input: {
  characterId: string;
  choiceId: string;
  nodeId?: string | null;
  eventId?: string | null;
  markerId?: string | null;
}) {
  if (playerDialogueChoiceHistoryAvailable === false) {
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to save dialogue choices.");
  }

  const { data, error } = await supabase
    .from("player_dialogue_choice_history")
    .upsert(
      {
        user_id: user.id,
        character_id: input.characterId,
        choice_id: input.choiceId,
        node_id: input.nodeId ?? null,
        event_id: input.eventId ?? null,
        marker_id: input.markerId ?? null,
        selected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,choice_id" },
    )
    .select()
    .single();

  if (error) {
    if (markPlayerDialogueChoiceHistoryUnavailable(error)) {
      return null;
    }

    throw error;
  }

  playerDialogueChoiceHistoryAvailable = true;
  return data as PlayerDialogueChoiceHistory;
}

export async function setCurrentRoute(routeId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to select a route.");
  }

  await supabase.from("route_progress").update({ is_current: false }).eq("user_id", user.id);
  await supabase.from("route_progress").upsert(
    {
      user_id: user.id,
      route_id: routeId,
      is_current: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,route_id" },
  );
}

export async function clearCurrentRoute() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return;
  }

  const { error } = await supabase.from("route_progress").update({ is_current: false }).eq("user_id", user.id);

  if (error) {
    console.warn("[map] could not clear current route", error.message);
  }
}

export async function saveRouteProgress(routeId: string, values: Pick<RouteProgress, "distance_walked_meters" | "progress_percent" | "current_x_percent" | "current_y_percent" | "last_lat" | "last_lng"> & Partial<Pick<RouteProgress, "travel_direction" | "is_current" | "source_marker_id">>) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to save route progress.");
  }

  if (values.is_current ?? true) {
    await supabase.from("route_progress").update({ is_current: false }).eq("user_id", user.id).neq("route_id", routeId);
  }

  const { data, error } = await supabase
    .from("route_progress")
    .upsert(
      {
        user_id: user.id,
        route_id: routeId,
        distance_walked_meters: values.distance_walked_meters,
        progress_percent: values.progress_percent,
        current_x_percent: values.current_x_percent,
        current_y_percent: values.current_y_percent,
        last_lat: values.last_lat,
        last_lng: values.last_lng,
        travel_direction: values.travel_direction ?? "forward",
        is_current: values.is_current ?? true,
        ...(values.source_marker_id !== undefined ? { source_marker_id: values.source_marker_id } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,route_id" },
    )
    .select()
    .single();

  if (error) {
    console.warn("[map] could not save progress", error.message);
    return null;
  }

  return data as RouteProgress;
}

export async function resetRouteProgress(routeId: string, startPoint: { x: number; y: number }) {
  return saveRouteProgress(routeId, {
    distance_walked_meters: 0,
    progress_percent: 0,
    current_x_percent: startPoint.x,
    current_y_percent: startPoint.y,
    last_lat: null,
    last_lng: null,
    travel_direction: "forward",
    is_current: true,
  });
}

export async function getMarkerRouteLinks(markerId: string) {
  const { data, error } = await supabase
    .from("marker_route_links")
    .select("*")
    .eq("marker_id", markerId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[map] marker route links unavailable", error.message);
    return [];
  }

  return (data ?? []) as MarkerRouteLink[];
}

export async function getAllMarkerRouteLinks() {
  const { data, error } = await supabase
    .from("marker_route_links")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[map] all marker route links unavailable", error.message);
    return [];
  }

  return (data ?? []) as MarkerRouteLink[];
}

export async function saveMarkerRouteLinks(
  markerId: string,
  routeIds: string[],
  seasonNumber = 1,
  chapterNumber = 1,
  completionCondition: MarkerRouteLink["completion_condition"] = "either",
  routeDirections: Record<string, MarkerRouteLink["start_direction"]> = {},
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uniqueRouteIds = Array.from(new Set(routeIds.filter(Boolean)));
  const { error: deleteError } = await supabase.from("marker_route_links").delete().eq("marker_id", markerId);

  if (deleteError) {
    throw deleteError;
  }

  if (uniqueRouteIds.length === 0) {
    return [];
  }

  const rows = uniqueRouteIds.map((routeId, index) => ({
    marker_id: markerId,
    route_id: routeId,
    sort_order: index + 1,
    starts_on_select: true,
    start_direction: routeDirections[routeId] ?? "forward",
    completion_condition: completionCondition,
    season_number: Number(seasonNumber) || 1,
    chapter_number: Number(chapterNumber) || 1,
    created_by: user?.id ?? null,
    updated_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase.from("marker_route_links").insert(rows).select();

  if (error) {
    throw error;
  }

  return (data ?? []) as MarkerRouteLink[];
}

export async function createMapMarker(input: Pick<MapMarker, "type" | "title" | "description" | "x_percent" | "y_percent" | "is_active" | "is_unlocked" | "route_id" | "quest_key"> & Partial<Pick<MapMarker, "linked_mini_map_id" | "mini_map_id" | "parent_marker_id" | "exit_target_type" | "exit_target_marker_id" | "exit_target_spawn_marker_id" | "linked_route_id" | "linked_route_start_direction" | "starts_route_on_accept" | "icon_label" | "icon_image_url" | "icon_color" | "marker_size" | "lock_type" | "lock_message" | "visible_story_flag_key" | "visible_story_flag_value" | "story_order" | "unlock_after_marker_id" | "hide_when_completed" | "require_all_linked_routes" | "reward_timing" | "season_number" | "chapter_number" | "dialogue_event_id" | "battle_event_id" | "enemy_id" | "npc_id" | "journal_title" | "journal_body" | "journal_image_url" | "journal_sort_order">>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("map_markers")
    .insert({
      ...normalizeCreateScope(input),
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as MapMarker;
}

export async function getMarkerMarketItems(markerId: string) {
  const { data, error } = await supabase
    .from("marker_market_items")
    .select("*")
    .eq("marker_id", markerId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[map] marker market unavailable", error.message);
    return [];
  }

  return (data ?? []) as MarkerMarketItem[];
}

export async function getPlayerMarketPurchaseCounts(marketItemIds: string[]) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || marketItemIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("player_market_purchases")
    .select("market_item_id,quantity_purchased")
    .eq("user_id", user.id)
    .in("market_item_id", marketItemIds);

  if (error) {
    console.warn("[map] player market purchases unavailable", error.message);
    return {};
  }

  return ((data ?? []) as Pick<PlayerMarketPurchase, "market_item_id" | "quantity_purchased">[]).reduce<Record<string, number>>((counts, row) => {
    counts[row.market_item_id] = Number(row.quantity_purchased) || 0;
    return counts;
  }, {});
}

export async function saveMarkerMarketItem(input: Omit<MarkerMarketItem, "id" | "created_at" | "updated_at"> & { id?: string }) {
  const values = {
    marker_id: input.marker_id,
    item_id: input.item_id,
    buy_price: Number(input.buy_price) || 0,
    sell_price: Number(input.sell_price) || 0,
    stock_quantity: input.unlimited_stock ? null : Math.max(0, Number(input.stock_quantity) || 0),
    unlimited_stock: Boolean(input.unlimited_stock),
    listing_mode: input.listing_mode ?? "buy_and_sell",
    season_number: Number(input.season_number) || 1,
    chapter_number: Number(input.chapter_number) || 1,
    updated_at: new Date().toISOString(),
  };

  const request = input.id
    ? supabase.from("marker_market_items").update(values).eq("id", input.id).select().single()
    : supabase.from("marker_market_items").upsert(values, { onConflict: "marker_id,item_id" }).select().single();
  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data as MarkerMarketItem;
}

export async function deleteMarkerMarketItem(marketItemId: string) {
  const { error } = await supabase.from("marker_market_items").delete().eq("id", marketItemId);

  if (error) {
    throw error;
  }
}

export async function createMapRoute(input: Pick<MapRoute, "name" | "sort_order" | "terrain" | "danger_level" | "distance_required_meters" | "estimated_encounters" | "path_points" | "is_active" | "lock_type" | "lock_message" | "season_number" | "chapter_number"> & Partial<Pick<MapRoute, "mini_map_id" | "image_url" | "path_segments" | "journal_title" | "journal_body" | "journal_image_url" | "journal_sort_order">>) {
  const { data, error } = await supabase
    .from("map_routes")
    .insert({
      ...normalizeCreateScope(input),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as MapRoute;
}

export async function updateMapRoute(routeId: string, values: Partial<Pick<MapRoute, "name" | "sort_order" | "terrain" | "danger_level" | "distance_required_meters" | "estimated_encounters" | "path_points" | "path_segments" | "is_active" | "lock_type" | "lock_message" | "season_number" | "chapter_number" | "mini_map_id" | "image_url" | "journal_title" | "journal_body" | "journal_image_url" | "journal_sort_order">>) {
  const { data, error } = await supabase
    .from("map_routes")
    .update({
      ...normalizeUpdateScope(values),
      updated_at: new Date().toISOString(),
    })
    .eq("id", routeId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as MapRoute;
}

export async function deleteMapRoute(routeId: string) {
  const { error } = await supabase.from("map_routes").delete().eq("id", routeId);

  if (error) {
    throw error;
  }
}

export async function updateMapMarker(markerId: string, values: Partial<Pick<MapMarker, "type" | "title" | "description" | "x_percent" | "y_percent" | "is_active" | "is_unlocked" | "route_id" | "quest_key" | "linked_mini_map_id" | "mini_map_id" | "parent_marker_id" | "exit_target_type" | "exit_target_marker_id" | "exit_target_spawn_marker_id" | "linked_route_id" | "linked_route_start_direction" | "starts_route_on_accept" | "icon_label" | "icon_image_url" | "icon_color" | "marker_size" | "lock_type" | "lock_message" | "visible_story_flag_key" | "visible_story_flag_value" | "story_order" | "unlock_after_marker_id" | "hide_when_completed" | "require_all_linked_routes" | "reward_timing" | "season_number" | "chapter_number" | "dialogue_event_id" | "battle_event_id" | "enemy_id" | "npc_id" | "journal_title" | "journal_body" | "journal_image_url" | "journal_sort_order">>) {
  const { data, error } = await supabase
    .from("map_markers")
    .update({
      ...normalizeUpdateScope(values),
      updated_at: new Date().toISOString(),
    })
    .eq("id", markerId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as MapMarker;
}

export async function updateMarkerSettings(markerId: string, values: Partial<Pick<MapMarker, "type" | "title" | "description" | "is_unlocked" | "is_interactable" | "quest_title" | "quest_dialogue" | "quest_image_url" | "shop_image_url" | "shop_background_image_url" | "scene_background_image_url" | "scene_npc_image_url" | "interaction_radius_percent" | "reward_xp" | "reward_gold" | "reward_item_id" | "reward_item_quantity" | "reward_full_heal" | "reward_timing" | "repeatable" | "reward_once_per_player" | "linked_mini_map_id" | "mini_map_id" | "parent_marker_id" | "exit_target_type" | "exit_target_marker_id" | "exit_target_spawn_marker_id" | "linked_route_id" | "linked_route_start_direction" | "starts_route_on_accept" | "icon_label" | "icon_image_url" | "icon_color" | "marker_size" | "lock_type" | "lock_message" | "visible_story_flag_key" | "visible_story_flag_value" | "story_order" | "unlock_after_marker_id" | "hide_when_completed" | "require_all_linked_routes" | "season_number" | "chapter_number" | "dialogue_event_id" | "battle_event_id" | "enemy_id" | "npc_id" | "journal_title" | "journal_body" | "journal_image_url" | "journal_sort_order">>) {
  const { data, error } = await supabase
    .from("map_markers")
    .update({
      ...normalizeUpdateScope(values),
      updated_at: new Date().toISOString(),
    })
    .eq("id", markerId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as MapMarker;
}

export async function deleteMapMarker(markerId: string) {
  const { error } = await supabase.from("map_markers").delete().eq("id", markerId);

  if (error) {
    throw error;
  }
}

export async function getStoryInstances(routeId: string) {
  const { data, error } = await supabase
    .from("map_story_instances")
    .select("*")
    .eq("route_id", routeId)
    .order("trigger_percent", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[map] story instances unavailable", error.message);
    return [];
  }

  return (data ?? []) as MapStoryInstance[];
}

export async function createStoryInstance(input: Pick<MapStoryInstance, "route_id" | "title" | "body" | "trigger_type" | "trigger_percent" | "chance_percent" | "is_active">) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("map_story_instances")
    .insert({
      ...input,
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as MapStoryInstance;
}

export async function updateStoryInstance(storyId: string, values: Partial<Pick<MapStoryInstance, "title" | "body" | "trigger_type" | "trigger_percent" | "chance_percent" | "is_active">>) {
  const { data, error } = await supabase
    .from("map_story_instances")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", storyId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as MapStoryInstance;
}

export async function deleteStoryInstance(storyId: string) {
  const { error } = await supabase.from("map_story_instances").delete().eq("id", storyId);

  if (error) {
    throw error;
  }
}

export async function getMapEvents(routeId?: string) {
  let query = supabase.from("map_events").select("*").order("distance_marker_percent", { ascending: true }).order("created_at", { ascending: true });

  if (routeId) {
    query = query.eq("route_id", routeId);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[map] events unavailable", error.message);
    return [];
  }

  return (data ?? []) as MapEvent[];
}

export async function createMapEvent(input: Omit<MapEvent, "id" | "created_by" | "created_at" | "updated_at">) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("map_events")
    .insert({
      ...normalizeCreateScope(input),
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as MapEvent;
}

export async function updateMapEvent(eventId: string, values: Partial<Omit<MapEvent, "id" | "created_by" | "created_at" | "updated_at">>) {
  const { data, error } = await supabase
    .from("map_events")
    .update({
      ...normalizeUpdateScope(values),
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as MapEvent;
}

export async function deleteMapEvent(eventId: string) {
  const { error } = await supabase.from("map_events").delete().eq("id", eventId);

  if (error) {
    throw error;
  }
}

export async function getEventCompletions(eventIds: string[]) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || eventIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("map_event_completions")
    .select("*")
    .eq("user_id", user.id)
    .in("event_id", eventIds);

  if (error) {
    console.warn("[map] event completions unavailable", error.message);
    return [];
  }

  return (data ?? []) as MapEventCompletion[];
}

export async function completeMapEvent(eventId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to complete an event.");
  }

  const { data, error } = await supabase
    .from("map_event_completions")
    .insert({
      user_id: user.id,
      event_id: eventId,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("map_event_completions")
      .select("*")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    return existing as MapEventCompletion;
  }

  if (error) {
    throw error;
  }

  await recordSocialContribution({
    userId: user.id,
    metricType: "map_event_completions",
    metricFilter: eventId,
    amount: 1,
    sourceType: "map_event",
    sourceId: eventId,
  });

  return data as MapEventCompletion;
}

export async function getStoryMarkerCompletions(markerIds: string[]) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || markerIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("story_marker_completions")
    .select("*")
    .eq("user_id", user.id)
    .in("marker_id", markerIds);

  if (error) {
    console.warn("[map] story marker completions unavailable", error.message);
    return [];
  }

  return (data ?? []) as StoryMarkerCompletion[];
}

export async function getStoryMarkerStarts(markerIds: string[]) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || markerIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("story_marker_starts")
    .select("*")
    .eq("user_id", user.id)
    .in("marker_id", markerIds);

  if (error) {
    console.warn("[map] story marker starts unavailable", error.message);
    return [];
  }

  return (data ?? []) as StoryMarkerStart[];
}

export async function getPlayerStoryFlags(characterId: string) {
  const { data, error } = await supabase
    .from("player_story_flags")
    .select("*")
    .eq("character_id", characterId);

  if (error) {
    console.warn("[map] story flags unavailable", error.message);
    return [];
  }

  return (data ?? []) as PlayerStoryFlag[];
}

export async function setPlayerStoryFlag(characterId: string, flagKey: string, flagValue = true, textValue?: string | null) {
  const cleanKey = flagKey.trim();
  if (!cleanKey) {
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to update story flags.");
  }

  const { data, error } = await supabase
    .from("player_story_flags")
    .upsert(
      {
        user_id: user.id,
        character_id: characterId,
        flag_key: cleanKey,
        flag_value: flagValue,
        text_value: textValue ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "character_id,flag_key" },
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as PlayerStoryFlag;
}

export async function getPlayerTutorialCompletions(characterId: string) {
  const { data, error } = await supabase
    .from("player_tutorial_completions")
    .select("*")
    .eq("character_id", characterId);

  if (error) {
    console.warn("[map] tutorial completions unavailable", error.message);
    return [];
  }

  return (data ?? []) as PlayerTutorialCompletion[];
}

export async function startStoryMarker(markerId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to start story quests.");
  }

  const { data, error } = await supabase
    .from("story_marker_starts")
    .upsert(
      {
        user_id: user.id,
        marker_id: markerId,
        started_at: new Date().toISOString(),
      },
      { onConflict: "user_id,marker_id" },
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as StoryMarkerStart;
}

export async function completeStoryMarker(markerId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to complete story quests.");
  }

  const { data, error } = await supabase
    .from("story_marker_completions")
    .insert({
      user_id: user.id,
      marker_id: markerId,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("story_marker_completions")
      .select("*")
      .eq("user_id", user.id)
      .eq("marker_id", markerId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    return existing as StoryMarkerCompletion;
  }

  if (error) {
    throw error;
  }

  await recordSocialContribution({
    userId: user.id,
    metricType: "story_marker_completions",
    metricFilter: markerId,
    amount: 1,
    sourceType: "story_marker",
    sourceId: markerId,
  });

  return data as StoryMarkerCompletion;
}

export async function applyRewards(
  character: CharacterWithDetails,
  reward: {
    xp?: number | null;
    gold?: number | null;
    itemId?: string | null;
    itemQuantity?: number | null;
    repeatable?: boolean | null;
    rewardOncePerPlayer?: boolean | null;
    markerId?: string | null;
    eventId?: string | null;
    choiceId?: string | null;
    fullHeal?: boolean | null;
    fullHealMaxHealth?: number | null;
  },
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to claim rewards.");
  }

  const shouldTrackClaim = Boolean(reward.markerId || reward.eventId || reward.choiceId);
  const allowRepeat = Boolean(reward.repeatable) || reward.rewardOncePerPlayer === false;

  if (shouldTrackClaim && !allowRepeat) {
    let query = supabase.from("marker_reward_claims").select("id").eq("user_id", user.id).limit(1);
    if (reward.markerId) {
      query = query.eq("marker_id", reward.markerId);
    } else if (reward.eventId) {
      query = query.eq("event_id", reward.eventId);
    } else if (reward.choiceId) {
      query = query.eq("choice_id", reward.choiceId);
    }

    const { data: existing, error: existingError } = await query;
    if (existingError) {
      throw existingError;
    }

    if ((existing ?? []).length > 0) {
      return { claimed: false, message: "Reward already claimed." };
    }
  }

  const xp = Math.max(0, Number(reward.xp) || 0);
  const gold = Math.max(0, Number(reward.gold) || 0);
  const quantity = Math.max(1, Number(reward.itemQuantity) || 1);

  if (xp > 0 || gold > 0) {
    await applyCharacterXpGold(character, xp, gold);
  }

  if (reward.itemId) {
    await grantItemToCharacter(character.id, reward.itemId, quantity);
  }

  const healedHealth = reward.fullHeal ? Math.max(1, Math.floor(Number(reward.fullHealMaxHealth) || Number(character.current_health) || 30)) : null;
  if (healedHealth) {
    await updateCharacterHealth(character.id, healedHealth);
  }

  if (shouldTrackClaim && !allowRepeat) {
    const { error } = await supabase.from("marker_reward_claims").insert({
      user_id: user.id,
      character_id: character.id,
      marker_id: reward.markerId ?? null,
      event_id: reward.eventId ?? null,
      choice_id: reward.choiceId ?? null,
    });

    if (error && error.code !== "23505") {
      throw error;
    }
  }

  return { claimed: true, message: formatRewardMessage(xp, gold, reward.itemId ? quantity : 0, Boolean(reward.fullHeal)), currentHealth: healedHealth };
}

export async function applyDialogueChoiceRewards(
  character: CharacterWithDetails,
  choice: StoryDialogueChoice,
  rewards: DialogueChoiceReward[],
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to claim rewards.");
  }

  const { data: atomicClaim, error: atomicClaimError } = await supabase.rpc("claim_dialogue_choice_rewards_atomic", {
    p_character_id: character.id,
    p_choice_id: choice.id,
  });

  if (!atomicClaimError) {
    const result = atomicClaim as {
      claimed?: boolean;
      message?: string;
      xp?: number;
      gold?: number;
      items?: Array<{ itemId?: string; item_id?: string; quantity?: number }>;
    } | null;
    const items = (result?.items ?? [])
      .map((item) => ({
        itemId: item.itemId ?? item.item_id ?? "",
        quantity: Math.max(1, Number(item.quantity) || 1),
      }))
      .filter((item) => item.itemId);

    return {
      claimed: Boolean(result?.claimed),
      message: result?.message || (result?.claimed ? formatRewardMessage(Number(result?.xp) || 0, Number(result?.gold) || 0, items.reduce((sum, item) => sum + item.quantity, 0)) : "Reward already claimed."),
      xp: Math.max(0, Number(result?.xp) || 0),
      gold: Math.max(0, Number(result?.gold) || 0),
      items,
    };
  }

  if (!isMissingRpcError(atomicClaimError)) {
    throw atomicClaimError;
  }

  const { data: existing, error: existingError } = await supabase
    .from("marker_reward_claims")
    .select("id")
    .eq("user_id", user.id)
    .eq("choice_id", choice.id)
    .limit(1);

  if (existingError) {
    throw existingError;
  }

  if ((existing ?? []).length > 0) {
    return { claimed: false, message: "Reward already claimed.", xp: 0, gold: 0, items: [] as Array<{ itemId: string; quantity: number }> };
  }

  const xp =
    Math.max(0, Number(choice.reward_xp) || 0) +
    rewards
      .filter((reward) => reward.reward_type === "xp")
      .reduce((sum, reward) => sum + Math.max(0, Number(reward.amount) || 0), 0);
  const gold =
    Math.max(0, Number(choice.reward_gold) || 0) +
    rewards
      .filter((reward) => reward.reward_type === "gold")
      .reduce((sum, reward) => sum + Math.max(0, Number(reward.amount) || 0), 0);
  const items: Array<{ itemId: string; quantity: number }> = [];

  if (choice.reward_item_id) {
    items.push({
      itemId: choice.reward_item_id,
      quantity: Math.max(1, Number(choice.reward_item_quantity) || 1),
    });
  }

  rewards
    .filter((reward) => reward.reward_type === "item" && reward.item_id)
    .forEach((reward) => {
      items.push({
        itemId: reward.item_id as string,
        quantity: Math.max(1, Number(reward.quantity) || 1),
      });
    });

  if (xp > 0 || gold > 0) {
    await applyCharacterXpGold(character, xp, gold);
  }

  for (const item of items) {
    await grantItemToCharacter(character.id, item.itemId, item.quantity);
  }

  const { error } = await supabase.from("marker_reward_claims").insert({
    user_id: user.id,
    character_id: character.id,
    choice_id: choice.id,
  });

  if (error && error.code !== "23505") {
    throw error;
  }

  const itemQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    claimed: true,
    message: formatRewardMessage(xp, gold, itemQuantity),
    xp,
    gold,
    items,
  };
}

export async function buyMarketItem(character: CharacterWithDetails, marketItem: MarkerMarketItem) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to buy items.");
  }

  if (!canMarketItemBeBought(marketItem)) {
    throw new Error("This market item is not for sale.");
  }

  const { data: currentCharacter, error: characterError } = await supabase
    .from("characters")
    .select("gold")
    .eq("id", character.id)
    .eq("user_id", user.id)
    .single();

  if (characterError) {
    throw characterError;
  }

  const { data: purchaseRow, error: purchaseError } = await supabase
    .from("player_market_purchases")
    .select("*")
    .eq("user_id", user.id)
    .eq("market_item_id", marketItem.id)
    .maybeSingle();

  if (purchaseError) {
    throw purchaseError;
  }

  const purchased = Number((purchaseRow as PlayerMarketPurchase | null)?.quantity_purchased ?? 0);
  const stockLimit = Math.max(0, Number(marketItem.stock_quantity) || 0);
  if (!marketItem.unlimited_stock && purchased >= stockLimit) {
    throw new Error("This item is sold out for you.");
  }

  const price = Math.max(0, Number(marketItem.buy_price) || 0);
  if (Number(currentCharacter.gold) < price) {
    throw new Error("Not enough gold.");
  }

  const { error: goldError } = await supabase
    .from("characters")
    .update({ gold: Number(currentCharacter.gold) - price })
    .eq("id", character.id)
    .eq("user_id", user.id);

  if (goldError) {
    throw goldError;
  }

  await grantItemToCharacter(character.id, marketItem.item_id, 1);

  if (!marketItem.unlimited_stock) {
    const { error: stockError } = await supabase.from("player_market_purchases").upsert(
      {
        user_id: user.id,
        character_id: character.id,
        market_item_id: marketItem.id,
        quantity_purchased: purchased + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,market_item_id" },
    );

    if (stockError) {
      throw stockError;
    }
  }

  return { gold: Number(currentCharacter.gold) - price };
}

export async function sellMarketInventoryItem(character: CharacterWithDetails, inventoryItem: InventoryItem, sellPrice: number) {
  if (!inventoryItem.item.sellable) {
    throw new Error("This item cannot be sold.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to sell items.");
  }

  const { data: currentCharacter, error: characterError } = await supabase
    .from("characters")
    .select("gold")
    .eq("id", character.id)
    .eq("user_id", user.id)
    .single();

  if (characterError) {
    throw characterError;
  }

  await consumeInventoryItem(inventoryItem, 1);
  const { error } = await supabase
    .from("characters")
    .update({ gold: Number(currentCharacter.gold) + Math.max(0, Number(sellPrice) || 0) })
    .eq("id", character.id)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }

  return { gold: Number(currentCharacter.gold) + Math.max(0, Number(sellPrice) || 0) };
}

export function canMarketItemBeBought(marketItem: MarkerMarketItem) {
  return marketItem.listing_mode === "buy_and_sell" || marketItem.listing_mode === "buy_only";
}

export function canMarketItemBeSoldTo(marketItem: MarkerMarketItem) {
  return marketItem.listing_mode === "buy_and_sell" || marketItem.listing_mode === "sell_only";
}

function formatRewardMessage(xp: number, gold: number, itemQuantity: number, fullHeal = false) {
  const parts = [];
  if (xp > 0) {
    parts.push(`${xp} XP`);
  }
  if (gold > 0) {
    parts.push(`${gold} gold`);
  }
  if (itemQuantity > 0) {
    parts.push(`${itemQuantity} item${itemQuantity === 1 ? "" : "s"}`);
  }
  if (fullHeal) {
    parts.push("full heal");
  }
  return parts.length > 0 ? `Reward claimed: ${parts.join(", ")}.` : "No reward configured.";
}

export async function getDialogueNodes(eventId: string) {
  const { data, error } = await supabase
    .from("story_dialogue_nodes")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[map] dialogue nodes unavailable", error.message);
    return [];
  }

  return (data ?? []) as StoryDialogueNode[];
}

export async function getDialogueNodesForMarker(markerId: string) {
  const { data, error } = await supabase
    .from("story_dialogue_nodes")
    .select("*")
    .eq("marker_id", markerId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as StoryDialogueNode[];
}

export async function getDialogueChoices(nodeIds: string[]) {
  if (nodeIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("story_dialogue_choices")
    .select("*")
    .in("node_id", nodeIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[map] dialogue choices unavailable", error.message);
    return [];
  }

  return (data ?? []) as StoryDialogueChoice[];
}

export async function getDialogueChoiceRewards(choiceIds: string[]) {
  if (choiceIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("dialogue_choice_rewards")
    .select("*")
    .in("choice_id", choiceIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[map] dialogue choice rewards unavailable", error.message);
    return [];
  }

  return (data ?? []) as DialogueChoiceReward[];
}

export async function createDialogueNode(input: Omit<StoryDialogueNode, "id" | "created_at" | "updated_at">) {
  const { data, error } = await supabase.from("story_dialogue_nodes").insert(input).select().single();

  if (error) {
    throw error;
  }

  return data as StoryDialogueNode;
}

export async function updateDialogueNode(nodeId: string, values: Partial<Omit<StoryDialogueNode, "id" | "event_id" | "created_at" | "updated_at">>) {
  const { data, error } = await supabase
    .from("story_dialogue_nodes")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", nodeId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as StoryDialogueNode;
}

export async function deleteDialogueNode(nodeId: string) {
  const { error } = await supabase.from("story_dialogue_nodes").delete().eq("id", nodeId);

  if (error) {
    throw error;
  }
}

export async function createDialogueChoice(input: Omit<StoryDialogueChoice, "id" | "created_at" | "updated_at" | "unlock_marker_id" | "update_notification_title" | "update_notification_body" | "restore_health" | "restore_stamina" | "restore_mana" | "choice_group_key" | "choice_group_lock_message" | "hide_when_group_locked" | "set_story_flag_key" | "set_story_flag_value" | "repeatable" | "hide_after_selected" | "disable_after_selected" | "selected_message"> & Partial<Pick<StoryDialogueChoice, "unlock_marker_id" | "update_notification_title" | "update_notification_body" | "restore_health" | "restore_stamina" | "restore_mana" | "choice_group_key" | "choice_group_lock_message" | "hide_when_group_locked" | "set_story_flag_key" | "set_story_flag_value" | "repeatable" | "hide_after_selected" | "disable_after_selected" | "selected_message">>) {
  const values = {
    ...input,
    consume_gold: input.consume_gold ?? 0,
    restore_health: input.restore_health ?? false,
    restore_stamina: input.restore_stamina ?? false,
    restore_mana: input.restore_mana ?? false,
    choice_group_key: input.choice_group_key?.trim() || null,
    choice_group_lock_message: input.choice_group_lock_message?.trim() || null,
    hide_when_group_locked: input.hide_when_group_locked ?? false,
    set_story_flag_key: input.set_story_flag_key?.trim() || null,
    set_story_flag_value: input.set_story_flag_value ?? true,
    repeatable: input.repeatable ?? true,
    hide_after_selected: input.hide_after_selected ?? false,
    disable_after_selected: input.disable_after_selected ?? false,
    selected_message: input.selected_message ?? null,
  };
  const { data, error } = await supabase.from("story_dialogue_choices").insert(values).select().single();

  if (error) {
    throw error;
  }

  return data as StoryDialogueChoice;
}

export async function updateDialogueChoice(choiceId: string, values: Partial<Omit<StoryDialogueChoice, "id" | "node_id" | "created_at" | "updated_at">>) {
  const { data, error } = await supabase
    .from("story_dialogue_choices")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", choiceId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as StoryDialogueChoice;
}

export async function hasClaimedDialogueChoiceEffect(choiceId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to check dialogue effects.");
  }

  const { data, error } = await supabase
    .from("marker_reward_claims")
    .select("id")
    .eq("user_id", user.id)
    .eq("choice_id", choiceId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function recordDialogueChoiceEffectClaim(character: CharacterWithDetails, choiceId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to save dialogue effects.");
  }

  const { error } = await supabase.from("marker_reward_claims").insert({
    user_id: user.id,
    character_id: character.id,
    choice_id: choiceId,
  });

  if (error && error.code !== "23505") {
    throw error;
  }
}

export async function getClaimedDialogueRewardChoiceIds(choiceIds: string[]) {
  const uniqueChoiceIds = Array.from(new Set(choiceIds.filter(Boolean)));

  if (uniqueChoiceIds.length === 0) {
    return new Set<string>();
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to load claimed dialogue rewards.");
  }

  const { data, error } = await supabase
    .from("marker_reward_claims")
    .select("choice_id")
    .eq("user_id", user.id)
    .in("choice_id", uniqueChoiceIds);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.choice_id).filter(Boolean) as string[]);
}

export async function recordPlayerAttributeCheck(input: {
  characterId: string;
  dialogueNodeId: string | null;
  choiceId: string;
  attributeUsed: NonNullable<StoryDialogueChoice["check_attribute"]>;
  attributeValue: number;
  dc: number;
  rollValue: number;
  finalResult: number;
  succeeded: boolean;
}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to record attribute checks.");
  }

  const { data, error } = await supabase
    .from("player_attribute_checks")
    .insert({
      user_id: user.id,
      character_id: input.characterId,
      dialogue_node_id: input.dialogueNodeId,
      choice_id: input.choiceId,
      attribute_used: input.attributeUsed,
      attribute_value: input.attributeValue,
      dc: input.dc,
      roll_value: input.rollValue,
      final_result: input.finalResult,
      succeeded: input.succeeded,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as PlayerAttributeCheck;
}

export async function deleteDialogueChoice(choiceId: string) {
  const { error } = await supabase.from("story_dialogue_choices").delete().eq("id", choiceId);

  if (error) {
    throw error;
  }
}

function isMissingRpcError(error: { message?: string; code?: string } | null) {
  if (!error) {
    return false;
  }

  return error.code === "42883" || error.message?.toLowerCase().includes("function") || error.message?.toLowerCase().includes("schema cache");
}
