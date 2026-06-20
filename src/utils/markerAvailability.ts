import type { MapMarker, MarkerRouteLink, RouteProgress } from "../services/mapService";
import { getPercentDistance, type PercentPoint } from "./mapGeometry";
import { isStoryQuestMarker } from "./mapVisibility";

export type MarkerAvailability = {
  visible: boolean;
  interactable: boolean;
  reason: string | null;
  distance: number;
  radius: number;
};

type MarkerAvailabilityInput = {
  marker: MapMarker;
  playerPosition: PercentPoint;
  routeLinks: MarkerRouteLink[];
  routeProgressRows: RouteProgress[];
};

export function getMarkerAvailability({
  marker,
  playerPosition,
  routeLinks,
  routeProgressRows,
}: MarkerAvailabilityInput): MarkerAvailability {
  const radius = Number(marker.interaction_radius_percent ?? 4) || 4;
  const markerPosition = { x: Number(marker.x_percent), y: Number(marker.y_percent) };
  const distance = getPercentDistance(playerPosition, markerPosition);

  if (marker.type === "Player Spawn") {
    return { visible: false, interactable: false, reason: null, distance, radius };
  }

  if (!marker.is_active || !marker.is_unlocked || marker.is_interactable === false) {
    return { visible: false, interactable: false, reason: null, distance, radius };
  }

  const requirements = getMarkerPathRequirements(marker, routeLinks);
  const metRequirements = requirements.filter((link) => isRouteLinkRequirementMet(link, routeProgressRows));
  const unmetRequirements = requirements.filter((link) => !isRouteLinkRequirementMet(link, routeProgressRows));
  const requiresAll = markerRequiresAllLinkedPaths(marker);

  if (requirements.length > 0 && ((!requiresAll && metRequirements.length === 0) || (requiresAll && unmetRequirements.length > 0))) {
    return {
      visible: true,
      interactable: false,
      reason: getRequirementMessage(marker, requirements.length, unmetRequirements.length),
      distance,
      radius,
    };
  }

  if (requirements.length > 0) {
    return { visible: true, interactable: true, reason: null, distance, radius };
  }

  if (distance > radius) {
    return {
      visible: false,
      interactable: false,
      reason: `You're not at this location yet. Required: ${radius.toFixed(2)}%. Current: ${distance.toFixed(2)}%.`,
      distance,
      radius,
    };
  }

  return { visible: true, interactable: true, reason: null, distance, radius };
}

export function getMarkerPathRequirements(marker: MapMarker, routeLinks: MarkerRouteLink[]) {
  if (marker.type === "Sign Post" || isStoryQuestMarker(marker)) {
    return [];
  }

  return routeLinks.filter((link) => link.marker_id === marker.id);
}

function markerRequiresAllLinkedPaths(marker: MapMarker) {
  if (marker.type === "Area/Town Entrance") {
    return false;
  }

  return marker.require_all_linked_routes !== false;
}

export function isRouteLinkRequirementMet(link: MarkerRouteLink, routeProgressRows: RouteProgress[]) {
  const progress = routeProgressRows.find((row) => row.route_id === link.route_id);

  if (!progress) {
    return false;
  }

  const percent = Number(progress.progress_percent ?? 0);
  return percent >= 100 || (percent <= 0 && progress.travel_direction === "reverse");
}

function getRequirementMessage(marker: MapMarker, totalCount: number, unmetCount: number) {
  if (marker.type === "Area/Town Entrance") {
    return totalCount === 1
      ? "Complete the linked walking path to enter this area."
      : "Complete one linked walking path to enter this area.";
  }

  return unmetCount === 1
    ? "A linked walking path must be completed before this marker can be used."
    : `${unmetCount} linked walking paths must be completed before this marker can be used.`;
}
