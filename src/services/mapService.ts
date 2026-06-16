import { supabase, Tables } from "../lib/supabase";
import type { CharacterWithDetails } from "./characterService";
import { consumeInventoryItem, grantItemToCharacter, type InventoryItem } from "./inventoryService";

export type MapRoute = Tables["map_routes"];
export type RouteProgress = Tables["route_progress"];
export type MapMarker = Tables["map_markers"];
export type MarkerLegendItem = Tables["marker_legend_items"];
export type MarkerRouteLink = Tables["marker_route_links"];
export type MiniMap = Tables["mini_maps"];
export type TutorialStep = Tables["tutorial_steps"];
export type MarkerMarketItem = Tables["marker_market_items"];
export type MapStoryInstance = Tables["map_story_instances"];
export type MapEvent = Tables["map_events"];
export type MapEventCompletion = Tables["map_event_completions"];
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
  mini_map_id: null,
  parent_marker_id: null,
  is_active: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

export const fallbackMarkers: MapMarker[] = [];

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

export async function saveRouteProgress(routeId: string, values: Pick<RouteProgress, "distance_walked_meters" | "progress_percent" | "current_x_percent" | "current_y_percent" | "last_lat" | "last_lng"> & Partial<Pick<RouteProgress, "travel_direction" | "is_current">>) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw userError ?? new Error("You must be signed in to save route progress.");
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

export async function saveMarkerRouteLinks(markerId: string, routeIds: string[]) {
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
    created_by: user?.id ?? null,
    updated_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase.from("marker_route_links").insert(rows).select();

  if (error) {
    throw error;
  }

  return (data ?? []) as MarkerRouteLink[];
}

export async function createMapMarker(input: Pick<MapMarker, "type" | "title" | "description" | "x_percent" | "y_percent" | "is_active" | "is_unlocked" | "route_id" | "quest_key"> & Partial<Pick<MapMarker, "linked_mini_map_id" | "mini_map_id" | "parent_marker_id" | "linked_route_id" | "starts_route_on_accept" | "icon_label" | "icon_image_url" | "icon_color">>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("map_markers")
    .insert({
      ...input,
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

export async function saveMarkerMarketItem(input: Omit<MarkerMarketItem, "id" | "created_at" | "updated_at"> & { id?: string }) {
  const values = {
    marker_id: input.marker_id,
    item_id: input.item_id,
    buy_price: Number(input.buy_price) || 0,
    sell_price: Number(input.sell_price) || 0,
    stock_quantity: input.unlimited_stock ? null : Math.max(0, Number(input.stock_quantity) || 0),
    unlimited_stock: Boolean(input.unlimited_stock),
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

export async function createMapRoute(input: Pick<MapRoute, "name" | "sort_order" | "terrain" | "danger_level" | "distance_required_meters" | "estimated_encounters" | "path_points" | "is_active">) {
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

export async function updateMapRoute(routeId: string, values: Partial<Pick<MapRoute, "name" | "sort_order" | "terrain" | "danger_level" | "distance_required_meters" | "estimated_encounters" | "path_points" | "is_active">>) {
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

export async function updateMapMarker(markerId: string, values: Partial<Pick<MapMarker, "type" | "title" | "description" | "x_percent" | "y_percent" | "is_active" | "is_unlocked" | "route_id" | "quest_key" | "linked_mini_map_id" | "mini_map_id" | "parent_marker_id" | "linked_route_id" | "starts_route_on_accept" | "icon_label" | "icon_image_url" | "icon_color">>) {
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

export async function updateMarkerSettings(markerId: string, values: Partial<Pick<MapMarker, "type" | "title" | "description" | "is_interactable" | "quest_title" | "quest_dialogue" | "quest_image_url" | "shop_image_url" | "shop_background_image_url" | "scene_background_image_url" | "scene_npc_image_url" | "interaction_radius_percent" | "reward_xp" | "reward_gold" | "reward_item_id" | "reward_item_quantity" | "repeatable" | "reward_once_per_player" | "linked_mini_map_id" | "mini_map_id" | "parent_marker_id" | "linked_route_id" | "starts_route_on_accept" | "icon_label" | "icon_image_url" | "icon_color">>) {
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

  const { data: currentCharacter, error: characterError } = await supabase
    .from("characters")
    .select("xp,gold")
    .eq("id", character.id)
    .eq("user_id", user.id)
    .single();

  if (characterError) {
    throw characterError;
  }

  const xp = Math.max(0, Number(reward.xp) || 0);
  const gold = Math.max(0, Number(reward.gold) || 0);
  const quantity = Math.max(1, Number(reward.itemQuantity) || 1);

  if (xp > 0 || gold > 0) {
    const { error } = await supabase
      .from("characters")
      .update({
        xp: Number(currentCharacter.xp) + xp,
        gold: Number(currentCharacter.gold) + gold,
      })
      .eq("id", character.id)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }
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

  if (!marketItem.unlimited_stock && Number(marketItem.stock_quantity) <= 0) {
    throw new Error("This item is out of stock.");
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
    const { error: stockError } = await supabase
      .from("marker_market_items")
      .update({ stock_quantity: Math.max(0, Number(marketItem.stock_quantity) - 1), updated_at: new Date().toISOString() })
      .eq("id", marketItem.id);

    if (stockError) {
      throw stockError;
    }
  }
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
