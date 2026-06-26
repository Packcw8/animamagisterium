import type { MapMarker } from "../services/mapService";

export type MarkerPayloadState = {
  draftType: string;
  draftTitle: string;
  draftDescription: string;
  activeMiniMapId: string | null;
  selectedMarker: MapMarker | null;
  selectedMiniMapId: string | null;
  markerExitTargetType: MapMarker["exit_target_type"];
  markerExitTargetMarkerId: string | null;
  markerExitTargetMiniMapId: string | null;
  markerLinkedRouteId: string | null;
  markerStartsRouteOnAccept: boolean;
  markerIconLabel: string;
  markerIconImage: string;
  markerIconColor: string;
  markerSize: string;
  markerLockType: MapMarker["lock_type"];
  markerLockMessage: string;
  markerStoryOrder: string;
  markerUnlockAfterId: string | null;
  markerHideWhenCompleted: boolean;
  markerRequireAllLinkedRoutes: boolean;
  markerDialogueEventId: string | null;
  markerBattleEventId?: string | null;
  markerEnemyId: string | null;
  markerNpcId: string | null;
  markerInteractable: boolean;
  markerQuestTitle: string;
  markerQuestDialogue: string;
  markerQuestImage: string;
  markerShopImage: string;
  markerShopBackground: string;
  markerSceneBackground: string;
  markerNpcImage: string;
  markerInteractionRadius: string;
  markerRewardXp: string;
  markerRewardGold: string;
  markerRewardItemId: string | null;
  markerRewardQuantity: string;
  markerRewardFullHeal: boolean;
  markerRewardTiming: MapMarker["reward_timing"];
  markerRepeatable: boolean;
  markerRewardOnce: boolean;
  selectedSeason: number;
  selectedChapter: number;
};

export function buildMarkerSettingsPayload(state: MarkerPayloadState, mode: "create" | "update") {
  const isExit = isExitType(state.draftType);
  const isQuest = isQuestType(state.draftType);
  const linkedMiniMapId = getLinkedMiniMapId(state);

  return {
    type: state.draftType,
    title: state.draftTitle.trim() || (mode === "update" ? state.selectedMarker?.title : "") || "Untitled Marker",
    description: state.draftDescription.trim() || null,
    is_interactable: state.markerInteractable,
    quest_title: state.markerQuestTitle.trim() || null,
    quest_dialogue: state.markerQuestDialogue.trim() || null,
    quest_image_url: state.markerQuestImage.trim() || null,
    shop_image_url: state.markerShopImage.trim() || null,
    shop_background_image_url: state.markerShopBackground.trim() || null,
    scene_background_image_url: state.markerSceneBackground.trim() || null,
    scene_npc_image_url: state.markerNpcImage.trim() || null,
    icon_label: state.markerIconLabel.trim() || null,
    icon_image_url: state.markerIconImage.trim() || null,
    icon_color: state.markerIconColor.trim() || null,
    marker_size: Math.max(50, Math.min(220, Number(state.markerSize) || 100)),
    lock_type: state.markerLockType,
    lock_message: state.markerLockMessage.trim() || null,
    story_order: Number(state.markerStoryOrder) || 0,
    unlock_after_marker_id: state.markerUnlockAfterId,
    hide_when_completed: state.markerHideWhenCompleted,
    require_all_linked_routes: state.markerRequireAllLinkedRoutes,
    dialogue_event_id: supportsDialogueType(state.draftType) ? state.markerDialogueEventId : null,
    battle_event_id: isBattleType(state.draftType) ? state.markerBattleEventId ?? null : null,
    enemy_id: isBattleType(state.draftType) ? state.markerEnemyId : null,
    npc_id: isBattleType(state.draftType) ? state.markerNpcId : null,
    interaction_radius_percent: Math.max(0.5, Number(state.markerInteractionRadius) || 4),
    reward_xp: Number(state.markerRewardXp) || 0,
    reward_gold: Number(state.markerRewardGold) || 0,
    reward_item_id: state.markerRewardItemId,
    reward_item_quantity: Math.max(1, Number(state.markerRewardQuantity) || 1),
    reward_full_heal: state.markerRewardFullHeal,
    reward_timing: state.markerRewardTiming,
    repeatable: state.markerRepeatable,
    reward_once_per_player: state.markerRewardOnce,
    linked_mini_map_id: linkedMiniMapId,
    mini_map_id: state.activeMiniMapId ?? (mode === "update" ? state.selectedMarker?.mini_map_id ?? null : null),
    parent_marker_id: state.activeMiniMapId || mode === "create" ? null : state.selectedMarker?.parent_marker_id ?? null,
    exit_target_type: isExit ? state.markerExitTargetType : null,
    exit_target_marker_id: isExit ? state.markerExitTargetMarkerId : null,
    linked_route_id: isQuest ? state.markerLinkedRouteId : null,
    starts_route_on_accept: isQuest && state.markerStartsRouteOnAccept,
    season_number: state.selectedSeason,
    chapter_number: state.selectedChapter,
  };
}

export function buildCreateMarkerInput(state: MarkerPayloadState, point: { x: number; y: number }) {
  const settings = buildMarkerSettingsPayload(state, "create");
  return {
    type: state.draftType,
    title: state.draftTitle.trim(),
    description: state.draftDescription.trim() || null,
    x_percent: point.x,
    y_percent: point.y,
    is_active: true,
    is_unlocked: true,
    route_id: null,
    quest_key: null,
    linked_mini_map_id: settings.linked_mini_map_id,
    mini_map_id: state.activeMiniMapId,
    parent_marker_id: null,
    exit_target_type: settings.exit_target_type,
    exit_target_marker_id: settings.exit_target_marker_id,
    linked_route_id: settings.linked_route_id,
    starts_route_on_accept: settings.starts_route_on_accept,
    icon_label: settings.icon_label,
    icon_image_url: settings.icon_image_url,
    icon_color: settings.icon_color,
    marker_size: settings.marker_size,
    lock_type: settings.lock_type,
    lock_message: settings.lock_message,
    story_order: settings.story_order,
    unlock_after_marker_id: settings.unlock_after_marker_id,
    hide_when_completed: settings.hide_when_completed,
    require_all_linked_routes: settings.require_all_linked_routes,
    dialogue_event_id: settings.dialogue_event_id,
    battle_event_id: settings.battle_event_id,
    enemy_id: settings.enemy_id,
    npc_id: settings.npc_id,
    season_number: state.selectedSeason,
    chapter_number: state.selectedChapter,
  };
}

function getLinkedMiniMapId(state: MarkerPayloadState) {
  if (state.draftType === "Area/Town Entrance") {
    return state.selectedMiniMapId;
  }

  if (isExitType(state.draftType) && state.markerExitTargetType === "mini_map") {
    return state.markerExitTargetMiniMapId;
  }

  return null;
}

function isQuestType(type: string) {
  return ["Quest", "Side Quest", "Story", "Point of Interest"].includes(type);
}

function supportsDialogueType(type: string) {
  return ["Story", "Quest", "Side Quest", "Point of Interest"].includes(type);
}

function isBattleType(type: string) {
  return type === "Battle" || type === "Battle Zone";
}

function isExitType(type: string) {
  return type === "Exit" || type === "Exit/Leave";
}
