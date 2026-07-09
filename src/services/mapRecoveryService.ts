import { clearPlayerMapState, savePlayerMapState, saveRouteProgress, type MapRoute, type RouteProgress } from "./mapService";
import { clamp, getPointOnRoute } from "../utils/mapGeometry";

type RecoveryPoint = {
  x: number;
  y: number;
};

export type MapRecoveryInput = {
  hasActiveRoute: boolean;
  route: MapRoute;
  distanceWalked: number;
  progressPercent: number;
  routeDirection: RouteProgress["travel_direction"];
  activeMiniMapId: string | null;
  fallbackPosition: RecoveryPoint;
};

export type MapRecoveryResult = {
  position: RecoveryPoint;
  activeMiniMapId: string | null;
  message: string;
};

export async function recoverPlayerMapPosition(input: MapRecoveryInput): Promise<MapRecoveryResult> {
  if (input.hasActiveRoute) {
    const progressPercent = clamp(Number(input.progressPercent) || 0, 0, 100);
    const position = getPointOnRoute(input.route.path_points, progressPercent);
    const activeMiniMapId = input.route.mini_map_id ?? null;

    await saveRouteProgress(input.route.id, {
      distance_walked_meters: Math.max(0, Number(input.distanceWalked) || 0),
      progress_percent: progressPercent,
      current_x_percent: position.x,
      current_y_percent: position.y,
      last_lat: null,
      last_lng: null,
      travel_direction: input.routeDirection ?? "forward",
      is_current: true,
    });

    if (activeMiniMapId) {
      await savePlayerMapState({
        active_mini_map_id: activeMiniMapId,
        current_x_percent: position.x,
        current_y_percent: position.y,
      });
    } else {
      await clearPlayerMapState();
    }

    return {
      position,
      activeMiniMapId,
      message: "Recovered your position on the current path without changing trail progress.",
    };
  }

  const position = input.fallbackPosition;
  await savePlayerMapState({
    active_mini_map_id: input.activeMiniMapId,
    current_x_percent: position.x,
    current_y_percent: position.y,
  });

  return {
    position,
    activeMiniMapId: input.activeMiniMapId,
    message: input.activeMiniMapId
      ? "Recovered your position to this area's spawn point."
      : "Recovered your position to the world spawn point.",
  };
}
