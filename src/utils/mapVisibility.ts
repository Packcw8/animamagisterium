import type { MapMarker, MarkerRouteLink } from "../services/mapService";
import { getPercentDistance, PercentPoint } from "./mapGeometry";

export function canPlayerSeeMarker(marker: MapMarker, playerPosition: PercentPoint) {
  if (isSpawnMarker(marker.type)) {
    return false;
  }

  if (!marker.is_active || !marker.is_unlocked || marker.is_interactable === false) {
    return false;
  }

  const radius = Number(marker.interaction_radius_percent ?? 4) || 4;
  return getPercentDistance(playerPosition, { x: Number(marker.x_percent), y: Number(marker.y_percent) }) <= radius;
}

export function isStoryQuestMarker(marker: Pick<MapMarker, "type">) {
  return marker.type === "Story" || marker.type === "Quest";
}

export function isSpawnMarker(type: string) {
  return type === "Player Spawn" || type === "World Spawn";
}

export function getOrderedMarkerRouteLinks(links: MarkerRouteLink[]) {
  return [...links].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at));
}

export function canPlayerSeeStoryMarker(marker: MapMarker, scopeMarkers: MapMarker[], completedMarkerIds: Set<string>, startedMarkerIds: Set<string> = new Set()) {
  if (!isStoryQuestMarker(marker)) {
    return true;
  }

  if (marker.hide_when_completed !== false && completedMarkerIds.has(marker.id)) {
    return false;
  }

  if (marker.unlock_after_marker_id && !completedMarkerIds.has(marker.unlock_after_marker_id)) {
    return false;
  }

  const order = Number(marker.story_order ?? 0);
  if (order <= 0) {
    return true;
  }

  return scopeMarkers
    .filter((item) => isStoryQuestMarker(item))
    .filter((item) => Number(item.season_number ?? 1) === Number(marker.season_number ?? 1))
    .filter((item) => Number(item.chapter_number ?? 1) === Number(marker.chapter_number ?? 1))
    .filter((item) => Number(item.story_order ?? 0) > 0 && Number(item.story_order ?? 0) < order)
    .every((item) => completedMarkerIds.has(item.id));
}

export function getMarkerRenderStyle(marker: MapMarker, playerPosition: PercentPoint, markerSize = 34) {
  const markerPosition = { x: Number(marker.x_percent), y: Number(marker.y_percent) };
  const radius = Math.max(1, Number(marker.interaction_radius_percent ?? 4) || 4);
  const distance = getPercentDistance(playerPosition, markerPosition);
  const scale = distance <= radius * 0.65 ? 1.48 : distance <= radius ? 1.34 : distance <= radius * 1.75 ? 1.16 : 1;
  const zIndex = distance <= radius ? 45 : 15;

  return {
    left: `${markerPosition.x}%`,
    top: `${markerPosition.y}%`,
    zIndex,
    transform: [{ translateX: -(markerSize / 2) }, { translateY: -(markerSize / 2) }, { scale }],
  } as object;
}

export function isMarkerLocked(marker: MapMarker) {
  return (marker.lock_type ?? "public") !== "public";
}

export function isExitMarker(marker: MapMarker) {
  return isExitMarkerType(marker.type);
}

export function isExitMarkerType(type: string) {
  return type === "Exit" || type === "Exit/Leave";
}

export function getMarkerLockMessage(marker: MapMarker) {
  if (!isMarkerLocked(marker)) {
    return "Available";
  }

  if (marker.lock_message?.trim()) {
    return marker.lock_message;
  }

  return marker.lock_type === "quest_locked" ? "Continue the required quest to unlock this." : "Progress further in the story to unlock this.";
}
