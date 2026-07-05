import type { MapEvent, MapMarker, MapRoute, MiniMap, TutorialStep, MarkerLegendItem, WorldMapSetting } from "../services/mapService";
import type { MapAdminSection } from "./mapAdminSections";
import { isExitMarkerType } from "./mapVisibility";

type AdminSectionSummaryInput = {
  section: MapAdminSection;
  activeWorldMapSetting: WorldMapSetting | null;
  worldMarkers: MapMarker[];
  miniMapMarkers: MapMarker[];
  miniMaps: MiniMap[];
  worldRoutes: MapRoute[];
  tutorialSteps: TutorialStep[];
  mapEvents: MapEvent[];
  legendItems: MarkerLegendItem[];
  routeName: string;
};

type AdminSectionWarningInput = {
  section: MapAdminSection;
  worldMarkers: MapMarker[];
  miniMapMarkers: MapMarker[];
  miniMaps: MiniMap[];
  worldRoutes: MapRoute[];
  mapEvents: MapEvent[];
};

export function getAdminSectionMarkers(section: MapAdminSection, worldMarkers: MapMarker[], miniMapMarkers: MapMarker[]) {
  if (section === "Area/Town Markers") {
    return worldMarkers.filter((marker) => marker.type === "Area/Town Entrance");
  }

  if (section === "Mini Maps") {
    return miniMapMarkers;
  }

  return worldMarkers.filter((marker) => marker.type !== "Area/Town Entrance");
}

export function getAdminSectionSummary(input: AdminSectionSummaryInput) {
  const {
    section,
    activeWorldMapSetting,
    worldMarkers,
    miniMapMarkers,
    miniMaps,
    worldRoutes,
    tutorialSteps,
    mapEvents,
    legendItems,
    routeName,
  } = input;

  if (section === "World Map") {
    return activeWorldMapSetting ? `${activeWorldMapSetting.name || "Custom map"} configured for this chapter.` : "Using the bundled overworld map.";
  }

  if (section === "World Markers" || section === "Area/Town Markers") {
    const sectionMarkers = getAdminSectionMarkers(section, worldMarkers, miniMapMarkers);
    const hiddenCount = sectionMarkers.filter((marker) => marker.is_active === false).length;
    return `${sectionMarkers.length} marker${sectionMarkers.length === 1 ? "" : "s"}${hiddenCount ? `, ${hiddenCount} hidden` : ""}.`;
  }

  if (section === "Mini Maps") {
    return `${miniMaps.length} mini map${miniMaps.length === 1 ? "" : "s"}, ${miniMapMarkers.length} mini marker${miniMapMarkers.length === 1 ? "" : "s"}.`;
  }

  if (section === "Walking Paths") {
    return `${worldRoutes.length} overworld path${worldRoutes.length === 1 ? "" : "s"} in this chapter.`;
  }

  if (section === "Tutorials") {
    return `${tutorialSteps.length} tutorial step${tutorialSteps.length === 1 ? "" : "s"}.`;
  }

  if (section === "Rewards/Interactions") {
    return `${mapEvents.length} event${mapEvents.length === 1 ? "" : "s"} on ${routeName}.`;
  }

  if (section === "Legend") {
    return `${legendItems.length} legend item${legendItems.length === 1 ? "" : "s"}.`;
  }

  return "";
}

export function getAdminSectionWarningCount(input: AdminSectionWarningInput) {
  const { section, worldMarkers, miniMapMarkers, miniMaps, worldRoutes, mapEvents } = input;

  if (section === "World Markers" || section === "Area/Town Markers") {
    return getMarkerWarningCount(getAdminSectionMarkers(section, worldMarkers, miniMapMarkers));
  }
  if (section === "Mini Maps") return getMiniMapWarningCount(miniMaps, miniMapMarkers);
  if (section === "Walking Paths") return getRouteWarningCount(worldRoutes);
  if (section === "Rewards/Interactions") return getEventWarningCount(mapEvents);
  return 0;
}

function getMarkerWarningCount(markerList: MapMarker[]) {
  return markerList.filter((marker) => {
    if (!marker.title?.trim()) return true;
    if (!Number.isFinite(Number(marker.x_percent)) || !Number.isFinite(Number(marker.y_percent))) return true;
    if (marker.type === "Area/Town Entrance" && !marker.linked_mini_map_id) return true;
    if (isExitMarkerType(marker.type) && !marker.exit_target_marker_id && !marker.linked_mini_map_id) return true;
    return false;
  }).length;
}

function getRouteWarningCount(routeList: MapRoute[]) {
  return routeList.filter((item) => !item.name?.trim() || !Array.isArray(item.path_points) || item.path_points.length < 2).length;
}

function getMiniMapWarningCount(miniMapList: MiniMap[], miniMapMarkers: MapMarker[]) {
  return miniMapList.filter((miniMap) => {
    const hasSpawn = miniMapMarkers.some((marker) => marker.mini_map_id === miniMap.id && marker.type === "Player Spawn");
    return !miniMap.background_image_url?.trim() || !hasSpawn;
  }).length;
}

function getEventWarningCount(eventList: MapEvent[]) {
  return eventList.filter((event) => {
    if (!event.title?.trim()) return true;
    if (event.event_type === "battle" && !event.enemy_id && !event.npc_id && !event.enemy_name?.trim()) return true;
    return false;
  }).length;
}
