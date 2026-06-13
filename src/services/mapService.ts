import { supabase, Tables } from "../lib/supabase";

export type MapRoute = Tables["map_routes"];
export type RouteProgress = Tables["route_progress"];
export type MapMarker = Tables["map_markers"];
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

export async function saveRouteProgress(routeId: string, values: Pick<RouteProgress, "distance_walked_meters" | "progress_percent" | "current_x_percent" | "current_y_percent" | "last_lat" | "last_lng">) {
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
  });
}

export async function createMapMarker(input: Pick<MapMarker, "type" | "title" | "description" | "x_percent" | "y_percent" | "is_active" | "is_unlocked" | "route_id" | "quest_key">) {
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

export async function updateMapMarker(markerId: string, values: Partial<Pick<MapMarker, "type" | "title" | "description" | "x_percent" | "y_percent" | "is_active" | "is_unlocked" | "route_id" | "quest_key">>) {
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
