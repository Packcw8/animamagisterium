import { supabase, Tables } from "../lib/supabase";

export type MapRoute = Tables["map_routes"];
export type RouteProgress = Tables["route_progress"];
export type MapMarker = Tables["map_markers"];
export type Role = Tables["profiles"]["role"];

export const fallbackRoute: MapRoute = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Grayfen Road to Hollow Watch",
  terrain: "Mire road, broken stone, low fog",
  danger_level: "Moderate",
  distance_required_meters: 5000,
  estimated_encounters: 3,
  path_points: [
    { x: 18, y: 70 },
    { x: 28, y: 62 },
    { x: 42, y: 54 },
    { x: 56, y: 41 },
    { x: 68, y: 38 },
  ],
  is_active: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

export const fallbackMarkers: MapMarker[] = [
  marker("Town", "Mirehold Crossing", 18, 70, "A lantern town at the edge of the flooded road."),
  marker("Battle", "Wolf Track Bend", 34, 58, "Fresh tracks cut through the mud."),
  marker("Merchant", "Copper Cart Waystation", 47, 49, "A caravan camp with guarded supplies."),
  marker("Occult Clue", "Broken Moon Cairn", 58, 41, "A cracked moon symbol carved into wet stone."),
  marker("Dungeon", "Hollow Watch", 68, 38, "Ruins overlooking the old marsh road."),
];

function marker(type: string, title: string, x: number, y: number, description: string): MapMarker {
  return {
    id: `${type}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    type,
    title,
    description,
    x_percent: x,
    y_percent: y,
    is_active: true,
    is_unlocked: true,
    quest_key: null,
    route_id: fallbackRoute.id,
    created_by: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

export async function getCurrentRole(): Promise<Role> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email?.toLowerCase() === "pack8cw@gmail.com") {
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
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[map] falling back to local route", error.message);
    return fallbackRoute;
  }

  return (data as MapRoute | null) ?? fallbackRoute;
}

export async function getMapMarkers() {
  const { data, error } = await supabase.from("map_markers").select("*").order("created_at", { ascending: true });

  if (error) {
    console.warn("[map] falling back to local markers", error.message);
    return fallbackMarkers;
  }

  return ((data ?? []) as MapMarker[]).length > 0 ? ((data ?? []) as MapMarker[]) : fallbackMarkers;
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

export async function saveRouteProgress(routeId: string, values: Pick<RouteProgress, "distance_walked_meters" | "progress_percent" | "last_lat" | "last_lng">) {
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
