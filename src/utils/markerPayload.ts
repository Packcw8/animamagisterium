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
  markerExitTargetSpawnMarkerId: string | null;
  markerLinkedRouteId: string | null;
  markerLinkedRouteStartDirection: MapMarker["linked_route_start_direction"];
  markerStartsRouteOnAccept: boolean;
  markerClearActiveRouteOnUse: boolean;
  markerIconLabel: string;
  markerIconImage: string;
  markerIconColor: string;
  markerSize: string;
  markerLockType: MapMarker["lock_type"];
  markerLockMessage: string;
  markerAccessRule: MapMarker["access_rule"];
  markerRequiredItemId: string | null;
  markerRequiredItemQuantity: string;
  markerAccessHint: string;
  markerVisibleStoryFlagKey: string;
  markerVisibleStoryFlagValue: boolean;
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
  markerJournalTitle: string;
  markerJournalBody: string;
  markerJournalImageUrl: string;
  markerJournalSortOrder: string;
  markerStoryDeckId: string | null;
  markerInteractionRadius: string;
  markerInitiallyUnlocked: boolean;
  markerRewardXp: string;
  markerRewardGold: string;
  markerRewardItemId: string | null;
  markerRewardQuantity: string;
  markerRewardFullHeal: boolean;
  markerRewardTiming: MapMarker["reward_timing"];
  markerRepeatable: boolean;
  markerRewardOnce: boolean;
  markerContentScope: MapMarker["content_scope"];
  selectedSeason: number;
  selectedChapter: number;
};

export function buildMarkerSettingsPayload(state: MarkerPayloadState, mode: "create" | "update") {
  const isExit = isExitType(state.draftType);
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
    journal_title: state.markerJournalTitle.trim() || null,
    journal_body: state.markerJournalBody.trim() || null,
    journal_image_url: state.markerJournalImageUrl.trim() || null,
    journal_sort_order: Number(state.markerJournalSortOrder) || Number(state.markerStoryOrder) || 0,
    story_deck_id: state.markerStoryDeckId,
    icon_label: state.markerIconLabel.trim() || null,
    icon_image_url: state.markerIconImage.trim() || null,
    icon_color: state.markerIconColor.trim() || null,
    marker_size: Math.max(50, Math.min(220, Number(state.markerSize) || 100)),
    lock_type: state.markerLockType,
    lock_message: state.markerLockMessage.trim() || null,
    access_rule: state.markerAccessRule,
    required_item_id: state.markerAccessRule === "item_required" ? state.markerRequiredItemId : null,
    required_item_quantity: Math.max(1, Number(state.markerRequiredItemQuantity) || 1),
    access_hint: state.markerAccessHint.trim() || null,
    visible_story_flag_key: state.markerVisibleStoryFlagKey.trim() || null,
    visible_story_flag_value: state.markerVisibleStoryFlagValue,
    story_order: Number(state.markerStoryOrder) || 0,
    unlock_after_marker_id: state.markerUnlockAfterId,
    hide_when_completed: state.markerHideWhenCompleted,
    require_all_linked_routes: state.markerRequireAllLinkedRoutes,
    dialogue_event_id: supportsDialogueType(state.draftType) ? state.markerDialogueEventId : null,
    battle_event_id: isBattleType(state.draftType) ? state.markerBattleEventId ?? null : null,
    enemy_id: isBattleType(state.draftType) ? state.markerEnemyId : null,
    npc_id: isBattleType(state.draftType) ? state.markerNpcId : null,
    interaction_radius_percent: Math.max(0.5, Number(state.markerInteractionRadius) || 4),
    is_unlocked: state.markerInitiallyUnlocked,
    reward_xp: Number(state.markerRewardXp) || 0,
    reward_gold: Number(state.markerRewardGold) || 0,
    reward_item_id: state.markerRewardItemId,
    reward_item_quantity: Math.max(1, Number(state.markerRewardQuantity) || 1),
    reward_full_heal: state.markerRewardFullHeal,
    reward_timing: state.markerRewardTiming,
    repeatable: state.markerRepeatable,
    reward_once_per_player: state.markerRewardOnce,
    content_scope: state.markerContentScope,
    linked_mini_map_id: linkedMiniMapId,
    mini_map_id: state.activeMiniMapId ?? (mode === "update" ? state.selectedMarker?.mini_map_id ?? null : null),
    parent_marker_id: state.activeMiniMapId || mode === "create" ? null : state.selectedMarker?.parent_marker_id ?? null,
    exit_target_type: isExit ? state.markerExitTargetType : null,
    exit_target_marker_id: isExit ? state.markerExitTargetMarkerId : null,
    exit_target_spawn_marker_id: (isExit && state.markerExitTargetType === "mini_map") || state.draftType === "Area/Town Entrance" ? state.markerExitTargetSpawnMarkerId : null,
    linked_route_id: supportsLinkedRoute(state.draftType) ? state.markerLinkedRouteId : null,
    linked_route_start_direction: supportsLinkedRoute(state.draftType) ? state.markerLinkedRouteStartDirection ?? "forward" : "forward",
    starts_route_on_accept: supportsLinkedRoute(state.draftType) && state.markerStartsRouteOnAccept,
    clear_active_route_on_use: state.markerClearActiveRouteOnUse,
    season_number: state.markerContentScope === "universal" ? 1 : state.selectedSeason,
    chapter_number: state.markerContentScope === "universal" ? 1 : state.selectedChapter,
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
    is_unlocked: state.markerInitiallyUnlocked,
    route_id: null,
    quest_key: null,
    linked_mini_map_id: settings.linked_mini_map_id,
    mini_map_id: state.activeMiniMapId,
    parent_marker_id: null,
    exit_target_type: settings.exit_target_type,
    exit_target_marker_id: settings.exit_target_marker_id,
    exit_target_spawn_marker_id: settings.exit_target_spawn_marker_id,
    linked_route_id: settings.linked_route_id,
    linked_route_start_direction: settings.linked_route_start_direction,
    starts_route_on_accept: settings.starts_route_on_accept,
    clear_active_route_on_use: settings.clear_active_route_on_use,
    icon_label: settings.icon_label,
    icon_image_url: settings.icon_image_url,
    icon_color: settings.icon_color,
    marker_size: settings.marker_size,
    lock_type: settings.lock_type,
    lock_message: settings.lock_message,
    access_rule: settings.access_rule,
    required_item_id: settings.required_item_id,
    required_item_quantity: settings.required_item_quantity,
    access_hint: settings.access_hint,
    visible_story_flag_key: settings.visible_story_flag_key,
    visible_story_flag_value: settings.visible_story_flag_value,
    story_order: settings.story_order,
    unlock_after_marker_id: settings.unlock_after_marker_id,
    hide_when_completed: settings.hide_when_completed,
    require_all_linked_routes: settings.require_all_linked_routes,
    dialogue_event_id: settings.dialogue_event_id,
    battle_event_id: settings.battle_event_id,
    enemy_id: settings.enemy_id,
    npc_id: settings.npc_id,
    journal_title: settings.journal_title,
    journal_body: settings.journal_body,
    journal_image_url: settings.journal_image_url,
    journal_sort_order: settings.journal_sort_order,
    story_deck_id: settings.story_deck_id,
    content_scope: settings.content_scope,
    season_number: settings.season_number,
    chapter_number: settings.chapter_number,
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
  return ["Quest", "Side Quest", "Story", "Point of Interest", "NPC"].includes(type);
}

function supportsLinkedRoute(type: string) {
  return isQuestType(type) || type === "Area/Town Entrance" || isExitType(type);
}

function supportsDialogueType(type: string) {
  return ["Story", "Quest", "Side Quest", "Point of Interest", "NPC"].includes(type);
}

function isBattleType(type: string) {
  return type === "Battle" || type === "Battle Zone" || type === "NPC";
}

function isExitType(type: string) {
  return type === "Exit" || type === "Exit/Leave";
}
