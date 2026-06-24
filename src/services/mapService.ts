import { supabase, Tables } from "../lib/supabase";
import type { CharacterWithDetails } from "./characterService";
import { consumeInventoryItem, grantItemToCharacter, type InventoryItem } from "./inventoryService";
import { applyCharacterXpGold } from "./progressionService";

export type MapRoute = Tables["map_routes"];
export type MapSeason = Tables["map_seasons"];
export type MapChapter = Tables["map_chapters"];
export type RouteProgress = Tables["route_progress"];
export type PlayerMapState = Tables["player_map_state"];
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
export type StoryDialogueNode = Tables["story_dialogue_nodes"];
export type StoryDialogueChoice = Tables["story_dialogue_choices"];
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
  image_url: null,
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
    return [{ id: "local-chapter-1-1", season_number: 1, chapter_number: 1, name: "Chapter 1", description: null, is_active: true, created_by: null, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString() }] as MapChapter[];
  }

  const chapters = (data ?? []) as MapChapter[];
  return chapters.length > 0 ? chapters : [{ id: "local-chapter-1-1", season_number: 1, chapter_number: 1, name: "Chapter 1", description: null, is_active: true, created_by: null, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString() }];
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

  return data as MapChapter;
}

export async function getMiniMaps() {
  const { data, error } = await supabase.from("mini_maps").select("*").order("created_at", { ascending: true });

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
    background_image_url: input.background_image_url?.trim() || null,
    description: input.description?.trim() || null,
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

export async function saveMarkerRouteLinks(markerId: string, routeIds: string[], seasonNumber = 1, chapterNumber = 1, completionCondition: MarkerRouteLink["completion_condition"] = "either") {
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

export async function createMapMarker(input: Pick<MapMarker, "type" | "title" | "description" | "x_percent" | "y_percent" | "is_active" | "is_unlocked" | "route_id" | "quest_key"> & Partial<Pick<MapMarker, "linked_mini_map_id" | "mini_map_id" | "parent_marker_id" | "exit_target_type" | "exit_target_marker_id" | "linked_route_id" | "starts_route_on_accept" | "icon_label" | "icon_image_url" | "icon_color" | "lock_type" | "lock_message" | "story_order" | "unlock_after_marker_id" | "hide_when_completed" | "require_all_linked_routes" | "reward_timing" | "season_number" | "chapter_number">>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("map_markers")
    .insert({
      ...input,
      season_number: Number(input.season_number) || 1,
      chapter_number: Number(input.chapter_number) || 1,
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

export async function createMapRoute(input: Pick<MapRoute, "name" | "sort_order" | "terrain" | "danger_level" | "distance_required_meters" | "estimated_encounters" | "path_points" | "is_active" | "lock_type" | "lock_message" | "season_number" | "chapter_number"> & Partial<Pick<MapRoute, "mini_map_id" | "image_url">>) {
  const { data, error } = await supabase
    .from("map_routes")
    .insert({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as MapRoute;
}

export async function updateMapRoute(routeId: string, values: Partial<Pick<MapRoute, "name" | "sort_order" | "terrain" | "danger_level" | "distance_required_meters" | "estimated_encounters" | "path_points" | "is_active" | "lock_type" | "lock_message" | "season_number" | "chapter_number" | "mini_map_id" | "image_url">>) {
  const { data, error } = await supabase
    .from("map_routes")
    .update({
      ...values,
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

export async function updateMapMarker(markerId: string, values: Partial<Pick<MapMarker, "type" | "title" | "description" | "x_percent" | "y_percent" | "is_active" | "is_unlocked" | "route_id" | "quest_key" | "linked_mini_map_id" | "mini_map_id" | "parent_marker_id" | "exit_target_type" | "exit_target_marker_id" | "linked_route_id" | "starts_route_on_accept" | "icon_label" | "icon_image_url" | "icon_color" | "lock_type" | "lock_message" | "story_order" | "unlock_after_marker_id" | "hide_when_completed" | "require_all_linked_routes" | "reward_timing" | "season_number" | "chapter_number">>) {
  const { data, error } = await supabase
    .from("map_markers")
    .update({
      ...values,
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

export async function updateMarkerSettings(markerId: string, values: Partial<Pick<MapMarker, "type" | "title" | "description" | "is_interactable" | "quest_title" | "quest_dialogue" | "quest_image_url" | "shop_image_url" | "shop_background_image_url" | "scene_background_image_url" | "scene_npc_image_url" | "interaction_radius_percent" | "reward_xp" | "reward_gold" | "reward_item_id" | "reward_item_quantity" | "reward_timing" | "repeatable" | "reward_once_per_player" | "linked_mini_map_id" | "mini_map_id" | "parent_marker_id" | "exit_target_type" | "exit_target_marker_id" | "linked_route_id" | "starts_route_on_accept" | "icon_label" | "icon_image_url" | "icon_color" | "lock_type" | "lock_message" | "story_order" | "unlock_after_marker_id" | "hide_when_completed" | "require_all_linked_routes" | "season_number" | "chapter_number">>) {
  const { data, error } = await supabase
    .from("map_markers")
    .update({
      ...values,
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
      ...input,
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
      ...values,
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
    .upsert(
      {
        user_id: user.id,
        event_id: eventId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,event_id" },
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

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
    .upsert(
      {
        user_id: user.id,
        marker_id: markerId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,marker_id" },
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

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

  return { claimed: true, message: formatRewardMessage(xp, gold, reward.itemId ? quantity : 0) };
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

function formatRewardMessage(xp: number, gold: number, itemQuantity: number) {
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

export async function createDialogueChoice(input: Omit<StoryDialogueChoice, "id" | "created_at" | "updated_at">) {
  const { data, error } = await supabase.from("story_dialogue_choices").insert(input).select().single();

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

export async function deleteDialogueChoice(choiceId: string) {
  const { error } = await supabase.from("story_dialogue_choices").delete().eq("id", choiceId);

  if (error) {
    throw error;
  }
}
