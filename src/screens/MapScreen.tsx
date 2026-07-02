import { distance as turfDistance } from "@turf/turf";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AdminImageUploadButton } from "../components/admin/AdminImageUploadButton";
import { AdminCollapsibleSection } from "../components/admin/AdminCollapsibleSection";
import { ActiveBattleView } from "../components/battle/ActiveBattleView";
import { BattlefieldLayoutEditor } from "../components/battle/BattlefieldLayoutEditor";
import { useBattleEncounter } from "../components/battle/useBattleEncounter";
import { BrandLogo } from "../components/BrandLogo";
import { DialogueCheckEditor } from "../components/dialogue/DialogueCheckEditor";
import { DialogueChoiceEditor } from "../components/dialogue/DialogueChoiceEditor";
import { DialogueChoiceEffectEditor } from "../components/dialogue/DialogueChoiceEffectEditor";
import { DialogueChoiceRequirementEditor } from "../components/dialogue/DialogueChoiceRequirementEditor";
import { DialogueNodeEditor } from "../components/dialogue/DialogueNodeEditor";
import { DialogueSceneScreen } from "../components/dialogue/DialogueSceneScreen";
import { DialogueTreeAdmin } from "../components/dialogue/DialogueTreeAdmin";
import { Frame } from "../components/Frame";
import { AdminCoordinatePanel } from "../components/map/AdminCoordinatePanel";
import { AdminMapEditorHeader } from "../components/map/AdminMapEditorHeader";
import { MiniMapCanvas, OverworldMapCanvas, type MapViewportRef, type PinchZoomPayload, type RouteEventPin } from "../components/map/MapCanvas";
import { MarkerIcon } from "../components/map/MarkerIcon";
import { MarkerInteractionPanel } from "../components/map/MarkerInteractionPanel";
import { MarkerContinuationRouteEditor } from "../components/map/MarkerContinuationRouteEditor";
import { LegendEditor } from "../components/map/LegendEditor";
import { MarkerAdminList } from "../components/map/MarkerAdminList";
import { GameToast, type GameToastData, type GameToastReward } from "../components/map/GameToast";
import { MarkerLegend } from "../components/map/MarkerLegend";
import { MarkerPathRequirementEditor } from "../components/map/MarkerPathRequirementEditor";
import { MarkerSceneScreen } from "../components/map/MarkerSceneScreen";
import { MarkerStyleEditor } from "../components/map/MarkerStyleEditor";
import { MarkerStoryFlagVisibilityEditor } from "../components/map/MarkerStoryFlagVisibilityEditor";
import { MarkerTypeSelector } from "../components/map/MarkerTypeSelector";
import { WorldMapSettingsPanel } from "../components/map/WorldMapSettingsPanel";
import {
  EnemyPicker,
  EventPicker,
  ExitTargetEditor,
  formatMarketListingMode,
  getEnemyName,
  getItemName,
  getNpcName,
  getRouteName,
  ItemPicker,
  LockPicker,
  MarketListingModePicker,
  MarkerPicker,
  MiniMapPicker,
  NpcPicker,
  RewardTimingPicker,
  RoutePicker,
} from "../components/map/MarkerEditorControls";
import { MiniMapEditor } from "../components/map/MiniMapEditor";
import { WalkingPathAdminPanel } from "../components/map/WalkingPathAdminPanel";
import { ProgressBar } from "../components/ProgressBar";
import { CharacterAbilitiesSheet } from "../components/player/CharacterAbilitiesSheet";
import { CharacterInventorySheet } from "../components/player/CharacterInventorySheet";
import type { PlayerAbilityTab } from "../components/home/PlayerAbilitiesPanel";
import type { PlayerInventoryTab } from "../components/home/PlayerInventoryPanel";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { CharacterWithDetails, getCharacter, incrementCharacterDistanceWalked, spendCharacterGold, updateCharacter } from "../services/characterService";
import { AbilityDefinition, canUseAbilityInContext, clampHealth, equipAbility, getCharacterResources, getCombatLoadout, getCurrentHealth, learnAbilityFromScroll } from "../services/abilityService";
import { CombatAbility, EnemyDefinition, getEnemies, getNpcs, NpcDefinition } from "../services/combatAdminService";
import { BattleEventCombatant, MarkerBattleCombatant, deleteBattleEventCombatant, deleteMarkerBattleCombatant, getBattleEventCombatants, getMarkerBattleCombatants, saveBattleEventCombatant, saveMarkerBattleCombatant } from "../services/battlefieldService";
import { canUseItemInContext, consumeInventoryItem, equipInventoryItem, EquipmentSlot, getInventoryResourceBonuses, getInventoryState, grantItemToCharacter, InventoryItem, ItemDefinition, unequipInventorySlot } from "../services/inventoryService";
import { isNativePedometerAvailable, requestPedometerPermission, startPedometerDistancePolling, type PedometerSubscription } from "../services/nativePedometerService";
import { recordSocialContribution } from "../services/partyGuildService";
import { recordEnemyKill } from "../services/progressionService";
import { requestPushNotificationPermission, scheduleLocalNotification } from "../services/pushNotificationService";
import { classifyMovement, metersPerSecondToMph, movementSpeedThresholdMph } from "../utils/combatMath";
import { getMarkerAvailability } from "../utils/markerAvailability";
import { clamp, getPathSegmentMetaAtProgress, getPointOnRoute, getRouteSegments, MAP_SIZE as mapSize, normalizePathSegments, roundPercent, type PathSegmentMeta } from "../utils/mapGeometry";
import { evaluateDialogueChoiceRequirement, eventTriggerModeName, eventTypeName, formatResourceName, rollDialogueAttributeCheck } from "../utils/dialogueFlow";
import { buildCreateMarkerInput, buildMarkerSettingsPayload, type MarkerPayloadState } from "../utils/markerPayload";
import {
  canPlayerSeeStoryMarker,
  getOrderedMarkerRouteLinks,
  isExitMarker,
  isExitMarkerType,
  isMarkerLocked,
  isStoryQuestMarker,
} from "../utils/mapVisibility";
import {
  compareRoutes,
  getAvailableNumbers,
  getChapterLabel,
  getNextChoiceOrder,
  getNextDialogueNodeOrder,
  getNextRouteOrder,
  getRouteLockMessage,
  getSeasonLabel,
  isInSelectedChapter,
  isRouteLocked,
  mergeChapterRecords,
  mergeSeasonRecords,
  upsertRouteProgressRow,
} from "../utils/mapProgress";
import {
  completeMapEvent,
  completeStoryMarker,
  applyDialogueChoiceRewards,
  applyRewards,
  buyMarketItem,
  clearCurrentRoute,
  clearPlayerMapState,
  canMarketItemBeSoldTo,
  createDialogueChoice,
  createDialogueNode,
  createMapRoute,
  createMapEvent,
  createMapMarker,
  deleteMarkerMarketItem,
  deleteMiniMap,
  deleteDialogueChoice,
  deleteDialogueNode,
  deleteMarkerLegendItem,
  deleteMapEvent,
  deleteMapMarker,
  deleteMapRoute,
  deleteTutorialStep,
  fallbackRoute,
  getCurrentRole,
  getMapMarkers,
  getMapRoutes,
  getMapChapters,
  getMapSeasons,
  getMapEvents,
  getMarkerMarketItems,
  getPlayerMarketPurchaseCounts,
  getPlayerStoryFlags,
  getPlayerTutorialCompletions,
  getPlayerMapState,
  getPlayerMarkerUnlocks,
  getPlayerDialogueChoiceHistory,
  getWorldMapSettings,
  getMarkerLegendItems,
  getMarkerRouteLinks,
  hasClaimedDialogueChoiceEffect,
  getAllMarkerRouteLinks,
  getMiniMaps,
  getTutorialSteps,
  getDialogueChoices,
  getDialogueChoiceRewards,
  getClaimedDialogueRewardChoiceIds,
  getDialogueNodes,
  getDialogueNodesForMarker,
  getEventCompletions,
  getStoryMarkerCompletions,
  getStoryMarkerStarts,
  getRouteProgress,
  getRouteProgressForRoutes,
  MapMarker,
  MapEvent,
  MapRoute,
  MapChapter,
  MapSeason,
  MarkerMarketItem,
  MarkerLegendItem,
  MarkerRouteLink,
  MiniMap,
  Role,
  RouteProgress,
  WorldMapSetting,
  StoryDialogueChoice,
  DialogueChoiceReward,
  StoryDialogueNode,
  saveMarkerMarketItem,
  saveMarkerLegendItem,
  saveMarkerRouteLinks,
  saveMiniMap,
  saveMapChapter,
  saveMapSeason,
  savePlayerMapState,
  saveRouteProgress,
  saveWorldMapSetting,
  saveTutorialStep,
  setPlayerStoryFlag,
  startStoryMarker,
  recordDialogueChoiceEffectClaim,
  recordPlayerDialogueChoice,
  recordPlayerAttributeCheck,
  setCurrentRoute,
  sellMarketInventoryItem,
  TutorialStep,
  updateDialogueChoice,
  updateDialogueNode,
  updateMapEvent,
  updateMapMarker,
  updateMarkerSettings,
  updateMapRoute,
  unlockPlayerMarker,
} from "../services/mapService";

const forgottenMarches = require("../../assets/TheForgottenMarches.png");
const markerTypes = ["World Spawn", "Story", "Side Quest", "NPC", "Market", "Point of Interest", "Battle Zone", "Training Spot", "Area/Town Entrance", "Sign Post"];
const miniMapMarkerTypes = ["Player Spawn", "Sign Post", "Story", "Quest", "Side Quest", "NPC", "Point of Interest", "Market", "Battle", "Training", "Dungeon Room", "Exit", "Exit/Leave"];
const legendMarkerTypes = Array.from(new Set([...markerTypes, ...miniMapMarkerTypes, "Custom"]));
const editorModes = ["Marker", "Walking Path"] as const;
const adminSections = ["World Map", "World Markers", "Area/Town Markers", "Mini Maps", "Walking Paths", "Tutorials", "Rewards/Interactions", "Legend"] as const;
const miniMapTypes = ["town", "forest", "dungeon", "area", "tutorial"] as const;
const eventTypes = ["dialogue", "battle", "clue", "reward"] as const;
const eventTriggerModes = ["fixed", "random"] as const;
const lockTypes = ["public", "story_locked", "quest_locked"] as const;
const rewardTimings = ["on_interact", "on_path_complete"] as const;
const choiceActions = ["Continue", "Investigate", "Ask Questions", "Start Battle", "Complete Event"] as const;
const dialogueRequirementTypes = ["none", "gold", "item", "story_flag", "completed_marker", "completed_event", "tutorial_step", "ability_known", "attribute_level"] as const;
const dialogueRequirementOperators = [">=", ">", "=", "<=", "<"] as const;
const attributeRequirementKeys = ["strength", "endurance", "agility", "intelligence", "wisdom", "charisma", "spirit"] as const;
const dialogueCheckAttributes = attributeRequirementKeys;
const eventTypeLabels: Record<(typeof eventTypes)[number], string> = {
  dialogue: "Dialogue Event",
  battle: "Battle Event",
  clue: "Clue / Investigation Event",
  reward: "Reward Event",
};
const eventTriggerModeLabels: Record<(typeof eventTriggerModes)[number], string> = {
  fixed: "Fixed Percent",
  random: "Random Encounter",
};
const movementStateDebounceMs = 5000;

type MapScreenProps = {
  character: CharacterWithDetails;
  onCharacterUpdated: (character: CharacterWithDetails) => void;
};

type Coordinate = {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number | null;
};

type MovementStatus = {
  label: string;
  speedMph: number;
  countedMeters: number;
  blockedReason: string | null;
};

type PlayerMovementState = "IDLE" | "MOVING";

function sortMiniMaps(items: MiniMap[]) {
  return [...items].sort((left, right) => {
    const leftArea = (left.area_name || left.type || "").toLowerCase();
    const rightArea = (right.area_name || right.type || "").toLowerCase();
    return (
      Number(left.season_number ?? 1) - Number(right.season_number ?? 1) ||
      Number(left.chapter_number ?? 1) - Number(right.chapter_number ?? 1) ||
      leftArea.localeCompare(rightArea) ||
      Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0) ||
      left.name.localeCompare(right.name)
    );
  });
}

export function MapScreen({ character, onCharacterUpdated }: MapScreenProps) {
  const [mapReady, setMapReady] = useState(false);
  const [route, setRoute] = useState<MapRoute>(fallbackRoute);
  const [hasActiveRoute, setHasActiveRoute] = useState(false);
  const [routes, setRoutes] = useState<MapRoute[]>([fallbackRoute]);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [legendItems, setLegendItems] = useState<MarkerLegendItem[]>([]);
  const [legendOpen, setLegendOpen] = useState(false);
  const [mapEvents, setMapEvents] = useState<MapEvent[]>([]);
  const [allMapEvents, setAllMapEvents] = useState<MapEvent[]>([]);
  const [markerDialogueIds, setMarkerDialogueIds] = useState<Set<string>>(new Set());
  const [completedEventIds, setCompletedEventIds] = useState<Set<string>>(new Set());
  const [completedStoryMarkerIds, setCompletedStoryMarkerIds] = useState<Set<string>>(new Set());
  const [startedStoryMarkerIds, setStartedStoryMarkerIds] = useState<Set<string>>(new Set());
  const [completedTutorialStepIds, setCompletedTutorialStepIds] = useState<Set<string>>(new Set());
  const [storyFlags, setStoryFlags] = useState<Map<string, boolean>>(new Map());
  const [activeEvent, setActiveEvent] = useState<MapEvent | null>(null);
  const [activeMarkerEventId, setActiveMarkerEventId] = useState<string | null>(null);
  const [adminPreviewMode, setAdminPreviewMode] = useState<"story" | "battle" | null>(null);
  const [dialogueNodes, setDialogueNodes] = useState<StoryDialogueNode[]>([]);
  const [dialogueChoices, setDialogueChoices] = useState<StoryDialogueChoice[]>([]);
  const [dialogueChoiceRewards, setDialogueChoiceRewards] = useState<DialogueChoiceReward[]>([]);
  const [claimedChoiceRewardIds, setClaimedChoiceRewardIds] = useState<Set<string>>(new Set());
  const [selectedDialogueChoiceIds, setSelectedDialogueChoiceIds] = useState<Set<string>>(new Set());
  const [pendingRewardChoice, setPendingRewardChoice] = useState<StoryDialogueChoice | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [dialogueLog, setDialogueLog] = useState<string[]>([]);
  const {
    activeBattle,
    setActiveBattle,
    battlePlayerHp,
    battleStamina,
    battleMagicka,
    battleEnemyHp,
    battleEnemyStamina,
    battleEnemyMagika,
    battleOpponents,
    battleCompanions,
    battleLayoutCombatants,
    selectedOpponentKey,
    battleLog,
    setBattleLog,
    battleFinished,
    battleTurnPhase,
    openingEnemyTurnQueued,
    revivePromptOpen,
    activeEnemy,
    setActiveEnemy,
    combatIndicators,
    combatResources,
    setCombatResources,
    equippedAbilities,
    setEquippedAbilities,
    battleInventoryOpen,
    setBattleInventoryOpen,
    resetBattleState,
    startBattle: startBattleEncounter,
    selectBattleTarget,
    savePlayerHealth,
    handleBattleAction: runBattleAction,
    handleWeaponAction: runWeaponAction,
    resolveOpeningEnemyTurn: runOpeningEnemyTurn,
    fleeBattle: runFleeBattle,
    declineReviveAfterDefeat: runDeclineReviveAfterDefeat,
    useBattleItem: runUseBattleItem,
  } = useBattleEncounter(character, onCharacterUpdated);
  const [enemyDefinitions, setEnemyDefinitions] = useState<EnemyDefinition[]>([]);
  const [npcDefinitions, setNpcDefinitions] = useState<NpcDefinition[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [itemDefinitions, setItemDefinitions] = useState<ItemDefinition[]>([]);
  const [equippedItems, setEquippedItems] = useState<Record<string, ItemDefinition | null>>({});
  const [knownAbilities, setKnownAbilities] = useState<AbilityDefinition[]>([]);
  const [totalInventoryWeight, setTotalInventoryWeight] = useState(0);
  const [carryCapacity, setCarryCapacity] = useState(50);
  const [activeMapSheet, setActiveMapSheet] = useState<"inventory" | "abilities" | null>(null);
  const [mapInventoryTab, setMapInventoryTab] = useState<PlayerInventoryTab>("Consumables");
  const [selectedMapInventoryItemId, setSelectedMapInventoryItemId] = useState<string | null>(null);
  const [mapAbilityTab, setMapAbilityTab] = useState<PlayerAbilityTab>("Attack");
  const [selectedMapAbility, setSelectedMapAbility] = useState<AbilityDefinition | null>(null);
  const [selectedMapAbilityKey, setSelectedMapAbilityKey] = useState<string | null>(null);
  const [mapItemMessage, setMapItemMessage] = useState<string | null>(null);
  const [gameToast, setGameToast] = useState<GameToastData | null>(null);
  const [role, setRole] = useState<Role>("player");
  const [adminMapViewMode, setAdminMapViewMode] = useState<"admin" | "player">("admin");
  const currentHealth = getCurrentHealth(character, combatResources);
  const [distanceWalked, setDistanceWalked] = useState(0);
  const [savedPlayerPosition, setSavedPlayerPosition] = useState<{ x: number; y: number } | null>(null);
  const [savedMiniMapPosition, setSavedMiniMapPosition] = useState<{ x: number; y: number } | null>(null);
  const [lastPosition, setLastPosition] = useState<Coordinate | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [gpsMessage, setGpsMessage] = useState(Platform.OS === "web" ? "GPS is off. Start tracking to count real-world walking distance." : "Pedometer is off. Start tracking to count steps toward your path.");
  const [playerMovementState, setPlayerMovementState] = useState<PlayerMovementState>("IDLE");
  const [movementStatus, setMovementStatus] = useState<MovementStatus>({
    label: "IDLE",
    speedMph: 0,
    countedMeters: 0,
    blockedReason: null,
  });
  const [routeProgressRows, setRouteProgressRows] = useState<RouteProgress[]>([]);
  const [allMarkerRouteLinks, setAllMarkerRouteLinks] = useState<MarkerRouteLink[]>([]);
  const [routeDirection, setRouteDirection] = useState<"forward" | "reverse">("forward");
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [activeMiniMap, setActiveMiniMap] = useState<MiniMap | null>(null);
  const [clickedPercent, setClickedPercent] = useState<{ x: number; y: number } | null>(null);
  const [adminSection, setAdminSection] = useState<(typeof adminSections)[number]>("World Markers");
  const [seasonPanelOpen, setSeasonPanelOpen] = useState(false);
  const [openAdminPanels, setOpenAdminPanels] = useState<Record<string, boolean>>({
    list: true,
    coordinates: true,
    editor: true,
    settings: true,
    rewards: true,
  });
  const [miniMaps, setMiniMaps] = useState<MiniMap[]>([]);
  const [mapSeasons, setMapSeasons] = useState<MapSeason[]>([]);
  const [mapChapters, setMapChapters] = useState<MapChapter[]>([]);
  const [worldMapSettings, setWorldMapSettings] = useState<WorldMapSetting[]>([]);
  const [worldMapName, setWorldMapName] = useState("The Forgotten Marches");
  const [worldMapDraftImage, setWorldMapDraftImage] = useState("");
  const [worldMapNotes, setWorldMapNotes] = useState("");
  const [worldMapAspectRatio, setWorldMapAspectRatio] = useState("current");
  const [worldMapWidth, setWorldMapWidth] = useState("1800");
  const [worldMapHeight, setWorldMapHeight] = useState("1400");
  const [worldMapActive, setWorldMapActive] = useState(true);
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newSeasonDescription, setNewSeasonDescription] = useState("");
  const [newChapterName, setNewChapterName] = useState("");
  const [newChapterDescription, setNewChapterDescription] = useState("");
  const [selectedMiniMapId, setSelectedMiniMapId] = useState<string | null>(null);
  const [editingMiniMapId, setEditingMiniMapId] = useState<string | null>(null);
  const [miniMapName, setMiniMapName] = useState("");
  const [miniMapType, setMiniMapType] = useState<(typeof miniMapTypes)[number]>("area");
  const [miniMapBackground, setMiniMapBackground] = useState("");
  const [miniMapDescription, setMiniMapDescription] = useState("");
  const [miniMapAreaName, setMiniMapAreaName] = useState("");
  const [miniMapAreaKey, setMiniMapAreaKey] = useState("");
  const [miniMapSortOrder, setMiniMapSortOrder] = useState("0");
  const [miniMapActive, setMiniMapActive] = useState(true);
  const [miniMapEditorWidth, setMiniMapEditorWidth] = useState("900");
  const [miniMapEditorHeight, setMiniMapEditorHeight] = useState("650");
  const [selectedMiniMapAreaKey, setSelectedMiniMapAreaKey] = useState("all");
  const [tutorialSteps, setTutorialSteps] = useState<TutorialStep[]>([]);
  const [editingTutorialId, setEditingTutorialId] = useState<string | null>(null);
  const [tutorialTitle, setTutorialTitle] = useState("");
  const [tutorialDescription, setTutorialDescription] = useState("");
  const [tutorialImage, setTutorialImage] = useState("");
  const [tutorialMarkerId, setTutorialMarkerId] = useState<string | null>(null);
  const [tutorialMiniMapId, setTutorialMiniMapId] = useState<string | null>(null);
  const [tutorialRouteId, setTutorialRouteId] = useState<string | null>(null);
  const [tutorialRewardXp, setTutorialRewardXp] = useState("0");
  const [tutorialRewardGold, setTutorialRewardGold] = useState("0");
  const [tutorialRewardItemId, setTutorialRewardItemId] = useState<string | null>(null);
  const [tutorialRewardQuantity, setTutorialRewardQuantity] = useState("1");
  const [tutorialSortOrder, setTutorialSortOrder] = useState("0");
  const [tutorialActive, setTutorialActive] = useState(true);
  const [draftType, setDraftType] = useState(markerTypes[0]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [markerQuestTitle, setMarkerQuestTitle] = useState("");
  const [markerQuestDialogue, setMarkerQuestDialogue] = useState("");
  const [markerQuestImage, setMarkerQuestImage] = useState("");
  const [markerShopImage, setMarkerShopImage] = useState("");
  const [markerShopBackground, setMarkerShopBackground] = useState("");
  const [markerSceneBackground, setMarkerSceneBackground] = useState("");
  const [markerNpcImage, setMarkerNpcImage] = useState("");
  const [markerIconLabel, setMarkerIconLabel] = useState("");
  const [markerIconImage, setMarkerIconImage] = useState("");
  const [markerIconColor, setMarkerIconColor] = useState("");
  const [markerSize, setMarkerSize] = useState("100");
  const [markerInteractionRadius, setMarkerInteractionRadius] = useState("4");
  const [markerInteractable, setMarkerInteractable] = useState(true);
  const [markerInitiallyUnlocked, setMarkerInitiallyUnlocked] = useState(true);
  const [markerRewardXp, setMarkerRewardXp] = useState("0");
  const [markerRewardGold, setMarkerRewardGold] = useState("0");
  const [markerRewardItemId, setMarkerRewardItemId] = useState<string | null>(null);
  const [markerRewardQuantity, setMarkerRewardQuantity] = useState("1");
  const [markerRewardFullHeal, setMarkerRewardFullHeal] = useState(false);
  const [markerRewardTiming, setMarkerRewardTiming] = useState<MapMarker["reward_timing"]>("on_interact");
  const [markerRepeatable, setMarkerRepeatable] = useState(false);
  const [markerRewardOnce, setMarkerRewardOnce] = useState(true);
  const [markerLinkedRouteId, setMarkerLinkedRouteId] = useState<string | null>(null);
  const [markerLinkedRouteStartDirection, setMarkerLinkedRouteStartDirection] = useState<MapMarker["linked_route_start_direction"]>("forward");
  const [markerStartsRouteOnAccept, setMarkerStartsRouteOnAccept] = useState(false);
  const [markerExitTargetType, setMarkerExitTargetType] = useState<MapMarker["exit_target_type"]>("world_marker");
  const [markerExitTargetMarkerId, setMarkerExitTargetMarkerId] = useState<string | null>(null);
  const [markerExitTargetMiniMapId, setMarkerExitTargetMiniMapId] = useState<string | null>(null);
  const [markerExitTargetSpawnMarkerId, setMarkerExitTargetSpawnMarkerId] = useState<string | null>(null);
  const [markerLockType, setMarkerLockType] = useState<MapMarker["lock_type"]>("public");
  const [markerLockMessage, setMarkerLockMessage] = useState("");
  const [markerVisibleStoryFlagKey, setMarkerVisibleStoryFlagKey] = useState("");
  const [markerVisibleStoryFlagValue, setMarkerVisibleStoryFlagValue] = useState(true);
  const [markerStoryOrder, setMarkerStoryOrder] = useState("0");
  const [markerUnlockAfterId, setMarkerUnlockAfterId] = useState<string | null>(null);
  const [markerHideWhenCompleted, setMarkerHideWhenCompleted] = useState(true);
  const [markerRequireAllLinkedRoutes, setMarkerRequireAllLinkedRoutes] = useState(true);
  const [markerRouteCompletionCondition, setMarkerRouteCompletionCondition] = useState<MarkerRouteLink["completion_condition"]>("either");
  const [markerDialogueEventId, setMarkerDialogueEventId] = useState<string | null>(null);
  const [markerBattleEventId, setMarkerBattleEventId] = useState<string | null>(null);
  const [markerEnemyId, setMarkerEnemyId] = useState<string | null>(null);
  const [markerNpcId, setMarkerNpcId] = useState<string | null>(null);
  const [markerMarketItems, setMarkerMarketItems] = useState<MarkerMarketItem[]>([]);
  const [marketPurchaseCounts, setMarketPurchaseCounts] = useState<Record<string, number>>({});
  const [markerRouteLinks, setMarkerRouteLinks] = useState<MarkerRouteLink[]>([]);
  const [selectedMarkerRouteIds, setSelectedMarkerRouteIds] = useState<string[]>([]);
  const [selectedMarkerRouteDirections, setSelectedMarkerRouteDirections] = useState<Record<string, MarkerRouteLink["start_direction"]>>({});
  const [marketItemId, setMarketItemId] = useState<string | null>(null);
  const [marketBuyPrice, setMarketBuyPrice] = useState("0");
  const [marketSellPrice, setMarketSellPrice] = useState("0");
  const [marketStock, setMarketStock] = useState("0");
  const [marketUnlimited, setMarketUnlimited] = useState(true);
  const [marketListingMode, setMarketListingMode] = useState<MarkerMarketItem["listing_mode"]>("buy_and_sell");
  const [markerPanelMessage, setMarkerPanelMessage] = useState<string | null>(null);
  const [editingLegendItemId, setEditingLegendItemId] = useState<string | null>(null);
  const [legendMarkerType, setLegendMarkerType] = useState("Market");
  const [legendTitle, setLegendTitle] = useState("");
  const [legendDescription, setLegendDescription] = useState("");
  const [legendIconLabel, setLegendIconLabel] = useState("");
  const [legendIconImage, setLegendIconImage] = useState("");
  const [legendIconColor, setLegendIconColor] = useState("");
  const [legendSortOrder, setLegendSortOrder] = useState("0");
  const [legendActive, setLegendActive] = useState(true);
  const [previewMarkerScene, setPreviewMarkerScene] = useState(false);
  const [editorMode, setEditorMode] = useState<(typeof editorModes)[number]>("Marker");
  const [pathDraft, setPathDraft] = useState<Array<{ x: number; y: number }>>([]);
  const [pathSegmentDraft, setPathSegmentDraft] = useState<PathSegmentMeta[]>([]);
  const [routeName, setRouteName] = useState("");
  const [routeOrder, setRouteOrder] = useState("1");
  const [routeTerrain, setRouteTerrain] = useState("");
  const [routeDanger, setRouteDanger] = useState("");
  const [routeDistance, setRouteDistance] = useState("");
  const [routeImage, setRouteImage] = useState("");
  const [routeLockType, setRouteLockType] = useState<MapRoute["lock_type"]>("public");
  const [routeLockMessage, setRouteLockMessage] = useState("");
  const [editingEvent, setEditingEvent] = useState<MapEvent | null>(null);
  const [eventType, setEventType] = useState<(typeof eventTypes)[number]>("dialogue");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDistance, setEventDistance] = useState("25");
  const [eventTriggerMode, setEventTriggerMode] = useState<(typeof eventTriggerModes)[number]>("fixed");
  const [eventRandomChance, setEventRandomChance] = useState("10");
  const [eventBackgroundImage, setEventBackgroundImage] = useState("");
  const [eventNpcName, setEventNpcName] = useState("");
  const [eventNpcPortrait, setEventNpcPortrait] = useState("");
  const [eventDialogueNpcId, setEventDialogueNpcId] = useState<string | null>(null);
  const [eventDialogue, setEventDialogue] = useState("");
  const [eventChoices, setEventChoices] = useState("Continue|Continue\nInvestigate|Investigate\nStart Battle|Start Battle");
  const [enemyName, setEnemyName] = useState("");
  const [enemyImage, setEnemyImage] = useState("");
  const [enemyHp, setEnemyHp] = useState("30");
  const [enemyAttack, setEnemyAttack] = useState("5");
  const [eventEnemyId, setEventEnemyId] = useState<string | null>(null);
  const [eventNpcId, setEventNpcId] = useState<string | null>(null);
  const [battleIntro, setBattleIntro] = useState("");
  const [victoryText, setVictoryText] = useState("");
  const [defeatText, setDefeatText] = useState("");
  const [rewardXp, setRewardXp] = useState("0");
  const [rewardGold, setRewardGold] = useState("0");
  const [rewardItem, setRewardItem] = useState("");
  const [rewardItemId, setRewardItemId] = useState<string | null>(null);
  const [rewardItemQuantity, setRewardItemQuantity] = useState("1");
  const [battlefieldCombatants, setBattlefieldCombatants] = useState<Array<BattleEventCombatant | MarkerBattleCombatant>>([]);
  const [reuseEventId, setReuseEventId] = useState<string | null>(null);
  const [reuseEventOpen, setReuseEventOpen] = useState(false);
  const [selectedDialogueEventId, setSelectedDialogueEventId] = useState<string | null>(null);
  const [selectedDialogueMarkerId, setSelectedDialogueMarkerId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<StoryDialogueNode | null>(null);
  const [editingChoice, setEditingChoice] = useState<StoryDialogueChoice | null>(null);
  const [nodeTitle, setNodeTitle] = useState("");
  const [nodeKey, setNodeKey] = useState("");
  const [nodeNpcName, setNodeNpcName] = useState("");
  const [nodeNpcId, setNodeNpcId] = useState<string | null>(null);
  const [nodeNpcPortrait, setNodeNpcPortrait] = useState("");
  const [nodeBackgroundImage, setNodeBackgroundImage] = useState("");
  const [nodeDialogue, setNodeDialogue] = useState("");
  const [nodeSortOrder, setNodeSortOrder] = useState("0");
  const [nodeIsStart, setNodeIsStart] = useState(false);
  const [nodeIsEnding, setNodeIsEnding] = useState(false);
  const [nodeAllowEndChat, setNodeAllowEndChat] = useState(true);
  const [nodeEndCompletesEvent, setNodeEndCompletesEvent] = useState(false);
  const [choiceNodeId, setChoiceNodeId] = useState<string | null>(null);
  const [choiceButtonText, setChoiceButtonText] = useState("");
  const [choicePlayerText, setChoicePlayerText] = useState("");
  const [choiceAction, setChoiceAction] = useState<StoryDialogueChoice["action"]>("go_to_node");
  const [choiceNextNodeId, setChoiceNextNodeId] = useState<string | null>(null);
  const [choiceBattleEventId, setChoiceBattleEventId] = useState<string | null>(null);
  const [choiceBattleTitle, setChoiceBattleTitle] = useState("");
  const [choiceRewardXp, setChoiceRewardXp] = useState("0");
  const [choiceRewardGold, setChoiceRewardGold] = useState("0");
  const [choiceRewardItem, setChoiceRewardItem] = useState("");
  const [choiceRewardItemId, setChoiceRewardItemId] = useState<string | null>(null);
  const [choiceRewardItemQuantity, setChoiceRewardItemQuantity] = useState("1");
  const [choiceUnlockMarkerId, setChoiceUnlockMarkerId] = useState<string | null>(null);
  const [choiceUpdateTitle, setChoiceUpdateTitle] = useState("");
  const [choiceUpdateBody, setChoiceUpdateBody] = useState("");
  const [choiceRestoreHealth, setChoiceRestoreHealth] = useState(false);
  const [choiceRestoreStamina, setChoiceRestoreStamina] = useState(false);
  const [choiceRestoreMana, setChoiceRestoreMana] = useState(false);
  const [choiceGroupKey, setChoiceGroupKey] = useState("");
  const [choiceGroupLockMessage, setChoiceGroupLockMessage] = useState("");
  const [choiceHideWhenGroupLocked, setChoiceHideWhenGroupLocked] = useState(false);
  const [choiceStoryFlagKey, setChoiceStoryFlagKey] = useState("");
  const [choiceStoryFlagValue, setChoiceStoryFlagValue] = useState(true);
  const [choiceRepeatable, setChoiceRepeatable] = useState(true);
  const [choiceHideAfterSelected, setChoiceHideAfterSelected] = useState(false);
  const [choiceDisableAfterSelected, setChoiceDisableAfterSelected] = useState(false);
  const [choiceSelectedMessage, setChoiceSelectedMessage] = useState("");
  const [choiceRequirementType, setChoiceRequirementType] = useState<StoryDialogueChoice["requirement_type"]>("none");
  const [choiceRequirementValue, setChoiceRequirementValue] = useState("");
  const [choiceRequirementQuantity, setChoiceRequirementQuantity] = useState("1");
  const [choiceRequirementOperator, setChoiceRequirementOperator] = useState<StoryDialogueChoice["requirement_operator"]>(">=");
  const [choiceHideIfUnmet, setChoiceHideIfUnmet] = useState(false);
  const [choiceDisableIfUnmet, setChoiceDisableIfUnmet] = useState(true);
  const [choiceRequirementFailureMessage, setChoiceRequirementFailureMessage] = useState("");
  const [choiceCheckEnabled, setChoiceCheckEnabled] = useState(false);
  const [choiceCheckAttribute, setChoiceCheckAttribute] = useState<NonNullable<StoryDialogueChoice["check_attribute"]>>("charisma");
  const [choiceCheckDc, setChoiceCheckDc] = useState("10");
  const [choiceCheckSuccessNodeId, setChoiceCheckSuccessNodeId] = useState<string | null>(null);
  const [choiceCheckFailureNodeId, setChoiceCheckFailureNodeId] = useState<string | null>(null);
  const [choiceCheckSuccessText, setChoiceCheckSuccessText] = useState("");
  const [choiceCheckFailureText, setChoiceCheckFailureText] = useState("");
  const [choiceSortOrder, setChoiceSortOrder] = useState("0");
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [scale, setScale] = useState(0.86);
  const [followPlayer, setFollowPlayer] = useState(true);
  const [completedRouteId, setCompletedRouteId] = useState<string | null>(null);
  const [miniMapExitInProgress, setMiniMapExitInProgress] = useState(false);
  const [playerUnlockedMarkerIds, setPlayerUnlockedMarkerIds] = useState<Set<string>>(new Set());
  const viewportRef = useRef<MapViewportRef | null>(null);
  const watchId = useRef<number | null>(null);
  const pedometerSubscriptionRef = useRef<PedometerSubscription | null>(null);
  const nativePedometerMetersRef = useRef(0);
  const distanceWalkedRef = useRef(0);
  const routeRef = useRef(fallbackRoute);
  const routeDirectionRef = useRef<"forward" | "reverse">("forward");
  const activeBattleRouteRef = useRef<MapRoute | null>(null);
  const exitingMiniMapRef = useRef(false);
  const openingToastShownRef = useRef(false);
  const movementStateRef = useRef<PlayerMovementState>("IDLE");
  const movementCandidateRef = useRef<{ state: PlayerMovementState; since: number } | null>(null);
  const lastCaptureRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const actualIsAdmin = role === "admin";
  const isAdmin = actualIsAdmin && adminMapViewMode === "admin";
  const isAdminPlayerPreview = actualIsAdmin && adminMapViewMode === "player";
  const progressPercent = Math.min(100, Math.max(0, (distanceWalked / route.distance_required_meters) * 100));
  const orderedRoutes = useMemo(() => [...routes].sort(compareRoutes), [routes]);
  const adminRoutes = useMemo(() => orderedRoutes.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter)), [orderedRoutes, selectedChapter, selectedSeason]);
  const adminWorldRoutes = useMemo(() => adminRoutes.filter((item) => !item.mini_map_id), [adminRoutes]);
  const adminMiniMapRoutes = useMemo(() => adminRoutes.filter((item) => item.mini_map_id === activeMiniMap?.id), [activeMiniMap?.id, adminRoutes]);
  const markerContinuationRoutes = useMemo(() => adminRoutes, [adminRoutes]);
  const dialogueChoiceAvailability = useMemo(
    () => {
      const selectedChoiceGroupKeys = new Map<string, StoryDialogueChoice>();
      for (const choice of dialogueChoices) {
        const groupKey = choice.choice_group_key?.trim();
        if (groupKey && selectedDialogueChoiceIds.has(choice.id)) {
          selectedChoiceGroupKeys.set(groupKey, choice);
        }
      }

      return Object.fromEntries(dialogueChoices.map((choice) => {
      const baseAvailability = evaluateDialogueChoiceRequirement(choice, {
        character,
        inventoryItems,
        itemDefinitions,
        completedMarkerIds: completedStoryMarkerIds,
        completedEventIds,
        completedTutorialStepIds,
        storyFlags,
        knownAbilities,
      });

      const choiceGroupKey = choice.choice_group_key?.trim();
      const selectedGroupChoice = choiceGroupKey ? selectedChoiceGroupKeys.get(choiceGroupKey) : null;
      if (selectedGroupChoice && selectedGroupChoice.id !== choice.id) {
        return [
          choice.id,
          {
            met: false,
            hidden: Boolean(choice.hide_when_group_locked),
            disabled: true,
            message: choice.choice_group_lock_message?.trim() || `You already chose: ${selectedGroupChoice.button_text}`,
          },
        ];
      }

      if (choice.action === "give_reward" && claimedChoiceRewardIds.has(choice.id)) {
        return [
          choice.id,
          {
            met: false,
            hidden: true,
            disabled: true,
            message: "Already claimed.",
          },
        ];
      }

      if (!choice.repeatable && selectedDialogueChoiceIds.has(choice.id)) {
        return [
          choice.id,
          {
            met: false,
            hidden: Boolean(choice.hide_after_selected),
            disabled: Boolean(choice.disable_after_selected || !choice.hide_after_selected),
            message: choice.selected_message ?? "You already chose this.",
          },
        ];
      }

      return [choice.id, baseAvailability];
    }));
    },
    [character, claimedChoiceRewardIds, completedEventIds, completedStoryMarkerIds, completedTutorialStepIds, dialogueChoices, inventoryItems, itemDefinitions, knownAbilities, selectedDialogueChoiceIds, storyFlags],
  );
  const activeWorldMapSetting = useMemo(
    () => worldMapSettings.find((item) => Number(item.season_number) === selectedSeason && Number(item.chapter_number) === selectedChapter) ?? null,
    [selectedChapter, selectedSeason, worldMapSettings],
  );
  const worldMapDimensions = useMemo(
    () => ({
      width: Math.max(320, Number(activeWorldMapSetting?.width) || mapSize.width),
      height: Math.max(320, Number(activeWorldMapSetting?.height) || mapSize.height),
    }),
    [activeWorldMapSetting?.height, activeWorldMapSetting?.width],
  );
  const scaledMapSize = useMemo(() => ({ width: worldMapDimensions.width * scale, height: worldMapDimensions.height * scale }), [scale, worldMapDimensions.height, worldMapDimensions.width]);
  const activeRouteScopeRoutes = activeMiniMap ? adminMiniMapRoutes : adminWorldRoutes;
  const routeProgressPosition = useMemo(() => getPointOnRoute(route.path_points, progressPercent), [route.path_points, progressPercent]);
  const playerPosition = savedPlayerPosition ?? routeProgressPosition;
  const routeSegments = useMemo(() => getRouteSegmentsForRoutes(isAdmin ? adminWorldRoutes : hasActiveRoute && !route.mini_map_id ? [route] : [], route.id, worldMapDimensions, isAdmin), [adminWorldRoutes, hasActiveRoute, isAdmin, route, worldMapDimensions]);
  const miniMapRouteSegments = useMemo(() => getRouteSegmentsForRoutes(isAdmin ? adminMiniMapRoutes : hasActiveRoute && route.mini_map_id === activeMiniMap?.id ? [route] : [], route.id, mapSize, isAdmin), [activeMiniMap?.id, adminMiniMapRoutes, hasActiveRoute, isAdmin, route]);
  const draftSegments = useMemo(() => getRouteSegments(pathDraft, activeMiniMap ? mapSize : worldMapDimensions).map((segment) => ({ ...segment, id: `draft-${segment.left}-${segment.top}`, isActive: true, isDraft: true })), [activeMiniMap, pathDraft, worldMapDimensions]);
  const playerPathVisibility = useMemo(() => (hasActiveRoute ? getPathSegmentMetaAtProgress(route.path_points, route.path_segments ?? [], progressPercent).visibility : "visible"), [hasActiveRoute, progressPercent, route.path_points, route.path_segments]);
  const effectiveMarkers = useMemo(
    () => markers.map((marker) => (playerUnlockedMarkerIds.has(marker.id) ? { ...marker, is_unlocked: true } : marker)),
    [markers, playerUnlockedMarkerIds],
  );
  const worldMarkers = useMemo(() => effectiveMarkers.filter((marker) => !marker.mini_map_id), [effectiveMarkers]);
  const miniMapMarkers = useMemo(() => effectiveMarkers.filter((marker) => marker.mini_map_id === activeMiniMap?.id), [effectiveMarkers, activeMiniMap?.id]);
  const miniMapSpawnMarker = useMemo(() => miniMapMarkers.find((marker) => marker.type === "Player Spawn") ?? null, [miniMapMarkers]);
  const miniMapSpawnPosition = miniMapSpawnMarker ? { x: Number(miniMapSpawnMarker.x_percent), y: Number(miniMapSpawnMarker.y_percent) } : { x: 50, y: 50 };
  const miniMapPlayerPosition = route.mini_map_id === activeMiniMap?.id ? playerPosition : savedMiniMapPosition ?? miniMapSpawnPosition;
  const currentInteractionPosition = activeMiniMap ? miniMapPlayerPosition : playerPosition;
  const adminWorldMarkers = useMemo(() => worldMarkers.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter)), [selectedChapter, selectedSeason, worldMarkers]);
  const adminMiniMapMarkers = useMemo(() => miniMapMarkers.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter)), [miniMapMarkers, selectedChapter, selectedSeason]);
  const adminStoryMarkers = useMemo(() => effectiveMarkers.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter) && isStoryQuestMarker(item)), [effectiveMarkers, selectedChapter, selectedSeason]);
  const adminMiniMaps = useMemo(() => sortMiniMaps(miniMaps.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter))), [miniMaps, selectedChapter, selectedSeason]);
  const adminTutorialSteps = useMemo(() => tutorialSteps.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter)), [selectedChapter, selectedSeason, tutorialSteps]);
  const adminLegendItems = useMemo(() => legendItems.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter)), [legendItems, selectedChapter, selectedSeason]);
  const adminMapEvents = useMemo(() => mapEvents.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter)), [mapEvents, selectedChapter, selectedSeason]);
  const adminRouteEventPins = useMemo<RouteEventPin[]>(() => {
    if (!isAdmin || adminSection !== "Walking Paths") {
      return [];
    }

    return adminMapEvents
      .filter((event) => event.route_id === route.id)
      .map((event) => {
        const percent = clamp(Number(event.distance_marker_percent) || 0, 0, 100);
        const point = getPointOnRoute(route.path_points, percent);
        return {
          id: event.id,
          title: `${Math.round(percent)}% - ${event.title}`,
          percent,
          eventType: event.event_type,
          linkedOnly: Boolean(event.linked_only),
          x: point.x,
          y: point.y,
        };
      });
  }, [adminMapEvents, adminSection, isAdmin, route.id, route.path_points]);
  const publishedWorldMapUri = resolveMapImageUri(activeWorldMapSetting?.image_url);
  const overworldImageSource = publishedWorldMapUri ? { uri: publishedWorldMapUri } : forgottenMarches;
  const availableSeasons = useMemo(() => mergeSeasonRecords(mapSeasons, getAvailableNumbers([routes, effectiveMarkers, miniMaps, tutorialSteps, legendItems, mapEvents, worldMapSettings].flat(), "season_number")), [legendItems, mapEvents, mapSeasons, effectiveMarkers, miniMaps, routes, tutorialSteps, worldMapSettings]);
  const availableChapters = useMemo(
    () => mergeChapterRecords(
      mapChapters.filter((chapter) => Number(chapter.season_number) === selectedSeason),
      getAvailableNumbers([routes, effectiveMarkers, miniMaps, tutorialSteps, legendItems, mapEvents, worldMapSettings].flat().filter((item) => Number(item.season_number ?? 1) === selectedSeason), "chapter_number"),
      selectedSeason,
    ),
    [legendItems, mapChapters, mapEvents, effectiveMarkers, miniMaps, routes, selectedSeason, tutorialSteps, worldMapSettings],
  );
  const effectiveRouteProgressRows = useMemo(() => {
    if (!hasActiveRoute) {
      return routeProgressRows;
    }

    const savedProgress = routeProgressRows.find((row) => row.route_id === route.id);
    const activeProgress = {
      id: savedProgress?.id ?? `active-${route.id}`,
      user_id: savedProgress?.user_id ?? "",
      route_id: route.id,
      distance_walked_meters: distanceWalked,
      progress_percent: progressPercent,
      current_x_percent: playerPosition.x,
      current_y_percent: playerPosition.y,
      last_lat: savedProgress?.last_lat ?? null,
      last_lng: savedProgress?.last_lng ?? null,
      travel_direction: routeDirection,
      is_current: true,
      source_marker_id: savedProgress?.source_marker_id ?? null,
      updated_at: savedProgress?.updated_at ?? new Date().toISOString(),
    } satisfies RouteProgress;

    return [...routeProgressRows.filter((row) => row.route_id !== route.id), activeProgress];
  }, [distanceWalked, hasActiveRoute, playerPosition.x, playerPosition.y, progressPercent, route.id, routeDirection, routeProgressRows]);
  const knownStoryFlagKeys = useMemo(() => {
    const keys = new Set<string>();

    dialogueChoices.forEach((choice) => {
      const setFlagKey = choice.set_story_flag_key?.trim();
      if (setFlagKey) {
        keys.add(setFlagKey);
      }

      const requiredFlagKey = choice.requirement_type === "story_flag" ? choice.requirement_value?.trim() : "";
      if (requiredFlagKey) {
        keys.add(requiredFlagKey);
      }
    });

    markers.forEach((marker) => {
      const visibleFlagKey = marker.visible_story_flag_key?.trim();
      if (visibleFlagKey) {
        keys.add(visibleFlagKey);
      }
    });

    storyFlags.forEach((_value, key) => {
      const savedFlagKey = key.trim();
      if (savedFlagKey) {
        keys.add(savedFlagKey);
      }
    });

    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [dialogueChoices, markers, storyFlags]);
  const markerStoryFlagIsVisible = useCallback((marker: MapMarker) => {
    const flagKey = marker.visible_story_flag_key?.trim();
    if (!flagKey) {
      return true;
    }

    const expectedValue = marker.visible_story_flag_value ?? true;
    return storyFlags.get(flagKey) === expectedValue;
  }, [storyFlags]);
  const visibleMarkers = isAdmin
    ? worldMarkers
    : worldMarkers.filter((marker) => markerStoryFlagIsVisible(marker) && getMarkerAvailability({ marker, playerPosition, routeLinks: allMarkerRouteLinks, routeProgressRows: effectiveRouteProgressRows }).visible && canPlayerSeeStoryMarker(marker, effectiveMarkers, completedStoryMarkerIds, startedStoryMarkerIds));
  const visibleMiniMapMarkers = isAdmin
    ? adminMiniMapMarkers
    : miniMapMarkers.filter((marker) => markerStoryFlagIsVisible(marker) && getMarkerAvailability({ marker, playerPosition: miniMapPlayerPosition, routeLinks: allMarkerRouteLinks, routeProgressRows: effectiveRouteProgressRows }).visible && canPlayerSeeStoryMarker(marker, effectiveMarkers, completedStoryMarkerIds, startedStoryMarkerIds));
  const selectedDialogueEvent = useMemo(() => mapEvents.find((event) => event.id === selectedDialogueEventId) ?? null, [mapEvents, selectedDialogueEventId]);
  const selectedChoiceNode = useMemo(() => dialogueNodes.find((node) => node.id === choiceNodeId) ?? null, [choiceNodeId, dialogueNodes]);
  const selectedDialogueMarker = useMemo(() => effectiveMarkers.find((marker) => marker.id === selectedDialogueMarkerId) ?? null, [effectiveMarkers, selectedDialogueMarkerId]);
  const selectedNodeChoices = useMemo(
    () => (choiceNodeId ? dialogueChoices.filter((choice) => choice.node_id === choiceNodeId).sort((a, b) => a.sort_order - b.sort_order) : []),
    [choiceNodeId, dialogueChoices],
  );
  const selectedMarkerAvailability = selectedMarker ? getMarkerAvailability({ marker: selectedMarker, playerPosition: currentInteractionPosition, routeLinks: allMarkerRouteLinks, routeProgressRows: effectiveRouteProgressRows }) : null;
  const selectedMarkerDistance = selectedMarkerAvailability?.distance ?? 0;
  const selectedMarkerRadius = selectedMarkerAvailability?.radius ?? 4;
  const canUseSelectedMarker = isAdmin || Boolean(selectedMarkerAvailability?.interactable);
  const selectedMarkerLocked = !isAdmin && Boolean(selectedMarker && isMarkerLocked(selectedMarker));
  const selectedMiniMap = useMemo(() => miniMaps.find((miniMap) => miniMap.id === selectedMiniMapId) ?? null, [miniMaps, selectedMiniMapId]);
  const activeSectionMarkerTypes = adminSection === "Area/Town Markers" ? ["Area/Town Entrance"] : markerTypes;
  const routeEvents = useMemo(() => mapEvents.filter((event) => event.route_id === route.id), [mapEvents, route.id]);
  const requiredRouteEvents = useMemo(() => routeEvents.filter((event) => !event.linked_only), [routeEvents]);
  const reusableMapEvents = useMemo(() => allMapEvents.filter((event) => isInSelectedChapter(event, selectedSeason, selectedChapter)), [allMapEvents, selectedChapter, selectedSeason]);
  const completedRouteEvents = useMemo(() => requiredRouteEvents.filter((event) => completedEventIds.has(event.id)).length, [completedEventIds, requiredRouteEvents]);
  const routePotentialXp = useMemo(() => requiredRouteEvents.reduce((total, event) => total + Number(event.reward_xp ?? 0), 0), [requiredRouteEvents]);
  const routePotentialGold = useMemo(() => requiredRouteEvents.reduce((total, event) => total + Number(event.reward_gold ?? 0), 0), [requiredRouteEvents]);
  const currentRouteProgress = useMemo(() => routeProgressRows.find((row) => row.route_id === route.id) ?? null, [route.id, routeProgressRows]);
  const selectedMapInventoryItem = useMemo(
    () => inventoryItems.find((entry) => entry.id === selectedMapInventoryItemId) ?? null,
    [inventoryItems, selectedMapInventoryItemId],
  );

  useEffect(() => {
    void loadMap().catch((error) => {
      setGpsMessage(getErrorMessage(error, "Unable to load map data."));
      setMapReady(true);
    });
    void loadCombatLoadout();
    void loadInventory();
    void loadEnemies();

    return () => {
      if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      if (pedometerSubscriptionRef.current) {
        pedometerSubscriptionRef.current.remove();
        pedometerSubscriptionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    void loadCombatLoadout();
    void loadInventory();
  }, [character.id, character.attributes]);

  async function loadCombatLoadout() {
    try {
      const loadout = await getCombatLoadout(character);
      setEquippedAbilities(loadout.equipped);
      setKnownAbilities(loadout.unlocked);
    } catch (error) {
      setBattleLog((current) => [getErrorMessage(error, "Unable to load combat abilities."), ...current].slice(0, 8));
    }
  }

  async function loadInventory() {
    try {
      const state = await getInventoryState(character.id);
      setInventoryItems(state.items);
      setItemDefinitions(state.definitions);
      setEquippedItems(state.equipped);
      setTotalInventoryWeight(state.totalWeight);
      setCarryCapacity(state.carryCapacity);
      const bonuses = getInventoryResourceBonuses(state.equipped);
      setCombatResources(getCharacterResources(character, {
        maxHp: bonuses.maxHp,
        maxStamina: bonuses.maxStamina,
        maxMagicka: bonuses.maxMagicka,
      }));
    } catch (error) {
      setBattleLog((current) => [getErrorMessage(error, "Unable to load inventory."), ...current].slice(0, 8));
    }
  }

  function buildRewardToastItems(reward: { xp?: number | null; gold?: number | null; itemId?: string | null; itemQuantity?: number | null; fullHeal?: boolean | null }, extraRewards: GameToastReward[] = []) {
    const rewards: GameToastReward[] = [];
    const xp = Number(reward.xp ?? 0) || 0;
    const gold = Number(reward.gold ?? 0) || 0;

    if (xp > 0) {
      rewards.push({ label: `${xp} XP` });
    }

    if (gold > 0) {
      rewards.push({ label: `${gold} Gold` });
    }

    if (reward.itemId) {
      rewards.push({
        label: getItemName(itemDefinitions, reward.itemId),
        quantity: Math.max(1, Number(reward.itemQuantity ?? 1) || 1),
      });
    }

    if (reward.fullHeal) {
      rewards.push({ label: "Full Heal" });
    }

    return [...rewards, ...extraRewards];
  }

  function showGameToast(toast: GameToastData) {
    setGameToast(toast);
  }

  function getNextStoryMarkerAfter(marker: MapMarker | null) {
    if (!marker || !isStoryQuestMarker(marker)) {
      return null;
    }

    const storyScope = markers
      .filter((item) => isStoryQuestMarker(item))
      .filter((item) => item.id !== marker.id)
      .filter((item) => Number(item.season_number ?? 1) === Number(marker.season_number ?? 1))
      .filter((item) => Number(item.chapter_number ?? 1) === Number(marker.chapter_number ?? 1));
    const explicitNextMarker = storyScope
      .filter((item) => item.unlock_after_marker_id === marker.id)
      .sort((a, b) => Number(a.story_order ?? 0) - Number(b.story_order ?? 0))[0] ?? null;

    if (explicitNextMarker) {
      return explicitNextMarker;
    }

    const currentOrder = Number(marker.story_order ?? 0);
    return storyScope
      .filter((item) => Number(item.story_order ?? 0) > currentOrder)
      .sort((a, b) => Number(a.story_order ?? 0) - Number(b.story_order ?? 0))[0] ?? null;
  }

  function showJourneyToast(input: { title: string; message: string; rewards?: GameToastReward[]; nextMarker?: MapMarker | null }) {
    showGameToast({
      title: input.title,
      message: input.message,
      rewards: input.rewards,
      nextMarker: input.nextMarker ?? null,
      actionLabel: "OK",
    });
  }

  useEffect(() => {
    if (!mapReady || openingToastShownRef.current || actualIsAdmin || storyFlags.get("opening_toast_seen")) {
      return;
    }

    const freshStartMarker =
      markers.find((marker) => marker.quest_key === "opening_fresh_start") ??
      markers.find((marker) => marker.title.trim().toLowerCase() === "fresh start") ??
      markers.find((marker) => marker.title.toLowerCase().includes("fresh start")) ??
      null;
    const freshStartRouteImage = getMarkerLinkedRouteImage(freshStartMarker, routes, allMarkerRouteLinks);

    openingToastShownRef.current = true;
    showGameToast({
      title: "A Fresh Start",
      message: "The Forgotten Marches stretch before you. Ten coins left. No name here yet. Maybe that is a mercy. Maybe this road is where you become someone new.",
      nextMarker: freshStartMarker,
      nextImageUri: freshStartRouteImage ? resolveMapImageUri(freshStartRouteImage) : null,
      actionLabel: "Begin",
    });

    void setPlayerStoryFlag(character.id, "opening_toast_seen", true)
      .then(() => {
        setStoryFlags((current) => {
          const next = new Map(current);
          next.set("opening_toast_seen", true);
          return next;
        });
      })
      .catch((error) => {
        console.warn("[map] unable to save opening toast flag", error);
        openingToastShownRef.current = false;
      });
  }, [actualIsAdmin, allMarkerRouteLinks, character.id, mapReady, markers, routes, storyFlags]);

  async function loadEnemies() {
    try {
      const [enemies, npcs] = await Promise.all([getEnemies(), getNpcs()]);
      setEnemyDefinitions(enemies);
      setNpcDefinitions(npcs);
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to load enemies and NPCs."));
    }
  }

  function resolveMovementState(speedMph: number, sampleTime: number) {
    const current = movementStateRef.current;
    const desired: PlayerMovementState = speedMph > movementSpeedThresholdMph ? "MOVING" : "IDLE";

    if (desired === current) {
      movementCandidateRef.current = null;
      return { state: current, changed: false };
    }

    const candidate = movementCandidateRef.current;
    const nextCandidate = candidate?.state === desired ? candidate : { state: desired, since: sampleTime };
    movementCandidateRef.current = nextCandidate;

    if (sampleTime - nextCandidate.since < movementStateDebounceMs) {
      return { state: current, changed: false };
    }

    movementStateRef.current = desired;
    movementCandidateRef.current = null;
    setPlayerMovementState(desired);
    return { state: desired, changed: true };
  }

  async function advanceActiveRouteByMeters(cleanMeters: number, telemetry?: { last_lat?: number | null; last_lng?: number | null }) {
    if (cleanMeters <= 0) {
      return;
    }

    const activeRoute = routeRef.current;
    const direction = routeDirectionRef.current;
    const nextDistance = direction === "reverse"
      ? Math.max(0, distanceWalkedRef.current - cleanMeters)
      : Math.min(activeRoute.distance_required_meters, distanceWalkedRef.current + cleanMeters);
    const nextProgress = Math.min(100, (nextDistance / activeRoute.distance_required_meters) * 100);
    const nextMapPosition = getPointOnRoute(activeRoute.path_points, nextProgress);

    distanceWalkedRef.current = nextDistance;
    setSavedPlayerPosition(nextMapPosition);
    setDistanceWalked(nextDistance);
    setRouteProgressRows((current) => upsertRouteProgressRow(current, activeRoute.id, nextProgress));
    await saveRouteProgress(activeRoute.id, {
      distance_walked_meters: nextDistance,
      progress_percent: nextProgress,
      current_x_percent: nextMapPosition.x,
      current_y_percent: nextMapPosition.y,
      last_lat: telemetry?.last_lat ?? null,
      last_lng: telemetry?.last_lng ?? null,
      travel_direction: direction,
      is_current: true,
    });
    const nextTotal = await incrementCharacterDistanceWalked(character.id, cleanMeters);
    if (nextTotal !== null) {
      onCharacterUpdated({
        ...character,
        total_distance_walked_meters: nextTotal,
      });
    }
    void recordSocialContribution({
      userId: character.user_id,
      metricType: "distance_walked_meters",
      amount: cleanMeters,
      sourceType: "route",
      sourceId: activeRoute.id,
    });
    if (activeRoute.mini_map_id) {
      void savePlayerMapState({
        active_mini_map_id: activeRoute.mini_map_id,
        current_x_percent: nextMapPosition.x,
        current_y_percent: nextMapPosition.y,
      });
    }
    setGpsMessage(direction === "reverse" && nextDistance <= 0
      ? "You returned to the starting sign post."
      : `${Platform.OS === "web" ? "GPS" : "Pedometer"} counted ${Math.round(cleanMeters)}m. Route progress is saved.`);
  }

  async function createSeasonFromAdmin() {
    const nextNumber = Math.max(0, ...availableSeasons.map((season) => season.season_number)) + 1;
    try {
      const saved = await saveMapSeason({
        season_number: nextNumber,
        name: newSeasonName.trim() || `Season ${nextNumber}`,
        description: newSeasonDescription.trim() || null,
        is_active: true,
      });
      setMapSeasons((current) => [...current.filter((season) => season.id !== saved.id), saved].sort((a, b) => a.season_number - b.season_number));
      setSelectedSeason(saved.season_number);
      setSelectedChapter(1);
      setNewSeasonName("");
      setNewSeasonDescription("");
      setAdminMessage(`${saved.name} created.`);
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to create season. Confirm the Supabase migration has run."));
    }
  }

  async function createChapterFromAdmin() {
    const nextNumber = Math.max(0, ...availableChapters.map((chapter) => chapter.chapter_number)) + 1;
    try {
      const saved = await saveMapChapter({
        season_number: selectedSeason,
        chapter_number: nextNumber,
        name: newChapterName.trim() || `Chapter ${nextNumber}`,
        description: newChapterDescription.trim() || null,
        is_active: true,
      });
      setMapChapters((current) =>
        [...current.filter((chapter) => chapter.id !== saved.id), saved].sort((a, b) => a.season_number - b.season_number || a.chapter_number - b.chapter_number),
      );
      setSelectedChapter(saved.chapter_number);
      setNewChapterName("");
      setNewChapterDescription("");
      setAdminMessage(`${saved.name} created under ${getSeasonLabel(mapSeasons, selectedSeason)}.`);
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to create chapter. Confirm the Supabase migration has run."));
    }
  }

  function syncWorldMapForm(setting: WorldMapSetting | null) {
    setWorldMapName(setting?.name ?? "The Forgotten Marches");
    setWorldMapDraftImage(setting?.draft_image_url ?? "");
    setWorldMapNotes(setting?.notes ?? "");
    setWorldMapAspectRatio(setting?.aspect_ratio ?? "current");
    setWorldMapWidth(String(setting?.width ?? mapSize.width));
    setWorldMapHeight(String(setting?.height ?? mapSize.height));
    setWorldMapActive(setting?.is_active ?? true);
  }

  async function saveWorldMapDraftSettings(nextValues?: Partial<WorldMapSetting>) {
    try {
      const saved = await saveWorldMapSetting({
        id: activeWorldMapSetting?.id,
        season_number: selectedSeason,
        chapter_number: selectedChapter,
        name: nextValues?.name ?? worldMapName,
        image_url: nextValues?.image_url ?? activeWorldMapSetting?.image_url ?? null,
        draft_image_url: nextValues?.draft_image_url ?? worldMapDraftImage,
        notes: nextValues?.notes ?? worldMapNotes,
        aspect_ratio: nextValues?.aspect_ratio ?? worldMapAspectRatio,
        width: nextValues?.width ?? (Number(worldMapWidth) || mapSize.width),
        height: nextValues?.height ?? (Number(worldMapHeight) || mapSize.height),
        is_active: nextValues?.is_active ?? worldMapActive,
      });
      setWorldMapSettings((current) => [saved, ...current.filter((item) => item.id !== saved.id)].sort((a, b) => a.season_number - b.season_number || a.chapter_number - b.chapter_number));
      syncWorldMapForm(saved);
      setAdminMessage("World map settings saved.");
      return saved;
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to save world map settings. Confirm the Supabase migration has run."));
      return null;
    }
  }

  async function publishWorldMapDraft() {
    const draft = worldMapDraftImage.trim();
    if (!draft) {
      setAdminMessage("Add a draft image URL before publishing.");
      return;
    }

    await saveWorldMapDraftSettings({
      image_url: draft,
      draft_image_url: null,
    });
  }

  async function clearWorldMapDraft() {
    await saveWorldMapDraftSettings({ draft_image_url: null });
  }

  async function restoreDefaultWorldMap() {
    await saveWorldMapDraftSettings({
      image_url: null,
      draft_image_url: null,
      name: worldMapName.trim() || "The Forgotten Marches",
    });
  }

  useEffect(() => {
    if (followPlayer) {
      centerOn(playerPosition.x, playerPosition.y);
    }
  }, [followPlayer, playerPosition.x, playerPosition.y, scale]);

  useEffect(() => {
    distanceWalkedRef.current = distanceWalked;
  }, [distanceWalked]);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    syncWorldMapForm(activeWorldMapSetting);
  }, [activeWorldMapSetting?.id, selectedChapter, selectedSeason]);

  useEffect(() => {
    if (miniMapExitInProgress || exitingMiniMapRef.current || savedMiniMapPosition || !hasActiveRoute || !route.mini_map_id || activeMiniMap?.id === route.mini_map_id) {
      return;
    }

    const routeMiniMap = miniMaps.find((item) => item.id === route.mini_map_id);
    if (!routeMiniMap) {
      return;
    }

    setActiveMiniMap(routeMiniMap);
    setSelectedMiniMapId(routeMiniMap.id);
    setSavedMiniMapPosition(null);
    if (!isAdmin) {
      void savePlayerMapState({
        active_mini_map_id: routeMiniMap.id,
        current_x_percent: playerPosition.x,
        current_y_percent: playerPosition.y,
      });
    }
  }, [activeMiniMap?.id, hasActiveRoute, isAdmin, miniMapExitInProgress, miniMaps, playerPosition.x, playerPosition.y, route.mini_map_id, savedMiniMapPosition]);

  useEffect(() => {
    if (!miniMapExitInProgress || (hasActiveRoute && route.mini_map_id)) {
      return;
    }

    exitingMiniMapRef.current = false;
    setMiniMapExitInProgress(false);
  }, [hasActiveRoute, miniMapExitInProgress, route.mini_map_id]);

  useEffect(() => {
    routeDirectionRef.current = routeDirection;
  }, [routeDirection]);

  useEffect(() => {
    if (routeDirection === "reverse" || progressPercent < 100 || completedRouteId === route.id) {
      return;
    }

    const pendingReachedFixedEvent = mapEvents.some(
      (event) =>
        event.is_active &&
        !event.linked_only &&
        event.route_id === route.id &&
        (event.trigger_mode ?? "fixed") !== "random" &&
        !completedEventIds.has(event.id) &&
        Number(event.distance_marker_percent) <= progressPercent,
    );

    if (pendingReachedFixedEvent) {
      return;
    }

    setCompletedRouteId(route.id);
    setGpsMessage(`${route.name} completed. Return to a Sign Post to choose your next path.`);
    if (!route.mini_map_id) {
      showJourneyToast({
        title: "Trail Complete",
        message: "You reached the end of this path. Open the destination marker or return to a Sign Post to choose another trail.",
        nextMarker: getJourneyDestinationMarker(route, markers, allMarkerRouteLinks, currentRouteProgress?.source_marker_id ?? null),
      });
    }
    void grantPathCompletionMarkerReward(route.id);
  }, [allMarkerRouteLinks, completedEventIds, completedRouteId, currentRouteProgress?.source_marker_id, mapEvents, markers, progressPercent, route, routeDirection]);

  function notifyRouteEvent(event: MapEvent) {
    if (isAdmin || adminPreviewMode) {
      return;
    }

    if (Number(event.distance_marker_percent) >= 100) {
      return;
    }

    const title = event.event_type === "battle" ? "Battle Encounter" : "Story Event";
    const body = event.event_type === "battle"
      ? `${event.title} is blocking your path.`
      : `${event.title} is ready on ${route.name}.`;

    void scheduleLocalNotification(title, body)
      .then((notificationId) => {
        if (!notificationId) {
          console.warn("[notifications] route event notification was not scheduled. Check notification permission on this device.");
        }
      })
      .catch((error) => {
        console.warn("[notifications] unable to send event notification", error);
      });
  }

  useEffect(() => {
    if (activeEvent || activeBattle || routeDirection === "reverse") {
      return;
    }

    const eligibleFixedEvents = mapEvents.filter(
      (event) =>
        event.is_active &&
        !event.linked_only &&
        event.route_id === route.id &&
        !completedEventIds.has(event.id) &&
        Number(event.distance_marker_percent) <= progressPercent,
    );
    const fixedEvent = eligibleFixedEvents.find((event) => (event.trigger_mode ?? "fixed") !== "random");
    const randomEvents = playerMovementState === "MOVING"
      ? eligibleFixedEvents.filter((event) => (event.trigger_mode ?? "fixed") === "random")
      : [];
    const randomEvent = randomEvents.find((event) => Math.random() * 100 < Number(event.random_chance_percent ?? 0));
    const nextEvent = fixedEvent ?? randomEvent;

    if (!nextEvent) {
      return;
    }

    notifyRouteEvent(nextEvent);

    if (nextEvent.event_type === "battle") {
        void startBattle(nextEvent);
      return;
    }

    setActiveEvent(nextEvent);
  }, [activeBattle, activeEvent, completedEventIds, mapEvents, playerMovementState, progressPercent, route.id, routeDirection]);

  useEffect(() => {
    if (!activeEvent || activeEvent.event_type === "battle") {
      setDialogueNodes([]);
      setDialogueChoices([]);
      setDialogueChoiceRewards([]);
      setPendingRewardChoice(null);
      setActiveNodeId(null);
      setDialogueLog([]);
      return;
    }

    if (activeMarkerEventId && activeEvent.id === getSyntheticMarkerEventId(activeMarkerEventId)) {
      void loadDialogueForMarker(activeMarkerEventId);
      return;
    }

    void loadDialogueForEvent(activeEvent);
  }, [activeEvent, activeMarkerEventId]);

  async function loadMap() {
    setMapReady(false);
    const [loadedRoutes, loadedMarkers, loadedMiniMaps, loadedTutorials, loadedLegendItems, loadedWorldMapSettings, loadedSeasons, loadedChapters, loadedRole, loadedEvents, loadedMarkerRouteLinks] = await Promise.all([
      getMapRoutes(),
      getMapMarkers(),
      getMiniMaps(),
      getTutorialSteps(),
      getMarkerLegendItems(),
      getWorldMapSettings(),
      getMapSeasons(),
      getMapChapters(),
      getCurrentRole(),
      getMapEvents(),
      getAllMarkerRouteLinks(),
    ]);
    const nextRoutes = [...loadedRoutes].sort(compareRoutes);
    const [progressRows, playerMapState, markerUnlocks] = await Promise.all([
      getRouteProgressForRoutes(nextRoutes.map((item) => item.id)),
      getPlayerMapState(),
      getPlayerMarkerUnlocks(),
    ]);
    const storyMarkerIds = loadedMarkers.filter(isStoryQuestMarker).map((item) => item.id);
    const [storyCompletions, storyStarts, loadedStoryFlags, tutorialCompletions, allEventCompletions] = await Promise.all([
      getStoryMarkerCompletions(storyMarkerIds),
      getStoryMarkerStarts(storyMarkerIds),
      getPlayerStoryFlags(character.id),
      getPlayerTutorialCompletions(character.id),
      getEventCompletions(loadedEvents.map((event) => event.id)),
    ]);
    const currentProgressRow =
      [...progressRows]
        .filter((row) => row.is_current)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0] ?? null;
    const currentRoute = nextRoutes.find((item) => item.id === currentProgressRow?.route_id) ?? null;
    const firstRoute = nextRoutes.find((item) => item.is_active) ?? nextRoutes[0] ?? fallbackRoute;
    setRouteProgressRows(progressRows);
    setCompletedStoryMarkerIds(new Set(storyCompletions.map((completion) => completion.marker_id)));
    setStartedStoryMarkerIds(new Set(storyStarts.map((start) => start.marker_id)));
    setStoryFlags(new Map(loadedStoryFlags.map((flag) => [flag.flag_key, flag.flag_value])));
    setCompletedTutorialStepIds(new Set(tutorialCompletions.map((completion) => completion.tutorial_step_id)));
    setCompletedEventIds(new Set(allEventCompletions.map((completion) => completion.event_id)));
    setPlayerUnlockedMarkerIds(new Set(markerUnlocks.map((unlock) => unlock.marker_id)));
    setRoutes(nextRoutes);
    setPathDraft([]);
    setPathSegmentDraft([]);
    setMarkers(loadedMarkers);
    setMiniMaps(loadedMiniMaps);
    setTutorialSteps(loadedTutorials);
    setLegendItems(loadedLegendItems);
    setWorldMapSettings(loadedWorldMapSettings);
    setMapSeasons(loadedSeasons);
    setMapChapters(loadedChapters);
    setRole(loadedRole);
    setAllMapEvents(loadedEvents);
    setAllMarkerRouteLinks(loadedMarkerRouteLinks);
    const currentMiniMap = currentRoute?.mini_map_id ? loadedMiniMaps.find((item) => item.id === currentRoute.mini_map_id) ?? null : null;
    const worldSpawnPosition = getWorldSpawnPosition(loadedMarkers);
    const savedMiniMap = !currentRoute && playerMapState?.active_mini_map_id ? loadedMiniMaps.find((item) => item.id === playerMapState.active_mini_map_id) ?? null : null;
    const savedWorldPosition = !currentRoute && !playerMapState?.active_mini_map_id && playerMapState?.current_x_percent != null && playerMapState?.current_y_percent != null
      ? { x: Number(playerMapState.current_x_percent), y: Number(playerMapState.current_y_percent) }
      : null;
    const restoredMiniMap = currentMiniMap ?? savedMiniMap ?? null;
    if (restoredMiniMap) {
      setActiveMiniMap(restoredMiniMap);
      setSelectedMiniMapId(restoredMiniMap.id);
      if (loadedRole === "admin") {
        editMiniMap(restoredMiniMap);
      }
    } else {
      setActiveMiniMap(null);
      setSelectedMiniMapId(null);
    }
    if (savedMiniMap && playerMapState && playerMapState.current_x_percent !== null && playerMapState.current_y_percent !== null) {
      setSavedMiniMapPosition({ x: Number(playerMapState.current_x_percent), y: Number(playerMapState.current_y_percent) });
    } else if (restoredMiniMap && !currentMiniMap) {
      const spawnPosition = getMiniMapSpawnPosition(restoredMiniMap.id, loadedMarkers);
      setSavedMiniMapPosition(spawnPosition);
    } else {
      setSavedMiniMapPosition(null);
    }
    if (currentRoute) {
      setHasActiveRoute(true);
      await selectRoute(currentRoute, true);
    } else {
      setHasActiveRoute(false);
      setRoute(firstRoute);
      setRouteName(firstRoute.name);
      setRouteOrder(String(firstRoute.sort_order));
      setRouteTerrain(firstRoute.terrain);
      setRouteDanger(firstRoute.danger_level);
      setRouteDistance(String(Math.round(firstRoute.distance_required_meters)));
      setRouteImage(firstRoute.image_url ?? "");
      setRouteLockType(firstRoute.lock_type ?? "public");
      setRouteLockMessage(firstRoute.lock_message ?? "");
      setPathDraft([]);
      setPathSegmentDraft([]);
      distanceWalkedRef.current = 0;
      const nextWorldPosition = savedWorldPosition ?? worldSpawnPosition;
      setSavedPlayerPosition(nextWorldPosition);
      setDistanceWalked(0);
      setRouteDirection("forward");
      setLastPosition(null);
      setMapEvents([]);
      setCompletedEventIds(new Set());
      if (!savedWorldPosition && !savedMiniMap) {
        void savePlayerMapState({
          active_mini_map_id: null,
          current_x_percent: nextWorldPosition.x,
          current_y_percent: nextWorldPosition.y,
        });
      }
      setGpsMessage("Choose a marker or path from the world map to begin travel.");
    }
    setMapReady(true);
  }

  function getMiniMapSpawnPosition(miniMapId: string, markerSource = markers) {
    const spawnMarker = markerSource.find((marker) => marker.mini_map_id === miniMapId && marker.type === "Player Spawn");
    return spawnMarker ? { x: Number(spawnMarker.x_percent), y: Number(spawnMarker.y_percent) } : { x: 50, y: 50 };
  }

  function getExitTargetMiniMapSpawnPosition(marker: MapMarker, miniMapId: string) {
    const selectedSpawn = marker.exit_target_spawn_marker_id
      ? markers.find((item) => item.id === marker.exit_target_spawn_marker_id && item.mini_map_id === miniMapId && item.type === "Player Spawn")
      : null;

    if (selectedSpawn && Number.isFinite(Number(selectedSpawn.x_percent)) && Number.isFinite(Number(selectedSpawn.y_percent))) {
      return { x: Number(selectedSpawn.x_percent), y: Number(selectedSpawn.y_percent) };
    }

    return getMiniMapSpawnPosition(miniMapId);
  }

  function getWorldSpawnPosition(markerSource = markers) {
    const spawnMarker = markerSource.find((marker) => !marker.mini_map_id && marker.type === "World Spawn");
    return spawnMarker ? { x: Number(spawnMarker.x_percent), y: Number(spawnMarker.y_percent) } : { x: 50, y: 50 };
  }

  function switchAdminMapViewMode(mode: "admin" | "player") {
    setAdminMapViewMode(mode);

    if (mode === "player") {
      setAdminMessage(null);
      setClickedPercent(null);
      setPreviewMarkerScene(false);
      setAdminPreviewMode(null);
      setSelectedMarker(null);
      setMarkerPanelMessage("Player view is active. Markers now use player proximity, lock, and visibility rules.");
    } else {
      setMarkerPanelMessage(null);
    }
  }

  function renderAdminViewTool() {
    if (!actualIsAdmin) {
      return null;
    }

    return (
      <Frame style={styles.adminViewTool}>
        <View style={styles.adminViewToolHeader}>
          <View style={styles.adminViewToolCopy}>
            <Text style={styles.markerName}>Admin View Tool</Text>
            <Text style={styles.copy}>
              {isAdminPlayerPreview
                ? "Player View is active. The map uses player proximity, lock, and visibility rules."
                : "Admin View is active. Editor tools, all markers, and admin previews are available."}
            </Text>
          </View>
          <View style={styles.viewModeControls}>
            <Pressable style={[styles.viewModeButton, adminMapViewMode === "admin" && styles.typeSelected]} onPress={() => switchAdminMapViewMode("admin")}>
              <Text style={styles.secondaryText}>Admin</Text>
            </Pressable>
            <Pressable style={[styles.viewModeButton, adminMapViewMode === "player" && styles.typeSelected]} onPress={() => switchAdminMapViewMode("player")}>
              <Text style={styles.secondaryText}>Player View</Text>
            </Pressable>
          </View>
        </View>
      </Frame>
    );
  }

  function toggleAdminPanel(key: string) {
    setOpenAdminPanels((current) => ({ ...current, [key]: current[key] === false }));
  }

  function isAdminPanelOpen(key: string) {
    return openAdminPanels[key] !== false;
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

  function getMiniMapWarningCount(miniMapList: MiniMap[]) {
    return miniMapList.filter((miniMap) => {
      const hasSpawn = adminMiniMapMarkers.some((marker) => marker.mini_map_id === miniMap.id && marker.type === "Player Spawn");
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

  function getAdminSectionSummary(section: (typeof adminSections)[number]) {
    if (section === "World Map") {
      return activeWorldMapSetting ? `${activeWorldMapSetting.name || "Custom map"} configured for this chapter.` : "Using the bundled overworld map.";
    }

    if (section === "World Markers" || section === "Area/Town Markers") {
      const sectionMarkers = getAdminSectionMarkers(section, adminWorldMarkers, adminMiniMapMarkers);
      const hiddenCount = sectionMarkers.filter((marker) => marker.is_active === false).length;
      return `${sectionMarkers.length} marker${sectionMarkers.length === 1 ? "" : "s"}${hiddenCount ? `, ${hiddenCount} hidden` : ""}.`;
    }

    if (section === "Mini Maps") {
      return `${adminMiniMaps.length} mini map${adminMiniMaps.length === 1 ? "" : "s"}, ${adminMiniMapMarkers.length} mini marker${adminMiniMapMarkers.length === 1 ? "" : "s"}.`;
    }

    if (section === "Walking Paths") {
      return `${adminWorldRoutes.length} overworld path${adminWorldRoutes.length === 1 ? "" : "s"} in this chapter.`;
    }

    if (section === "Tutorials") {
      return `${adminTutorialSteps.length} tutorial step${adminTutorialSteps.length === 1 ? "" : "s"}.`;
    }

    if (section === "Rewards/Interactions") {
      return `${adminMapEvents.length} event${adminMapEvents.length === 1 ? "" : "s"} on ${route.name}.`;
    }

    if (section === "Legend") {
      return `${adminLegendItems.length} legend item${adminLegendItems.length === 1 ? "" : "s"}.`;
    }

    return "";
  }

  function getAdminSectionWarningCount(section: (typeof adminSections)[number]) {
    if (section === "World Markers" || section === "Area/Town Markers") {
      return getMarkerWarningCount(getAdminSectionMarkers(section, adminWorldMarkers, adminMiniMapMarkers));
    }
    if (section === "Mini Maps") return getMiniMapWarningCount(adminMiniMaps);
    if (section === "Walking Paths") return getRouteWarningCount(adminWorldRoutes);
    if (section === "Rewards/Interactions") return getEventWarningCount(adminMapEvents);
    return 0;
  }

  async function selectRoute(nextRoute: MapRoute, force = false) {
    if (!force && !isAdmin && isRouteLocked(nextRoute)) {
      setGpsMessage(getRouteLockMessage(nextRoute));
      return;
    }

    setRoute(nextRoute);
    setRouteName(nextRoute.name);
    setRouteOrder(String(nextRoute.sort_order));
    setRouteTerrain(nextRoute.terrain);
    setRouteDanger(nextRoute.danger_level);
    setRouteDistance(String(Math.round(nextRoute.distance_required_meters)));
    setRouteImage(nextRoute.image_url ?? "");
    setRouteLockType(nextRoute.lock_type ?? "public");
    setRouteLockMessage(nextRoute.lock_message ?? "");
    setPathDraft([]);
    setPathSegmentDraft([]);
    setRouteDirection("forward");
    setLastPosition(null);

    const [progress, events] = await Promise.all([getRouteProgress(nextRoute.id), getMapEvents(nextRoute.id)]);
    setMapEvents(events);
    const completions = await getEventCompletions(events.map((event) => event.id));
    setCompletedEventIds((current) => new Set([...current, ...completions.map((completion) => completion.event_id)]));

    if (progress) {
      const savedDistance = Number(progress.distance_walked_meters);
      distanceWalkedRef.current = savedDistance;
      setDistanceWalked(savedDistance);
      setRouteDirection(progress.travel_direction ?? "forward");
      if (progress.current_x_percent !== null && progress.current_y_percent !== null) {
        setSavedPlayerPosition({ x: Number(progress.current_x_percent), y: Number(progress.current_y_percent) });
      }
    } else {
      distanceWalkedRef.current = 0;
      setSavedPlayerPosition(null);
      setDistanceWalked(0);
    }
  }

  function startGpsTracking() {
    if (!hasActiveRoute) {
      setGpsMessage("Choose a story path or sign post path before tracking a walk.");
      return;
    }

    if (Platform.OS !== "web") {
      if (pedometerSubscriptionRef.current) {
        return;
      }
      void (async () => {
        const available = await isNativePedometerAvailable();
        if (!available) {
          setGpsMessage("Pedometer tracking is not available on this device.");
          return;
        }
        const granted = await requestPedometerPermission();
        if (!granted) {
          setGpsMessage("Motion permission is required for iOS pedometer walking.");
          return;
        }

        nativePedometerMetersRef.current = 0;
        movementStateRef.current = "MOVING";
        movementCandidateRef.current = null;
        setPlayerMovementState("MOVING");
        setMovementStatus({
          label: "MOVING",
          speedMph: 0,
          countedMeters: 0,
          blockedReason: null,
        });
        setIsTracking(true);
        setGpsMessage("Pedometer is tracking steps toward your active path.");
        pedometerSubscriptionRef.current = await startPedometerDistancePolling((sample) => {
          const deltaMeters = Math.max(0, sample.distanceMeters - nativePedometerMetersRef.current);
          nativePedometerMetersRef.current = sample.distanceMeters;
          if (deltaMeters <= 0) {
            return;
          }
          setMovementStatus({
            label: "MOVING",
            speedMph: 0,
            countedMeters: deltaMeters,
            blockedReason: null,
          });
          void advanceActiveRouteByMeters(deltaMeters);
        });
      })().catch((error) => {
        setIsTracking(false);
        setGpsMessage(getErrorMessage(error, "Unable to start iOS pedometer tracking."));
      });
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsMessage("Geolocation is not available in this browser.");
      return;
    }

    if (watchId.current !== null) {
      return;
    }

    void requestPushNotificationPermission().then((permission) => {
      if (!permission.granted) {
        console.warn("[notifications] trail alerts are disabled", permission.status);
      }
    });

    setIsTracking(true);
    setGpsMessage("GPS is tracking distance only. Real coordinates are never mapped to the fantasy world.");
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp || Date.now(),
          accuracy: position.coords.accuracy ?? null,
        };

        setLastPosition((previous) => {
          if (!previous) {
            const activeRoute = routeRef.current;
            const currentProgress = (distanceWalkedRef.current / activeRoute.distance_required_meters) * 100;
            setRouteProgressRows((current) => upsertRouteProgressRow(current, activeRoute.id, currentProgress));
            void saveRouteProgress(activeRoute.id, {
              distance_walked_meters: distanceWalkedRef.current,
              progress_percent: currentProgress,
              current_x_percent: playerPosition.x,
              current_y_percent: playerPosition.y,
              last_lat: next.latitude,
              last_lng: next.longitude,
              travel_direction: routeDirectionRef.current,
              is_current: true,
            });
            setMovementStatus({
              label: movementStateRef.current,
              speedMph: 0,
              countedMeters: 0,
              blockedReason: null,
            });
            return next;
          }

          const activeRoute = routeRef.current;
          const meters = turfDistance([previous.longitude, previous.latitude], [next.longitude, next.latitude], { units: "kilometers" }) * 1000;
          const elapsedSeconds = Math.max(0, (next.timestamp - previous.timestamp) / 1000);
          const speedMph = elapsedSeconds > 0 ? metersPerSecondToMph(meters / elapsedSeconds) : 0;
          const movement = classifyMovement({
            meters,
            elapsedSeconds,
            speedMph,
            accuracy: next.accuracy,
          });
          const movementState = movement.blockedReason ? { state: movementStateRef.current, changed: false } : resolveMovementState(speedMph, next.timestamp);
          const shouldCountDistance = movementState.state === "MOVING" && movement.countedMeters > 0;
          const countedMeters = shouldCountDistance ? movement.countedMeters : 0;

          setMovementStatus({
            label: movementState.state,
            speedMph,
            countedMeters,
            blockedReason: movement.blockedReason,
          });

          if (movement.blockedReason) {
            setGpsMessage(movement.blockedReason);
            return next;
          }

          if (!shouldCountDistance) {
            setGpsMessage(`State: ${movementState.state}. Speed ${speedMph.toFixed(1)} mph. Progress starts above ${movementSpeedThresholdMph.toFixed(1)} mph after a steady GPS signal.`);
            return next;
          }

          const cleanMeters = countedMeters;
          void advanceActiveRouteByMeters(cleanMeters, {
            last_lat: next.latitude,
            last_lng: next.longitude,
          }).then(() => {
            setGpsMessage(`State: MOVING. ${routeDirectionRef.current === "reverse" ? "Backtracked" : "Counted"} ${Math.round(cleanMeters)}m at ${speedMph.toFixed(1)} mph.`);
          });

          return next;
        });
      },
      (error) => {
        setGpsMessage(error.message);
        setIsTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
  }

  function stopGpsTracking() {
    if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (pedometerSubscriptionRef.current) {
      pedometerSubscriptionRef.current.remove();
      pedometerSubscriptionRef.current = null;
    }
    nativePedometerMetersRef.current = 0;
    setIsTracking(false);
    setLastPosition(null);
    movementStateRef.current = "IDLE";
    movementCandidateRef.current = null;
    setPlayerMovementState("IDLE");
    setGpsMessage(Platform.OS === "web" ? "GPS paused. Route progress is saved in Supabase." : "Pedometer paused. Route progress is saved in Supabase.");
    setMovementStatus((current) => ({ ...current, label: "IDLE", speedMph: 0, countedMeters: 0 }));
  }

  function zoomBy(delta: number, focal?: { clientX: number; clientY: number }) {
    const viewport = viewportRef.current;
    const rect = viewport?.getBoundingClientRect?.();
    const currentScrollLeft = viewport?.scrollLeft ?? 0;
    const currentScrollTop = viewport?.scrollTop ?? 0;
    const viewportX = focal && rect ? focal.clientX - rect.left : null;
    const viewportY = focal && rect ? focal.clientY - rect.top : null;

    setScale((current) => {
      const next = clamp(current + delta, 0.5, 2.7);

      if (viewport && viewportX !== null && viewportY !== null && next !== current) {
        const unscaledX = (currentScrollLeft + viewportX) / current;
        const unscaledY = (currentScrollTop + viewportY) / current;
        requestAnimationFrame(() => {
          scrollMapTo(unscaledX * next - viewportX, unscaledY * next - viewportY, "auto");
        });
      }

      return next;
    });
  }

  function handlePinchZoom(payload: PinchZoomPayload) {
    zoomBy(payload.delta, { clientX: payload.centerClientX, clientY: payload.centerClientY });
  }

  function resetZoom() {
    setScale(0.86);
    scrollMapTo(0, 0, "auto");
    setFollowPlayer(false);
  }

  function centerOnPlayer() {
    centerOn(playerPosition.x, playerPosition.y);
    setFollowPlayer(true);
  }

  function centerOn(xPercent: number, yPercent: number) {
    const viewport = viewportRef.current;
    const viewportWidth = viewport?.clientWidth ?? 360;
    const viewportHeight = viewport?.clientHeight ?? 520;
    const left = (xPercent / 100) * scaledMapSize.width - viewportWidth / 2;
    const top = (yPercent / 100) * scaledMapSize.height - viewportHeight / 2;
    scrollMapTo(left, top);
  }

  function scrollMapTo(left: number, top: number, behavior: "smooth" | "auto" = "smooth") {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    if (viewport.scrollTo) {
      viewport.scrollTo({ left: Math.max(0, left), top: Math.max(0, top), behavior });
      return;
    }

    viewport.scrollLeft = Math.max(0, left);
    viewport.scrollTop = Math.max(0, top);
  }

  function handleWheel(event: { nativeEvent?: { deltaY?: number } }) {
    const deltaY = event.nativeEvent?.deltaY ?? 0;
    zoomBy(deltaY > 0 ? -0.08 : 0.08);
  }

  function handleMapPointer(event: {
    clientX?: number;
    clientY?: number;
    currentTarget?: {
      getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
      clientWidth?: number;
      clientHeight?: number;
    };
    nativeEvent?: {
      clientX?: number;
      clientY?: number;
      offsetX?: number;
      offsetY?: number;
      locationX?: number;
      locationY?: number;
      changedTouches?: Array<{ clientX?: number; clientY?: number }>;
      touches?: Array<{ clientX?: number; clientY?: number }>;
      target?: { clientWidth?: number; clientHeight?: number };
    };
  }, scope: "world" | "mini" = "world") {
    if (!isAdmin) {
      return;
    }

    const nativeEvent = event.nativeEvent ?? {};
    const touch = nativeEvent.changedTouches?.[0] ?? nativeEvent.touches?.[0];
    const clientX = touch?.clientX ?? nativeEvent.clientX ?? event.clientX;
    const clientY = touch?.clientY ?? nativeEvent.clientY ?? event.clientY;
    const rect = event.currentTarget?.getBoundingClientRect?.();

    if (rect && clientX !== undefined && clientY !== undefined) {
      const x = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
      const y = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
      captureMapPercent(x, y);
      return;
    }

    if (scope === "mini" && nativeEvent.offsetX !== undefined && nativeEvent.offsetY !== undefined) {
      const width = event.currentTarget?.clientWidth ?? nativeEvent.target?.clientWidth ?? 1;
      const height = event.currentTarget?.clientHeight ?? nativeEvent.target?.clientHeight ?? 1;
      const x = clamp((nativeEvent.offsetX / width) * 100, 0, 100);
      const y = clamp((nativeEvent.offsetY / height) * 100, 0, 100);
      captureMapPercent(x, y);
      return;
    }

    if (nativeEvent.locationX !== undefined && nativeEvent.locationY !== undefined) {
      const width = scope === "mini" ? event.currentTarget?.clientWidth ?? nativeEvent.target?.clientWidth ?? scaledMapSize.width : scaledMapSize.width;
      const height = scope === "mini" ? event.currentTarget?.clientHeight ?? nativeEvent.target?.clientHeight ?? scaledMapSize.height : scaledMapSize.height;
      const x = clamp((nativeEvent.locationX / width) * 100, 0, 100);
      const y = clamp((nativeEvent.locationY / height) * 100, 0, 100);
      captureMapPercent(x, y);
    }
  }

  function captureMapPercent(x: number, y: number) {
    const nextPoint = { x: roundPercent(x), y: roundPercent(y) };
    const now = Date.now();
    const lastCapture = lastCaptureRef.current;

    if (lastCapture && now - lastCapture.time < 180 && Math.abs(lastCapture.x - nextPoint.x) < 0.05 && Math.abs(lastCapture.y - nextPoint.y) < 0.05) {
      return;
    }

    lastCaptureRef.current = { time: now, ...nextPoint };
    setClickedPercent(nextPoint);
    setAdminMessage(`Coordinates captured: X ${nextPoint.x}% / Y ${nextPoint.y}%`);

    if (editorMode === "Walking Path") {
      setPathDraft((current) => [...current, nextPoint]);
    }
  }

  async function copyCoordinates() {
    if (!clickedPercent || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(`x_percent=${clickedPercent.x}, y_percent=${clickedPercent.y}`);
  }

  async function addMarker() {
    if (!clickedPercent) {
      setAdminMessage("Tap the map image first to capture X/Y coordinates, then create the marker.");
      return;
    }

    if (!draftTitle.trim()) {
      setAdminMessage("Add a marker title before creating the marker.");
      return;
    }

    const activeMiniMapId = activeMiniMap?.id ?? null;
    const isMiniMapMarker = Boolean(activeMiniMapId);

    if (adminSection === "Mini Maps" && !activeMiniMapId) {
      setAdminMessage("Open a mini map before creating mini-map markers.");
      return;
    }

    if (isMiniMapMarker && draftType === "Player Spawn" && markers.some((marker) => marker.mini_map_id === activeMiniMapId && marker.type === "Player Spawn")) {
      setAdminMessage("This mini map already has a Player Spawn marker. Edit or move the existing spawn instead.");
      return;
    }

    if (!isMiniMapMarker && draftType === "World Spawn" && markers.some((marker) => !marker.mini_map_id && marker.type === "World Spawn")) {
      setAdminMessage("The overworld already has a World Spawn marker. Edit or move the existing spawn instead.");
      return;
    }

    try {
      const markerState = getMarkerPayloadState(activeMiniMapId);
      const created = await createMapMarker(buildCreateMarkerInput(markerState, clickedPercent));
      const configured = await updateMarkerSettings(created.id, getMarkerSettingsPayload("create"));
      if (activeMiniMapId && configured.mini_map_id !== activeMiniMapId) {
        throw new Error("Mini-map marker was saved without the open mini map id. Try again after reopening the mini map.");
      }
      const links = await saveMarkerRouteLinks(configured.id, selectedMarkerRouteIds, selectedSeason, selectedChapter, markerRouteCompletionCondition, selectedMarkerRouteDirections);
      setMarkerRouteLinks(links);
      setAllMarkerRouteLinks((current) => [...current.filter((link) => link.marker_id !== configured.id), ...links]);
      setMarkers((current) => [...current, configured]);
      setSelectedMarker(configured);
      setDraftTitle("");
      setDraftDescription("");
      setClickedPercent(null);
      setAdminMessage("Marker created.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to create marker. Confirm the Supabase migration has run."));
    }
  }

  function getMarkerPayloadState(activeMiniMapId = activeMiniMap?.id ?? null): MarkerPayloadState {
    return {
      draftType,
      draftTitle,
      draftDescription,
      activeMiniMapId,
      selectedMarker,
      selectedMiniMapId,
      markerExitTargetType,
      markerExitTargetMarkerId,
      markerExitTargetMiniMapId,
      markerExitTargetSpawnMarkerId,
      markerLinkedRouteId,
      markerLinkedRouteStartDirection,
      markerStartsRouteOnAccept,
      markerIconLabel,
      markerIconImage,
      markerIconColor,
      markerSize,
      markerLockType,
      markerLockMessage,
      markerVisibleStoryFlagKey,
      markerVisibleStoryFlagValue,
      markerStoryOrder,
      markerUnlockAfterId,
      markerHideWhenCompleted,
      markerRequireAllLinkedRoutes,
      markerDialogueEventId,
      markerBattleEventId,
      markerEnemyId,
      markerNpcId,
      markerInteractable,
      markerQuestTitle,
      markerQuestDialogue,
      markerQuestImage,
      markerShopImage,
      markerShopBackground,
      markerSceneBackground,
      markerNpcImage,
      markerInteractionRadius,
      markerInitiallyUnlocked,
      markerRewardXp,
      markerRewardGold,
      markerRewardItemId,
      markerRewardQuantity,
      markerRewardFullHeal,
      markerRewardTiming,
      markerRepeatable,
      markerRewardOnce,
      selectedSeason,
      selectedChapter,
    };
  }

  function getMarkerSettingsPayload(mode: "create" | "update" = "update") {
    return buildMarkerSettingsPayload(getMarkerPayloadState(), mode);
  }

  async function selectMarker(marker: MapMarker) {
    if (activeMiniMap && !isAdmin && isExitMarker(marker)) {
      void openExitMarker(marker);
      return;
    }

    setPreviewMarkerScene(false);
    setSelectedMarker(marker);
    setDraftType(marker.type || markerTypes[0]);
    setDraftTitle(marker.title);
    setDraftDescription(marker.description ?? "");
    setMarkerQuestTitle(marker.quest_title ?? "");
    setMarkerQuestDialogue(marker.quest_dialogue ?? "");
    setMarkerQuestImage(marker.quest_image_url ?? "");
    setMarkerShopImage(marker.shop_image_url ?? "");
    setMarkerShopBackground(marker.shop_background_image_url ?? "");
    setMarkerSceneBackground(marker.scene_background_image_url ?? "");
    setMarkerNpcImage(marker.scene_npc_image_url ?? "");
    setMarkerIconLabel(marker.icon_label ?? "");
    setMarkerIconImage(marker.icon_image_url ?? "");
    setMarkerIconColor(marker.icon_color ?? "");
    setMarkerSize(String(marker.marker_size ?? 100));
    setMarkerLockType(marker.lock_type ?? "public");
    setMarkerLockMessage(marker.lock_message ?? "");
    setMarkerVisibleStoryFlagKey(marker.visible_story_flag_key ?? "");
    setMarkerVisibleStoryFlagValue(marker.visible_story_flag_value ?? true);
    setMarkerStoryOrder(String(marker.story_order ?? 0));
    setMarkerUnlockAfterId(marker.unlock_after_marker_id ?? null);
    setMarkerHideWhenCompleted(marker.hide_when_completed ?? true);
    setMarkerRequireAllLinkedRoutes(marker.require_all_linked_routes ?? true);
    setMarkerDialogueEventId(marker.dialogue_event_id ?? null);
    setMarkerBattleEventId(marker.battle_event_id ?? null);
    setMarkerEnemyId(marker.enemy_id ?? null);
    setMarkerNpcId(marker.npc_id ?? null);
    setMarkerInteractionRadius(String(marker.interaction_radius_percent ?? 4));
    setMarkerInteractable(marker.is_interactable ?? true);
    setMarkerInitiallyUnlocked(marker.is_unlocked ?? true);
    setMarkerRewardXp(String(marker.reward_xp ?? 0));
    setMarkerRewardGold(String(marker.reward_gold ?? 0));
    setMarkerRewardItemId(marker.reward_item_id ?? null);
    setMarkerRewardQuantity(String(marker.reward_item_quantity ?? 1));
    setMarkerRewardFullHeal(Boolean(marker.reward_full_heal));
    setMarkerRewardTiming(marker.reward_timing ?? "on_interact");
    setMarkerRepeatable(Boolean(marker.repeatable));
    setMarkerRewardOnce(marker.reward_once_per_player ?? true);
    setMarkerLinkedRouteId(marker.linked_route_id ?? null);
    setMarkerLinkedRouteStartDirection(marker.linked_route_start_direction ?? "forward");
    setMarkerStartsRouteOnAccept(Boolean(marker.starts_route_on_accept));
    setMarkerExitTargetType(marker.exit_target_type ?? "world_marker");
    setMarkerExitTargetMarkerId(marker.exit_target_marker_id ?? null);
    setMarkerExitTargetMiniMapId(marker.exit_target_type === "mini_map" ? marker.linked_mini_map_id : null);
    setMarkerExitTargetSpawnMarkerId((marker.exit_target_type === "mini_map" || marker.type === "Area/Town Entrance") ? marker.exit_target_spawn_marker_id ?? null : null);
    setSelectedMiniMapId(marker.linked_mini_map_id ?? marker.mini_map_id ?? selectedMiniMapId);
    setMarkerPanelMessage(null);

    try {
      const [links, markerNodes] = await Promise.all([
        getMarkerRouteLinks(marker.id),
        supportsMarkerDialogue(marker.type) ? getDialogueNodesForMarker(marker.id) : Promise.resolve([]),
      ]);
      await loadMarkerMarketState(marker.id);
      if (isBattleMarkerType(marker.type)) {
        await loadMarkerBattlefieldCombatants(marker.id);
      } else {
        setBattlefieldCombatants([]);
      }
      setMarkerRouteLinks(links);
      setSelectedMarkerRouteIds(links.map((link) => link.route_id));
      setSelectedMarkerRouteDirections(Object.fromEntries(links.map((link) => [link.route_id, link.start_direction ?? "forward"])));
      setMarkerRouteCompletionCondition(links[0]?.completion_condition ?? "either");
      setMarkerDialogueIds((current) => {
        const next = new Set(current);
        if (markerNodes.length > 0 || marker.dialogue_event_id) {
          next.add(marker.id);
        } else {
          next.delete(marker.id);
        }
        return next;
      });
    } catch (error) {
      setMarkerPanelMessage(getErrorMessage(error, "Unable to load marker market."));
    }
  }

  async function reuseStoryMarkerInMiniMap(marker: MapMarker) {
    if (!activeMiniMap) {
      setAdminMessage("Open a mini map before reusing a story marker.");
      return;
    }

    setEditorMode("Marker");
    setAdminSection("Mini Maps");
    setSelectedMarker(null);
    setPreviewMarkerScene(false);
    setDraftType(marker.type === "Quest" ? "Quest" : "Story");
    setDraftTitle(marker.title);
    setDraftDescription(marker.description ?? "");
    setMarkerQuestTitle(marker.quest_title ?? marker.title);
    setMarkerQuestDialogue(marker.quest_dialogue ?? "");
    setMarkerQuestImage(marker.quest_image_url ?? "");
    setMarkerSceneBackground(marker.scene_background_image_url ?? "");
    setMarkerNpcImage(marker.scene_npc_image_url ?? "");
    setMarkerIconLabel(marker.icon_label ?? "");
    setMarkerIconImage(marker.icon_image_url ?? "");
    setMarkerIconColor(marker.icon_color ?? "");
    setMarkerSize(String(marker.marker_size ?? 100));
    setMarkerLockType(marker.lock_type ?? "public");
    setMarkerLockMessage(marker.lock_message ?? "");
    setMarkerVisibleStoryFlagKey(marker.visible_story_flag_key ?? "");
    setMarkerVisibleStoryFlagValue(marker.visible_story_flag_value ?? true);
    setMarkerStoryOrder(String(marker.story_order ?? 0));
    setMarkerUnlockAfterId(null);
    setMarkerHideWhenCompleted(marker.hide_when_completed ?? true);
    setMarkerRequireAllLinkedRoutes(marker.require_all_linked_routes ?? true);
    setMarkerInteractionRadius(String(marker.interaction_radius_percent ?? 4));
    setMarkerInteractable(marker.is_interactable ?? true);
    setMarkerRewardXp(String(marker.reward_xp ?? 0));
    setMarkerRewardGold(String(marker.reward_gold ?? 0));
    setMarkerRewardItemId(marker.reward_item_id ?? null);
    setMarkerRewardQuantity(String(marker.reward_item_quantity ?? 1));
    setMarkerRewardFullHeal(Boolean(marker.reward_full_heal));
    setMarkerRewardTiming(marker.reward_timing ?? "on_interact");
    setMarkerRepeatable(Boolean(marker.repeatable));
    setMarkerRewardOnce(marker.reward_once_per_player ?? true);
    setMarkerLinkedRouteId(marker.linked_route_id ?? null);
    setMarkerLinkedRouteStartDirection(marker.linked_route_start_direction ?? "forward");
    setMarkerStartsRouteOnAccept(Boolean(marker.starts_route_on_accept));

    try {
      const links = await getMarkerRouteLinks(marker.id);
      setMarkerRouteLinks(links);
      setSelectedMarkerRouteIds(links.map((link) => link.route_id));
      setSelectedMarkerRouteDirections(Object.fromEntries(links.map((link) => [link.route_id, link.start_direction ?? "forward"])));
      setMarkerRouteCompletionCondition(links[0]?.completion_condition ?? "either");
      setAdminMessage(clickedPercent ? `Loaded ${marker.title}. Save it to place a copy in ${activeMiniMap.name}.` : `Loaded ${marker.title}. Tap the mini map to choose its new position, then save.`);
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Story loaded, but linked paths could not be copied."));
    }
  }

  async function loadMarkerMarketState(markerId: string) {
    const items = await getMarkerMarketItems(markerId);
    setMarkerMarketItems(items);
    setMarketPurchaseCounts(await getPlayerMarketPurchaseCounts(items.map((item) => item.id)));
  }

  async function previewMarker(marker: MapMarker) {
    await selectMarker(marker);
    setPreviewMarkerScene(true);
  }

  function closeMarkerScene() {
    setPreviewMarkerScene(false);
    setSelectedMarker(null);
    setMarkerPanelMessage(null);
    setMarketPurchaseCounts({});
  }

  async function saveSelectedMarkerSettings() {
    if (!selectedMarker) {
      return;
    }

    if (
      selectedMarker.mini_map_id &&
      draftType === "Player Spawn" &&
      markers.some((marker) => marker.id !== selectedMarker.id && marker.mini_map_id === selectedMarker.mini_map_id && marker.type === "Player Spawn")
    ) {
      setAdminMessage("This mini map already has a Player Spawn marker. Move or edit that spawn instead.");
      return;
    }

    if (
      !selectedMarker.mini_map_id &&
      draftType === "World Spawn" &&
      markers.some((marker) => marker.id !== selectedMarker.id && !marker.mini_map_id && marker.type === "World Spawn")
    ) {
      setAdminMessage("The overworld already has a World Spawn marker. Move or edit that spawn instead.");
      return;
    }

    try {
      const moved = clickedPercent
        ? await updateMapMarker(selectedMarker.id, {
            x_percent: clickedPercent.x,
            y_percent: clickedPercent.y,
          })
        : selectedMarker;
      const updated = await updateMarkerSettings(moved.id, getMarkerSettingsPayload());
      const links = await saveMarkerRouteLinks(updated.id, selectedMarkerRouteIds, selectedSeason, selectedChapter, markerRouteCompletionCondition, selectedMarkerRouteDirections);
      setMarkerRouteLinks(links);
      setAllMarkerRouteLinks((current) => [...current.filter((link) => link.marker_id !== updated.id), ...links]);
      setMarkers((current) => current.map((marker) => (marker.id === updated.id ? updated : marker)));
      setSelectedMarker(updated);
      setClickedPercent(null);
      setAdminMessage("Marker settings saved.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to save marker settings."));
    }
  }

  async function saveMarketItem() {
    if (!selectedMarker || !marketItemId) {
      setAdminMessage("Select a marker and item first.");
      return;
    }

    try {
      const saved = await saveMarkerMarketItem({
        marker_id: selectedMarker.id,
        item_id: marketItemId,
        buy_price: Number(marketBuyPrice) || 0,
        sell_price: Number(marketSellPrice) || 0,
        stock_quantity: marketUnlimited ? null : Number(marketStock) || 0,
        unlimited_stock: marketUnlimited,
        listing_mode: marketListingMode,
        season_number: selectedSeason,
        chapter_number: selectedChapter,
      });
      setMarkerMarketItems((current) => [saved, ...current.filter((item) => item.id !== saved.id && item.item_id !== saved.item_id)]);
      setAdminMessage("Market item saved.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to save market item."));
    }
  }

  async function removeMarketItem(marketItemId: string) {
    try {
      await deleteMarkerMarketItem(marketItemId);
      setMarkerMarketItems((current) => current.filter((item) => item.id !== marketItemId));
      setAdminMessage("Market item removed.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to remove market item."));
    }
  }

  function clearLegendForm() {
    setEditingLegendItemId(null);
    setLegendMarkerType("Market");
    setLegendTitle("");
    setLegendDescription("");
    setLegendIconLabel("");
    setLegendIconImage("");
    setLegendIconColor("");
    setLegendSortOrder("0");
    setLegendActive(true);
  }

  function editLegendItem(item: MarkerLegendItem) {
    setEditingLegendItemId(item.id);
    setLegendMarkerType(item.marker_type);
    setLegendTitle(item.title);
    setLegendDescription(item.description ?? "");
    setLegendIconLabel(item.icon_label ?? "");
    setLegendIconImage(item.icon_image_url ?? "");
    setLegendIconColor(item.icon_color ?? "");
    setLegendSortOrder(String(item.sort_order ?? 0));
    setLegendActive(item.is_active);
  }

  async function saveLegendItemForm() {
    try {
      const saved = await saveMarkerLegendItem({
        id: editingLegendItemId ?? undefined,
        marker_type: legendMarkerType,
        title: legendTitle,
        description: legendDescription,
        icon_label: legendIconLabel,
        icon_image_url: legendIconImage,
        icon_color: legendIconColor,
        sort_order: Number(legendSortOrder) || 0,
        is_active: legendActive,
        season_number: selectedSeason,
        chapter_number: selectedChapter,
      });
      setLegendItems((current) => [saved, ...current.filter((item) => item.id !== saved.id)].sort((a, b) => a.sort_order - b.sort_order));
      clearLegendForm();
      setAdminMessage("Legend item saved.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to save legend item. Confirm the Supabase migration has run."));
    }
  }

  async function removeLegendItem(legendItemId: string) {
    try {
      await deleteMarkerLegendItem(legendItemId);
      setLegendItems((current) => current.filter((item) => item.id !== legendItemId));
      if (editingLegendItemId === legendItemId) {
        clearLegendForm();
      }
      setAdminMessage("Legend item deleted.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to delete legend item."));
    }
  }

  async function buyFromMarker(marketItem: MarkerMarketItem) {
    try {
      const result = await buyMarketItem(character, marketItem);
      onCharacterUpdated({ ...character, gold: result.gold });
      setMarkerPanelMessage("Item purchased.");
      showGameToast({
        title: "Item Added",
        message: "Your purchase was added to Inventory.",
        rewards: [{ label: getItemName(itemDefinitions, marketItem.item_id) }],
        actionLabel: "OK",
      });
      await loadInventory();
      if (selectedMarker) {
        await loadMarkerMarketState(selectedMarker.id);
      }
    } catch (error) {
      setMarkerPanelMessage(getErrorMessage(error, "Unable to buy item."));
    }
  }

  async function sellToMarker(entry: InventoryItem) {
    const marketItem = markerMarketItems.find((item) => item.item_id === entry.item_id && canMarketItemBeSoldTo(item));

    if (!marketItem) {
      setMarkerPanelMessage("This market is not buying that item.");
      return;
    }

    const sellPrice = marketItem.sell_price;

    try {
      const result = await sellMarketInventoryItem(character, entry, sellPrice);
      onCharacterUpdated({ ...character, gold: result.gold });
      setMarkerPanelMessage("Item sold.");
      await loadInventory();
    } catch (error) {
      setMarkerPanelMessage(getErrorMessage(error, "Unable to sell item."));
    }
  }

  async function claimSelectedMarkerReward() {
    if (!selectedMarker) {
      return;
    }

    if (selectedMarker.reward_timing === "on_path_complete") {
      setMarkerPanelMessage("This reward is granted after completing the linked walking path.");
      return;
    }

    try {
      const result = await applyRewards(character, {
        xp: selectedMarker.reward_xp,
        gold: selectedMarker.reward_gold,
        itemId: selectedMarker.reward_item_id,
        itemQuantity: selectedMarker.reward_item_quantity,
        fullHeal: selectedMarker.reward_full_heal,
        fullHealMaxHealth: combatResources.maxHp,
        repeatable: selectedMarker.repeatable,
        rewardOncePerPlayer: selectedMarker.reward_once_per_player,
        markerId: selectedMarker.id,
      });
      if (isStoryQuestMarker(selectedMarker)) {
        const completedMarker = selectedMarker;
        const nextMarker = getNextStoryMarkerAfter(completedMarker);
        await completeStoryMarker(selectedMarker.id);
        setCompletedStoryMarkerIds((current) => new Set([...current, selectedMarker.id]));
        setSelectedMarker(null);
        setPreviewMarkerScene(false);
        setMarkerPanelMessage(null);
        setGpsMessage(result.claimed ? `${selectedMarker.quest_title || selectedMarker.title} completed. ${result.message}` : `${selectedMarker.quest_title || selectedMarker.title} completed.`);
        showJourneyToast({
          title: `${completedMarker.quest_title || completedMarker.title} Complete`,
          message: nextMarker ? "Your story continues at the next marker." : "This story step is complete.",
          rewards: result.claimed ? buildRewardToastItems({
            xp: completedMarker.reward_xp,
            gold: completedMarker.reward_gold,
            itemId: completedMarker.reward_item_id,
            itemQuantity: completedMarker.reward_item_quantity,
            fullHeal: completedMarker.reward_full_heal,
          }) : [],
          nextMarker,
        });
        await loadInventory();
        if (result.currentHealth != null) {
          onCharacterUpdated({ ...character, current_health: result.currentHealth });
        }
        return;
      }
      setMarkerPanelMessage(result.message);
      if (result.claimed) {
        showGameToast({
          title: selectedMarker.quest_title || selectedMarker.title,
          message: "Reward claimed.",
          rewards: buildRewardToastItems({
            xp: selectedMarker.reward_xp,
            gold: selectedMarker.reward_gold,
            itemId: selectedMarker.reward_item_id,
            itemQuantity: selectedMarker.reward_item_quantity,
            fullHeal: selectedMarker.reward_full_heal,
          }),
          actionLabel: "OK",
        });
      }
      await loadInventory();
      if (result.currentHealth != null) {
        onCharacterUpdated({ ...character, current_health: result.currentHealth });
      }
    } catch (error) {
      setMarkerPanelMessage(getErrorMessage(error, "Unable to claim marker reward."));
    }
  }

  async function completeSelectedStoryMarker(marker: MapMarker) {
    try {
      const result = await applyRewards(character, {
        xp: marker.reward_xp,
        gold: marker.reward_gold,
        itemId: marker.reward_item_id,
        itemQuantity: marker.reward_item_quantity,
        fullHeal: marker.reward_full_heal,
        fullHealMaxHealth: combatResources.maxHp,
        repeatable: marker.repeatable,
        rewardOncePerPlayer: marker.reward_once_per_player,
        markerId: marker.id,
      });
      await completeStoryMarker(marker.id);
      setCompletedStoryMarkerIds((current) => new Set([...current, marker.id]));
      setSelectedMarker(null);
      setPreviewMarkerScene(false);
      setMarkerPanelMessage(null);
      setGpsMessage(result.claimed ? `${marker.quest_title || marker.title} completed. ${result.message}` : `${marker.quest_title || marker.title} completed.`);
      showJourneyToast({
        title: `${marker.quest_title || marker.title} Complete`,
        message: getNextStoryMarkerAfter(marker) ? "Your story continues at the next marker." : "This story quest is complete.",
        rewards: result.claimed ? buildRewardToastItems({
          xp: marker.reward_xp,
          gold: marker.reward_gold,
          itemId: marker.reward_item_id,
          itemQuantity: marker.reward_item_quantity,
          fullHeal: marker.reward_full_heal,
        }) : [],
        nextMarker: getNextStoryMarkerAfter(marker),
      });
      await loadInventory();
      if (result.currentHealth != null) {
        onCharacterUpdated({ ...character, current_health: result.currentHealth });
      }
    } catch (error) {
      setMarkerPanelMessage(getErrorMessage(error, "Unable to complete story quest."));
    }
  }

  async function acceptSelectedMarkerQuest() {
    if (!selectedMarker) {
      return;
    }

    await startMarkerQuestFromDialogueOrScene(selectedMarker, markerRouteLinks);
  }

  async function markStoryMarkerStartedForPlayer(marker: MapMarker) {
    if (!isStoryQuestMarker(marker) || marker.hide_when_completed === false) {
      return;
    }

    try {
      await startStoryMarker(marker.id);
      setStartedStoryMarkerIds((current) => new Set([...current, marker.id]));
    } catch (error) {
      console.warn("[map] unable to save story marker start", error);
    }
  }

  async function startMarkerQuestFromDialogueOrScene(marker: MapMarker, routeLinksForMarker?: MarkerRouteLink[]) {
    const routeLinksToUse = routeLinksForMarker ?? await getMarkerRouteLinks(marker.id);

    if (!marker.starts_route_on_accept && routeLinksToUse.length === 0) {
      if (selectedMarker?.id === marker.id) {
        await claimSelectedMarkerReward();
      } else {
        await completeSelectedStoryMarker(marker);
      }
      return;
    }

    const orderedLinks = getOrderedMarkerRouteLinks(routeLinksToUse);
    const firstIncompleteLink = orderedLinks.find((link) => {
      const progress = routeProgressRows.find((row) => row.route_id === link.route_id)?.progress_percent ?? 0;
      return progress < 100;
    });

    if (orderedLinks.length > 0 && !firstIncompleteLink) {
      await completeSelectedStoryMarker(marker);
      return;
    }

    const routeId = firstIncompleteLink?.route_id ?? marker.linked_route_id;
    const linkedRoute = routes.find((item) => item.id === routeId);

    if (!linkedRoute) {
      setMarkerPanelMessage("This quest is linked to a walking path that could not be found.");
      return;
    }

    try {
      const startPoint = linkedRoute.path_points[0] ?? { x: 33.8, y: 73.81 };
      const targetMiniMap = linkedRoute.mini_map_id ? miniMaps.find((item) => item.id === linkedRoute.mini_map_id) ?? null : null;
      await setCurrentRoute(linkedRoute.id);
      setHasActiveRoute(true);
      setActiveMiniMap(targetMiniMap);
      setSelectedMiniMapId(targetMiniMap?.id ?? null);
      setSavedMiniMapPosition(null);
      if (targetMiniMap) {
        void savePlayerMapState({ active_mini_map_id: targetMiniMap.id, current_x_percent: startPoint.x, current_y_percent: startPoint.y });
      } else {
        void clearPlayerMapState();
      }
      setSelectedMarker(null);
      setPreviewMarkerScene(false);
      setMarkerPanelMessage(null);
      const savedProgress = await saveRouteProgress(linkedRoute.id, {
        distance_walked_meters: 0,
        progress_percent: 0,
        current_x_percent: startPoint.x,
        current_y_percent: startPoint.y,
        last_lat: null,
        last_lng: null,
        source_marker_id: marker.id,
      });
      setRouteProgressRows((current) => {
        const rows = upsertRouteProgressRow(current, linkedRoute.id, 0).map((row) => ({
          ...row,
          is_current: row.route_id === linkedRoute.id,
          ...(row.route_id === linkedRoute.id ? { source_marker_id: marker.id, travel_direction: "forward" as const } : {}),
        }));
        return savedProgress ? rows.map((row) => (row.route_id === linkedRoute.id ? savedProgress : row)) : rows;
      });
      if (orderedLinks.length <= 1) {
        await markStoryMarkerStartedForPlayer(marker);
      }
      await selectRoute(linkedRoute, true);
      setSavedPlayerPosition(startPoint);
      distanceWalkedRef.current = 0;
      setDistanceWalked(0);
      setGpsMessage(`${marker.quest_title || marker.title} accepted. ${linkedRoute.name} is now the active walking path.`);
    } catch (error) {
      setMarkerPanelMessage(getErrorMessage(error, "Unable to start linked walking path."));
    }
  }

  async function openSelectedMarkerDialogue() {
    if (!selectedMarker) {
      return;
    }

    try {
      const markerNodes = await getDialogueNodesForMarker(selectedMarker.id);
      const event = markerNodes.length > 0
        ? createMarkerDialogueEvent(selectedMarker)
        : selectedMarker.dialogue_event_id
          ? allMapEvents.find((item) => item.id === selectedMarker.dialogue_event_id) ?? null
          : null;

      if (!event) {
        setMarkerPanelMessage("No marker dialogue tree has been built yet.");
        return;
      }

      setActiveMarkerEventId(selectedMarker.id);
      setSelectedMarker(null);
      setPreviewMarkerScene(false);
      setMarkerPanelMessage(null);
      setActiveBattle(null);
      setActiveEvent(event);
      if (markerNodes.length > 0) {
        await loadDialogueForMarker(selectedMarker.id, markerNodes);
      } else {
        await loadDialogueForEvent(event);
      }
    } catch (error) {
      setMarkerPanelMessage(getErrorMessage(error, "Unable to open dialogue."));
    }
  }

  async function startSelectedMarkerBattle() {
    if (!selectedMarker) {
      return;
    }

    let hasMarkerBattleActors = battlefieldCombatants.some((combatant) => combatant.side === "enemy" && combatant.is_active && (combatant.enemy_id || combatant.npc_id));
    if (!hasMarkerBattleActors && !selectedMarker.battle_event_id && !selectedMarker.enemy_id && !selectedMarker.npc_id) {
      try {
        const markerActors = await getMarkerBattleCombatants(selectedMarker.id);
        hasMarkerBattleActors = markerActors.some((combatant) => combatant.side === "enemy" && combatant.is_active && (combatant.enemy_id || combatant.npc_id));
      } catch {
        hasMarkerBattleActors = false;
      }
    }

    if (!selectedMarker.battle_event_id && !selectedMarker.enemy_id && !selectedMarker.npc_id && !hasMarkerBattleActors) {
      setMarkerPanelMessage("No Battle Event, Enemy, NPC, or Marker Battle Board enemy is linked to this battle marker yet.");
      return;
    }

    const event = selectedMarker.battle_event_id
      ? allMapEvents.find((item) => item.id === selectedMarker.battle_event_id) ?? null
      : createMarkerBattleEvent(selectedMarker, enemyDefinitions, npcDefinitions);

    if (!event) {
      setMarkerPanelMessage("The linked Battle Event could not be found. Re-link this marker to a saved Battle Event.");
      return;
    }

    const result = await startBattle(event, false, { saveRoutePosition: false });

    if (!result.ok) {
      setMarkerPanelMessage(result.message ?? "Unable to start this battle marker. Check the selected Enemy or NPC.");
      return;
    }

    setActiveMarkerEventId(selectedMarker.id);
    setSelectedMarker(null);
    setPreviewMarkerScene(false);
    setMarkerPanelMessage(null);
  }

  async function grantPathCompletionMarkerReward(routeId: string) {
    try {
      const progress = await getRouteProgress(routeId);
      if (!progress?.source_marker_id) {
        return;
      }

      const completedRoute = routes.find((item) => item.id === routeId) ?? route;
      const suppressCompletionToast = Boolean(completedRoute.mini_map_id);
      const sourceMarker = markers.find((marker) => marker.id === progress.source_marker_id);
      if (!sourceMarker || (sourceMarker.reward_timing !== "on_path_complete" && !isStoryQuestMarker(sourceMarker))) {
        return;
      }

      const linkedRoutes = getOrderedMarkerRouteLinks(await getMarkerRouteLinks(sourceMarker.id))
        .map((link) => routes.find((item) => item.id === link.route_id))
        .filter(Boolean) as MapRoute[];
      const completedRouteIds = new Set(routeProgressRows.filter((row) => Number(row.progress_percent) >= 100).map((row) => row.route_id));
      completedRouteIds.add(routeId);
      const nextRoute = linkedRoutes.find((item) => !completedRouteIds.has(item.id));

      if (nextRoute && sourceMarker.require_all_linked_routes !== false) {
        setGpsMessage(`${route.name} completed. Return to ${sourceMarker.quest_title || sourceMarker.title} to choose the next story path.`);
        if (!suppressCompletionToast) {
          showJourneyToast({
            title: "Path Complete",
            message: `The next story path is available, but it will not start automatically. Return to ${sourceMarker.quest_title || sourceMarker.title} when you are ready.`,
            nextMarker: sourceMarker,
          });
        }
        return;
      }

      const result = await applyRewards(character, {
        xp: sourceMarker.reward_xp,
        gold: sourceMarker.reward_gold,
        itemId: sourceMarker.reward_item_id,
        itemQuantity: sourceMarker.reward_item_quantity,
        fullHeal: sourceMarker.reward_full_heal,
        fullHealMaxHealth: combatResources.maxHp,
        repeatable: sourceMarker.repeatable,
        rewardOncePerPlayer: sourceMarker.reward_once_per_player,
        markerId: sourceMarker.id,
      });

      if (isStoryQuestMarker(sourceMarker)) {
        await completeStoryMarker(sourceMarker.id);
        setCompletedStoryMarkerIds((current) => new Set([...current, sourceMarker.id]));
      }

      setGpsMessage(result.claimed ? `${route.name} completed. ${result.message}` : `${route.name} completed. ${sourceMarker.quest_title || sourceMarker.title} is now complete.`);
      if (!suppressCompletionToast) {
        showJourneyToast({
          title: `${route.name} Complete`,
          message: isStoryQuestMarker(sourceMarker)
            ? "This story path is complete. Look for the next story marker."
            : "Path complete. Your rewards were added.",
          rewards: result.claimed ? buildRewardToastItems({
            xp: sourceMarker.reward_xp,
            gold: sourceMarker.reward_gold,
            itemId: sourceMarker.reward_item_id,
            itemQuantity: sourceMarker.reward_item_quantity,
            fullHeal: sourceMarker.reward_full_heal,
          }) : [],
          nextMarker: getNextStoryMarkerAfter(sourceMarker),
        });
      }
      await loadInventory();
      if (result.currentHealth != null) {
        onCharacterUpdated({ ...character, current_health: result.currentHealth });
      }
    } catch (error) {
      setGpsMessage(getErrorMessage(error, "Path completed, but the linked quest reward could not be granted."));
    }
  }

  function toggleSignPostRoute(routeId: string) {
    setSelectedMarkerRouteIds((current) => {
      if (current.includes(routeId)) {
        setSelectedMarkerRouteDirections((directions) => {
          const next = { ...directions };
          delete next[routeId];
          return next;
        });
        return current.filter((id) => id !== routeId);
      }

      setSelectedMarkerRouteDirections((directions) => ({ ...directions, [routeId]: directions[routeId] ?? "forward" }));
      return [...current, routeId];
    });
  }

  function setSignPostRouteDirection(routeId: string, direction: MarkerRouteLink["start_direction"]) {
    setSelectedMarkerRouteDirections((current) => ({ ...current, [routeId]: direction }));
  }

  async function startPathFromSignPost(nextRoute: MapRoute, routeLink?: Pick<MarkerRouteLink, "start_direction">) {
    if (!isAdmin && isRouteLocked(nextRoute)) {
      setMarkerPanelMessage(getRouteLockMessage(nextRoute));
      return;
    }

    const progress = await getRouteProgress(nextRoute.id);
    const hasExplicitStartDirection = Boolean(routeLink?.start_direction);
    const selectedDirection = routeLink?.start_direction ?? "forward";
    const savedProgress = hasExplicitStartDirection
      ? selectedDirection === "reverse" ? 100 : 0
      : Number(progress?.progress_percent ?? 0);
    const isCompletedNonStoryRoute = savedProgress >= 100 && !progress?.source_marker_id && !hasExplicitStartDirection;
    const existingDistance = isCompletedNonStoryRoute
      ? selectedDirection === "reverse" ? Number(nextRoute.distance_required_meters) || 0 : 0
      : hasExplicitStartDirection
        ? selectedDirection === "reverse" ? Number(nextRoute.distance_required_meters) || 0 : 0
        : Number(progress?.distance_walked_meters ?? 0);
    const nextProgress = hasExplicitStartDirection
      ? selectedDirection === "reverse" ? 100 : 0
      : isCompletedNonStoryRoute
      ? selectedDirection === "reverse" ? 100 : 0
      : Math.min(100, Math.max(0, progress?.progress_percent ?? (existingDistance / nextRoute.distance_required_meters) * 100));
    const nextPoint = getPointOnRoute(nextRoute.path_points, nextProgress);

    await setCurrentRoute(nextRoute.id);
    setHasActiveRoute(true);
    setRouteDirection(selectedDirection);
    routeDirectionRef.current = selectedDirection;
    distanceWalkedRef.current = existingDistance;
    setDistanceWalked(existingDistance);
    setSavedPlayerPosition(nextPoint);
    setRouteProgressRows((current) =>
      upsertRouteProgressRow(current, nextRoute.id, nextProgress).map((row) => (
        row.route_id === nextRoute.id
          ? {
              ...row,
              distance_walked_meters: existingDistance,
              progress_percent: nextProgress,
              current_x_percent: nextPoint.x,
              current_y_percent: nextPoint.y,
              travel_direction: selectedDirection,
              is_current: true,
            }
          : { ...row, is_current: false }
      )),
    );
    await saveRouteProgress(nextRoute.id, {
      distance_walked_meters: existingDistance,
      progress_percent: nextProgress,
      current_x_percent: nextPoint.x,
      current_y_percent: nextPoint.y,
      last_lat: null,
      last_lng: null,
      travel_direction: selectedDirection,
      is_current: true,
      source_marker_id: isCompletedNonStoryRoute ? null : progress?.source_marker_id ?? null,
    });
    if (isCompletedNonStoryRoute) {
      setCompletedRouteId(null);
    }
    setSelectedMarker(null);
    setPreviewMarkerScene(false);
    setMarkerPanelMessage(null);
    const nextMiniMap = nextRoute.mini_map_id ? miniMaps.find((item) => item.id === nextRoute.mini_map_id) ?? null : null;
    setActiveMiniMap(nextMiniMap);
    setSelectedMiniMapId(nextMiniMap?.id ?? null);
    setSavedMiniMapPosition(null);
    if (nextMiniMap) {
      void savePlayerMapState({ active_mini_map_id: nextMiniMap.id, current_x_percent: nextPoint.x, current_y_percent: nextPoint.y });
    } else {
      void clearPlayerMapState();
    }
    await selectRoute(nextRoute, true);
    setGpsMessage(`${nextRoute.name} is now your active walking path.`);
  }

  async function turnBackOnCurrentPath() {
    const nextPoint = getPointOnRoute(route.path_points, progressPercent);
    const nextDirection = routeDirection === "reverse" ? "forward" : "reverse";
    setRouteDirection(nextDirection);
    routeDirectionRef.current = nextDirection;
    setSavedPlayerPosition(nextPoint);
    await saveRouteProgress(route.id, {
      distance_walked_meters: distanceWalkedRef.current,
      progress_percent: progressPercent,
      current_x_percent: nextPoint.x,
      current_y_percent: nextPoint.y,
      last_lat: null,
      last_lng: null,
      travel_direction: nextDirection,
      is_current: true,
    });
    setGpsMessage(
      nextDirection === "reverse"
        ? `Turning back on ${route.name}. Walking now returns you toward the starting sign post.`
        : `Continuing forward on ${route.name}. Walking now heads toward the destination sign post.`,
    );
  }

  async function useMapConsumable(entry: InventoryItem) {
    const item = entry.item;

    if (!canUseItemInContext(item, "outside")) {
      setMapItemMessage("This item cannot be used while traveling.");
      return;
    }

    if (!["potion", "revive potion", "consumable", "food"].includes(item.type)) {
      setMapItemMessage(`${item.name} is not a quick-use consumable.`);
      return;
    }

    const target = item.potion_target ?? "health";
    if (target !== "health") {
      setMapItemMessage("Only health consumables can be used from the map for now.");
      return;
    }

    if (currentHealth >= combatResources.maxHp) {
      setMapItemMessage("Health is already full.");
      return;
    }

    try {
      const restoreFromPercent = item.restore_percent ? Math.ceil(combatResources.maxHp * (item.restore_percent / 100)) : 0;
      const amount = Math.max(Number(item.restore_amount ?? 0), restoreFromPercent, 1);
      const nextHealth = clampHealth(currentHealth + amount, combatResources.maxHp);
      await savePlayerHealth(nextHealth);
      await consumeInventoryItem(entry, 1);
      await loadInventory();
      setMapItemMessage(`Used ${item.name}. Health ${nextHealth} / ${combatResources.maxHp}.`);
    } catch (error) {
      setMapItemMessage(getErrorMessage(error, "Unable to use item."));
    }
  }

  async function equipMapItem(entry: InventoryItem) {
    try {
      await equipInventoryItem(character.id, entry.item);
      setMapItemMessage(`${entry.item.name} equipped.`);
      await loadInventory();
      await loadCombatLoadout();
    } catch (error) {
      setMapItemMessage(getErrorMessage(error, "Unable to equip item."));
    }
  }

  async function unequipMapSlot(slot: EquipmentSlot) {
    try {
      await unequipInventorySlot(character.id, slot);
      setMapItemMessage("Item unequipped.");
      await loadInventory();
      await loadCombatLoadout();
    } catch (error) {
      setMapItemMessage(getErrorMessage(error, "Unable to unequip item."));
    }
  }

  async function dropMapItem(entry: InventoryItem) {
    try {
      await consumeInventoryItem(entry, 1);
      setSelectedMapInventoryItemId(null);
      setMapItemMessage(`Dropped ${entry.item.name}.`);
      await loadInventory();
      await loadCombatLoadout();
    } catch (error) {
      setMapItemMessage(getErrorMessage(error, "Unable to drop item."));
    }
  }

  async function useMapInventoryItem(entry: InventoryItem) {
    if (entry.item.type === "scroll" && entry.item.teaches_ability_id) {
      try {
        const result = await learnAbilityFromScroll(character.id, entry.item.teaches_ability_id);
        if (!result.learned) {
          setMapItemMessage(result.message);
          return;
        }

        await consumeInventoryItem(entry, 1);
        await loadInventory();
        await loadCombatLoadout();
        setMapItemMessage(result.message);
        if (!result.isStarter && result.abilityName) {
          showGameToast({
            title: "Ability Learned",
            message: `${result.abilityName} has been added to your ability collection.`,
            actionLabel: "OK",
          });
        }
      } catch (error) {
        console.error("[map inventory] ability scroll use failed", error);
        setMapItemMessage(getErrorMessage(error, "Unable to learn ability from scroll."));
      }
      return;
    }

    await useMapConsumable(entry);
  }

  async function equipMapAbility(slot: number) {
    if (!selectedMapAbilityKey) {
      setMapItemMessage("Select an ability first.");
      return;
    }

    try {
      await equipAbility(character.id, slot, selectedMapAbilityKey);
      setMapItemMessage("Ability equipped.");
      await loadCombatLoadout();
    } catch (error) {
      setMapItemMessage(getErrorMessage(error, "Unable to equip ability."));
    }
  }

  async function clearMapAbilitySlot(slot: number) {
    try {
      await equipAbility(character.id, slot, null);
      setMapItemMessage("Ability slot cleared.");
      await loadCombatLoadout();
    } catch (error) {
      setMapItemMessage(getErrorMessage(error, "Unable to clear ability slot."));
    }
  }

  async function useMapOutsideBattleAbility(ability: AbilityDefinition) {
    if (!ability.adminAbility || ability.adminAbility.type !== "heal" || !canUseAbilityInContext(ability, "outside")) {
      setMapItemMessage("This ability cannot be used while traveling.");
      return;
    }

    if (currentHealth >= combatResources.maxHp) {
      setMapItemMessage("Health is already full.");
      return;
    }

    try {
      const amount = Math.max(1, Number(ability.adminAbility.healing) || 1);
      const nextHealth = clampHealth(currentHealth + amount, combatResources.maxHp);
      await savePlayerHealth(nextHealth);
      setMapItemMessage(`${ability.name} restored Health to ${nextHealth} / ${combatResources.maxHp}.`);
    } catch (error) {
      setMapItemMessage(getErrorMessage(error, "Unable to use healing ability."));
    }
  }

  async function reduceCurrentRouteProgress(percent: number) {
    const targetRoute = activeBattleRouteRef.current ?? routeRef.current;
    const meters = targetRoute.distance_required_meters * (percent / 100);
    const nextDistance = Math.max(0, distanceWalkedRef.current - meters);
    const nextProgress = Math.max(0, (nextDistance / targetRoute.distance_required_meters) * 100);
    const nextPoint = getPointOnRoute(targetRoute.path_points, nextProgress);
    distanceWalkedRef.current = nextDistance;
    setDistanceWalked(nextDistance);
    setSavedPlayerPosition(nextPoint);
    setRouteProgressRows((current) => upsertRouteProgressRow(current, targetRoute.id, nextProgress, true).map((row) => ({ ...row, is_current: row.route_id === targetRoute.id })));
    await saveRouteProgress(targetRoute.id, {
      distance_walked_meters: nextDistance,
      progress_percent: nextProgress,
      current_x_percent: nextPoint.x,
      current_y_percent: nextPoint.y,
      last_lat: null,
      last_lng: null,
      travel_direction: routeDirectionRef.current,
      is_current: true,
    });
    if (targetRoute.mini_map_id) {
      void savePlayerMapState({
        active_mini_map_id: targetRoute.mini_map_id,
        current_x_percent: nextPoint.x,
        current_y_percent: nextPoint.y,
      });
    }
  }

  async function moveSelectedMarker() {
    if (!selectedMarker || !clickedPercent) {
      return;
    }

    await moveMarkerToClicked(selectedMarker);
  }

  async function moveMarkerToClicked(marker: MapMarker) {
    if (!clickedPercent) {
      setAdminMessage("Tap the map first to capture the marker's new X/Y coordinates.");
      return;
    }

    try {
      const updated = await updateMapMarker(marker.id, {
        x_percent: clickedPercent.x,
        y_percent: clickedPercent.y,
      });
      setMarkers((current) => current.map((marker) => (marker.id === updated.id ? updated : marker)));
      setSelectedMarker(updated);
      setClickedPercent(null);
      setAdminMessage(`${updated.title} moved to X ${Number(updated.x_percent).toFixed(2)}% / Y ${Number(updated.y_percent).toFixed(2)}%.`);
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to move marker."));
    }
  }

  async function toggleSelectedMarker() {
    if (!selectedMarker) {
      return;
    }

    try {
      const updated = await updateMapMarker(selectedMarker.id, {
        is_active: !selectedMarker.is_active,
      });
      setMarkers((current) => current.map((marker) => (marker.id === updated.id ? updated : marker)));
      setSelectedMarker(updated);
      setAdminMessage(updated.is_active ? "Marker revealed." : "Marker hidden.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to update marker."));
    }
  }

  async function removeSelectedMarker() {
    if (!selectedMarker) {
      return;
    }

    await removeMarker(selectedMarker);
  }

  async function removeMarker(marker: MapMarker) {
    try {
      await deleteMapMarker(marker.id);
      setMarkers((current) => current.filter((item) => item.id !== marker.id));
      if (selectedMarker?.id === marker.id) {
        setSelectedMarker(null);
      }
      setAdminMessage("Marker deleted.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to delete marker."));
    }
  }

  async function saveMiniMapForm() {
    try {
      const saved = await saveMiniMap({
        id: editingMiniMapId ?? undefined,
        name: miniMapName,
        type: miniMapType,
        area_name: miniMapAreaName,
        area_key: miniMapAreaKey,
        background_image_url: miniMapBackground,
        description: miniMapDescription,
        width: Number(miniMapEditorWidth) || 900,
        height: Number(miniMapEditorHeight) || 650,
        sort_order: Number(miniMapSortOrder) || 0,
        is_active: miniMapActive,
        season_number: selectedSeason,
        chapter_number: selectedChapter,
      });
      setMiniMaps((current) => sortMiniMaps([saved, ...current.filter((item) => item.id !== saved.id)]));
      setSelectedMiniMapId(saved.id);
      if (activeMiniMap?.id === saved.id) {
        setActiveMiniMap(saved);
        setEditingMiniMapId(saved.id);
      } else {
        setEditingMiniMapId(null);
        setMiniMapName("");
        setMiniMapAreaName("");
        setMiniMapAreaKey("");
        setMiniMapSortOrder("0");
        setMiniMapBackground("");
        setMiniMapDescription("");
        setMiniMapEditorWidth("900");
        setMiniMapEditorHeight("650");
        setMiniMapActive(true);
      }
      setAdminMessage("Mini map saved.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to save mini map. Confirm the Supabase migration has run."));
    }
  }

  function editMiniMap(miniMap: MiniMap) {
    setEditingMiniMapId(miniMap.id);
    setSelectedMiniMapId(miniMap.id);
    setMiniMapName(miniMap.name);
    setMiniMapType(miniMap.type);
    setMiniMapAreaName(miniMap.area_name ?? "");
    setMiniMapAreaKey(miniMap.area_key ?? "");
    setMiniMapSortOrder(String(miniMap.sort_order ?? 0));
    setMiniMapBackground(miniMap.background_image_url ?? "");
    setMiniMapDescription(miniMap.description ?? "");
    setMiniMapEditorWidth(String(miniMap.width ?? 900));
    setMiniMapEditorHeight(String(miniMap.height ?? 650));
    setMiniMapActive(miniMap.is_active);
  }

  function clearMiniMapEditForm() {
    setEditingMiniMapId(null);
    setSelectedMiniMapId(null);
    setMiniMapName("");
    setMiniMapType("town");
    setMiniMapAreaName("");
    setMiniMapAreaKey("");
    setMiniMapSortOrder("0");
    setMiniMapBackground("");
    setMiniMapDescription("");
    setMiniMapEditorWidth("900");
    setMiniMapEditorHeight("650");
    setMiniMapActive(true);
  }

  async function removeMiniMap(miniMapId: string) {
    try {
      await deleteMiniMap(miniMapId);
      setMiniMaps((current) => current.filter((item) => item.id !== miniMapId));
      if (selectedMiniMapId === miniMapId) {
        setSelectedMiniMapId(null);
      }
      setAdminMessage("Mini map deleted.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to delete mini map."));
    }
  }

  function openMiniMap(miniMap: MiniMap, options?: { persistPlayerState?: boolean; spawnPosition?: { x: number; y: number } }) {
    const persistPlayerState = options?.persistPlayerState ?? !isAdmin;
    const nextFreeRoamPosition = options?.spawnPosition ?? getMiniMapSpawnPosition(miniMap.id);
    setActiveMiniMap(miniMap);
    setSelectedMiniMapId(miniMap.id);
    if (isAdmin) {
      editMiniMap(miniMap);
      setAdminSection("Mini Maps");
      setEditorMode("Marker");
    }
    setSelectedMarker(null);
    setPreviewMarkerScene(false);
    setClickedPercent(null);
    if (route.mini_map_id !== miniMap.id) {
      setSavedMiniMapPosition(nextFreeRoamPosition);
      if (persistPlayerState) {
        void savePlayerMapState({
          active_mini_map_id: miniMap.id,
          current_x_percent: nextFreeRoamPosition.x,
          current_y_percent: nextFreeRoamPosition.y,
        });
      }
    }
  }

  function getMiniMapWorldReturnPosition(miniMapId?: string | null) {
    const linkedWorldMarker = markers.find(
      (marker) => !marker.mini_map_id && marker.linked_mini_map_id === miniMapId && Number.isFinite(Number(marker.x_percent)) && Number.isFinite(Number(marker.y_percent)),
    );
    if (linkedWorldMarker) {
      return { x: Number(linkedWorldMarker.x_percent), y: Number(linkedWorldMarker.y_percent) };
    }

    const worldEntrance = markers.find(
      (marker) =>
        !marker.mini_map_id &&
        marker.type === "Area/Town Entrance" &&
        Number.isFinite(Number(marker.x_percent)) &&
        Number.isFinite(Number(marker.y_percent)),
    );
    if (worldEntrance) {
      return { x: Number(worldEntrance.x_percent), y: Number(worldEntrance.y_percent) };
    }

    return getWorldSpawnPosition();
  }

  async function leaveMiniMap(targetPosition?: { x: number; y: number }, options?: { forceExit?: boolean }) {
    const forceExit = options?.forceExit ?? Boolean(targetPosition);
    const returnPosition = targetPosition ?? (forceExit ? getMiniMapWorldReturnPosition(activeMiniMap?.id) : undefined);
    exitingMiniMapRef.current = forceExit;
    if (forceExit) {
      setMiniMapExitInProgress(true);
    }
    try {
      const currentWorldProgress = routeProgressRows
        .filter((row) => row.is_current)
        .map((row) => ({ progress: row, route: orderedRoutes.find((item) => item.id === row.route_id) ?? null }))
        .find((item): item is { progress: RouteProgress; route: MapRoute } => Boolean(item.route && !item.route.mini_map_id));
      const selectedWorldRoute = !route.mini_map_id ? route : currentWorldProgress?.route ?? null;
      const displayWorldRoute = selectedWorldRoute ?? orderedRoutes.find((item) => !item.mini_map_id && item.is_active) ?? orderedRoutes.find((item) => !item.mini_map_id) ?? fallbackRoute;
      const shouldRestoreWorldRoute = Boolean(selectedWorldRoute && route.mini_map_id && !forceExit);

      setActiveMiniMap(null);
      setEditingMiniMapId(null);
      setMiniMapName("");
      setMiniMapBackground("");
      setMiniMapDescription("");
      setMiniMapEditorWidth("900");
      setMiniMapEditorHeight("650");
      setMiniMapActive(true);
      setSelectedMarker(null);
      setPreviewMarkerScene(false);
      setMarkerPanelMessage(null);
      setClickedPercent(null);
      setPathDraft([]);
      setPathSegmentDraft([]);
      setSavedMiniMapPosition(null);

      if (returnPosition) {
        await clearCurrentRoute();
        setHasActiveRoute(false);
        setRouteProgressRows((current) => current.map((row) => ({ ...row, is_current: false })));
        setRoute(displayWorldRoute);
        setRouteName(displayWorldRoute.name);
        setRouteOrder(String(displayWorldRoute.sort_order));
        setRouteTerrain(displayWorldRoute.terrain);
        setRouteDanger(displayWorldRoute.danger_level);
        setRouteDistance(String(Math.round(displayWorldRoute.distance_required_meters)));
        setRouteImage(displayWorldRoute.image_url ?? "");
        setRouteLockType(displayWorldRoute.lock_type ?? "public");
        setRouteLockMessage(displayWorldRoute.lock_message ?? "");
        distanceWalkedRef.current = 0;
        setDistanceWalked(0);
        setSavedPlayerPosition(returnPosition);
        setMapEvents([]);
        setCompletedEventIds(new Set());
        await savePlayerMapState({
          active_mini_map_id: null,
          current_x_percent: returnPosition.x,
          current_y_percent: returnPosition.y,
        });
      } else if (selectedWorldRoute && shouldRestoreWorldRoute) {
        await setCurrentRoute(selectedWorldRoute.id);
        await selectRoute(selectedWorldRoute, true);
      } else {
        void clearPlayerMapState();
      }
    } finally {
      if (!forceExit) {
        exitingMiniMapRef.current = false;
        setMiniMapExitInProgress(false);
      }
    }
  }

  async function openExitMarker(marker: MapMarker) {
    if (marker.exit_target_type === "mini_map" && marker.linked_mini_map_id) {
      const nextMiniMap = miniMaps.find((item) => item.id === marker.linked_mini_map_id);
      if (nextMiniMap) {
        openMiniMap(nextMiniMap, { spawnPosition: getExitTargetMiniMapSpawnPosition(marker, nextMiniMap.id) });
        await maybeStartMarkerContinuationRoute(marker);
        return;
      }
    }

    if (marker.exit_target_type === "world_marker" && marker.exit_target_marker_id) {
      const worldMarker = markers.find((item) => item.id === marker.exit_target_marker_id);
      if (worldMarker) {
        await leaveMiniMap({ x: Number(worldMarker.x_percent), y: Number(worldMarker.y_percent) });
        await maybeStartMarkerContinuationRoute(marker);
        return;
      }
    }

    await leaveMiniMap(undefined, { forceExit: true });
    await maybeStartMarkerContinuationRoute(marker);
  }

  async function enterAreaMarker(marker: MapMarker) {
    const miniMap = miniMaps.find((item) => item.id === marker.linked_mini_map_id);
    if (!miniMap) {
      setMarkerPanelMessage("No mini map is linked to this entrance yet.");
      return;
    }

    openMiniMap(miniMap, { spawnPosition: getExitTargetMiniMapSpawnPosition(marker, miniMap.id) });
    await maybeStartMarkerContinuationRoute(marker);
  }

  async function maybeStartMarkerContinuationRoute(marker: MapMarker) {
    if (!marker.starts_route_on_accept || !marker.linked_route_id) {
      return;
    }

    const linkedRoute = routes.find((item) => item.id === marker.linked_route_id);
    if (!linkedRoute) {
      setMarkerPanelMessage("This marker is set to start a walking path, but the linked path could not be found.");
      return;
    }

    await startPathFromSignPost(linkedRoute, { start_direction: marker.linked_route_start_direction ?? "forward" });
  }

  async function saveTutorialForm() {
    try {
      const saved = await saveTutorialStep({
        id: editingTutorialId ?? undefined,
        title: tutorialTitle,
        description: tutorialDescription,
        image_url: tutorialImage,
        marker_id: tutorialMarkerId,
        mini_map_id: tutorialMiniMapId,
        route_id: tutorialRouteId,
        reward_xp: Number(tutorialRewardXp) || 0,
        reward_gold: Number(tutorialRewardGold) || 0,
        reward_item_id: tutorialRewardItemId,
        reward_item_quantity: Math.max(1, Number(tutorialRewardQuantity) || 1),
        sort_order: Number(tutorialSortOrder) || 0,
        is_active: tutorialActive,
        season_number: selectedSeason,
        chapter_number: selectedChapter,
      });
      setTutorialSteps((current) => [saved, ...current.filter((item) => item.id !== saved.id)].sort((a, b) => a.sort_order - b.sort_order));
      clearTutorialForm();
      setAdminMessage("Tutorial step saved.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to save tutorial step. Confirm the Supabase migration has run."));
    }
  }

  function editTutorial(step: TutorialStep) {
    setEditingTutorialId(step.id);
    setTutorialTitle(step.title);
    setTutorialDescription(step.description ?? "");
    setTutorialImage(step.image_url ?? "");
    setTutorialMarkerId(step.marker_id);
    setTutorialMiniMapId(step.mini_map_id);
    setTutorialRouteId(step.route_id);
    setTutorialRewardXp(String(step.reward_xp ?? 0));
    setTutorialRewardGold(String(step.reward_gold ?? 0));
    setTutorialRewardItemId(step.reward_item_id);
    setTutorialRewardQuantity(String(step.reward_item_quantity ?? 1));
    setTutorialSortOrder(String(step.sort_order ?? 0));
    setTutorialActive(step.is_active);
  }

  function clearTutorialForm() {
    setEditingTutorialId(null);
    setTutorialTitle("");
    setTutorialDescription("");
    setTutorialImage("");
    setTutorialMarkerId(null);
    setTutorialMiniMapId(null);
    setTutorialRouteId(null);
    setTutorialRewardXp("0");
    setTutorialRewardGold("0");
    setTutorialRewardItemId(null);
    setTutorialRewardQuantity("1");
    setTutorialSortOrder("0");
    setTutorialActive(true);
  }

  async function removeTutorial(stepId: string) {
    try {
      await deleteTutorialStep(stepId);
      setTutorialSteps((current) => current.filter((item) => item.id !== stepId));
      setAdminMessage("Tutorial step deleted.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to delete tutorial step."));
    }
  }

  async function saveWalkingPath() {
    if (pathDraft.length < 2) {
      setAdminMessage("Add at least two path points before saving.");
      return;
    }

    if (activeMiniMap && route.mini_map_id !== activeMiniMap.id) {
      setAdminMessage("Select an existing trail from this mini map, or use Create as New Walking Path to add a mini-map trail.");
      return;
    }

    try {
      const updated = await updateMapRoute(route.id, {
        name: routeName.trim() || route.name,
        sort_order: Number(routeOrder) || route.sort_order,
        terrain: routeTerrain.trim() || route.terrain,
        danger_level: routeDanger.trim() || route.danger_level,
        distance_required_meters: Number(routeDistance) || route.distance_required_meters,
        path_points: pathDraft,
        path_segments: normalizePathSegments(pathSegmentDraft, pathDraft.length),
        image_url: routeImage.trim() || null,
        lock_type: routeLockType,
        lock_message: routeLockMessage.trim() || null,
        mini_map_id: activeMiniMap?.id ?? route.mini_map_id ?? null,
        season_number: selectedSeason,
        chapter_number: selectedChapter,
      });
      setRoute(updated);
      const nextRoutes = routes.map((item) => (item.id === updated.id ? updated : item)).sort(compareRoutes);
      setRoutes(nextRoutes);
      resetWalkingPathFormForNewRoute(nextRoutes.filter((item) => (activeMiniMap ? item.mini_map_id === activeMiniMap.id : !item.mini_map_id)));
      setAdminMessage("Walking path saved. Ready to create another walking path.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to save walking path. Confirm the Supabase migration has run."));
    }
  }

  async function createWalkingPath() {
    if (pathDraft.length < 2) {
      setAdminMessage("Add at least two path points before creating a new route.");
      return;
    }

    try {
      const created = await createMapRoute({
        name: routeName.trim() || "New Walking Path",
        sort_order: Number(routeOrder) || getNextRouteOrder(activeRouteScopeRoutes.length > 0 ? activeRouteScopeRoutes : routes),
        terrain: routeTerrain.trim() || "Unknown road",
        danger_level: routeDanger.trim() || "Low",
        distance_required_meters: Number(routeDistance) || 1000,
        estimated_encounters: route.estimated_encounters,
        path_points: pathDraft,
        path_segments: normalizePathSegments(pathSegmentDraft, pathDraft.length),
        image_url: routeImage.trim() || null,
        is_active: true,
        lock_type: routeLockType,
        lock_message: routeLockMessage.trim() || null,
        mini_map_id: activeMiniMap?.id ?? null,
        season_number: selectedSeason,
        chapter_number: selectedChapter,
      });
      const nextRoutes = [...routes, created].sort(compareRoutes);
      setRoutes(nextRoutes);
      setRoute(created);
      resetWalkingPathFormForNewRoute(nextRoutes.filter((item) => (activeMiniMap ? item.mini_map_id === activeMiniMap.id : !item.mini_map_id)));
      setAdminMessage("New walking path created. Ready to create another walking path.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to create walking path. Confirm the Supabase migration has run."));
    }
  }

  async function removeWalkingPath(routeId: string) {
    if (routes.length <= 1) {
      setAdminMessage("At least one walking path must remain.");
      return;
    }

    try {
      await deleteMapRoute(routeId);
      const nextRoutes = routes.filter((item) => item.id !== routeId).sort(compareRoutes);
      setRoutes(nextRoutes);
      if (route.id === routeId) {
        await selectRoute(nextRoutes[0] ?? fallbackRoute, true);
      }
      setAdminMessage("Walking path deleted.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to delete walking path."));
    }
  }

  async function loadDialogueForEvent(event: MapEvent) {
    const nodes = await getDialogueNodes(event.id);
    const choices = await getDialogueChoices(nodes.map((node) => node.id));
    const rewards = await getDialogueChoiceRewards(choices.map((choice) => choice.id));
    const [claimedRewardChoices, selectedChoices] = await Promise.all([
      getClaimedDialogueRewardChoiceIds(choices.filter((choice) => choice.action === "give_reward").map((choice) => choice.id)),
      getPlayerDialogueChoiceHistory(choices.map((choice) => choice.id)),
    ]);
    const startNode = getDialogueStartNode(nodes, choices, selectedChoices);
    setDialogueNodes(nodes);
    setDialogueChoices(choices);
    setDialogueChoiceRewards(rewards);
    setClaimedChoiceRewardIds(claimedRewardChoices);
    setSelectedDialogueChoiceIds(selectedChoices);
    setPendingRewardChoice(null);
    setActiveNodeId(startNode?.id ?? null);
    setDialogueLog([]);
  }

  async function loadDialogueForMarker(markerId: string, existingNodes?: StoryDialogueNode[]) {
    const nodes = existingNodes ?? await getDialogueNodesForMarker(markerId);
    const choices = await getDialogueChoices(nodes.map((node) => node.id));
    const rewards = await getDialogueChoiceRewards(choices.map((choice) => choice.id));
    const [claimedRewardChoices, selectedChoices] = await Promise.all([
      getClaimedDialogueRewardChoiceIds(choices.filter((choice) => choice.action === "give_reward").map((choice) => choice.id)),
      getPlayerDialogueChoiceHistory(choices.map((choice) => choice.id)),
    ]);
    const startNode = getDialogueStartNode(nodes, choices, selectedChoices);
    setDialogueNodes(nodes);
    setDialogueChoices(choices);
    setDialogueChoiceRewards(rewards);
    setClaimedChoiceRewardIds(claimedRewardChoices);
    setSelectedDialogueChoiceIds(selectedChoices);
    setPendingRewardChoice(null);
    setActiveNodeId(startNode?.id ?? null);
    setDialogueLog([]);
  }

  function getDialogueStartNode(nodes: StoryDialogueNode[], choices: StoryDialogueChoice[], selectedChoices: Set<string>) {
    const guardReturnNode = nodes.find((node) => node.node_key === "forgotten_marches_opening_10_return_after_refusal");
    if (guardReturnNode && storyFlags.get("iron_pass_toll_avoided") === true && storyFlags.get("iron_pass_toll_paid") !== true) {
      return guardReturnNode;
    }

    const repeatNode = nodes.find((node) => node.node_key.endsWith("_repeat_after_story_start"));
    const hasStartedStory = choices.some((choice) => selectedChoices.has(choice.id) && choice.repeatable === false && (choice.hide_after_selected || choice.disable_after_selected));
    if (repeatNode && hasStartedStory) {
      return repeatNode;
    }

    return nodes.find((node) => node.is_start) ?? nodes[0] ?? null;
  }

  async function loadDialogueEditor(eventId: string) {
    setSelectedDialogueEventId(eventId);
    setSelectedDialogueMarkerId(null);
    const nodes = await getDialogueNodes(eventId);
    const choices = await getDialogueChoices(nodes.map((node) => node.id));
    const rewards = await getDialogueChoiceRewards(choices.map((choice) => choice.id));
    setDialogueNodes(nodes);
    setDialogueChoices(choices);
    setDialogueChoiceRewards(rewards);
    setClaimedChoiceRewardIds(new Set());
    setSelectedDialogueChoiceIds(new Set());
    setChoiceNodeId(nodes[0]?.id ?? null);
    clearDialogueNodeForm();
    clearDialogueChoiceForm();
  }

  async function loadMarkerDialogueEditor(marker: MapMarker) {
    setSelectedDialogueEventId(null);
    setSelectedDialogueMarkerId(marker.id);
    const nodes = await getDialogueNodesForMarker(marker.id);
    const choices = await getDialogueChoices(nodes.map((node) => node.id));
    const rewards = await getDialogueChoiceRewards(choices.map((choice) => choice.id));
    setDialogueNodes(nodes);
    setDialogueChoices(choices);
    setDialogueChoiceRewards(rewards);
    setClaimedChoiceRewardIds(new Set());
    setSelectedDialogueChoiceIds(new Set());
    setChoiceNodeId(nodes[0]?.id ?? null);
    clearDialogueNodeForm();
    clearDialogueChoiceForm();
    setAdminMessage(`Editing marker dialogue tree for "${marker.title}".`);
  }

  async function previewMapEvent(event: MapEvent) {
    if (event.event_type === "battle") {
      await startBattle(event, true);
      return;
    }

    setAdminPreviewMode("story");
    setActiveBattle(null);
    setActiveEvent(event);
    await loadDialogueForEvent(event);
    setAdminMessage(`Previewing ${event.title}.`);
  }

  function closeAdminPreview() {
    setActiveEvent(null);
    setAdminPreviewMode(null);
    activeBattleRouteRef.current = null;
    resetBattleState();
    setPendingRewardChoice(null);
    setDialogueLog([]);
    setDialogueChoiceRewards([]);
  }

  function startNewDialogueStep() {
    clearDialogueNodeForm();
    setNodeSortOrder(String(getNextDialogueNodeOrder(dialogueNodes)));
    setNodeIsStart(dialogueNodes.length === 0);
  }

  async function startBattle(event: MapEvent, preview = false, options: { saveRoutePosition?: boolean } = {}) {
    activeBattleRouteRef.current = preview ? null : routeRef.current;
    if (!preview && options.saveRoutePosition !== false) {
      await saveCurrentRoutePositionBeforeBattle();
    }

    return startBattleEncounter(event, {
      preview,
      currentHealth,
      combatResources,
      setActiveEvent,
      setAdminPreviewMode,
      setAdminMessage,
    });
  }

  async function saveCurrentRoutePositionBeforeBattle() {
    const targetRoute = activeBattleRouteRef.current ?? routeRef.current;
    const currentDistance = distanceWalkedRef.current;
    const currentProgress = Math.min(100, Math.max(0, (currentDistance / targetRoute.distance_required_meters) * 100 || progressPercent));
    const currentPoint = getPointOnRoute(targetRoute.path_points, currentProgress);

    setDistanceWalked(currentDistance);
    setSavedPlayerPosition(currentPoint);
    setRouteProgressRows((current) => upsertRouteProgressRow(current, targetRoute.id, currentProgress, true));

    await saveRouteProgress(targetRoute.id, {
      distance_walked_meters: currentDistance,
      progress_percent: currentProgress,
      current_x_percent: currentPoint.x,
      current_y_percent: currentPoint.y,
      last_lat: null,
      last_lng: null,
      travel_direction: routeDirectionRef.current,
      is_current: true,
    });

    if (targetRoute.mini_map_id) {
      void savePlayerMapState({
        active_mini_map_id: targetRoute.mini_map_id,
        current_x_percent: currentPoint.x,
        current_y_percent: currentPoint.y,
      });
    }
  }

  async function finishEvent(event: MapEvent) {
    if (adminPreviewMode) {
      setGpsMessage(`Preview complete: ${event.title}.`);
      closeAdminPreview();
      return;
    }

    try {
      if (activeMarkerEventId && event.event_type === "battle") {
        const marker = markers.find((item) => item.id === activeMarkerEventId) ?? null;
        const rewardResult = await applyRewards(character, {
          xp: (marker?.reward_xp ?? 0) + (activeEnemy?.xp_reward ?? 0),
          gold: (marker?.reward_gold ?? 0) + (activeEnemy?.gold_reward ?? 0),
          itemId: marker?.reward_item_id ?? null,
          itemQuantity: marker?.reward_item_quantity ?? 1,
          fullHeal: marker?.reward_full_heal,
          fullHealMaxHealth: combatResources.maxHp,
          repeatable: marker?.repeatable,
          rewardOncePerPlayer: marker?.reward_once_per_player,
          markerId: marker?.id ?? null,
        });
        const drops: string[] = [];
        const dropRewards: GameToastReward[] = [];
        for (const drop of activeEnemy?.drops ?? []) {
          if (Math.random() * 100 <= Number(drop.drop_chance)) {
            await grantItemToCharacter(character.id, drop.item_id, drop.quantity);
            const itemName = getItemName(itemDefinitions, drop.item_id);
            drops.push(`${itemName} x${drop.quantity}`);
            dropRewards.push({ label: itemName, quantity: drop.quantity });
          }
        }
        let killMessage = "";
        try {
          const enemySource = event.npc_id ? "npc" : event.enemy_id ? "enemy" : "manual";
          const kill = await recordEnemyKill({
            userId: character.user_id,
            characterId: character.id,
            enemyId: enemySource === "enemy" ? event.enemy_id : null,
            npcId: enemySource === "npc" ? event.npc_id : null,
            enemyName: activeEnemy?.name || event.enemy_name || "Unknown Enemy",
            enemyType: activeEnemy?.type || "Marker",
            enemySource,
            routeId: null,
            mapEventId: null,
            seasonNumber: event.season_number,
            chapterNumber: event.chapter_number,
          });
          killMessage = ` ${kill.enemyName} defeated ${kill.enemyKillCount} time${kill.enemyKillCount === 1 ? "" : "s"}. ${kill.enemyType} kills: ${kill.typeKillCount}.`;
        } catch (killError) {
          console.warn("[battle] unable to record marker enemy kill", killError);
          killMessage = " Kill tracking could not be saved.";
        }
        setActiveEvent(null);
        setActiveMarkerEventId(null);
        setActiveBattle(null);
        setActiveEnemy(null);
        activeBattleRouteRef.current = null;
        setGpsMessage(`${event.title} completed. ${rewardResult.message}${drops.length ? ` Drops: ${drops.join(", ")}.` : ""}${killMessage}`);
        showGameToast({
          title: `${event.title} Complete`,
          message: drops.length ? "Battle rewards and drops were added to Inventory." : "Battle complete. Rewards were saved.",
          rewards: rewardResult.claimed ? buildRewardToastItems({
            xp: (marker?.reward_xp ?? 0) + (activeEnemy?.xp_reward ?? 0),
            gold: (marker?.reward_gold ?? 0) + (activeEnemy?.gold_reward ?? 0),
            itemId: marker?.reward_item_id ?? null,
            itemQuantity: marker?.reward_item_quantity ?? 1,
            fullHeal: marker?.reward_full_heal,
          }, dropRewards) : dropRewards,
          actionLabel: "OK",
        });
        await loadInventory();
        if (rewardResult.currentHealth != null) {
          onCharacterUpdated({ ...character, current_health: rewardResult.currentHealth });
        }
        return;
      }

      const completedMarker = activeMarkerEventId ? markers.find((item) => item.id === activeMarkerEventId) ?? null : null;
      const rewardResult = await applyRewards(character, {
        xp: ((completedMarker?.reward_xp ?? event.reward_xp) ?? 0) + (activeEnemy?.xp_reward ?? 0),
        gold: ((completedMarker?.reward_gold ?? event.reward_gold) ?? 0) + (activeEnemy?.gold_reward ?? 0),
        itemId: completedMarker?.reward_item_id ?? event.reward_item_id,
        itemQuantity: completedMarker?.reward_item_quantity ?? event.reward_item_quantity,
        fullHeal: completedMarker?.reward_full_heal,
        fullHealMaxHealth: combatResources.maxHp,
        eventId: completedMarker ? null : event.id,
        markerId: completedMarker?.id ?? null,
        repeatable: completedMarker?.repeatable,
        rewardOncePerPlayer: completedMarker?.reward_once_per_player,
      });
      const drops: string[] = [];
      const dropRewards: GameToastReward[] = [];
      for (const drop of activeEnemy?.drops ?? []) {
        if (Math.random() * 100 <= Number(drop.drop_chance)) {
          await grantItemToCharacter(character.id, drop.item_id, drop.quantity);
          const itemName = getItemName(itemDefinitions, drop.item_id);
          drops.push(`${itemName} x${drop.quantity}`);
          dropRewards.push({ label: itemName, quantity: drop.quantity });
        }
      }
      let killMessage = "";
      if (event.event_type === "battle") {
        try {
          const enemySource = event.npc_id ? "npc" : event.enemy_id ? "enemy" : "manual";
          const kill = await recordEnemyKill({
            userId: character.user_id,
            characterId: character.id,
            enemyId: enemySource === "enemy" ? event.enemy_id : null,
            npcId: enemySource === "npc" ? event.npc_id : null,
            enemyName: activeEnemy?.name || event.enemy_name || "Unknown Enemy",
            enemyType: activeEnemy?.type || (enemySource === "manual" ? "Manual" : "Unknown"),
            enemySource,
            routeId: event.route_id,
            mapEventId: event.id,
            seasonNumber: event.season_number,
            chapterNumber: event.chapter_number,
          });
          killMessage = ` ${kill.enemyName} defeated ${kill.enemyKillCount} time${kill.enemyKillCount === 1 ? "" : "s"}. ${kill.enemyType} kills: ${kill.typeKillCount}.`;
        } catch (killError) {
          console.warn("[battle] unable to record enemy kill", killError);
          killMessage = " Kill tracking could not be saved.";
        }
      }
      if (!completedMarker) {
        await completeMapEvent(event.id);
        setCompletedEventIds((current) => new Set([...current, event.id]));
      }
      if (completedMarker && supportsMarkerDialogue(completedMarker.type)) {
        await completeStoryMarker(completedMarker.id);
        setCompletedStoryMarkerIds((current) => new Set([...current, completedMarker.id]));
      }
      setActiveEvent(null);
      setActiveMarkerEventId(null);
      setActiveBattle(null);
      setActiveEnemy(null);
      activeBattleRouteRef.current = null;
      setGpsMessage(`${event.title} completed. ${rewardResult.message}${drops.length ? ` Drops: ${drops.join(", ")}.` : ""}${killMessage}`);
      showGameToast({
        title: `${event.title} Complete`,
        message: drops.length ? "Rewards and drops were added to Inventory." : "Event complete. Rewards were saved.",
        rewards: rewardResult.claimed ? buildRewardToastItems({
          xp: ((completedMarker?.reward_xp ?? event.reward_xp) ?? 0) + (activeEnemy?.xp_reward ?? 0),
          gold: ((completedMarker?.reward_gold ?? event.reward_gold) ?? 0) + (activeEnemy?.gold_reward ?? 0),
          itemId: completedMarker?.reward_item_id ?? event.reward_item_id,
          itemQuantity: completedMarker?.reward_item_quantity ?? event.reward_item_quantity,
          fullHeal: completedMarker?.reward_full_heal,
        }, dropRewards) : dropRewards,
        nextMarker: completedMarker ? getNextStoryMarkerAfter(completedMarker) : getJourneyDestinationMarker(routeRef.current, markers, allMarkerRouteLinks, currentRouteProgress?.source_marker_id ?? null),
        actionLabel: "OK",
      });
      await loadInventory();
      if (rewardResult.currentHealth != null) {
        onCharacterUpdated({ ...character, current_health: rewardResult.currentHealth });
      }
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to complete event."));
    }
  }

  function handleStoryChoice(action: MapEvent["choices"][number]["action"]) {
    if (!activeEvent) {
      return;
    }

    if (action === "Complete Event" || action === "Continue") {
      void finishEvent(activeEvent);
      return;
    }

    if (action === "Start Battle") {
      const linkedBattle = mapEvents.find((event) => event.event_type === "battle" && !completedEventIds.has(event.id) && event.route_id === activeEvent.route_id);
      if (linkedBattle) {
        if (!adminPreviewMode) {
          void completeMapEvent(activeEvent.id);
          setCompletedEventIds((current) => new Set([...current, activeEvent.id]));
        }
        void startBattle(linkedBattle, adminPreviewMode === "story");
        return;
      }
      setBattleLog(["No linked battle exists on this trail yet."]);
      return;
    }

    setGpsMessage(`${activeEvent.title}: ${action}`);
  }

  async function handleDialogueChoice(choice: StoryDialogueChoice) {
    if (!activeEvent) {
      return;
    }

    const requirement = dialogueChoiceAvailability[choice.id];
    if (requirement && !requirement.met) {
      setDialogueLog((current) => [requirement.message ?? "That choice is not available yet.", ...current].slice(0, 4));
      return;
    }

    if (pendingRewardChoice && choice.id !== pendingRewardChoice.id) {
      setPendingRewardChoice(null);
    }

    if (choice.player_dialogue_text) {
      setDialogueLog((current) => [`You: ${choice.player_dialogue_text}`, ...current].slice(0, 4));
    }

    async function applyResourceRest() {
      if (!choice.restore_health && !choice.restore_stamina && !choice.restore_mana) {
        return true;
      }

      if (adminPreviewMode) {
        setDialogueLog((current) => ["Admin preview: would restore selected resources.", ...current].slice(0, 4));
        return true;
      }

      try {
        if (choice.restore_health) {
          const updated = await updateCharacter(character.id, { current_health: combatResources.maxHp });
          onCharacterUpdated({ ...character, current_health: updated.current_health });
        }
        const restoredResources = [
          choice.restore_health ? "Health" : null,
          choice.restore_stamina ? "Stamina" : null,
          choice.restore_mana ? "Mana" : null,
        ].filter(Boolean);
        setDialogueLog((current) => [`Restored ${restoredResources.join(", ")}.`, ...current].slice(0, 4));
        return true;
      } catch (error) {
        setDialogueLog((current) => [getErrorMessage(error, "Unable to restore resources."), ...current].slice(0, 4));
        return false;
      }
    }

    async function recordThisChoice() {
      if (adminPreviewMode) {
        return;
      }

      try {
        await recordPlayerDialogueChoice({
          characterId: character.id,
          choiceId: choice.id,
          nodeId: choice.node_id,
          eventId: activeMarkerEventId ? null : activeEvent?.id ?? null,
          markerId: activeMarkerEventId,
        });
        setSelectedDialogueChoiceIds((current) => new Set([...current, choice.id]));
      } catch (error) {
        console.warn("[dialogue] unable to save player choice history", error);
      }
    }

    async function applyStoryFlagEffect() {
      const flagKey = choice.set_story_flag_key?.trim();
      if (!flagKey) {
        return true;
      }

      if (adminPreviewMode) {
        setDialogueLog((current) => [`Admin preview: would set story flag ${flagKey} = ${choice.set_story_flag_value ? "true" : "false"}.`, ...current].slice(0, 4));
        return true;
      }

      try {
        await setPlayerStoryFlag(character.id, flagKey, choice.set_story_flag_value ?? true);
        setStoryFlags((current) => {
          const next = new Map(current);
          next.set(flagKey, choice.set_story_flag_value ?? true);
          return next;
        });
        return true;
      } catch (error) {
        setDialogueLog((current) => [getErrorMessage(error, "Unable to save story decision."), ...current].slice(0, 4));
        return false;
      }
    }

    const didRestore = await applyResourceRest();
    if (!didRestore) {
      return;
    }

    const didSetStoryFlag = await applyStoryFlagEffect();
    if (!didSetStoryFlag) {
      return;
    }
    if (choice.set_story_flag_key && !choice.unlock_marker_id && (choice.update_notification_title || choice.update_notification_body) && !adminPreviewMode) {
      const flagKey = choice.set_story_flag_key.trim();
      const flagValue = choice.set_story_flag_value ?? true;
      const unlockedMarker =
        effectiveMarkers.find((marker) => marker.visible_story_flag_key?.trim() === flagKey && (marker.visible_story_flag_value ?? true) === flagValue) ??
        markers.find((marker) => marker.visible_story_flag_key?.trim() === flagKey && (marker.visible_story_flag_value ?? true) === flagValue) ??
        null;
      showGameToast({
        title: choice.update_notification_title || "Story Updated",
        message: choice.update_notification_body || (unlockedMarker ? `${unlockedMarker.title} is now available.` : "Your story progress has been updated."),
        nextMarker: unlockedMarker,
        actionLabel: "OK",
      });
    }

    if (Number(choice.consume_gold ?? 0) > 0 && !adminPreviewMode) {
      try {
        const alreadyPaid = claimedChoiceRewardIds.has(choice.id) || await hasClaimedDialogueChoiceEffect(choice.id);
        if (!alreadyPaid) {
          const updatedCharacter = await spendCharacterGold(character.id, Number(choice.consume_gold));
          if (updatedCharacter) {
            onCharacterUpdated({ ...character, gold: updatedCharacter.gold });
          }
          await recordDialogueChoiceEffectClaim(character, choice.id);
          setClaimedChoiceRewardIds((current) => new Set([...current, choice.id]));
          setDialogueLog((current) => [`Paid ${choice.consume_gold} gold.`, ...current].slice(0, 4));
        }
      } catch (error) {
        setDialogueLog((current) => [getErrorMessage(error, `Requires ${choice.consume_gold} gold.`), ...current].slice(0, 4));
        return;
      }
    }

    if (choice.check_enabled && choice.check_attribute) {
      const checkResult = rollDialogueAttributeCheck(choice, character);
      if (checkResult) {
        try {
          await recordPlayerAttributeCheck({
            characterId: character.id,
            dialogueNodeId: activeNodeId,
            choiceId: choice.id,
            attributeUsed: checkResult.attribute,
            attributeValue: checkResult.attributeValue,
            dc: checkResult.dc,
            rollValue: checkResult.roll,
            finalResult: checkResult.total,
            succeeded: checkResult.succeeded,
          });
        } catch (error) {
          console.warn("[dialogue] unable to save attribute check", error);
        }

        setDialogueLog((current) => [...checkResult.resultLines, ...current].slice(0, 8));
        const targetNodeId = checkResult.succeeded ? choice.check_success_node_id : choice.check_failure_node_id;
        if (targetNodeId && dialogueNodes.some((node) => node.id === targetNodeId)) {
          setActiveNodeId(targetNodeId);
          return;
        }
        if (!checkResult.succeeded) {
          return;
        }
      }
    }

    if (choice.unlock_marker_id && !adminPreviewMode) {
      const alreadyUnlocked = playerUnlockedMarkerIds.has(choice.unlock_marker_id);
      try {
        await unlockPlayerMarker(choice.unlock_marker_id, choice.id);
        setPlayerUnlockedMarkerIds((current) => new Set([...current, choice.unlock_marker_id as string]));
        const refreshedMarkers = await getMapMarkers();
        setMarkers(refreshedMarkers);
        if (!alreadyUnlocked) {
          const unlockedMarker =
            refreshedMarkers.find((marker) => marker.id === choice.unlock_marker_id) ??
            effectiveMarkers.find((marker) => marker.id === choice.unlock_marker_id) ??
            markers.find((marker) => marker.id === choice.unlock_marker_id) ??
            null;
          showGameToast({
            title: choice.update_notification_title || "Quest Updated",
            message: choice.update_notification_body || (unlockedMarker ? `${unlockedMarker.title} is now available on the map.` : "A new map marker is now available."),
            nextMarker: unlockedMarker,
            actionLabel: "OK",
          });
        }
      } catch (error) {
        setDialogueLog((current) => [getErrorMessage(error, "Unable to update the map marker for this choice."), ...current].slice(0, 4));
        return;
      }
    } else if (choice.unlock_marker_id && adminPreviewMode) {
      const unlockedMarker = effectiveMarkers.find((marker) => marker.id === choice.unlock_marker_id) ?? null;
      setDialogueLog((current) => [`Admin preview: would reveal ${unlockedMarker?.title ?? "a map marker"}.`, ...current].slice(0, 4));
    }

    if (choice.action === "go_to_node") {
      await recordThisChoice();
      if (choice.next_node_id && dialogueNodes.some((node) => node.id === choice.next_node_id)) {
        setActiveNodeId(choice.next_node_id);
        return;
      }
      setDialogueLog((current) => ["The conversation path is missing. Return to the map when ready.", ...current].slice(0, 4));
      return;
    }

    if (choice.action === "start_battle") {
      await recordThisChoice();
      const battle =
        allMapEvents.find((event) => event.id === choice.battle_event_id) ??
        mapEvents.find((event) => event.event_type === "battle" && event.route_id === routeRef.current.id);
      if (battle) {
        if (!adminPreviewMode) {
          try {
            await completeMapEvent(activeEvent.id);
            setCompletedEventIds((current) => new Set([...current, activeEvent.id]));
          } catch (error) {
            setDialogueLog((current) => [getErrorMessage(error, "Unable to save story progress before battle."), ...current].slice(0, 4));
            return;
          }
        }
        void startBattle(battle, adminPreviewMode === "story", { saveRoutePosition: !activeMarkerEventId });
        return;
      }
      setDialogueLog((current) => ["No battle is linked yet.", ...current].slice(0, 4));
      return;
    }

    if (choice.action === "start_quest") {
      await recordThisChoice();
      const marker = activeMarkerEventId ? markers.find((item) => item.id === activeMarkerEventId) ?? null : null;
      if (!marker) {
        setDialogueLog((current) => ["This choice must be used from a marker dialogue tree.", ...current].slice(0, 4));
        return;
      }
      setActiveEvent(null);
      setActiveMarkerEventId(null);
      await startMarkerQuestFromDialogueOrScene(marker);
      return;
    }

    if (choice.action === "complete_event" || choice.action === "unlock_next_event") {
      await recordThisChoice();
      await finishEvent(activeEvent);
      return;
    }

    if (choice.action === "give_reward") {
      if (adminPreviewMode) {
        if (choice.next_node_id && dialogueNodes.some((node) => node.id === choice.next_node_id)) {
          setActiveNodeId(choice.next_node_id);
        }
        setPendingRewardChoice(choice);
        return;
      }

      if (claimedChoiceRewardIds.has(choice.id) || await hasClaimedDialogueChoiceEffect(choice.id)) {
        setClaimedChoiceRewardIds((current) => new Set([...current, choice.id]));
        setDialogueLog((current) => ["You already took those supplies.", ...current].slice(0, 4));
        return;
      }

      setPendingRewardChoice(choice);
      await recordThisChoice();
      if (choice.next_node_id && dialogueNodes.some((node) => node.id === choice.next_node_id)) {
        setActiveNodeId(choice.next_node_id);
      }
      return;
    }

    if (adminPreviewMode) {
      closeAdminPreview();
      return;
    }

    await recordThisChoice();
    setActiveEvent(null);
    setActiveMarkerEventId(null);
  }

  async function claimPendingDialogueReward(choice: StoryDialogueChoice) {
    if (!activeEvent) {
      return;
    }

    const configuredRewards = dialogueChoiceRewards.filter((reward) => reward.choice_id === choice.id);
    if (adminPreviewMode) {
      setDialogueLog((current) => ["Admin preview: reward would be granted here.", ...current].slice(0, 4));
      setPendingRewardChoice(null);
      return;
    }

    try {
      if (claimedChoiceRewardIds.has(choice.id) || await hasClaimedDialogueChoiceEffect(choice.id)) {
        setClaimedChoiceRewardIds((current) => new Set([...current, choice.id]));
        setPendingRewardChoice(null);
        setDialogueLog((current) => ["You already took those supplies.", ...current].slice(0, 4));
        return;
      }

      const rewardResult = await applyDialogueChoiceRewards(
        character,
        choice,
        configuredRewards,
      );
      setDialogueLog((current) => [rewardResult.message, ...current].slice(0, 4));
      setClaimedChoiceRewardIds((current) => new Set([...current, choice.id]));
      setPendingRewardChoice(null);
      if (rewardResult.claimed) {
        const itemRewards = rewardResult.items.map((item) => ({
          label: getItemName(itemDefinitions, item.itemId),
          quantity: item.quantity,
        }));
        showGameToast({
          title: "Reward Received",
          message: "Items and rewards were added to your character.",
          rewards: buildRewardToastItems({ xp: rewardResult.xp, gold: rewardResult.gold }, itemRewards),
          actionLabel: "OK",
        });
      }
      await loadInventory();
      const refreshedCharacter = await getCharacter();
      if (refreshedCharacter) {
        onCharacterUpdated(refreshedCharacter);
      }
    } catch (error) {
      setDialogueLog((current) => [getErrorMessage(error, "Unable to claim reward."), ...current].slice(0, 4));
    }
  }

  async function endDialogueChat(completeEvent: boolean) {
    if (adminPreviewMode && !completeEvent) {
      setPendingRewardChoice(null);
      closeAdminPreview();
      return;
    }

    if (activeEvent && completeEvent) {
      await finishEvent(activeEvent);
      return;
    }

    setPendingRewardChoice(null);
    setActiveEvent(null);
    setActiveMarkerEventId(null);
  }

  function getBattleActionContext() {
    return {
      previewMode: Boolean(adminPreviewMode),
      equippedItems,
      inventoryItems,
      closePreview: closeAdminPreview,
      resetRouteAfterDefeat: resetCurrentRouteAfterDefeat,
      reduceRouteProgress: reduceCurrentRouteProgress,
      setGpsMessage,
      loadInventory,
    };
  }

  async function handleBattleAction(ability: AbilityDefinition) {
    await runBattleAction(ability, getBattleActionContext());
  }

  async function handleWeaponAction(weapon: ItemDefinition) {
    await runWeaponAction(weapon, getBattleActionContext());
  }

  async function handleOpeningEnemyTurn() {
    await runOpeningEnemyTurn(getBattleActionContext());
  }

  async function fleeBattle() {
    await runFleeBattle(getBattleActionContext());
    activeBattleRouteRef.current = null;
  }

  async function declineReviveAfterDefeat() {
    await runDeclineReviveAfterDefeat(getBattleActionContext());
  }

  async function useBattleItem(entry: InventoryItem) {
    await runUseBattleItem(entry, getBattleActionContext());
  }

  async function resetCurrentRouteAfterDefeat() {
    const defeatedRoute = activeBattleRouteRef.current ?? routeRef.current;
    await reduceCurrentRouteProgress(5);
    setCompletedRouteId(null);
    activeBattleRouteRef.current = null;
    setHasActiveRoute(true);
    const nextMiniMap = defeatedRoute.mini_map_id ? miniMaps.find((item) => item.id === defeatedRoute.mini_map_id) ?? null : null;
    setActiveMiniMap(nextMiniMap);
    setSelectedMiniMapId(nextMiniMap?.id ?? null);
    await selectRoute(defeatedRoute, true);
    resetBattleState();
    setGpsMessage("Defeated. You lost 5% progress on this path.");
  }

  function editMapEvent(event: MapEvent) {
    setAdminSection("Rewards/Interactions");
    setOpenAdminPanels((current) => ({ ...current, "active-section": true }));
    setEditingEvent(event);
    setEventType(event.event_type === "story" ? "dialogue" : event.event_type);
    setEventTitle(event.title);
    setEventDistance(String(event.distance_marker_percent));
    setEventTriggerMode((event.trigger_mode ?? "fixed") === "random" ? "random" : "fixed");
    setEventRandomChance(String(event.random_chance_percent ?? 10));
    setEventBackgroundImage(event.background_image_url ?? "");
    setEventNpcName(event.npc_name ?? "");
    setEventNpcPortrait(event.npc_portrait_url ?? "");
    setEventDialogueNpcId(event.dialogue_npc_id ?? null);
    setEventDialogue(event.dialogue_text ?? "");
    setEventChoices(event.choices.map((choice) => `${choice.label}|${choice.action}`).join("\n"));
    setEnemyName(event.enemy_name ?? "");
    setEnemyImage(event.enemy_image_url ?? "");
    setEnemyHp(String(event.enemy_hp));
    setEnemyAttack(String(event.enemy_attack_damage));
    setEventEnemyId(event.enemy_id ?? null);
    setEventNpcId(event.npc_id ?? null);
    setBattleIntro(event.battle_intro_text ?? "");
    setVictoryText(event.victory_text ?? "");
    setDefeatText(event.defeat_text ?? "");
    setRewardXp(String(event.reward_xp));
    setRewardGold(String(event.reward_gold ?? 0));
    setRewardItem(event.reward_item ?? "");
    setRewardItemId(event.reward_item_id ?? null);
    setRewardItemQuantity(String(event.reward_item_quantity ?? 1));
    if (event.event_type === "battle") {
      void loadBattlefieldCombatants(event.id);
    } else {
      setBattlefieldCombatants([]);
    }
  }

  async function loadBattlefieldCombatants(eventId: string) {
    try {
      const loaded = await getBattleEventCombatants(eventId);
      setBattlefieldCombatants(loaded);
    } catch (error) {
      setBattlefieldCombatants([]);
      setAdminMessage(getErrorMessage(error, "Unable to load battlefield layout. Confirm the Supabase migration has run."));
    }
  }

  async function loadMarkerBattlefieldCombatants(markerId: string) {
    try {
      const loaded = await getMarkerBattleCombatants(markerId);
      setBattlefieldCombatants(loaded);
    } catch (error) {
      setBattlefieldCombatants([]);
      setAdminMessage(getErrorMessage(error, "Unable to load marker battlefield layout. Confirm the Supabase migration has run."));
    }
  }

  async function saveBattlefieldCombatant(input: Partial<BattleEventCombatant> & { event_id: string }) {
    try {
      const saved = await saveBattleEventCombatant(input);
      setBattlefieldCombatants((current) => {
        const exists = current.some((combatant) => combatant.id === saved.id);
        const next = exists ? current.map((combatant) => combatant.id === saved.id ? saved : combatant) : [...current, saved];
        return next.sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
      });
      setAdminMessage("Battlefield combatant saved.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to save battlefield combatant. Confirm the Supabase migration has run."));
    }
  }

  async function saveMarkerBattlefieldCombatant(input: Partial<BattleEventCombatant> & { event_id: string }) {
    try {
      const saved = await saveMarkerBattleCombatant({
        ...input,
        marker_id: input.event_id,
      });
      setBattlefieldCombatants((current) => {
        const exists = current.some((combatant) => combatant.id === saved.id);
        const next = exists ? current.map((combatant) => combatant.id === saved.id ? saved : combatant) : [...current, saved];
        return next.sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
      });
      setAdminMessage("Marker battlefield actor saved.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to save marker battlefield actor. Confirm the Supabase migration has run."));
    }
  }

  async function removeMarkerBattlefieldCombatant(combatantId: string) {
    try {
      await deleteMarkerBattleCombatant(combatantId);
      setBattlefieldCombatants((current) => current.filter((combatant) => combatant.id !== combatantId));
      setAdminMessage("Marker battlefield actor removed.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to delete marker battlefield actor."));
    }
  }

  async function removeBattlefieldCombatant(combatantId: string) {
    try {
      await deleteBattleEventCombatant(combatantId);
      setBattlefieldCombatants((current) => current.filter((combatant) => combatant.id !== combatantId));
      setAdminMessage("Battlefield combatant deleted.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to delete battlefield combatant."));
    }
  }

  function selectEventEnemy(enemyId: string | null) {
    setEventEnemyId(enemyId);
    if (enemyId) {
      setEventNpcId(null);
    }

    if (!enemyId) {
      return;
    }

    const enemy = enemyDefinitions.find((entry) => entry.id === enemyId);

    if (!enemy) {
      return;
    }

    setEnemyName(enemy.name);
    setEnemyImage(enemy.image_url ?? "");
    setEnemyHp(String(enemy.health));
    setEnemyAttack("0");
    setBattleIntro((current) => current || `${enemy.name} blocks the trail.`);
    setRewardXp((current) => current === "0" ? String(enemy.xp_reward ?? 0) : current);
    setRewardGold((current) => current === "0" ? String(enemy.gold_reward ?? 0) : current);
  }

  function selectEventBattleNpc(npcId: string | null) {
    setEventNpcId(npcId);
    if (npcId) {
      setEventEnemyId(null);
    }

    if (!npcId) {
      return;
    }

    const npc = npcDefinitions.find((entry) => entry.id === npcId);

    if (!npc) {
      return;
    }

    setEnemyName(npc.name);
    setEnemyImage(npc.image_url ?? "");
    setEnemyHp(String(npc.health));
    setEnemyAttack("0");
    setBattleIntro((current) => current || `${npc.name} blocks the trail.`);
    setRewardXp((current) => current === "0" ? String(npc.xp_reward ?? 0) : current);
    setRewardGold((current) => current === "0" ? String(npc.gold_reward ?? 0) : current);
  }

  function selectEventDialogueNpc(npcId: string | null) {
    setEventDialogueNpcId(npcId);
    const npc = npcDefinitions.find((entry) => entry.id === npcId);
    setEventNpcName(npc?.name ?? "");
    setEventNpcPortrait(npc?.image_url ?? "");
  }

  function selectNodeDialogueNpc(npcId: string | null) {
    setNodeNpcId(npcId);
    const npc = npcDefinitions.find((entry) => entry.id === npcId);
    setNodeNpcName(npc?.name ?? "");
    setNodeNpcPortrait(npc?.image_url ?? "");
  }

  function clearEventForm() {
    setEditingEvent(null);
    setEventType("dialogue");
    setEventTitle("");
    setEventDistance("25");
    setEventTriggerMode("fixed");
    setEventRandomChance("10");
    setEventBackgroundImage("");
    setEventNpcName("");
    setEventNpcPortrait("");
    setEventDialogueNpcId(null);
    setEventDialogue("");
    setEventChoices("Continue|Continue\nInvestigate|Investigate\nStart Battle|Start Battle");
    setEnemyName("");
    setEnemyImage("");
    setEnemyHp("30");
    setEnemyAttack("5");
    setEventEnemyId(null);
    setEventNpcId(null);
    setBattleIntro("");
    setVictoryText("");
    setDefeatText("");
    setRewardXp("0");
    setRewardGold("0");
    setRewardItem("");
    setRewardItemId(null);
    setRewardItemQuantity("1");
    setBattlefieldCombatants([]);
    setReuseEventId(null);
  }

  async function saveMapEvent() {
    if (!eventTitle.trim()) {
      setAdminMessage("Add an event title first.");
      return;
    }

    const values = {
      event_type: eventType,
      title: eventTitle.trim(),
      route_id: route.id,
      distance_marker_percent: clamp(Number(eventDistance) || 0, 0, 100),
      trigger_mode: eventTriggerMode,
      random_chance_percent: eventTriggerMode === "random" ? clamp(Number(eventRandomChance) || 0, 0, 100) : 0,
      linked_only: editingEvent?.linked_only ?? false,
      background_image_url: eventBackgroundImage.trim() || null,
      npc_name: eventNpcName.trim() || null,
      npc_portrait_url: eventNpcPortrait.trim() || null,
      dialogue_npc_id: eventDialogueNpcId,
      npc_id: eventNpcId,
      dialogue_text: eventDialogue.trim() || null,
      choices: parseChoices(eventChoices),
      enemy_name: enemyName.trim() || null,
      enemy_id: eventEnemyId,
      enemy_image_url: enemyImage.trim() || null,
      enemy_hp: Number(enemyHp) || 30,
      enemy_attack_damage: Number(enemyAttack) || 5,
      battle_intro_text: battleIntro.trim() || null,
      victory_text: victoryText.trim() || null,
      defeat_text: defeatText.trim() || null,
      reward_xp: Number(rewardXp) || 0,
      reward_gold: Number(rewardGold) || 0,
      reward_item: rewardItem.trim() || null,
      reward_item_id: rewardItemId,
      reward_item_quantity: Math.max(1, Number(rewardItemQuantity) || 1),
      season_number: selectedSeason,
      chapter_number: selectedChapter,
      is_active: true,
    };

    try {
      const saved = editingEvent ? await updateMapEvent(editingEvent.id, values) : await createMapEvent(values);
      setMapEvents((current) => {
        const next = editingEvent ? current.map((event) => (event.id === saved.id ? saved : event)) : [...current, saved];
        return next.sort((a, b) => Number(a.distance_marker_percent) - Number(b.distance_marker_percent));
      });
      setAllMapEvents((current) => {
        const next = editingEvent ? current.map((event) => (event.id === saved.id ? saved : event)) : [...current, saved];
        return next.sort(compareEventsByRouteAndDistance);
      });
      if (saved.event_type === "battle") {
        setEditingEvent(saved);
        await loadBattlefieldCombatants(saved.id);
        setAdminMessage("Event saved. You can now place battlefield combatants.");
        return;
      }
      clearEventForm();
      setAdminMessage("Event saved.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to save event. Confirm the Supabase migration has run."));
    }
  }

  async function reuseSavedEvent() {
    const source = allMapEvents.find((event) => event.id === reuseEventId);

    if (!source) {
      setAdminMessage("Choose a saved event to reuse first.");
      return;
    }

    try {
      const copied = await createMapEvent({
        event_type: source.event_type,
        title: eventTitle.trim() || `${source.title} Copy`,
        route_id: route.id,
        distance_marker_percent: clamp(Number(eventDistance) || Number(source.distance_marker_percent) || 0, 0, 100),
        background_image_url: source.background_image_url,
        npc_name: source.npc_name,
        npc_portrait_url: source.npc_portrait_url,
        dialogue_npc_id: source.dialogue_npc_id,
        npc_id: source.npc_id,
        dialogue_text: source.dialogue_text,
        choices: source.choices ?? [],
        enemy_name: source.enemy_name,
        enemy_id: source.enemy_id,
        enemy_image_url: source.enemy_image_url,
        enemy_hp: source.enemy_hp,
        enemy_attack_damage: source.enemy_attack_damage,
        battle_intro_text: source.battle_intro_text,
        victory_text: source.victory_text,
        defeat_text: source.defeat_text,
        reward_xp: source.reward_xp,
        reward_gold: source.reward_gold,
        reward_item: source.reward_item,
        reward_item_id: source.reward_item_id,
        reward_item_quantity: source.reward_item_quantity,
        trigger_mode: source.trigger_mode ?? "fixed",
        random_chance_percent: source.trigger_mode === "random" ? source.random_chance_percent : 0,
        linked_only: source.linked_only ?? false,
        season_number: selectedSeason,
        chapter_number: selectedChapter,
        is_active: source.is_active,
      });

      await copyDialogueTree(source.id, copied.id);
      setMapEvents((current) => [...current, copied].sort((a, b) => Number(a.distance_marker_percent) - Number(b.distance_marker_percent)));
      setAllMapEvents((current) => [...current, copied].sort(compareEventsByRouteAndDistance));
      setReuseEventId(null);
      clearEventForm();
      setAdminMessage(`Reused ${source.title} on ${route.name}.`);
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to reuse event."));
    }
  }

  async function copyDialogueTree(sourceEventId: string, targetEventId: string) {
    const sourceNodes = await getDialogueNodes(sourceEventId);
    if (sourceNodes.length === 0) {
      return;
    }

    const sourceChoices = await getDialogueChoices(sourceNodes.map((node) => node.id));
    const nodeIdMap = new Map<string, string>();

    for (const node of sourceNodes) {
      const copiedNode = await createDialogueNode({
        event_id: targetEventId,
        marker_id: null,
        node_key: `${node.node_key}-${Date.now()}`.slice(0, 120),
        title: node.title,
        npc_name: node.npc_name,
        npc_id: node.npc_id,
        npc_portrait_url: node.npc_portrait_url,
        background_image_url: node.background_image_url,
        dialogue_text: node.dialogue_text,
        is_start: node.is_start,
        is_ending: node.is_ending,
        allow_end_chat: node.allow_end_chat,
        end_completes_event: node.end_completes_event,
        sort_order: node.sort_order,
      });
      nodeIdMap.set(node.id, copiedNode.id);
    }

    for (const choice of sourceChoices) {
      const copiedNodeId = nodeIdMap.get(choice.node_id);
      if (!copiedNodeId) {
        continue;
      }

      await createDialogueChoice({
        node_id: copiedNodeId,
        button_text: choice.button_text,
        player_dialogue_text: choice.player_dialogue_text,
        action: choice.action,
        next_node_id: choice.next_node_id ? nodeIdMap.get(choice.next_node_id) ?? null : null,
        battle_event_id: choice.battle_event_id,
        reward_xp: choice.reward_xp,
        reward_gold: choice.reward_gold,
        reward_item: choice.reward_item,
        reward_item_id: choice.reward_item_id,
        reward_item_quantity: choice.reward_item_quantity,
        consume_gold: choice.consume_gold ?? 0,
        requirement_type: choice.requirement_type ?? "none",
        requirement_value: choice.requirement_value,
        requirement_quantity: choice.requirement_quantity ?? 1,
        requirement_operator: choice.requirement_operator ?? ">=",
        hide_if_unmet: choice.hide_if_unmet ?? false,
        disable_if_unmet: choice.disable_if_unmet ?? true,
        requirement_failure_message: choice.requirement_failure_message,
        check_enabled: choice.check_enabled ?? false,
        check_attribute: choice.check_attribute,
        check_dc: choice.check_dc ?? 10,
        check_success_node_id: choice.check_success_node_id ? nodeIdMap.get(choice.check_success_node_id) ?? null : null,
        check_failure_node_id: choice.check_failure_node_id ? nodeIdMap.get(choice.check_failure_node_id) ?? null : null,
        check_success_text: choice.check_success_text,
        check_failure_text: choice.check_failure_text,
        unlock_marker_id: choice.unlock_marker_id,
        update_notification_title: choice.update_notification_title,
        update_notification_body: choice.update_notification_body,
        restore_health: choice.restore_health ?? false,
        restore_stamina: choice.restore_stamina ?? false,
        restore_mana: choice.restore_mana ?? false,
        choice_group_key: choice.choice_group_key,
        choice_group_lock_message: choice.choice_group_lock_message,
        hide_when_group_locked: choice.hide_when_group_locked ?? false,
        set_story_flag_key: choice.set_story_flag_key,
        set_story_flag_value: choice.set_story_flag_value ?? true,
        repeatable: choice.repeatable ?? true,
        hide_after_selected: choice.hide_after_selected ?? false,
        disable_after_selected: choice.disable_after_selected ?? false,
        selected_message: choice.selected_message,
        sort_order: choice.sort_order,
      });
    }
  }

  async function removeMapEvent(eventId: string) {
    try {
      await deleteMapEvent(eventId);
      setMapEvents((current) => current.filter((event) => event.id !== eventId));
      setAllMapEvents((current) => current.filter((event) => event.id !== eventId));
      if (editingEvent?.id === eventId) {
        clearEventForm();
      }
      setAdminMessage("Event deleted.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to delete event."));
    }
  }

  function editDialogueNode(node: StoryDialogueNode) {
    setEditingNode(node);
    setNodeTitle(node.title);
    setNodeKey(node.node_key);
    setNodeNpcName(node.npc_name ?? "");
    setNodeNpcId(node.npc_id ?? null);
    setNodeNpcPortrait(node.npc_portrait_url ?? "");
    setNodeBackgroundImage(node.background_image_url ?? "");
    setNodeDialogue(node.dialogue_text);
    setNodeSortOrder(String(node.sort_order));
    setNodeIsStart(node.is_start);
    setNodeIsEnding(node.is_ending);
    setNodeAllowEndChat(node.allow_end_chat);
    setNodeEndCompletesEvent(node.end_completes_event);
    setChoiceNodeId(node.id);
  }

  function selectDialogueNode(nodeId: string) {
    setChoiceNodeId(nodeId);
    clearDialogueChoiceForm();
  }

  function clearDialogueNodeForm() {
    setEditingNode(null);
    setNodeTitle("");
    setNodeKey("");
    setNodeNpcName("");
    setNodeNpcId(null);
    setNodeNpcPortrait("");
    setNodeBackgroundImage("");
    setNodeDialogue("");
    setNodeSortOrder(String(getNextDialogueNodeOrder(dialogueNodes)));
    setNodeIsStart(false);
    setNodeIsEnding(false);
    setNodeAllowEndChat(true);
    setNodeEndCompletesEvent(false);
  }

  async function saveDialogueNode() {
    if ((!selectedDialogueEventId && !selectedDialogueMarkerId) || !nodeTitle.trim()) {
      setAdminMessage("Select a dialogue/event or marker and add a dialogue step title.");
      return;
    }

    try {
      const input = {
        node_key: nodeKey.trim() || nodeTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: nodeTitle.trim(),
        npc_name: nodeNpcName.trim() || null,
        npc_id: nodeNpcId,
        npc_portrait_url: nodeNpcPortrait.trim() || null,
        background_image_url: nodeBackgroundImage.trim() || null,
        dialogue_text: nodeDialogue.trim(),
        is_start: nodeIsStart,
        is_ending: nodeIsEnding,
        allow_end_chat: nodeAllowEndChat,
        end_completes_event: nodeEndCompletesEvent,
        sort_order: Number(nodeSortOrder) || 0,
      };
      const saved = editingNode
        ? await updateDialogueNode(editingNode.id, input)
        : await createDialogueNode({ ...input, event_id: selectedDialogueEventId, marker_id: selectedDialogueMarkerId });
      setDialogueNodes((current) => {
        const next = editingNode ? current.map((node) => (node.id === saved.id ? saved : node)) : [...current, saved];
        return next.sort((a, b) => a.sort_order - b.sort_order);
      });
      setChoiceNodeId(saved.id);
      setChoiceSortOrder(String(getNextChoiceOrder(dialogueChoices, saved.id)));
      clearDialogueNodeForm();
      setAdminMessage(`Dialogue step saved. Add player choices for "${saved.title}" next.`);
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to save dialogue node."));
    }
  }

  async function removeDialogueNode(nodeId: string) {
    try {
      await deleteDialogueNode(nodeId);
      setDialogueNodes((current) => current.filter((node) => node.id !== nodeId));
      const deletedChoiceIds = dialogueChoices.filter((choice) => choice.node_id === nodeId).map((choice) => choice.id);
      setDialogueChoices((current) => current.filter((choice) => choice.node_id !== nodeId));
      setDialogueChoiceRewards((current) => current.filter((reward) => !deletedChoiceIds.includes(reward.choice_id)));
      if (choiceNodeId === nodeId) {
        setChoiceNodeId(null);
      }
      setAdminMessage("Dialogue node deleted.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to delete dialogue node."));
    }
  }

  function editDialogueChoice(choice: StoryDialogueChoice) {
    setEditingChoice(choice);
    setChoiceNodeId(choice.node_id);
    setChoiceButtonText(choice.button_text);
    setChoicePlayerText(choice.player_dialogue_text ?? "");
    setChoiceAction(choice.action);
    setChoiceNextNodeId(choice.next_node_id);
    setChoiceBattleEventId(choice.battle_event_id);
    setChoiceRewardXp(String(choice.reward_xp));
    setChoiceRewardGold(String(choice.reward_gold ?? 0));
    setChoiceRewardItem(choice.reward_item ?? "");
    setChoiceRewardItemId(choice.reward_item_id ?? null);
    setChoiceRewardItemQuantity(String(choice.reward_item_quantity ?? 1));
    setChoiceRequirementType(choice.requirement_type ?? "none");
    setChoiceRequirementValue(choice.requirement_value ?? "");
    setChoiceRequirementQuantity(String(choice.requirement_quantity ?? 1));
    setChoiceRequirementOperator(choice.requirement_operator ?? ">=");
    setChoiceHideIfUnmet(choice.hide_if_unmet ?? false);
    setChoiceDisableIfUnmet(choice.disable_if_unmet ?? true);
    setChoiceRequirementFailureMessage(choice.requirement_failure_message ?? "");
    setChoiceCheckEnabled(choice.check_enabled ?? false);
    setChoiceCheckAttribute(choice.check_attribute ?? "charisma");
    setChoiceCheckDc(String(choice.check_dc ?? 10));
    setChoiceCheckSuccessNodeId(choice.check_success_node_id ?? null);
    setChoiceCheckFailureNodeId(choice.check_failure_node_id ?? null);
    setChoiceCheckSuccessText(choice.check_success_text ?? "");
    setChoiceCheckFailureText(choice.check_failure_text ?? "");
    setChoiceUnlockMarkerId(choice.unlock_marker_id ?? null);
    setChoiceUpdateTitle(choice.update_notification_title ?? "");
    setChoiceUpdateBody(choice.update_notification_body ?? "");
    setChoiceRestoreHealth(choice.restore_health ?? false);
    setChoiceRestoreStamina(choice.restore_stamina ?? false);
    setChoiceRestoreMana(choice.restore_mana ?? false);
    setChoiceGroupKey(choice.choice_group_key ?? "");
    setChoiceGroupLockMessage(choice.choice_group_lock_message ?? "");
    setChoiceHideWhenGroupLocked(choice.hide_when_group_locked ?? false);
    setChoiceStoryFlagKey(choice.set_story_flag_key ?? "");
    setChoiceStoryFlagValue(choice.set_story_flag_value ?? true);
    setChoiceRepeatable(choice.repeatable ?? true);
    setChoiceHideAfterSelected(choice.hide_after_selected ?? false);
    setChoiceDisableAfterSelected(choice.disable_after_selected ?? false);
    setChoiceSelectedMessage(choice.selected_message ?? "");
    setChoiceSortOrder(String(choice.sort_order));
  }

  function startChoiceForNode(node: StoryDialogueNode) {
    setChoiceNodeId(node.id);
    clearDialogueChoiceForm();
    setChoiceSortOrder(String(getNextChoiceOrder(dialogueChoices, node.id)));
    setAdminMessage(`Adding a player choice to "${node.title}".`);
  }

  function clearDialogueChoiceForm() {
    setEditingChoice(null);
    setChoiceButtonText("");
    setChoicePlayerText("");
    setChoiceAction("go_to_node");
    setChoiceNextNodeId(null);
    setChoiceBattleEventId(null);
    setChoiceBattleTitle("");
    setEventBackgroundImage("");
    setChoiceRewardXp("0");
    setChoiceRewardGold("0");
    setChoiceRewardItem("");
    setChoiceRewardItemId(null);
    setChoiceRewardItemQuantity("1");
    setChoiceRequirementType("none");
    setChoiceRequirementValue("");
    setChoiceRequirementQuantity("1");
    setChoiceRequirementOperator(">=");
    setChoiceHideIfUnmet(false);
    setChoiceDisableIfUnmet(true);
    setChoiceRequirementFailureMessage("");
    setChoiceCheckEnabled(false);
    setChoiceCheckAttribute("charisma");
    setChoiceCheckDc("10");
    setChoiceCheckSuccessNodeId(null);
    setChoiceCheckFailureNodeId(null);
    setChoiceCheckSuccessText("");
    setChoiceCheckFailureText("");
    setChoiceUnlockMarkerId(null);
    setChoiceUpdateTitle("");
    setChoiceUpdateBody("");
    setChoiceRestoreHealth(false);
    setChoiceRestoreStamina(false);
    setChoiceRestoreMana(false);
    setChoiceGroupKey("");
    setChoiceGroupLockMessage("");
    setChoiceHideWhenGroupLocked(false);
    setChoiceStoryFlagKey("");
    setChoiceStoryFlagValue(true);
    setChoiceRepeatable(true);
    setChoiceHideAfterSelected(false);
    setChoiceDisableAfterSelected(false);
    setChoiceSelectedMessage("");
    setChoiceSortOrder(String(choiceNodeId ? getNextChoiceOrder(dialogueChoices, choiceNodeId) : 0));
  }

  function selectChoiceBattleEvent(event: MapEvent) {
    setChoiceBattleEventId(event.id);
    setChoiceAction("start_battle");
    setChoiceBattleTitle(event.title);
    setEventBackgroundImage(event.background_image_url ?? "");
    setEventNpcId(event.npc_id ?? null);
    setEventEnemyId(event.enemy_id ?? null);
    setEnemyName(event.enemy_name ?? "");
    setEnemyImage(event.enemy_image_url ?? "");
    setEnemyHp(String(event.enemy_hp ?? 30));
    setEnemyAttack(String(event.enemy_attack_damage ?? 5));
    setBattleIntro(event.battle_intro_text ?? "");
    setVictoryText(event.victory_text ?? "");
    setDefeatText(event.defeat_text ?? "");
    setRewardXp(String(event.reward_xp ?? 0));
    setRewardGold(String(event.reward_gold ?? 0));
    setRewardItem(event.reward_item ?? "");
    setRewardItemId(event.reward_item_id ?? null);
    setRewardItemQuantity(String(event.reward_item_quantity ?? 1));
    setAdminMessage(`Editing linked battle "${event.title}".`);
  }

  async function saveDialogueChoice() {
    if (!choiceNodeId || !choiceButtonText.trim()) {
      setAdminMessage("Select a dialogue node and add choice button text.");
      return;
    }

    try {
      const input = {
        button_text: choiceButtonText.trim(),
        player_dialogue_text: choicePlayerText.trim() || null,
        action: choiceAction,
        next_node_id: choiceAction === "go_to_node" || choiceAction === "give_reward" ? choiceNextNodeId : null,
        battle_event_id: choiceAction === "start_battle" ? choiceBattleEventId : null,
        reward_xp: Number(choiceRewardXp) || 0,
        reward_gold: Number(choiceRewardGold) || 0,
        reward_item: choiceRewardItem.trim() || null,
        reward_item_id: choiceRewardItemId,
        reward_item_quantity: Math.max(1, Number(choiceRewardItemQuantity) || 1),
        consume_gold: editingChoice?.consume_gold ?? 0,
        requirement_type: choiceRequirementType,
        requirement_value: choiceRequirementType === "none" ? null : choiceRequirementValue.trim() || null,
        requirement_quantity: Math.max(1, Number(choiceRequirementQuantity) || 1),
        requirement_operator: choiceRequirementOperator,
        hide_if_unmet: choiceHideIfUnmet,
        disable_if_unmet: choiceDisableIfUnmet,
        requirement_failure_message: choiceRequirementFailureMessage.trim() || null,
        check_enabled: choiceCheckEnabled,
        check_attribute: choiceCheckEnabled ? choiceCheckAttribute : null,
        check_dc: Math.max(1, Number(choiceCheckDc) || 10),
        check_success_node_id: choiceCheckEnabled ? choiceCheckSuccessNodeId : null,
        check_failure_node_id: choiceCheckEnabled ? choiceCheckFailureNodeId : null,
        check_success_text: choiceCheckSuccessText.trim() || null,
        check_failure_text: choiceCheckFailureText.trim() || null,
        unlock_marker_id: choiceUnlockMarkerId,
        update_notification_title: choiceUpdateTitle.trim() || null,
        update_notification_body: choiceUpdateBody.trim() || null,
        restore_health: choiceRestoreHealth,
        restore_stamina: choiceRestoreStamina,
        restore_mana: choiceRestoreMana,
        choice_group_key: choiceGroupKey.trim() || null,
        choice_group_lock_message: choiceGroupLockMessage.trim() || null,
        hide_when_group_locked: choiceHideWhenGroupLocked,
        set_story_flag_key: choiceStoryFlagKey.trim() || null,
        set_story_flag_value: choiceStoryFlagValue,
        repeatable: choiceRepeatable,
        hide_after_selected: !choiceRepeatable && choiceHideAfterSelected,
        disable_after_selected: !choiceRepeatable && choiceDisableAfterSelected,
        selected_message: choiceSelectedMessage.trim() || null,
        sort_order: Number(choiceSortOrder) || 0,
      };
      const saved = editingChoice ? await updateDialogueChoice(editingChoice.id, input) : await createDialogueChoice({ ...input, node_id: choiceNodeId });
      setDialogueChoices((current) => {
        const next = editingChoice ? current.map((choice) => (choice.id === saved.id ? saved : choice)) : [...current, saved];
        return next.sort((a, b) => a.sort_order - b.sort_order);
      });
      clearDialogueChoiceForm();
      setChoiceSortOrder(String(getNextChoiceOrder([...dialogueChoices.filter((choice) => choice.id !== saved.id), saved], choiceNodeId)));
      setAdminMessage(`Player choice saved for "${selectedChoiceNode?.title ?? "this step"}".`);
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to save dialogue choice."));
    }
  }

  async function saveLinkedBattleForChoice() {
    const dialogueSource = selectedDialogueEvent ?? (selectedDialogueMarker ? createMarkerDialogueEvent(selectedDialogueMarker) : null);

    if (!dialogueSource) {
      setAdminMessage("Select a dialogue event or marker dialogue tree before creating a linked battle.");
      return;
    }

    const existingBattle = choiceBattleEventId ? mapEvents.find((event) => event.id === choiceBattleEventId) ?? allMapEvents.find((event) => event.id === choiceBattleEventId) ?? null : null;
    const title = choiceBattleTitle.trim() || existingBattle?.title || `${dialogueSource.title} Battle`;
    const values = {
      event_type: "battle" as const,
      title,
      route_id: dialogueSource.route_id,
      distance_marker_percent: Number(dialogueSource.distance_marker_percent) || 0,
      trigger_mode: "fixed" as const,
      random_chance_percent: 0,
      linked_only: true,
      background_image_url: eventBackgroundImage.trim() || null,
      npc_name: null,
      npc_portrait_url: null,
      dialogue_npc_id: null,
      npc_id: eventNpcId,
      dialogue_text: null,
      choices: [],
      enemy_name: enemyName.trim() || null,
      enemy_id: eventEnemyId,
      enemy_image_url: enemyImage.trim() || null,
      enemy_hp: Number(enemyHp) || 30,
      enemy_attack_damage: Number(enemyAttack) || 5,
      battle_intro_text: battleIntro.trim() || null,
      victory_text: victoryText.trim() || null,
      defeat_text: defeatText.trim() || null,
      reward_xp: Number(rewardXp) || 0,
      reward_gold: Number(rewardGold) || 0,
      reward_item: rewardItem.trim() || null,
      reward_item_id: rewardItemId,
      reward_item_quantity: Math.max(1, Number(rewardItemQuantity) || 1),
      season_number: dialogueSource.season_number ?? selectedSeason,
      chapter_number: dialogueSource.chapter_number ?? selectedChapter,
      is_active: true,
    };

    try {
      const saved = existingBattle ? await updateMapEvent(existingBattle.id, values) : await createMapEvent(values);
      setMapEvents((current) => {
        const next = current.some((event) => event.id === saved.id)
          ? current.map((event) => (event.id === saved.id ? saved : event))
          : [...current, saved];
        return next.sort((a, b) => Number(a.distance_marker_percent) - Number(b.distance_marker_percent));
      });
      setAllMapEvents((current) => {
        const next = current.some((event) => event.id === saved.id)
          ? current.map((event) => (event.id === saved.id ? saved : event))
          : [...current, saved];
        return next.sort(compareEventsByRouteAndDistance);
      });
      setChoiceBattleEventId(saved.id);
      setChoiceAction("start_battle");
      setChoiceBattleTitle(saved.title);
      setAdminMessage(`Linked battle "${saved.title}" saved. Now save the player choice to connect it.`);
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to save linked battle event."));
    }
  }

  async function removeDialogueChoice(choiceId: string) {
    try {
      await deleteDialogueChoice(choiceId);
      setDialogueChoices((current) => current.filter((choice) => choice.id !== choiceId));
      setDialogueChoiceRewards((current) => current.filter((reward) => reward.choice_id !== choiceId));
      setAdminMessage("Dialogue choice deleted.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to delete dialogue choice."));
    }
  }

  function undoPathPoint() {
    setPathDraft((current) => current.slice(0, -1));
    setPathSegmentDraft((current) => normalizePathSegments(current, Math.max(0, pathDraft.length - 1)));
  }

  function clearPathDraft() {
    setPathDraft([]);
    setPathSegmentDraft([]);
  }

  function loadSelectedPathIntoDraft() {
    setPathDraft(route.path_points);
    setPathSegmentDraft(normalizePathSegments(route.path_segments ?? [], route.path_points.length));
    setAdminMessage(`Loaded ${route.name} into the walking path editor.`);
  }

  function resetWalkingPathFormForNewRoute(routeSource: MapRoute[] = activeRouteScopeRoutes.length > 0 ? activeRouteScopeRoutes : routes) {
    setRouteName("");
    setRouteOrder(String(getNextRouteOrder(routeSource)));
    setRouteTerrain("");
    setRouteDanger("");
    setRouteDistance("");
    setRouteImage("");
    setRouteLockType("public");
    setRouteLockMessage("");
    setPathDraft([]);
    setPathSegmentDraft([]);
    setClickedPercent(null);
  }

  async function editWalkingPath(nextRoute: MapRoute) {
    setEditorMode("Walking Path");
    await selectRoute(nextRoute, true);
    setPathDraft(nextRoute.path_points);
    setPathSegmentDraft(normalizePathSegments(nextRoute.path_segments ?? [], nextRoute.path_points.length));
    setAdminMessage(`Editing ${nextRoute.name}. Change the fields below, then Save Walking Path.`);
  }

  function renderLinkedBattleBuilder() {
    return (
      <View style={styles.storyEditor}>
        <Text style={styles.selectedTitle}>Linked Battle</Text>
        <Text style={styles.copy}>Select an existing linked battle to edit, or build one here. Save Linked Battle stores the battle as linked-only so it starts from this player choice, not the trail percentage.</Text>
        <View style={styles.storyRoutePicker}>
          {adminMapEvents.filter((event) => event.event_type === "battle").map((event) => (
            <Pressable key={event.id} style={[styles.routeChip, choiceBattleEventId === event.id && styles.routeChipActive]} onPress={() => selectChoiceBattleEvent(event)}>
              <Text style={styles.routeChipText}>{event.title}</Text>
              <Text style={styles.debugLine}>{event.linked_only ? "Linked Only" : "Trail Battle"}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={choiceBattleTitle} onChangeText={setChoiceBattleTitle} placeholder="Linked battle title" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={eventBackgroundImage} onChangeText={setEventBackgroundImage} placeholder="Battleground image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
        <AdminImageUploadButton folder="battle-backgrounds" onUploaded={setEventBackgroundImage} onMessage={setAdminMessage} />
        <EnemyPicker enemies={enemyDefinitions} selectedId={eventEnemyId} onSelect={selectEventEnemy} />
        <NpcPicker label="Or select a battle-capable NPC" npcs={npcDefinitions} selectedId={eventNpcId} onSelect={selectEventBattleNpc} battleOnly />
        {eventNpcId ? (
          <View style={styles.storyCard}>
            <Text style={styles.markerName}>{getNpcName(npcDefinitions, eventNpcId)}</Text>
            <Text style={styles.copy}>This linked battle will use the selected NPC's battle stats, abilities, rewards, and drops.</Text>
          </View>
        ) : eventEnemyId ? (
          <View style={styles.storyCard}>
            <Text style={styles.markerName}>{getEnemyName(enemyDefinitions, eventEnemyId)}</Text>
            <Text style={styles.copy}>This linked battle will use the selected enemy's stats, abilities, rewards, and drops.</Text>
          </View>
        ) : (
          <View style={styles.storyCard}>
            <Text style={styles.markerName}>Manual Enemy Fallback</Text>
            <TextInput value={enemyName} onChangeText={setEnemyName} placeholder="Enemy name" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput value={enemyImage} onChangeText={setEnemyImage} placeholder="Enemy image URL" placeholderTextColor={colors.muted} style={styles.input} />
            <AdminImageUploadButton folder="battle-enemies" onUploaded={setEnemyImage} onMessage={setAdminMessage} />
            <TextInput value={enemyHp} onChangeText={setEnemyHp} placeholder="Enemy HP" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput value={enemyAttack} onChangeText={setEnemyAttack} placeholder="Enemy attack damage" placeholderTextColor={colors.muted} style={styles.input} />
          </View>
        )}
        <TextInput value={battleIntro} onChangeText={setBattleIntro} placeholder="Battle intro text" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={victoryText} onChangeText={setVictoryText} placeholder="Victory text" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={defeatText} onChangeText={setDefeatText} placeholder="Defeat text" placeholderTextColor={colors.muted} style={styles.input} />
        <Text style={styles.selectedTitle}>Battle Rewards</Text>
        <TextInput value={rewardXp} onChangeText={setRewardXp} placeholder="Reward XP" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={rewardGold} onChangeText={setRewardGold} placeholder="Reward gold" placeholderTextColor={colors.muted} style={styles.input} />
        <ItemPicker label="Reward item" items={itemDefinitions} selectedId={rewardItemId} onSelect={setRewardItemId} />
        <TextInput value={rewardItemQuantity} onChangeText={setRewardItemQuantity} placeholder="Reward item quantity" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={rewardItem} onChangeText={setRewardItem} placeholder="Legacy reward item text optional" placeholderTextColor={colors.muted} style={styles.input} />
        <Pressable style={styles.primaryButton} onPress={() => void saveLinkedBattleForChoice()}>
          <Text style={styles.primaryText}>Save Linked Battle</Text>
        </Pressable>
        <Text style={styles.debugLine}>After saving the linked battle, save the player choice to connect the button to this battle.</Text>
      </View>
    );
  }

  function renderDialogueChoiceRequirementEditor() {
    return (
      <DialogueChoiceRequirementEditor
        requirementTypes={dialogueRequirementTypes}
        operators={dialogueRequirementOperators}
        attributeKeys={attributeRequirementKeys}
        requirementType={choiceRequirementType}
        requirementValue={choiceRequirementValue}
        requirementQuantity={choiceRequirementQuantity}
        requirementOperator={choiceRequirementOperator}
        hideIfUnmet={choiceHideIfUnmet}
        disableIfUnmet={choiceDisableIfUnmet}
        failureMessage={choiceRequirementFailureMessage}
        itemDefinitions={itemDefinitions}
        markers={markers}
        events={allMapEvents}
        tutorialSteps={tutorialSteps}
        storyFlagKeys={knownStoryFlagKeys}
        onChangeType={setChoiceRequirementType}
        onChangeValue={setChoiceRequirementValue}
        onChangeQuantity={setChoiceRequirementQuantity}
        onChangeOperator={setChoiceRequirementOperator}
        onToggleHide={() => setChoiceHideIfUnmet((value) => !value)}
        onToggleDisable={() => setChoiceDisableIfUnmet((value) => !value)}
        onChangeFailureMessage={setChoiceRequirementFailureMessage}
      />
    );
  }

  function renderDialogueAttributeCheckEditor() {
    return (
      <DialogueCheckEditor
        enabled={choiceCheckEnabled}
        attribute={choiceCheckAttribute}
        dc={choiceCheckDc}
        successNodeId={choiceCheckSuccessNodeId}
        failureNodeId={choiceCheckFailureNodeId}
        successText={choiceCheckSuccessText}
        failureText={choiceCheckFailureText}
        attributes={dialogueCheckAttributes}
        nodes={dialogueNodes}
        onToggleEnabled={() => setChoiceCheckEnabled((value) => !value)}
        onChangeAttribute={setChoiceCheckAttribute}
        onChangeDc={setChoiceCheckDc}
        onChangeSuccessNodeId={setChoiceCheckSuccessNodeId}
        onChangeFailureNodeId={setChoiceCheckFailureNodeId}
        onChangeSuccessText={setChoiceCheckSuccessText}
        onChangeFailureText={setChoiceCheckFailureText}
      />
    );
  }

  function applyLegendStyleToMarker(item: MarkerLegendItem) {
    setDraftType(item.marker_type);
    setMarkerIconLabel(item.icon_label ?? "");
    setMarkerIconImage(item.icon_image_url ?? "");
    setMarkerIconColor(item.icon_color ?? "");
    if (!draftTitle.trim()) {
      setDraftTitle(item.title);
    }
    if (!draftDescription.trim() && item.description) {
      setDraftDescription(item.description);
    }
    setAdminMessage(`Applied legend style: ${item.title}.`);
  }

  function renderBranchingDialogueEditor(markerSource?: MapMarker) {
    const markerDialogueEvent = markerSource ? createMarkerDialogueEvent(markerSource) : null;
    const editorSelectedEvent = markerDialogueEvent ?? selectedDialogueEvent;
    const editorSelectedId = markerSource?.id ?? selectedDialogueEventId;

    return (
      <DialogueTreeAdmin
        title={markerSource ? "Marker Dialogue Tree Builder" : "Dialogue Tree Admin"}
        description={markerSource ? "Build this marker's own branching conversation. Use Start Quest to begin linked paths from a player choice." : undefined}
        emptyText={markerSource ? "Select a Story, Quest, Side Quest, or Point of Interest marker first." : undefined}
        showEventPicker={!markerSource}
        sourceSummary={markerSource ? `${markerSource.type} marker / ${markerSource.mini_map_id ? "Mini map" : "World map"}` : null}
        events={adminMapEvents}
        selectedEventId={editorSelectedId}
        selectedEvent={editorSelectedEvent}
        nodes={dialogueNodes}
        choices={dialogueChoices}
        itemDefinitions={itemDefinitions}
        onSelectEvent={(eventId) => void loadDialogueEditor(eventId)}
        onStartNewNode={startNewDialogueStep}
        onEditChoice={editDialogueChoice}
        nodeEditor={
          <DialogueNodeEditor
            nodes={dialogueNodes}
            editingNode={editingNode}
            selectedNodeId={choiceNodeId}
            title={nodeTitle}
            nodeKey={nodeKey}
            npcName={nodeNpcName}
            npcPortrait={nodeNpcPortrait}
            backgroundImage={nodeBackgroundImage}
            dialogue={nodeDialogue}
            sortOrder={nodeSortOrder}
            isStart={nodeIsStart}
            isEnding={nodeIsEnding}
            allowEndChat={nodeAllowEndChat}
            endCompletesEvent={nodeEndCompletesEvent}
            selectedDialogueEventId={editorSelectedId}
            renderNpcPicker={<NpcPicker label="Reuse NPC for this dialogue step" npcs={npcDefinitions} selectedId={nodeNpcId} onSelect={selectNodeDialogueNpc} />}
            renderNpcPortraitUploader={<AdminImageUploadButton folder="dialogue-npcs" onUploaded={setNodeNpcPortrait} onMessage={setAdminMessage} />}
            renderBackgroundUploader={<AdminImageUploadButton folder="dialogue-backgrounds" onUploaded={setNodeBackgroundImage} onMessage={setAdminMessage} />}
            onChangeTitle={setNodeTitle}
            onChangeNodeKey={setNodeKey}
            onChangeNpcName={setNodeNpcName}
            onChangeNpcPortrait={setNodeNpcPortrait}
            onChangeBackgroundImage={setNodeBackgroundImage}
            onChangeDialogue={setNodeDialogue}
            onChangeSortOrder={setNodeSortOrder}
            onToggleStart={() => setNodeIsStart((value) => !value)}
            onToggleEnding={() => setNodeIsEnding((value) => !value)}
            onToggleAllowEndChat={() => setNodeAllowEndChat((value) => !value)}
            onToggleEndCompletesEvent={() => setNodeEndCompletesEvent((value) => !value)}
            onSave={() => void saveDialogueNode()}
            onCancelEdit={clearDialogueNodeForm}
            onSelectNode={selectDialogueNode}
            onEditNode={editDialogueNode}
            onStartChoice={startChoiceForNode}
            onDeleteNode={(nodeId) => void removeDialogueNode(nodeId)}
            getNodeChoiceCount={(nodeId) => dialogueChoices.filter((choice) => choice.node_id === nodeId).length}
          />
        }
        choiceEditor={
          <DialogueChoiceEditor
            nodes={dialogueNodes}
            selectedChoiceNode={selectedChoiceNode}
            selectedNodeChoices={selectedNodeChoices}
            editingChoice={editingChoice}
            nodeId={choiceNodeId}
            buttonText={choiceButtonText}
            playerText={choicePlayerText}
            action={choiceAction}
            nextNodeId={choiceNextNodeId}
            sortOrder={choiceSortOrder}
            repeatable={choiceRepeatable}
            hideAfterSelected={choiceHideAfterSelected}
            disableAfterSelected={choiceDisableAfterSelected}
            selectedMessage={choiceSelectedMessage}
            choiceGroupKey={choiceGroupKey}
            choiceGroupLockMessage={choiceGroupLockMessage}
            hideWhenGroupLocked={choiceHideWhenGroupLocked}
            itemDefinitions={itemDefinitions}
            effectEditor={
              <DialogueChoiceEffectEditor
                action={choiceAction}
                rewardXp={choiceRewardXp}
                rewardGold={choiceRewardGold}
                rewardItemId={choiceRewardItemId}
                rewardItemQuantity={choiceRewardItemQuantity}
                legacyRewardItem={choiceRewardItem}
                itemDefinitions={itemDefinitions}
                markers={effectiveMarkers.filter((marker) => isInSelectedChapter(marker, selectedSeason, selectedChapter))}
                unlockMarkerId={choiceUnlockMarkerId}
                updateTitle={choiceUpdateTitle}
                updateBody={choiceUpdateBody}
                restoreHealth={choiceRestoreHealth}
                restoreStamina={choiceRestoreStamina}
                restoreMana={choiceRestoreMana}
                storyFlagKey={choiceStoryFlagKey}
                storyFlagValue={choiceStoryFlagValue}
                storyFlagKeys={knownStoryFlagKeys}
                linkedBattleBuilder={choiceAction === "start_battle" ? renderLinkedBattleBuilder() : null}
                onChangeRewardXp={setChoiceRewardXp}
                onChangeRewardGold={setChoiceRewardGold}
                onChangeRewardItemId={setChoiceRewardItemId}
                onChangeRewardItemQuantity={setChoiceRewardItemQuantity}
                onChangeLegacyRewardItem={setChoiceRewardItem}
                onChangeUnlockMarkerId={setChoiceUnlockMarkerId}
                onChangeUpdateTitle={setChoiceUpdateTitle}
                onChangeUpdateBody={setChoiceUpdateBody}
                onToggleRestoreHealth={() => setChoiceRestoreHealth((value) => !value)}
                onToggleRestoreStamina={() => setChoiceRestoreStamina((value) => !value)}
                onToggleRestoreMana={() => setChoiceRestoreMana((value) => !value)}
                onChangeStoryFlagKey={setChoiceStoryFlagKey}
                onToggleStoryFlagValue={() => setChoiceStoryFlagValue((value) => !value)}
              />
            }
            requirementEditor={renderDialogueChoiceRequirementEditor()}
            checkEditor={renderDialogueAttributeCheckEditor()}
            onSelectNode={selectDialogueNode}
            onChangeButtonText={setChoiceButtonText}
            onChangePlayerText={setChoicePlayerText}
            onChangeAction={setChoiceAction}
            onChangeNextNodeId={setChoiceNextNodeId}
            onChangeSortOrder={setChoiceSortOrder}
            onToggleRepeatable={() => setChoiceRepeatable((value) => !value)}
            onToggleHideAfterSelected={() => setChoiceHideAfterSelected((value) => !value)}
            onToggleDisableAfterSelected={() => setChoiceDisableAfterSelected((value) => !value)}
            onChangeSelectedMessage={setChoiceSelectedMessage}
            onChangeChoiceGroupKey={setChoiceGroupKey}
            onChangeChoiceGroupLockMessage={setChoiceGroupLockMessage}
            onToggleHideWhenGroupLocked={() => setChoiceHideWhenGroupLocked((value) => !value)}
            onSave={() => void saveDialogueChoice()}
            onCancelEdit={clearDialogueChoiceForm}
            onEditChoice={editDialogueChoice}
            onDeleteChoice={(choiceId) => void removeDialogueChoice(choiceId)}
          />
        }
      />
    );
  }

  if (activeEvent) {
    return (
      <>
        <DialogueSceneScreen
          event={activeEvent}
          nodes={dialogueNodes}
          choices={dialogueChoices}
          npcs={npcDefinitions}
          activeNodeId={activeNodeId}
          dialogueLog={dialogueLog}
          previewMode={adminPreviewMode === "story"}
          choiceAvailability={dialogueChoiceAvailability}
          choiceRewards={dialogueChoiceRewards}
          itemDefinitions={itemDefinitions}
          pendingRewardChoice={pendingRewardChoice}
          onLegacyChoice={handleStoryChoice}
          onChoice={(choice) => void handleDialogueChoice(choice)}
          onClaimPendingReward={(choice) => void claimPendingDialogueReward(choice)}
          onEndChat={(completeEvent) => void endDialogueChat(completeEvent)}
          onExitPreview={closeAdminPreview}
        />
        <GameToast toast={gameToast} onDismiss={() => setGameToast(null)} />
      </>
    );
  }

  if (activeBattle) {
    return (
      <ActiveBattleView
        character={character}
        activeBattle={activeBattle}
        playerHp={battlePlayerHp}
        stamina={battleStamina}
        mana={battleMagicka}
        resources={combatResources}
        enemyHp={battleEnemyHp}
        enemyStamina={battleEnemyStamina}
        enemyMana={battleEnemyMagika}
        activeEnemy={activeEnemy}
        opponents={battleOpponents}
        companions={battleCompanions}
        layoutCombatants={battleLayoutCombatants}
        selectedOpponentKey={selectedOpponentKey}
        equippedAbilities={equippedAbilities}
        equippedWeapon={equippedItems.weapon ?? null}
        inventoryItems={inventoryItems}
        inventoryOpen={battleInventoryOpen}
        battleLog={battleLog}
        battleTurnPhase={battleTurnPhase}
        openingEnemyTurnQueued={openingEnemyTurnQueued}
        combatIndicators={combatIndicators}
        revivePromptOpen={revivePromptOpen}
        result={battleFinished}
        previewMode={adminPreviewMode === "battle"}
        toast={gameToast}
        onAction={(ability) => void handleBattleAction(ability)}
        onOpeningEnemyTurn={() => void handleOpeningEnemyTurn()}
        onSelectOpponent={selectBattleTarget}
        onWeaponAction={(weapon) => void handleWeaponAction(weapon)}
        onFlee={() => void fleeBattle()}
        onUseItem={(item) => void useBattleItem(item)}
        onToggleInventory={() => setBattleInventoryOpen((current) => !current)}
        onDeclineRevive={() => void declineReviveAfterDefeat()}
        onReturnToStart={() => void resetCurrentRouteAfterDefeat()}
        onComplete={() => void finishEvent(activeBattle)}
        onExitPreview={closeAdminPreview}
        onDismissToast={() => setGameToast(null)}
      />
    );
  }

  if (activeMapSheet === "inventory") {
    return (
      <CharacterInventorySheet
        items={inventoryItems}
        equippedItems={equippedItems}
        selectedItem={selectedMapInventoryItem}
        activeTab={mapInventoryTab}
        totalWeight={totalInventoryWeight}
        carryCapacity={carryCapacity}
        currentHealth={currentHealth}
        maxHealth={combatResources.maxHp}
        message={mapItemMessage}
        onClose={() => setActiveMapSheet(null)}
        onSelectTab={setMapInventoryTab}
        onSelectItem={setSelectedMapInventoryItemId}
        onEquipItem={(entry) => void equipMapItem(entry)}
        onUnequipSlot={(slot) => void unequipMapSlot(slot)}
        onUseItem={(entry) => void useMapInventoryItem(entry)}
        onUseScroll={(entry) => void useMapInventoryItem(entry)}
        onDropItem={(entry) => void dropMapItem(entry)}
      />
    );
  }

  if (activeMapSheet === "abilities") {
    return (
      <CharacterAbilitiesSheet
        abilities={knownAbilities}
        equippedAbilities={equippedAbilities}
        selectedAbility={selectedMapAbility}
        selectedAbilityKey={selectedMapAbilityKey}
        activeTab={mapAbilityTab}
        currentHealth={currentHealth}
        maxHealth={combatResources.maxHp}
        message={mapItemMessage}
        onClose={() => setActiveMapSheet(null)}
        onSelectTab={setMapAbilityTab}
        onSelectAbility={(ability) => {
          setSelectedMapAbility(ability);
          setSelectedMapAbilityKey(ability?.key ?? null);
        }}
        onEquipAbility={(slot) => void equipMapAbility(slot)}
        onClearSlot={(slot) => void clearMapAbilitySlot(slot)}
        onUseHeal={(ability) => void useMapOutsideBattleAbility(ability)}
      />
    );
  }

  if (selectedMarker && (previewMarkerScene || (!isAdmin && canUseSelectedMarker && !selectedMarkerLocked))) {
    return (
      <>
        <MarkerSceneScreen
          marker={selectedMarker}
          characterGold={character.gold}
          marketItems={markerMarketItems}
          marketPurchaseCounts={marketPurchaseCounts}
          routeLinks={markerRouteLinks}
          routes={routes}
          routeProgressRows={effectiveRouteProgressRows}
          inventoryItems={inventoryItems}
          itemDefinitions={itemDefinitions}
          markerHasDialogue={markerDialogueIds.has(selectedMarker.id) || Boolean(selectedMarker.dialogue_event_id)}
          message={markerPanelMessage}
          onExit={closeMarkerScene}
          onBuy={(marketItem) => void buyFromMarker(marketItem)}
          onSell={(entry) => void sellToMarker(entry)}
          onClaimReward={() => void claimSelectedMarkerReward()}
          onAcceptQuest={() => void acceptSelectedMarkerQuest()}
          onStartPath={(nextRoute, routeLink) => void startPathFromSignPost(nextRoute, routeLink)}
          onUseExit={() => void openExitMarker(selectedMarker)}
          onEnterArea={() => void enterAreaMarker(selectedMarker)}
          onOpenDialogueEvent={() => void openSelectedMarkerDialogue()}
          onStartBattleEvent={() => void startSelectedMarkerBattle()}
        />
        <GameToast toast={gameToast} onDismiss={() => setGameToast(null)} />
      </>
    );
  }

  if (!mapReady) {
    return (
      <Screen>
        <View style={styles.header}>
          <BrandLogo size={54} />
          <View style={styles.headerText}>
            <Text style={styles.brand}>Anima Magisterium</Text>
            <Text style={styles.subtitle}>Map / Battles</Text>
          </View>
        </View>
        <Frame style={styles.panel}>
          <Text style={styles.sectionTitle}>Loading Map</Text>
          <Text style={styles.copy}>Restoring your current trail and saved position...</Text>
        </Frame>
      </Screen>
    );
  }

  function renderJourneyPanel() {
    if (!hasActiveRoute) {
      return null;
    }

    const remainingMeters = Math.max(0, route.distance_required_meters - distanceWalked);
    const routeImageUri = route.image_url ? resolveMapImageUri(route.image_url) : null;
    const sourceMarker = currentRouteProgress?.source_marker_id ? markers.find((marker) => marker.id === currentRouteProgress.source_marker_id) ?? null : null;
    const sourceRouteLinks = sourceMarker ? getOrderedMarkerRouteLinks(allMarkerRouteLinks.filter((link) => link.marker_id === sourceMarker.id)) : [];
    const sourceRouteIndex = sourceRouteLinks.findIndex((link) => link.route_id === route.id);
    const destinationMarker = getJourneyDestinationMarker(route, markers, allMarkerRouteLinks, sourceMarker?.id ?? null);
    const hasStoryContext = Boolean(sourceMarker && isStoryQuestMarker(sourceMarker));
    const journeyMode = hasStoryContext ? (sourceMarker?.type === "Side Quest" || sourceMarker?.type === "Quest" ? "Quest Journey" : "Story Journey") : "Road Sign Travel";
    const journeyTitle = hasStoryContext ? sourceMarker?.quest_title || sourceMarker?.title || route.name : route.name;
    const journeyObjective = hasStoryContext
      ? getJourneyObjective(sourceMarker, route, sourceRouteLinks[sourceRouteIndex])
      : routeDirection === "reverse"
        ? "Return to the previous sign post."
        : "Follow the selected trail.";
    const stepLabel = hasStoryContext && sourceRouteIndex >= 0
      ? `Path ${sourceRouteIndex + 1} of ${sourceRouteLinks.length}`
      : routeDirection === "reverse"
        ? "Returning"
        : "Active Path";
    const arrivedAtEnd = routeDirection !== "reverse" && progressPercent >= 100;
    const arrivedAtStart = routeDirection === "reverse" && progressPercent <= 0;
    const arrived = arrivedAtEnd || arrivedAtStart;
    const travelTitle = arrived ? "Arrived" : routeDirection === "reverse" ? "Returning" : journeyMode;
    const primaryLabel = arrived && destinationMarker ? `Open ${destinationMarker.type}` : isTracking ? (Platform.OS === "web" ? "Pause GPS" : "Pause Steps") : "Continue Walking";
    const turnLabel = routeDirection === "reverse" ? "Travel Forward" : "Turn Back";
    const handlePrimaryJourneyAction = () => {
      if (arrived && destinationMarker) {
        void selectMarker(destinationMarker);
        return;
      }

      if (isTracking) {
        stopGpsTracking();
      } else {
        startGpsTracking();
      }
    };

    return (
      <Frame style={[styles.panel, styles.journeyHud]}>
        <View style={styles.journeyActionBar}>
          <Pressable style={[styles.journeyPrimary, (isTracking || arrived) && styles.gpsActive]} onPress={handlePrimaryJourneyAction}>
            <Text style={styles.journeyPrimaryText}>{primaryLabel}</Text>
          </Pressable>
          <Pressable style={[styles.journeySecondary, routeDirection === "reverse" && styles.gpsActive, progressPercent <= 0 && styles.disabledAction]} onPress={() => void turnBackOnCurrentPath()} disabled={progressPercent <= 0}>
            <Text style={styles.journeySecondaryText}>{turnLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.journeyTop}>
          <View style={styles.journeyTitleBlock}>
            <Text style={styles.journeyOverline}>{travelTitle}</Text>
            <Text style={styles.journeyTitle}>{journeyTitle}</Text>
            <Text style={styles.journeySub}>{journeyObjective}</Text>
          </View>
          <View style={styles.journeyRouteImage}>
            {routeImageUri ? <Image source={{ uri: routeImageUri }} style={styles.journeyRoutePhoto} /> : <Text style={styles.journeyRouteInitial}>{route.name.slice(0, 1).toUpperCase()}</Text>}
          </View>
        </View>

        <View style={styles.journeyQuestCard}>
          <View style={styles.journeyQuestHeader}>
            <Text style={styles.journeyQuestLabel}>{stepLabel}</Text>
            <Text style={styles.journeyQuestMeta}>{metersToMiles(remainingMeters)} mi left</Text>
          </View>
          <Text style={styles.journeyQuestTitle}>{route.name}</Text>
          <Text style={styles.journeyQuestText}>{routeDirection === "reverse" ? "Progress is moving back toward the start of this path." : "Walking progress moves you toward the next story point."}</Text>
          {destinationMarker ? (
            <View style={styles.journeyDestination}>
              <MarkerIcon marker={destinationMarker} compact />
              <View style={styles.journeyDestinationCopy}>
                <Text style={styles.journeyDestinationLabel}>Destination Marker</Text>
                <Text style={styles.journeyDestinationTitle}>{destinationMarker.title}</Text>
                <Text style={styles.journeyDestinationType}>{destinationMarker.type}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.journeyProgressRow}>
          <View style={styles.journeyProgressTrack}>
            <ProgressBar value={progressPercent} max={100} color={colors.gold} height={8} />
          </View>
          <Text style={styles.journeyPercent}>{Math.round(progressPercent)}%</Text>
        </View>

        <View style={styles.journeyStats}>
          <View style={styles.journeyStat}>
            <Text style={styles.journeyStatValue}>{route.estimated_encounters}</Text>
            <Text style={styles.journeyStatLabel}>Encounters</Text>
          </View>
          <View style={styles.journeyStat}>
            <Text style={styles.journeyStatValue}>{routePotentialXp}</Text>
            <Text style={styles.journeyStatLabel}>XP Potential</Text>
          </View>
          <View style={styles.journeyStat}>
            <Text style={styles.journeyStatValue}>{routePotentialGold}</Text>
            <Text style={styles.journeyStatLabel}>Gold Potential</Text>
          </View>
          <View style={styles.journeyStat}>
            <Text style={styles.journeyStatValue}>{completedRouteEvents}/{requiredRouteEvents.length}</Text>
            <Text style={styles.journeyStatLabel}>Required Events</Text>
          </View>
        </View>

        <View style={styles.journeyResources}>
          <View style={styles.journeyResource}>
            <View style={styles.journeyResourceHeader}>
              <Text style={[styles.journeyResourceLabel, { color: colors.red }]}>HP</Text>
              <Text style={styles.journeyResourceValue}>{currentHealth} / {combatResources.maxHp}</Text>
            </View>
            <ProgressBar value={currentHealth} max={Math.max(1, combatResources.maxHp)} color={colors.red} height={6} />
          </View>
          <View style={styles.journeyResource}>
            <View style={styles.journeyResourceHeader}>
              <Text style={[styles.journeyResourceLabel, { color: colors.gold }]}>Stamina</Text>
              <Text style={styles.journeyResourceValue}>{combatResources.maxStamina} / {combatResources.maxStamina}</Text>
            </View>
            <ProgressBar value={combatResources.maxStamina} max={Math.max(1, combatResources.maxStamina)} color={colors.gold} height={6} />
          </View>
          <View style={styles.journeyResource}>
            <View style={styles.journeyResourceHeader}>
              <Text style={[styles.journeyResourceLabel, { color: colors.blue }]}>Mana</Text>
              <Text style={styles.journeyResourceValue}>{combatResources.maxMagicka} / {combatResources.maxMagicka}</Text>
            </View>
            <ProgressBar value={combatResources.maxMagicka} max={Math.max(1, combatResources.maxMagicka)} color={colors.blue} height={6} />
          </View>
        </View>

        <View style={styles.journeyActions}>
          <Pressable style={styles.journeySecondary} onPress={() => setActiveMapSheet("inventory")}>
            <Text style={styles.journeySecondaryText}>Inventory ({inventoryItems.length})</Text>
          </Pressable>
          <Pressable style={styles.journeySecondary} onPress={() => setActiveMapSheet("abilities")}>
            <Text style={styles.journeySecondaryText}>Abilities</Text>
          </Pressable>
        </View>

        <View style={styles.journeyDebugGrid}>
          <Text style={styles.journeyDebug}>State {playerMovementState}</Text>
          <Text style={styles.journeyDebug}>Speed {movementStatus.speedMph.toFixed(1)} mph</Text>
          <Text style={styles.journeyDebug}>{route.terrain}</Text>
        </View>
        <Text style={styles.gpsMessage}>{gpsMessage}</Text>
      </Frame>
    );
  }

  function renderReuseEventPanel() {
    const selectedReusableEvent = reusableMapEvents.find((event) => event.id === reuseEventId) ?? null;

    return (
      <View style={styles.storyEditor}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.selectedTitle}>Reuse Existing Event</Text>
            <Text style={styles.copy}>{reuseEventOpen ? "Pick any saved event and copy it onto the selected trail." : "Copy a saved event onto this trail."}</Text>
          </View>
          <Pressable style={styles.secondaryButtonFlex} onPress={() => setReuseEventOpen((value) => !value)}>
            <Text style={styles.secondaryText}>{reuseEventOpen ? "Hide" : "Show"}</Text>
          </Pressable>
        </View>
        {reuseEventOpen ? (
          <>
            <Text style={styles.copy}>Pick any saved event, set the distance marker above or below, then copy it onto the selected trail.</Text>
            {reusableMapEvents.length === 0 ? <Text style={styles.copy}>No saved events found for this season and chapter yet.</Text> : null}
            <View style={styles.storyRoutePicker}>
              {reusableMapEvents.map((event) => (
                <Pressable
                  key={event.id}
                  style={[styles.routeChip, reuseEventId === event.id && styles.routeChipActive]}
                  onPress={() => {
                    setReuseEventId(event.id);
                    setEventType(event.event_type === "story" ? "dialogue" : event.event_type);
                    setEventDistance(String(event.distance_marker_percent));
                    setEventTitle((current) => current || `${event.title} Copy`);
                  }}
                >
                  <Text style={styles.routeChipText}>{event.title}</Text>
                  <Text style={styles.debugLine}>{eventTypeName(event.event_type)} / {getRouteName(routes, event.route_id ?? "")}</Text>
                </Pressable>
              ))}
            </View>
            {selectedReusableEvent ? (
              <View style={styles.storyCard}>
                <Text style={styles.markerName}>{selectedReusableEvent.title}</Text>
                <Text style={styles.copy}>{eventTypeName(selectedReusableEvent.event_type)} copied to {route.name} at {clamp(Number(eventDistance) || 0, 0, 100)}%.</Text>
                <Pressable style={styles.primaryButton} onPress={() => void reuseSavedEvent()}>
                  <Text style={styles.primaryText}>Reuse Event on This Trail</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    );
  }

  function renderReuseStoryMarkerPanel() {
    const reusableStoryMarkers = adminStoryMarkers.filter((marker) => marker.id !== selectedMarker?.id);

    return (
      <View style={styles.storyEditor}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.selectedTitle}>Reuse Existing Story Marker</Text>
            <Text style={styles.copy}>Copy an existing story or quest marker into this mini map, then tap the mini map to place it.</Text>
          </View>
        </View>
        {reusableStoryMarkers.length === 0 ? <Text style={styles.copy}>No reusable story markers found for this season and chapter.</Text> : null}
        <View style={styles.storyRoutePicker}>
          {reusableStoryMarkers.map((marker) => (
            <Pressable key={marker.id} style={styles.routeChip} onPress={() => void reuseStoryMarkerInMiniMap(marker)}>
              <Text style={styles.routeChipText}>{marker.story_order || 0}. {marker.title}</Text>
              <Text style={styles.debugLine}>{marker.type}{marker.mini_map_id ? " / Mini Map" : " / World"}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  if (activeMiniMap) {
    const miniMapImage = resolveMapImageUri(activeMiniMap.background_image_url);

    return (
      <Screen>
        <View style={styles.header}>
          <BrandLogo size={54} />
          <View style={styles.headerText}>
            <Text style={styles.brand}>{activeMiniMap.name}</Text>
            <Text style={styles.subtitle}>Mini Map / {activeMiniMap.type}</Text>
          </View>
        </View>
        {renderAdminViewTool()}
        {route.mini_map_id === activeMiniMap.id ? renderJourneyPanel() : null}
        <Frame style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.sectionTitle}>{activeMiniMap.name}</Text>
              {activeMiniMap.description ? <Text style={styles.copy}>{activeMiniMap.description}</Text> : null}
            </View>
            {isAdmin ? (
              <Pressable style={styles.secondaryButtonFlex} onPress={() => void leaveMiniMap()}>
                <Text style={styles.secondaryText}>Close Mini Map</Text>
              </Pressable>
            ) : null}
          </View>
          <MiniMapCanvas
            imageUri={miniMapImage}
            width={Math.max(320, Number(activeMiniMap.width) || 900)}
            height={Math.max(280, Number(activeMiniMap.height) || 650)}
            canCapturePointer={isAdmin}
            onMapPointer={(event) => handleMapPointer(event as Parameters<typeof handleMapPointer>[0], "mini")}
            routeSegments={miniMapRouteSegments}
            draftSegments={draftSegments}
            pathDraft={pathDraft}
            eventPins={adminRouteEventPins}
            showDraft={isAdmin && editorMode === "Walking Path"}
            clickedPercent={clickedPercent}
            showTempMarker={isAdmin && editorMode === "Marker"}
            markers={visibleMiniMapMarkers}
            playerPosition={miniMapPlayerPosition}
            playerName={character.name}
            playerPortraitUrl={character.portrait_url}
            playerPathVisibility={route.mini_map_id === activeMiniMap.id ? playerPathVisibility : "visible"}
            onSelectMarker={(marker) => void selectMarker(marker)}
          />
        </Frame>
        <MarkerLegend items={legendItems} open={legendOpen} onToggle={() => setLegendOpen((value) => !value)} />
        {isAdmin ? (
          <Frame style={styles.panel}>
            <Text style={styles.sectionTitle}>Mini Map Admin Preview</Text>
            <Text style={styles.copy}>Click this mini map image to capture percentage coordinates, then create or edit markers inside {activeMiniMap.name}.</Text>
            {adminMessage ? <Text style={styles.adminMessage}>{adminMessage}</Text> : null}
            <View style={styles.storyEditor}>
              <Text style={styles.selectedTitle}>Mini Map Details</Text>
              <TextInput value={miniMapName} onChangeText={setMiniMapName} placeholder="Mini map name" placeholderTextColor={colors.muted} style={styles.input} />
              <View style={styles.modeRow}>
                <TextInput value={miniMapAreaName} onChangeText={setMiniMapAreaName} placeholder="Area group, example Hearthland Woods" placeholderTextColor={colors.muted} style={[styles.input, styles.flexInput]} />
                <TextInput value={miniMapSortOrder} onChangeText={setMiniMapSortOrder} placeholder="Order" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.input, styles.flexInput]} />
              </View>
              <TextInput value={miniMapAreaKey} onChangeText={setMiniMapAreaKey} placeholder="Area key optional, example hearthland-woods" placeholderTextColor={colors.muted} style={styles.input} />
              <View style={styles.storyRoutePicker}>
                {miniMapTypes.map((type) => (
                  <Pressable key={type} style={[styles.routeChip, miniMapType === type && styles.routeChipActive]} onPress={() => setMiniMapType(type)}>
                    <Text style={styles.routeChipText}>{type}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={miniMapBackground} onChangeText={setMiniMapBackground} placeholder="Background image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
              <AdminImageUploadButton folder="mini-maps" onUploaded={setMiniMapBackground} onMessage={setAdminMessage} />
              <View style={styles.modeRow}>
                <TextInput value={miniMapEditorWidth} onChangeText={setMiniMapEditorWidth} placeholder="Frame width, example 900" placeholderTextColor={colors.muted} style={[styles.input, styles.flexInput]} />
                <TextInput value={miniMapEditorHeight} onChangeText={setMiniMapEditorHeight} placeholder="Frame height, example 650" placeholderTextColor={colors.muted} style={[styles.input, styles.flexInput]} />
              </View>
              <View style={styles.storyRoutePicker}>
                {[
                  { label: "Compact", width: "720", height: "520" },
                  { label: "Normal", width: "900", height: "650" },
                  { label: "Large", width: "1200", height: "860" },
                ].map((option) => (
                  <Pressable key={option.label} style={[styles.routeChip, miniMapEditorWidth === option.width && miniMapEditorHeight === option.height && styles.routeChipActive]} onPress={() => {
                    setMiniMapEditorWidth(option.width);
                    setMiniMapEditorHeight(option.height);
                  }}>
                    <Text style={styles.routeChipText}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={miniMapDescription} onChangeText={setMiniMapDescription} placeholder="Description" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
              <Pressable style={[styles.secondaryButton, miniMapActive && styles.typeSelected]} onPress={() => setMiniMapActive((value) => !value)}>
                <Text style={styles.secondaryText}>Active: {miniMapActive ? "true" : "false"}</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => void saveMiniMapForm()} disabled={!miniMapName.trim()}>
                <Text style={styles.primaryText}>Update Open Mini Map</Text>
              </Pressable>
            </View>
            <AdminCoordinatePanel clickedPercent={clickedPercent} tapLabel="Tap the mini map" onCopy={() => void copyCoordinates()} />
            <View style={styles.routeList}>
              <Text style={styles.selectedTitle}>Mini Map Markers</Text>
              {adminMiniMapMarkers.length === 0 ? <Text style={styles.copy}>No markers created in this mini map yet.</Text> : null}
              {adminMiniMapMarkers.map((marker) => (
                <View key={marker.id} style={styles.markerTableRow}>
                  <View style={styles.markerTableInfo}>
                    <Text style={styles.markerName}>{marker.title}</Text>
                    <Text style={styles.copy}>{marker.type} / X {Number(marker.x_percent).toFixed(2)}% / Y {Number(marker.y_percent).toFixed(2)}%</Text>
                    {marker.linked_route_id ? <Text style={styles.debugLine}>Linked path: {getRouteName(routes, marker.linked_route_id)} / Starts on accept: {marker.starts_route_on_accept ? "Yes" : "No"}</Text> : null}
                  </View>
                  <View style={styles.markerTableActions}>
                    <Pressable style={styles.secondaryButtonFlex} onPress={() => { setAdminSection("Mini Maps"); setEditorMode("Marker"); void selectMarker(marker); }}>
                      <Text style={styles.secondaryText}>Edit</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButtonFlex} onPress={() => void previewMarker(marker)}>
                      <Text style={styles.secondaryText}>Preview/Test</Text>
                    </Pressable>
                    <Pressable style={[styles.secondaryButtonFlex, !clickedPercent && styles.disabledAction]} onPress={() => void moveMarkerToClicked(marker)} disabled={!clickedPercent}>
                      <Text style={styles.secondaryText}>{clickedPercent ? "Move Here" : "Tap Mini Map First"}</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButtonFlex} onPress={() => void removeMarker(marker)}>
                      <Text style={styles.dangerText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
            <WalkingPathAdminPanel
              title="Mini Map Walking Paths"
              emptyText="No walking paths created in this mini map yet."
              routes={adminMiniMapRoutes}
              selectedRouteId={route.id}
              modes={editorModes}
              activeMode={editorMode}
              showList={editorMode === "Walking Path"}
              onSelectMode={setEditorMode}
              onSelectRoute={(item) => void selectRoute(item, true)}
              onEditRoute={(item) => void editWalkingPath(item)}
              onDeleteRoute={(routeId) => void removeWalkingPath(routeId)}
              pathDraft={pathDraft}
              pathSegments={pathSegmentDraft}
              onChangePathSegments={(segments) => setPathSegmentDraft(normalizePathSegments(segments, pathDraft.length))}
            />
            {editorMode === "Marker" ? renderReuseStoryMarkerPanel() : null}
            {editorMode === "Marker" ? <MiniMapMarkerAdminForm
              activeSectionMarkerTypes={miniMapMarkerTypes}
              legendItems={adminLegendItems}
              onApplyLegendStyle={applyLegendStyleToMarker}
              draftType={draftType}
              setDraftType={setDraftType}
              draftTitle={draftTitle}
              setDraftTitle={setDraftTitle}
              draftDescription={draftDescription}
              setDraftDescription={setDraftDescription}
              markerSceneBackground={markerSceneBackground}
              setMarkerSceneBackground={setMarkerSceneBackground}
              markerNpcImage={markerNpcImage}
              setMarkerNpcImage={setMarkerNpcImage}
              markerIconLabel={markerIconLabel}
              setMarkerIconLabel={setMarkerIconLabel}
              markerIconImage={markerIconImage}
              setMarkerIconImage={setMarkerIconImage}
              markerIconColor={markerIconColor}
              setMarkerIconColor={setMarkerIconColor}
              markerSize={markerSize}
              setMarkerSize={setMarkerSize}
              markerShopImage={markerShopImage}
              setMarkerShopImage={setMarkerShopImage}
              markerShopBackground={markerShopBackground}
              setMarkerShopBackground={setMarkerShopBackground}
              markerInteractionRadius={markerInteractionRadius}
              setMarkerInteractionRadius={setMarkerInteractionRadius}
              markerInteractable={markerInteractable}
              setMarkerInteractable={setMarkerInteractable}
              markerInitiallyUnlocked={markerInitiallyUnlocked}
              setMarkerInitiallyUnlocked={setMarkerInitiallyUnlocked}
              markerQuestTitle={markerQuestTitle}
              setMarkerQuestTitle={setMarkerQuestTitle}
              markerQuestDialogue={markerQuestDialogue}
              setMarkerQuestDialogue={setMarkerQuestDialogue}
              markerQuestImage={markerQuestImage}
              setMarkerQuestImage={setMarkerQuestImage}
              markerRewardXp={markerRewardXp}
              setMarkerRewardXp={setMarkerRewardXp}
              markerRewardGold={markerRewardGold}
              setMarkerRewardGold={setMarkerRewardGold}
              markerRewardItemId={markerRewardItemId}
              setMarkerRewardItemId={setMarkerRewardItemId}
              markerRewardQuantity={markerRewardQuantity}
              setMarkerRewardQuantity={setMarkerRewardQuantity}
              markerRewardFullHeal={markerRewardFullHeal}
              setMarkerRewardFullHeal={setMarkerRewardFullHeal}
              markerRewardTiming={markerRewardTiming}
              setMarkerRewardTiming={setMarkerRewardTiming}
              markerRepeatable={markerRepeatable}
              setMarkerRepeatable={setMarkerRepeatable}
              markerRewardOnce={markerRewardOnce}
              setMarkerRewardOnce={setMarkerRewardOnce}
              markerLinkedRouteId={markerLinkedRouteId}
              setMarkerLinkedRouteId={setMarkerLinkedRouteId}
              markerLinkedRouteStartDirection={markerLinkedRouteStartDirection}
              setMarkerLinkedRouteStartDirection={setMarkerLinkedRouteStartDirection}
              markerStartsRouteOnAccept={markerStartsRouteOnAccept}
              setMarkerStartsRouteOnAccept={setMarkerStartsRouteOnAccept}
              markerVisibleStoryFlagKey={markerVisibleStoryFlagKey}
              setMarkerVisibleStoryFlagKey={setMarkerVisibleStoryFlagKey}
              markerVisibleStoryFlagValue={markerVisibleStoryFlagValue}
              setMarkerVisibleStoryFlagValue={setMarkerVisibleStoryFlagValue}
              knownStoryFlagKeys={knownStoryFlagKeys}
              markerStoryOrder={markerStoryOrder}
              setMarkerStoryOrder={setMarkerStoryOrder}
              markerUnlockAfterId={markerUnlockAfterId}
              setMarkerUnlockAfterId={setMarkerUnlockAfterId}
              markerHideWhenCompleted={markerHideWhenCompleted}
              setMarkerHideWhenCompleted={setMarkerHideWhenCompleted}
              markerRequireAllLinkedRoutes={markerRequireAllLinkedRoutes}
              setMarkerRequireAllLinkedRoutes={setMarkerRequireAllLinkedRoutes}
              markerRouteCompletionCondition={markerRouteCompletionCondition}
              setMarkerRouteCompletionCondition={setMarkerRouteCompletionCondition}
              markerDialogueEventId={markerDialogueEventId}
              setMarkerDialogueEventId={setMarkerDialogueEventId}
              markerBattleEventId={markerBattleEventId}
              setMarkerBattleEventId={setMarkerBattleEventId}
              markerEnemyId={markerEnemyId}
              setMarkerEnemyId={setMarkerEnemyId}
              markerNpcId={markerNpcId}
              setMarkerNpcId={setMarkerNpcId}
              reusableMapEvents={reusableMapEvents}
              enemyDefinitions={enemyDefinitions}
              npcDefinitions={npcDefinitions}
              routes={activeRouteScopeRoutes}
              continuationRoutes={markerContinuationRoutes}
              storyRoutes={adminRoutes}
              allMarkers={markers}
              selectedMarkerRouteIds={selectedMarkerRouteIds}
              selectedMarkerRouteDirections={selectedMarkerRouteDirections}
              toggleSignPostRoute={toggleSignPostRoute}
              setSignPostRouteDirection={setSignPostRouteDirection}
              worldMarkers={adminWorldMarkers}
              storyScopeMarkers={adminStoryMarkers}
              miniMaps={adminMiniMaps}
              markerExitTargetType={markerExitTargetType}
              setMarkerExitTargetType={setMarkerExitTargetType}
              markerExitTargetMarkerId={markerExitTargetMarkerId}
              setMarkerExitTargetMarkerId={setMarkerExitTargetMarkerId}
              markerExitTargetMiniMapId={markerExitTargetMiniMapId}
              setMarkerExitTargetMiniMapId={setMarkerExitTargetMiniMapId}
              markerExitTargetSpawnMarkerId={markerExitTargetSpawnMarkerId}
              setMarkerExitTargetSpawnMarkerId={setMarkerExitTargetSpawnMarkerId}
              itemDefinitions={itemDefinitions}
              markerMarketItems={markerMarketItems}
              marketItemId={marketItemId}
              setMarketItemId={setMarketItemId}
              marketBuyPrice={marketBuyPrice}
              setMarketBuyPrice={setMarketBuyPrice}
              marketSellPrice={marketSellPrice}
              setMarketSellPrice={setMarketSellPrice}
              marketStock={marketStock}
              setMarketStock={setMarketStock}
              marketUnlimited={marketUnlimited}
              setMarketUnlimited={setMarketUnlimited}
              marketListingMode={marketListingMode}
              setMarketListingMode={setMarketListingMode}
              selectedMarker={selectedMarker}
              clickedPercent={clickedPercent}
              onAddMarker={() => void addMarker()}
              onSaveSelectedMarker={() => void saveSelectedMarkerSettings()}
              onSaveMarketItem={() => void saveMarketItem()}
              onRemoveMarketItem={(marketItemId) => void removeMarketItem(marketItemId)}
              selectedDialogueMarkerId={selectedDialogueMarkerId}
              onLoadMarkerDialogue={(marker) => void loadMarkerDialogueEditor(marker)}
              onEditBattleEvent={editMapEvent}
              battlefieldCombatants={battlefieldCombatants}
              onSaveMarkerBattlefieldCombatant={saveMarkerBattlefieldCombatant}
              onRemoveMarkerBattlefieldCombatant={removeMarkerBattlefieldCombatant}
              onMessage={setAdminMessage}
              renderMarkerDialogueEditor={(marker) => renderBranchingDialogueEditor(marker)}
            /> : (
              <View style={styles.pathEditor}>
                <Text style={styles.selectedTitle}>Create / Edit Mini Map Walking Path</Text>
                <Text style={styles.copy}>Click the mini map image above to add percentage path points. These trails can be linked to Sign Post markers in this mini map.</Text>
                <TextInput value={routeName} onChangeText={setRouteName} placeholder="Route name" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={routeOrder} onChangeText={setRouteOrder} placeholder="Route order" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={routeTerrain} onChangeText={setRouteTerrain} placeholder="Terrain" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={routeDanger} onChangeText={setRouteDanger} placeholder="Danger level" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={routeDistance} onChangeText={setRouteDistance} placeholder="Required walking distance in meters" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={routeImage} onChangeText={setRouteImage} placeholder="Route image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
                <AdminImageUploadButton folder="route-images" onUploaded={setRouteImage} onMessage={setAdminMessage} />
                <LockPicker label="Path lock" value={routeLockType} onSelect={setRouteLockType} />
                {routeLockType !== "public" ? <TextInput value={routeLockMessage} onChangeText={setRouteLockMessage} placeholder="Lock message shown on signposts" placeholderTextColor={colors.muted} style={styles.input} /> : null}
                <Info label="Path Points" value={String(pathDraft.length)} />
                <WalkingPathAdminPanel
                  title="Mini Map Trail Visibility"
                  emptyText=""
                  routes={[]}
                  selectedRouteId={route.id}
                  showList={false}
                  onSelectRoute={() => undefined}
                  onEditRoute={() => undefined}
                  onDeleteRoute={() => undefined}
                  pathDraft={pathDraft}
                  pathSegments={pathSegmentDraft}
                  onChangePathSegments={(segments) => setPathSegmentDraft(normalizePathSegments(segments, pathDraft.length))}
                />
                <View style={styles.modeRow}>
                  <Pressable style={styles.secondaryButtonFlex} onPress={loadSelectedPathIntoDraft}>
                    <Text style={styles.secondaryText}>Load Selected Path</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButtonFlex} onPress={clearPathDraft}>
                    <Text style={styles.secondaryText}>Clear Path</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButtonFlex} onPress={undoPathPoint}>
                    <Text style={styles.secondaryText}>Undo Point</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.primaryButton} onPress={() => void saveWalkingPath()}>
                  <Text style={styles.primaryText}>Save Walking Path</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => void createWalkingPath()}>
                  <Text style={styles.secondaryText}>Create as New Mini Map Walking Path</Text>
                </Pressable>
              </View>
            )}
            <View style={styles.storyEditor}>
              <Text style={styles.selectedTitle}>Mini Map Trail Events / Rewards</Text>
              <Text style={styles.copy}>Select a mini-map walking path, then add story, battle, clue, reward, or random encounter events to that trail.</Text>
              <View style={styles.storyRoutePicker}>
                {adminMiniMapRoutes.map((item) => (
                  <Pressable key={item.id} style={[styles.routeChip, route.id === item.id && styles.routeChipActive]} onPress={() => void selectRoute(item, true)}>
                    <Text style={styles.routeChipText}>{item.sort_order}. {item.name}</Text>
                  </Pressable>
                ))}
              </View>
              {adminMiniMapRoutes.length === 0 ? <Text style={styles.copy}>Create a mini-map walking path before adding trail events.</Text> : null}
              {route.mini_map_id === activeMiniMap.id ? (
                <>
                  {renderReuseEventPanel()}
                  <View style={styles.modeRow}>
                    {eventTypes.map((type) => (
                      <Pressable key={type} style={[styles.modeButton, eventType === type && styles.typeSelected]} onPress={() => setEventType(type)}>
                        <Text style={styles.typeText}>{eventTypeLabels[type]}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput value={eventTitle} onChangeText={setEventTitle} placeholder="Event title" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={eventDistance} onChangeText={setEventDistance} placeholder="Distance marker on trail, 0-100" placeholderTextColor={colors.muted} style={styles.input} />
                  <View style={styles.modeRow}>
                    {eventTriggerModes.map((mode) => (
                      <Pressable key={mode} style={[styles.secondaryButtonFlex, eventTriggerMode === mode && styles.typeSelected]} onPress={() => setEventTriggerMode(mode)}>
                        <Text style={styles.secondaryText}>{eventTriggerModeLabels[mode]}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {eventTriggerMode === "random" ? (
                    <>
                      <TextInput value={eventRandomChance} onChangeText={setEventRandomChance} placeholder="Random chance percent while moving" placeholderTextColor={colors.muted} style={styles.input} />
                      <Text style={styles.debugLine}>Random encounters can trigger after this mini-map trail reaches the distance marker.</Text>
                    </>
                  ) : null}
                  {eventType !== "battle" ? (
                    <>
                      <NpcPicker label="Reuse NPC for this dialogue/event" npcs={npcDefinitions} selectedId={eventDialogueNpcId} onSelect={selectEventDialogueNpc} />
                      <TextInput value={eventBackgroundImage} onChangeText={setEventBackgroundImage} placeholder="Background image URL" placeholderTextColor={colors.muted} style={styles.input} />
                      <AdminImageUploadButton folder="event-backgrounds" onUploaded={setEventBackgroundImage} onMessage={setAdminMessage} />
                      <TextInput value={eventNpcName} onChangeText={setEventNpcName} placeholder="NPC name optional" placeholderTextColor={colors.muted} style={styles.input} />
                      <TextInput value={eventNpcPortrait} onChangeText={setEventNpcPortrait} placeholder="NPC portrait URL optional" placeholderTextColor={colors.muted} style={styles.input} />
                      <AdminImageUploadButton folder="event-npcs" onUploaded={setEventNpcPortrait} onMessage={setAdminMessage} />
                      <TextInput value={eventDialogue} onChangeText={setEventDialogue} placeholder="Fallback dialogue text if no dialogue steps exist" placeholderTextColor={colors.muted} style={styles.input} />
                    </>
                  ) : (
                    <>
                      <Text style={styles.selectedTitle}>Enemy From Admin</Text>
                      <TextInput value={eventBackgroundImage} onChangeText={setEventBackgroundImage} placeholder="Battleground image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
                      <AdminImageUploadButton folder="battle-backgrounds" onUploaded={setEventBackgroundImage} onMessage={setAdminMessage} />
                      <EnemyPicker enemies={enemyDefinitions} selectedId={eventEnemyId} onSelect={selectEventEnemy} />
                      <NpcPicker label="Or select a battle-capable NPC" npcs={npcDefinitions} selectedId={eventNpcId} onSelect={selectEventBattleNpc} battleOnly />
                      {eventNpcId ? (
                        <View style={styles.storyCard}>
                          <Text style={styles.markerName}>{getNpcName(npcDefinitions, eventNpcId)}</Text>
                          <Text style={styles.copy}>This battle will use the selected NPC's battle stats, abilities, rewards, and drops.</Text>
                        </View>
                      ) : eventEnemyId ? (
                        <View style={styles.storyCard}>
                          <Text style={styles.markerName}>{getEnemyName(enemyDefinitions, eventEnemyId)}</Text>
                          <Text style={styles.copy}>This battle will use the selected admin enemy's stats, abilities, rewards, and drops.</Text>
                        </View>
                      ) : (
                        <View style={styles.storyCard}>
                          <Text style={styles.markerName}>Manual Enemy Fallback</Text>
                          <TextInput value={enemyName} onChangeText={setEnemyName} placeholder="Enemy name" placeholderTextColor={colors.muted} style={styles.input} />
                          <TextInput value={enemyImage} onChangeText={setEnemyImage} placeholder="Enemy image URL" placeholderTextColor={colors.muted} style={styles.input} />
                          <AdminImageUploadButton folder="battle-enemies" onUploaded={setEnemyImage} onMessage={setAdminMessage} />
                          <TextInput value={enemyHp} onChangeText={setEnemyHp} placeholder="Enemy HP" placeholderTextColor={colors.muted} style={styles.input} />
                          <TextInput value={enemyAttack} onChangeText={setEnemyAttack} placeholder="Enemy attack damage" placeholderTextColor={colors.muted} style={styles.input} />
                        </View>
                      )}
                      <TextInput value={battleIntro} onChangeText={setBattleIntro} placeholder="Battle intro text" placeholderTextColor={colors.muted} style={styles.input} />
                      <TextInput value={victoryText} onChangeText={setVictoryText} placeholder="Victory text" placeholderTextColor={colors.muted} style={styles.input} />
                      <TextInput value={defeatText} onChangeText={setDefeatText} placeholder="Defeat text" placeholderTextColor={colors.muted} style={styles.input} />
                      <BattlefieldLayoutEditor
                        eventId={editingEvent?.event_type === "battle" ? editingEvent.id : null}
                        backgroundImageUrl={eventBackgroundImage}
                        combatants={battlefieldCombatants}
                        enemies={enemyDefinitions}
                        npcs={npcDefinitions}
                        onSave={saveBattlefieldCombatant}
                        onDelete={removeBattlefieldCombatant}
                        onMessage={setAdminMessage}
                      />
                    </>
                  )}
                  <Text style={styles.selectedTitle}>Event Rewards</Text>
                  <TextInput value={rewardXp} onChangeText={setRewardXp} placeholder="Reward XP" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={rewardGold} onChangeText={setRewardGold} placeholder="Reward gold" placeholderTextColor={colors.muted} style={styles.input} />
                  <ItemPicker label="Reward item" items={itemDefinitions} selectedId={rewardItemId} onSelect={setRewardItemId} />
                  <TextInput value={rewardItemQuantity} onChangeText={setRewardItemQuantity} placeholder="Reward item quantity" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={rewardItem} onChangeText={setRewardItem} placeholder="Legacy reward item text optional" placeholderTextColor={colors.muted} style={styles.input} />
                  <Pressable style={styles.primaryButton} onPress={() => void saveMapEvent()} disabled={!eventTitle.trim()}>
                    <Text style={styles.primaryText}>{editingEvent ? "Update Trail Event" : "Create Trail Event"}</Text>
                  </Pressable>
                  {editingEvent ? (
                    <Pressable style={styles.secondaryButton} onPress={clearEventForm}>
                      <Text style={styles.secondaryText}>Cancel Event Edit</Text>
                    </Pressable>
                  ) : null}
                  {adminMapEvents.length === 0 ? <Text style={styles.copy}>No events saved for the selected mini-map path yet.</Text> : null}
                  {adminMapEvents.map((event) => (
                    <View key={event.id} style={styles.storyCard}>
                      <Text style={styles.markerName}>{event.distance_marker_percent}% - {event.title}</Text>
                      <Text style={styles.copy}>{eventTriggerModeName(event)} / {event.linked_only ? "Linked Only / " : ""}{event.event_type === "battle" && event.npc_id ? getNpcName(npcDefinitions, event.npc_id) : eventTypeName(event.event_type)}</Text>
                      <View style={styles.modeRow}>
                        <Pressable style={styles.secondaryButtonFlex} onPress={() => void previewMapEvent(event)}>
                          <Text style={styles.secondaryText}>Preview/Test</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryButtonFlex} onPress={() => editMapEvent(event)}>
                          <Text style={styles.secondaryText}>Edit</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryButtonFlex} onPress={() => void removeMapEvent(event.id)}>
                          <Text style={styles.dangerText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                  {renderBranchingDialogueEditor()}
                </>
              ) : (
                <Text style={styles.debugLine}>Select a mini-map walking path above to create or edit its events.</Text>
              )}
            </View>
          </Frame>
        ) : null}
        <GameToast toast={gameToast} onDismiss={() => setGameToast(null)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <BrandLogo size={54} />
        <View style={styles.headerText}>
          <Text style={styles.brand}>ANIMA MAGISTERIUM</Text>
          <Text style={styles.subtitle}>Map / Battles</Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <Pressable style={styles.toolButton} onPress={() => zoomBy(0.15)}><Text style={styles.toolText}>Zoom In</Text></Pressable>
        <Pressable style={styles.toolButton} onPress={() => zoomBy(-0.15)}><Text style={styles.toolText}>Zoom Out</Text></Pressable>
        <Pressable style={styles.toolButton} onPress={resetZoom}><Text style={styles.toolText}>Reset</Text></Pressable>
        <Pressable style={styles.toolButton} onPress={centerOnPlayer}><Text style={styles.toolText}>Center Player</Text></Pressable>
        <Pressable style={[styles.toolButton, followPlayer && styles.toolActive]} onPress={() => setFollowPlayer((value) => !value)}><Text style={styles.toolText}>Follow {followPlayer ? "On" : "Off"}</Text></Pressable>
      </View>

      {renderAdminViewTool()}

      {renderJourneyPanel()}

      <OverworldMapCanvas
        viewportRef={viewportRef}
        scaledMapSize={scaledMapSize}
        imageSource={overworldImageSource}
        onWheel={handleWheel}
        onPinchZoom={handlePinchZoom}
        canCapturePointer={isAdmin}
        onMapPointer={(event) => handleMapPointer(event as Parameters<typeof handleMapPointer>[0])}
        routeSegments={routeSegments}
        draftSegments={draftSegments}
        pathDraft={pathDraft}
        eventPins={adminRouteEventPins}
        showDraft={isAdmin && adminSection === "Walking Paths" && editorMode === "Walking Path"}
        clickedPercent={clickedPercent}
        showTempMarker={isAdmin && editorMode === "Marker"}
        markers={visibleMarkers}
        playerPosition={playerPosition}
        playerName={character.name}
        playerPortraitUrl={character.portrait_url}
        playerPathVisibility={!route.mini_map_id ? playerPathVisibility : "visible"}
        onSelectMarker={(marker) => void selectMarker(marker)}
      />

      <MarkerLegend items={legendItems} open={legendOpen} onToggle={() => setLegendOpen((value) => !value)} />

      {selectedMarker && !isAdmin ? (
        <MarkerInteractionPanel
          marker={selectedMarker}
          message={markerPanelMessage}
          locked={selectedMarkerLocked}
          canUse={canUseSelectedMarker}
          unavailableReason={selectedMarkerAvailability?.reason ?? null}
          distance={selectedMarkerDistance}
          radius={selectedMarkerRadius}
          isTracking={isTracking}
          routeLinks={markerRouteLinks}
          routes={routes}
          routeProgressRows={routeProgressRows}
          marketItems={markerMarketItems}
          inventoryItems={inventoryItems}
          itemDefinitions={itemDefinitions}
          onClose={() => setSelectedMarker(null)}
          onStartTracking={startGpsTracking}
          onStartPath={(nextRoute, routeLink) => void startPathFromSignPost(nextRoute, routeLink)}
          onEnterArea={() => void enterAreaMarker(selectedMarker)}
          onStartBattleEvent={() => void startSelectedMarkerBattle()}
          onBuy={(marketItem) => void buyFromMarker(marketItem)}
          onSell={(entry) => void sellToMarker(entry)}
          onClaimReward={() => void claimSelectedMarkerReward()}
        />
      ) : null}

      {isAdmin ? (
        <Frame style={styles.panel}>
          <AdminMapEditorHeader
            availableSeasons={availableSeasons}
            availableChapters={availableChapters}
            mapSeasons={mapSeasons}
            mapChapters={mapChapters}
            selectedSeason={selectedSeason}
            selectedChapter={selectedChapter}
            newSeasonName={newSeasonName}
            newSeasonDescription={newSeasonDescription}
            newChapterName={newChapterName}
            newChapterDescription={newChapterDescription}
            sections={adminSections}
            activeSection={adminSection}
            message={adminMessage}
            seasonPanelOpen={seasonPanelOpen}
            onSelectSeason={(seasonNumber) => {
              setSelectedSeason(seasonNumber);
              setSelectedChapter(1);
            }}
            onSelectChapter={setSelectedChapter}
            onChangeSeasonName={setNewSeasonName}
            onChangeSeasonDescription={setNewSeasonDescription}
            onChangeChapterName={setNewChapterName}
            onChangeChapterDescription={setNewChapterDescription}
            onCreateSeason={() => void createSeasonFromAdmin()}
            onCreateChapter={() => void createChapterFromAdmin()}
            onSelectSection={(section) => {
              setAdminSection(section);
              if (section === "Area/Town Markers") setDraftType("Area/Town Entrance");
              if (section === "World Markers") setDraftType("Story");
              if (section === "Walking Paths") setEditorMode("Walking Path");
              if (section !== "Walking Paths") setEditorMode("Marker");
            }}
            onToggleSeasonPanel={() => setSeasonPanelOpen((value) => !value)}
          />
          <AdminCollapsibleSection
            title={adminSection}
            summary={getAdminSectionSummary(adminSection)}
            warningCount={getAdminSectionWarningCount(adminSection)}
            isOpen={isAdminPanelOpen("active-section")}
            onToggle={() => toggleAdminPanel("active-section")}
          >
          {adminSection === "World Map" ? (
            <WorldMapSettingsPanel
              setting={activeWorldMapSetting}
              name={worldMapName}
              draftImageUrl={worldMapDraftImage}
              notes={worldMapNotes}
              aspectRatio={worldMapAspectRatio}
              width={worldMapWidth}
              height={worldMapHeight}
              isActive={worldMapActive}
              activeImageUrl={publishedWorldMapUri}
              onChangeName={setWorldMapName}
              onChangeDraftImageUrl={setWorldMapDraftImage}
              onChangeNotes={setWorldMapNotes}
              onChangeAspectRatio={setWorldMapAspectRatio}
              onChangeWidth={setWorldMapWidth}
              onChangeHeight={setWorldMapHeight}
              onToggleActive={() => setWorldMapActive((value) => !value)}
              onSaveDraft={() => void saveWorldMapDraftSettings()}
              onPublishDraft={() => void publishWorldMapDraft()}
              onClearDraft={() => void clearWorldMapDraft()}
              onRestoreDefault={() => void restoreDefaultWorldMap()}
              onUploadMessage={setAdminMessage}
            />
          ) : null}
          {adminSection === "Legend" ? (
            <LegendEditor
              markerTypes={legendMarkerTypes}
              items={adminLegendItems}
              editingItemId={editingLegendItemId}
              markerType={legendMarkerType}
              title={legendTitle}
              description={legendDescription}
              iconLabel={legendIconLabel}
              iconImage={legendIconImage}
              iconColor={legendIconColor}
              sortOrder={legendSortOrder}
              active={legendActive}
              onChangeMarkerType={setLegendMarkerType}
              onChangeTitle={setLegendTitle}
              onChangeDescription={setLegendDescription}
              onChangeIconLabel={setLegendIconLabel}
              onChangeIconImage={setLegendIconImage}
              onChangeIconColor={setLegendIconColor}
              onChangeSortOrder={setLegendSortOrder}
              onToggleActive={() => setLegendActive((value) => !value)}
              onSave={() => void saveLegendItemForm()}
              onCancelEdit={clearLegendForm}
              onEditItem={editLegendItem}
              onDeleteItem={(legendItemId) => void removeLegendItem(legendItemId)}
              onUploadMessage={setAdminMessage}
            />
          ) : null}
          {adminSection === "Walking Paths" ? (
            <WalkingPathAdminPanel
              title="Walking Path Order"
              emptyText="No walking paths created yet."
              routes={adminWorldRoutes}
              selectedRouteId={route.id}
              modes={editorModes}
              activeMode={editorMode}
              onSelectMode={setEditorMode}
              onSelectRoute={(item) => void selectRoute(item, true)}
              onEditRoute={(item) => void editWalkingPath(item)}
              onDeleteRoute={(routeId) => void removeWalkingPath(routeId)}
            />
          ) : null}
          {["World Markers", "Area/Town Markers"].includes(adminSection) ? (
            <MarkerAdminList
              title="Existing Markers"
              emptyText="No markers created yet."
              markers={getAdminSectionMarkers(adminSection, adminWorldMarkers, adminMiniMapMarkers)}
              onEdit={(marker) => {
                setEditorMode("Marker");
                void selectMarker(marker);
              }}
              onPreview={(marker) => void previewMarker(marker)}
              onMove={(marker) => void moveMarkerToClicked(marker)}
              canMove={Boolean(clickedPercent)}
              onDelete={(marker) => void removeMarker(marker)}
            />
          ) : null}
          {["World Markers", "Area/Town Markers", "Walking Paths"].includes(adminSection) ? (
            <AdminCoordinatePanel clickedPercent={clickedPercent} tapLabel="Tap the map" onCopy={() => void copyCoordinates()} />
          ) : null}
          {adminSection === "Mini Maps" ? (
            <MiniMapEditor
              miniMapTypes={miniMapTypes}
              miniMaps={adminMiniMaps}
              name={miniMapName}
              type={miniMapType}
              background={miniMapBackground}
              description={miniMapDescription}
              areaName={miniMapAreaName}
              areaKey={miniMapAreaKey}
              sortOrder={miniMapSortOrder}
              width={miniMapEditorWidth}
              height={miniMapEditorHeight}
              active={miniMapActive}
              selectedAreaKey={selectedMiniMapAreaKey}
              onChangeName={setMiniMapName}
              onChangeType={setMiniMapType}
              onChangeBackground={setMiniMapBackground}
              onChangeDescription={setMiniMapDescription}
              onChangeAreaName={setMiniMapAreaName}
              onChangeAreaKey={setMiniMapAreaKey}
              onChangeSortOrder={setMiniMapSortOrder}
              onChangeWidth={setMiniMapEditorWidth}
              onChangeHeight={setMiniMapEditorHeight}
              onSelectAreaKey={setSelectedMiniMapAreaKey}
              onToggleActive={() => setMiniMapActive((value) => !value)}
              onSave={() => void saveMiniMapForm()}
              onEdit={editMiniMap}
              onCancelEdit={clearMiniMapEditForm}
              onOpen={(miniMap) => {
                setSelectedMiniMapId(miniMap.id);
                openMiniMap(miniMap);
              }}
              onDelete={(miniMapId) => void removeMiniMap(miniMapId)}
              onUploadMessage={setAdminMessage}
              editingMiniMapId={editingMiniMapId}
            />
          ) : null}
          {editorMode === "Marker" && ["World Markers", "Area/Town Markers"].includes(adminSection) ? (
            <>
              <MarkerTypeSelector types={activeSectionMarkerTypes} selectedType={draftType} onSelectType={setDraftType} />
              <LegendStylePicker items={adminLegendItems} onApply={applyLegendStyleToMarker} />
              <TextInput value={draftTitle} onChangeText={setDraftTitle} placeholder="Marker title" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={draftDescription} onChangeText={setDraftDescription} placeholder="Marker description" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={markerSceneBackground} onChangeText={setMarkerSceneBackground} placeholder="Marker scene background image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
              <AdminImageUploadButton folder="marker-backgrounds" onUploaded={setMarkerSceneBackground} onMessage={setAdminMessage} />
              <TextInput value={markerNpcImage} onChangeText={setMarkerNpcImage} placeholder="NPC / character image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
              <AdminImageUploadButton folder="marker-npcs" onUploaded={setMarkerNpcImage} onMessage={setAdminMessage} />
              <MarkerStyleEditor
                iconLabel={markerIconLabel}
                iconImage={markerIconImage}
                iconColor={markerIconColor}
                markerSize={markerSize}
                uploadFolder="marker-icons"
                onChangeIconLabel={setMarkerIconLabel}
                onChangeIconImage={setMarkerIconImage}
                onChangeIconColor={setMarkerIconColor}
                onChangeMarkerSize={setMarkerSize}
                onUploadMessage={setAdminMessage}
              />
              <TextInput value={markerInteractionRadius} onChangeText={setMarkerInteractionRadius} placeholder="Interaction radius percent, example 4" placeholderTextColor={colors.muted} style={styles.input} />
              <LockPicker label="Marker lock" value={markerLockType} onSelect={setMarkerLockType} />
              {markerLockType !== "public" ? <TextInput value={markerLockMessage} onChangeText={setMarkerLockMessage} placeholder="Lock message shown to players" placeholderTextColor={colors.muted} style={styles.input} /> : null}
              <MarkerStoryFlagVisibilityEditor
                storyFlagKeys={knownStoryFlagKeys}
                visibleStoryFlagKey={markerVisibleStoryFlagKey}
                visibleStoryFlagValue={markerVisibleStoryFlagValue}
                onChangeVisibleStoryFlagKey={setMarkerVisibleStoryFlagKey}
                onToggleVisibleStoryFlagValue={() => setMarkerVisibleStoryFlagValue((value) => !value)}
                onClear={() => {
                  setMarkerVisibleStoryFlagKey("");
                  setMarkerVisibleStoryFlagValue(true);
                }}
              />
              <LinkedMarkerPathNotice
                markerType={draftType}
                selectedRouteIds={selectedMarkerRouteIds}
                routes={activeRouteScopeRoutes}
                startsRouteOnAccept={markerStartsRouteOnAccept}
                requireAllLinkedRoutes={markerRequireAllLinkedRoutes}
              />
              {draftType === "Area/Town Entrance" ? (
                <View style={styles.storyEditor}>
                  <MiniMapPicker
                    miniMaps={adminMiniMaps}
                    selectedId={selectedMiniMapId}
                    onSelect={(miniMapId) => {
                      setSelectedMiniMapId(miniMapId);
                      setMarkerExitTargetSpawnMarkerId(null);
                    }}
                  />
                  {selectedMiniMapId ? (
                    <MarkerPicker
                      label="Target spawn in mini map"
                      markers={markers.filter((marker) => marker.mini_map_id === selectedMiniMapId && marker.type === "Player Spawn")}
                      selectedId={markerExitTargetSpawnMarkerId}
                      onSelect={setMarkerExitTargetSpawnMarkerId}
                    />
                  ) : null}
                  {selectedMiniMapId && !markers.some((marker) => marker.mini_map_id === selectedMiniMapId && marker.type === "Player Spawn") ? (
                    <Text style={styles.debugLine}>No Player Spawn marker exists in this mini map yet. The entrance will fall back to the center of the mini map.</Text>
                  ) : null}
                </View>
              ) : null}
              {isExitMarkerType(draftType) ? (
                <ExitTargetEditor
                  targetType={markerExitTargetType}
                  setTargetType={setMarkerExitTargetType}
                  targetMarkerId={markerExitTargetMarkerId}
                  setTargetMarkerId={setMarkerExitTargetMarkerId}
                  targetMiniMapId={markerExitTargetMiniMapId}
                  setTargetMiniMapId={setMarkerExitTargetMiniMapId}
                  targetSpawnMarkerId={markerExitTargetSpawnMarkerId}
                  setTargetSpawnMarkerId={setMarkerExitTargetSpawnMarkerId}
                  worldMarkers={adminWorldMarkers}
                  miniMaps={adminMiniMaps}
                  spawnMarkers={markers}
                />
              ) : null}
              {(draftType === "Area/Town Entrance" || isExitMarkerType(draftType)) ? (
                <MarkerContinuationRouteEditor
                  markerType={draftType}
                  routes={markerContinuationRoutes}
                  selectedRouteId={markerLinkedRouteId}
                  startDirection={markerLinkedRouteStartDirection}
                  startsRouteOnAccept={markerStartsRouteOnAccept}
                  onSelectRoute={setMarkerLinkedRouteId}
                  onSelectStartDirection={setMarkerLinkedRouteStartDirection}
                  onToggleStartsRoute={() => setMarkerStartsRouteOnAccept((value) => !value)}
                />
              ) : null}
              {draftType === "Sign Post" ? (
                <View style={styles.storyEditor}>
                  <Text style={styles.selectedTitle}>Linked Walking Paths</Text>
                  <Text style={styles.copy}>Players choose from these paths when they interact with this Sign Post.</Text>
                  <View style={styles.storyRoutePicker}>
                    {adminWorldRoutes.map((item) => (
                      <Pressable key={item.id} style={[styles.routeChip, selectedMarkerRouteIds.includes(item.id) && styles.routeChipActive]} onPress={() => toggleSignPostRoute(item.id)}>
                        <Text style={styles.routeChipText}>{item.sort_order}. {item.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <SignPostRouteDirectionEditor
                    routes={adminWorldRoutes}
                    selectedRouteIds={selectedMarkerRouteIds}
                    routeDirections={selectedMarkerRouteDirections}
                    onSelectDirection={setSignPostRouteDirection}
                  />
                  {selectedMarker ? (
                    <Text style={styles.debugLine}>Save Selected Marker Settings after changing linked paths.</Text>
                  ) : (
                    <Text style={styles.debugLine}>Selected paths will be linked when the Sign Post marker is created.</Text>
                  )}
                </View>
              ) : null}
              {draftType === "NPC" ? (
                <View style={styles.storyEditor}>
                  <Text style={styles.selectedTitle}>NPC Character</Text>
                  <Text style={styles.copy}>Choose a reusable NPC. Its image can be used for the map marker, dialogue, and optional battle.</Text>
                  <NpcPicker
                    label="Linked NPC"
                    npcs={npcDefinitions}
                    selectedId={markerNpcId}
                    onSelect={(id) => {
                      setMarkerNpcId(id);
                      const npc = npcDefinitions.find((item) => item.id === id);
                      if (npc) {
                        setDraftTitle((current) => current || npc.name);
                        setMarkerQuestTitle((current) => current || npc.name);
                        setMarkerNpcImage((current) => current || npc.image_url || "");
                        setMarkerIconImage((current) => current || npc.image_url || "");
                      }
                    }}
                  />
                  <Text style={styles.copy}>Use the Marker Dialogue Tree below for conversation choices. If the NPC is battle-capable, the battle setup can also use this same NPC.</Text>
                </View>
              ) : null}
              {draftType !== "Sign Post" && !isBattleMarkerType(draftType) ? (
                isStoryQuestMarker({ type: draftType }) ? (
                  <View style={styles.storyEditor}>
                    <Text style={styles.selectedTitle}>Story Path Sequence</Text>
                    <Text style={styles.copy}>These paths belong to this story marker and can run in order.</Text>
                    <View style={styles.storyRoutePicker}>
                      {activeRouteScopeRoutes.map((item) => (
                        <Pressable key={item.id} style={[styles.routeChip, selectedMarkerRouteIds.includes(item.id) && styles.routeChipActive]} onPress={() => toggleSignPostRoute(item.id)}>
                          <Text style={styles.routeChipText}>{item.sort_order}. {item.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {activeRouteScopeRoutes.length === 0 ? <Text style={styles.debugLine}>Create a walking path in this map area before linking story paths.</Text> : null}
                  </View>
                ) : (
                  <MarkerPathRequirementEditor
                    title="Required Completed Paths"
                    description={draftType === "Area/Town Entrance"
                      ? "Players can enter after completing any one linked path that leads to this entrance. Use the unlock point below to choose whether the entrance opens at the path end, path start after reverse travel, or either side."
                      : "Players must complete linked paths before this marker becomes interactable. Use the unlock point below for endpoint-style exits, gates, clues, and area transitions."}
                    routes={activeRouteScopeRoutes}
                    selectedRouteIds={selectedMarkerRouteIds}
                    completionCondition={markerRouteCompletionCondition}
                    onToggleRoute={toggleSignPostRoute}
                    onSelectCompletionCondition={setMarkerRouteCompletionCondition}
                    emptyText="Create a walking path in this map area before linking requirements."
                  />
                )
              ) : null}
              <Pressable style={[styles.secondaryButton, markerInteractable && styles.typeSelected]} onPress={() => setMarkerInteractable((value) => !value)}>
                <Text style={styles.secondaryText}>Interactable: {markerInteractable ? "true" : "false"}</Text>
              </Pressable>
              <Pressable style={[styles.secondaryButton, markerInitiallyUnlocked && styles.typeSelected]} onPress={() => setMarkerInitiallyUnlocked((value) => !value)}>
                <Text style={styles.secondaryText}>Initially Unlocked: {markerInitiallyUnlocked ? "true" : "false"}</Text>
              </Pressable>
              {supportsMarkerDialogue(draftType) ? (
                <View style={styles.storyEditor}>
                  <Text style={styles.selectedTitle}>Marker Dialogue Tree</Text>
                  <Text style={styles.copy}>Story, Quest, Side Quest, Point of Interest, and NPC markers use their own dialogue tree. Use dialogue choices to start quests, give rewards, branch the story, or start a battle.</Text>
                  {selectedMarker ? (
                    <>
                      <Pressable style={styles.secondaryButton} onPress={() => void loadMarkerDialogueEditor(selectedMarker)}>
                        <Text style={styles.secondaryText}>{selectedDialogueMarkerId === selectedMarker.id ? "Reload Marker Dialogue Tree" : "Build / Edit Marker Dialogue Tree"}</Text>
                      </Pressable>
                      {selectedDialogueMarkerId === selectedMarker.id ? renderBranchingDialogueEditor(selectedMarker) : null}
                    </>
                  ) : (
                    <Text style={styles.debugLine}>Create or select this marker before building its dialogue tree.</Text>
                  )}
                </View>
              ) : null}
              {isBattleMarkerType(draftType) ? (
                <View style={styles.storyEditor}>
                  <Text style={styles.selectedTitle}>Battle Setup</Text>
                  <Text style={styles.copy}>Link a saved Battle Event to use its battleground image, battlefield layout, rewards, and combatants. Or pick a direct Enemy/NPC for a simple standalone battle.</Text>
                  <EventPicker
                    label="Linked Battle Event"
                    events={reusableMapEvents.filter((event) => event.event_type === "battle")}
                    selectedId={markerBattleEventId}
                    onSelect={setMarkerBattleEventId}
                  />
                  {markerBattleEventId ? (
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => {
                        const linkedEvent = reusableMapEvents.find((event) => event.id === markerBattleEventId);
                        if (linkedEvent) {
                          editMapEvent(linkedEvent);
                        } else {
                          setAdminMessage("The linked Battle Event could not be found in this season/chapter.");
                        }
                      }}
                    >
                      <Text style={styles.secondaryText}>Edit Linked Battle Event Board</Text>
                    </Pressable>
                  ) : null}
                  <EnemyPicker
                    enemies={enemyDefinitions}
                    selectedId={markerEnemyId}
                    onSelect={(id) => {
                      setMarkerEnemyId(id);
                      if (id) setMarkerNpcId(null);
                    }}
                  />
                  <NpcPicker
                    label="Battle NPC"
                    npcs={npcDefinitions}
                    selectedId={markerNpcId}
                    onSelect={(id) => {
                      setMarkerNpcId(id);
                      if (id) setMarkerEnemyId(null);
                    }}
                    battleOnly
                  />
                  <BattlefieldLayoutEditor
                    title="Marker Battle Board"
                    emptyText="Select or create this Battle marker first, then place enemies directly on its battleground."
                    eventId={selectedMarker?.id ?? null}
                    backgroundImageUrl={markerSceneBackground || markerQuestImage}
                    combatants={battlefieldCombatants}
                    enemies={enemyDefinitions}
                    npcs={npcDefinitions}
                    onSave={saveMarkerBattlefieldCombatant}
                    onDelete={removeMarkerBattlefieldCombatant}
                    onMessage={setAdminMessage}
                  />
                </View>
              ) : null}
              {(draftType === "Side Quest" || draftType === "Story" || draftType === "Point of Interest" || draftType === "NPC") ? (
                <View style={styles.storyEditor}>
                  <Text style={styles.selectedTitle}>Marker Rewards / Quest Settings</Text>
                  <TextInput value={markerQuestTitle} onChangeText={setMarkerQuestTitle} placeholder="Quest title optional" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={markerQuestDialogue} onChangeText={setMarkerQuestDialogue} placeholder="Quest dialogue" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
                  <TextInput value={markerQuestImage} onChangeText={setMarkerQuestImage} placeholder="Quest image URL" placeholderTextColor={colors.muted} style={styles.input} />
                  <AdminImageUploadButton folder="quest-images" onUploaded={setMarkerQuestImage} onMessage={setAdminMessage} />
                  {draftType === "Story" ? (
                    <>
                      <TextInput value={markerStoryOrder} onChangeText={setMarkerStoryOrder} placeholder="Story order, example 1" placeholderTextColor={colors.muted} style={styles.input} />
                      <Text style={styles.selectedTitle}>Unlock After Story Marker</Text>
                      <View style={styles.storyRoutePicker}>
                        <Pressable style={[styles.routeChip, !markerUnlockAfterId && styles.routeChipActive]} onPress={() => setMarkerUnlockAfterId(null)}>
                          <Text style={styles.routeChipText}>Use story order</Text>
                        </Pressable>
                        {adminStoryMarkers.filter((marker) => marker.id !== selectedMarker?.id).map((marker) => (
                          <Pressable key={marker.id} style={[styles.routeChip, markerUnlockAfterId === marker.id && styles.routeChipActive]} onPress={() => setMarkerUnlockAfterId(marker.id)}>
                            <Text style={styles.routeChipText}>{marker.story_order || 0}. {marker.title}{marker.mini_map_id ? " (Mini)" : " (World)"}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable style={[styles.secondaryButton, markerHideWhenCompleted && styles.typeSelected]} onPress={() => setMarkerHideWhenCompleted((value) => !value)}>
                        <Text style={styles.secondaryText}>Hide After Completion: {markerHideWhenCompleted ? "Yes" : "No"}</Text>
                      </Pressable>
                      <Pressable style={[styles.secondaryButton, markerRequireAllLinkedRoutes && styles.typeSelected]} onPress={() => setMarkerRequireAllLinkedRoutes((value) => !value)}>
                        <Text style={styles.secondaryText}>Require All Linked Paths: {markerRequireAllLinkedRoutes ? "Yes" : "No"}</Text>
                      </Pressable>
                    </>
                  ) : null}
                  <Text style={styles.selectedTitle}>Linked Walking Paths</Text>
                  <Text style={styles.copy}>Select one or more paths. They run in the order shown by route sort/order.</Text>
                  <View style={styles.storyRoutePicker}>
                    {adminRoutes.map((item) => (
                      <Pressable key={item.id} style={[styles.routeChip, selectedMarkerRouteIds.includes(item.id) && styles.routeChipActive]} onPress={() => toggleSignPostRoute(item.id)}>
                        <Text style={styles.routeChipText}>{item.sort_order}. {item.name}{item.mini_map_id ? " (Mini)" : " (World)"}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <RoutePicker routes={adminRoutes} selectedId={markerLinkedRouteId} onSelect={setMarkerLinkedRouteId} />
                  <Pressable style={[styles.secondaryButton, markerStartsRouteOnAccept && styles.typeSelected]} onPress={() => setMarkerStartsRouteOnAccept((value) => !value)}>
                    <Text style={styles.secondaryText}>Start Path On Accept: {markerStartsRouteOnAccept ? "Yes" : "No"}</Text>
                  </Pressable>
                  <TextInput value={markerRewardXp} onChangeText={setMarkerRewardXp} placeholder="XP reward" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={markerRewardGold} onChangeText={setMarkerRewardGold} placeholder="Gold reward" placeholderTextColor={colors.muted} style={styles.input} />
                  <ItemPicker label="Item reward" items={itemDefinitions} selectedId={markerRewardItemId} onSelect={setMarkerRewardItemId} />
                  <TextInput value={markerRewardQuantity} onChangeText={setMarkerRewardQuantity} placeholder="Reward item quantity" placeholderTextColor={colors.muted} style={styles.input} />
                  <Pressable style={[styles.secondaryButton, markerRewardFullHeal && styles.typeSelected]} onPress={() => setMarkerRewardFullHeal((value) => !value)}>
                    <Text style={styles.secondaryText}>Full Heal Reward: {markerRewardFullHeal ? "Yes" : "No"}</Text>
                  </Pressable>
                  <RewardTimingPicker value={markerRewardTiming} onSelect={setMarkerRewardTiming} />
                  <View style={styles.modeRow}>
                    <Pressable style={[styles.secondaryButtonFlex, markerRepeatable && styles.typeSelected]} onPress={() => setMarkerRepeatable((value) => !value)}>
                      <Text style={styles.secondaryText}>Repeatable: {markerRepeatable ? "Yes" : "No"}</Text>
                    </Pressable>
                    <Pressable style={[styles.secondaryButtonFlex, markerRewardOnce && styles.typeSelected]} onPress={() => setMarkerRewardOnce((value) => !value)}>
                      <Text style={styles.secondaryText}>Reward Once: {markerRewardOnce ? "Yes" : "No"}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {draftType === "Market" ? (
                <View style={styles.storyEditor}>
                  <Text style={styles.selectedTitle}>Market / Shop Settings</Text>
                  <Text style={styles.copy}>{selectedMarker ? "Choose items from the admin item database for this market." : "Create or select a Market marker before adding shop stock."}</Text>
                  <TextInput value={markerQuestTitle} onChangeText={setMarkerQuestTitle} placeholder="Shop display name optional" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={markerQuestDialogue} onChangeText={setMarkerQuestDialogue} placeholder="Shop welcome text" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
                  <TextInput value={markerShopImage} onChangeText={setMarkerShopImage} placeholder="Shop image URL" placeholderTextColor={colors.muted} style={styles.input} />
                  <AdminImageUploadButton folder="shop-images" onUploaded={setMarkerShopImage} onMessage={setAdminMessage} />
                  <TextInput value={markerShopBackground} onChangeText={setMarkerShopBackground} placeholder="Shop background image URL" placeholderTextColor={colors.muted} style={styles.input} />
                  <AdminImageUploadButton folder="shop-backgrounds" onUploaded={setMarkerShopBackground} onMessage={setAdminMessage} />
                  <TextInput value={markerInteractionRadius} onChangeText={setMarkerInteractionRadius} placeholder="Interaction radius percent, example 4" placeholderTextColor={colors.muted} style={styles.input} />
                  <ItemPicker label="Market item" items={itemDefinitions} selectedId={marketItemId} onSelect={setMarketItemId} />
                  <MarketListingModePicker value={marketListingMode} onSelect={setMarketListingMode} />
                  <TextInput value={marketBuyPrice} onChangeText={setMarketBuyPrice} placeholder="Buy price" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={marketSellPrice} onChangeText={setMarketSellPrice} placeholder="Sell price" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={marketStock} onChangeText={setMarketStock} placeholder="Stock quantity" placeholderTextColor={colors.muted} style={styles.input} />
                  <Pressable style={[styles.secondaryButton, marketUnlimited && styles.typeSelected]} onPress={() => setMarketUnlimited((value) => !value)}>
                    <Text style={styles.secondaryText}>Unlimited Stock: {marketUnlimited ? "Yes" : "No"}</Text>
                  </Pressable>
                  <Pressable style={styles.primaryButton} onPress={() => void saveMarketItem()} disabled={!selectedMarker || !marketItemId}>
                    <Text style={styles.primaryText}>Save Market Item</Text>
                  </Pressable>
                  {markerMarketItems.map((marketItem) => (
                    <View key={marketItem.id} style={styles.storyCard}>
                      <Text style={styles.markerName}>{getItemName(itemDefinitions, marketItem.item_id)}</Text>
                      <Text style={styles.copy}>{formatMarketListingMode(marketItem.listing_mode)} / Buy {marketItem.buy_price} / Sell {marketItem.sell_price} / {marketItem.unlimited_stock ? "Unlimited" : `Stock ${marketItem.stock_quantity ?? 0}`}</Text>
                      <Pressable style={styles.secondaryButton} onPress={() => void removeMarketItem(marketItem.id)}>
                        <Text style={styles.dangerText}>Remove Item</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              {!clickedPercent ? <Text style={styles.lockText}>Tap the map image first to choose this marker's position.</Text> : null}
              {!draftTitle.trim() ? <Text style={styles.lockText}>Add a marker title before creating it.</Text> : null}
              <Pressable style={[styles.primaryButton, (!clickedPercent || !draftTitle.trim()) && styles.disabledAction]} onPress={() => void addMarker()}>
                <Text style={styles.primaryText}>Create Marker</Text>
              </Pressable>
              {selectedMarker ? (
                <Pressable style={styles.secondaryButton} onPress={() => void saveSelectedMarkerSettings()}>
                  <Text style={styles.secondaryText}>Save Selected Marker Settings</Text>
                </Pressable>
              ) : null}
            </>
          ) : adminSection === "Walking Paths" ? (
            <View style={styles.pathEditor}>
              <TextInput value={routeName} onChangeText={setRouteName} placeholder="Route name" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={routeOrder} onChangeText={setRouteOrder} placeholder="Route order" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={routeTerrain} onChangeText={setRouteTerrain} placeholder="Terrain" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={routeDanger} onChangeText={setRouteDanger} placeholder="Danger level" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={routeDistance} onChangeText={setRouteDistance} placeholder="Required walking distance in meters" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={routeImage} onChangeText={setRouteImage} placeholder="Route image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
              <AdminImageUploadButton folder="route-images" onUploaded={setRouteImage} onMessage={setAdminMessage} />
              <LockPicker label="Path lock" value={routeLockType} onSelect={setRouteLockType} />
              {routeLockType !== "public" ? <TextInput value={routeLockMessage} onChangeText={setRouteLockMessage} placeholder="Lock message shown on signposts" placeholderTextColor={colors.muted} style={styles.input} /> : null}
              <Info label="Path Points" value={String(pathDraft.length)} />
              <WalkingPathAdminPanel
                title="Overworld Trail Visibility"
                emptyText=""
                routes={[]}
                selectedRouteId={route.id}
                showList={false}
                onSelectRoute={() => undefined}
                onEditRoute={() => undefined}
                onDeleteRoute={() => undefined}
                pathDraft={pathDraft}
                pathSegments={pathSegmentDraft}
                onChangePathSegments={(segments) => setPathSegmentDraft(normalizePathSegments(segments, pathDraft.length))}
              />
              <View style={styles.modeRow}>
                <Pressable style={styles.secondaryButtonFlex} onPress={loadSelectedPathIntoDraft}>
                  <Text style={styles.secondaryText}>Load Selected Path</Text>
                </Pressable>
                <Pressable style={styles.secondaryButtonFlex} onPress={clearPathDraft}>
                  <Text style={styles.secondaryText}>Clear Path</Text>
                </Pressable>
                <Pressable style={styles.secondaryButtonFlex} onPress={undoPathPoint}>
                  <Text style={styles.secondaryText}>Undo Point</Text>
                </Pressable>
              </View>
              <Pressable style={styles.primaryButton} onPress={() => void saveWalkingPath()}>
                <Text style={styles.primaryText}>Save Walking Path</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => void createWalkingPath()}>
                <Text style={styles.secondaryText}>Create as New Walking Path</Text>
              </Pressable>
            </View>
          ) : null}
          {adminSection === "Tutorials" ? (
            <View style={styles.storyEditor}>
              <Text style={styles.selectedTitle}>Tutorial Steps</Text>
              <TextInput value={tutorialTitle} onChangeText={setTutorialTitle} placeholder="Tutorial title" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={tutorialDescription} onChangeText={setTutorialDescription} placeholder="Description / dialogue" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
              <TextInput value={tutorialImage} onChangeText={setTutorialImage} placeholder="Image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
              <AdminImageUploadButton folder="tutorials" onUploaded={setTutorialImage} onMessage={setAdminMessage} />
              <MarkerPicker label="Linked marker optional" markers={adminWorldMarkers} selectedId={tutorialMarkerId} onSelect={setTutorialMarkerId} />
              <MiniMapPicker miniMaps={adminMiniMaps} selectedId={tutorialMiniMapId} onSelect={setTutorialMiniMapId} />
              <RoutePicker routes={adminWorldRoutes} selectedId={tutorialRouteId} onSelect={setTutorialRouteId} />
              <TextInput value={tutorialRewardXp} onChangeText={setTutorialRewardXp} placeholder="Reward XP" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={tutorialRewardGold} onChangeText={setTutorialRewardGold} placeholder="Reward gold" placeholderTextColor={colors.muted} style={styles.input} />
              <ItemPicker label="Reward item" items={itemDefinitions} selectedId={tutorialRewardItemId} onSelect={setTutorialRewardItemId} />
              <TextInput value={tutorialRewardQuantity} onChangeText={setTutorialRewardQuantity} placeholder="Reward item quantity" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={tutorialSortOrder} onChangeText={setTutorialSortOrder} placeholder="Sort order" placeholderTextColor={colors.muted} style={styles.input} />
              <Pressable style={[styles.secondaryButton, tutorialActive && styles.typeSelected]} onPress={() => setTutorialActive((value) => !value)}>
                <Text style={styles.secondaryText}>Active: {tutorialActive ? "true" : "false"}</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => void saveTutorialForm()} disabled={!tutorialTitle.trim()}>
                <Text style={styles.primaryText}>{editingTutorialId ? "Update Tutorial Step" : "Create Tutorial Step"}</Text>
              </Pressable>
              {editingTutorialId ? <Pressable style={styles.secondaryButton} onPress={clearTutorialForm}><Text style={styles.secondaryText}>Cancel Tutorial Edit</Text></Pressable> : null}
              {adminTutorialSteps.map((step) => (
                <View key={step.id} style={styles.storyCard}>
                  <Text style={styles.markerName}>{step.sort_order}. {step.title}</Text>
                  <Text style={styles.copy}>{step.description || "No description."}</Text>
                  <View style={styles.modeRow}>
                    <Pressable style={styles.secondaryButtonFlex} onPress={() => editTutorial(step)}><Text style={styles.secondaryText}>Edit</Text></Pressable>
                    <Pressable style={styles.secondaryButtonFlex} onPress={() => void removeTutorial(step.id)}><Text style={styles.dangerText}>Delete</Text></Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {adminSection === "Rewards/Interactions" ? <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>Dialogue / Event Builder on {route.name}</Text>
            <Text style={styles.copy}>Create dialogue, investigation, reward, or battle events for the selected trail. The distance marker is the route progress percent where the event opens for players.</Text>
            <View style={styles.storyRoutePicker}>
              {adminWorldRoutes.map((item) => (
                <Pressable key={item.id} style={[styles.routeChip, route.id === item.id && styles.routeChipActive]} onPress={() => void selectRoute(item, true)}>
                  <Text style={styles.routeChipText}>{item.sort_order}. {item.name}</Text>
                </Pressable>
              ))}
            </View>
            {renderReuseEventPanel()}
            <View style={styles.modeRow}>
              {eventTypes.map((type) => (
                <Pressable key={type} style={[styles.modeButton, eventType === type && styles.typeSelected]} onPress={() => setEventType(type)}>
                  <Text style={styles.typeText}>{eventTypeLabels[type]}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={eventTitle} onChangeText={setEventTitle} placeholder="Event title" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput value={eventDistance} onChangeText={setEventDistance} placeholder="Distance marker on trail, 0-100" placeholderTextColor={colors.muted} style={styles.input} />
            <View style={styles.modeRow}>
              {eventTriggerModes.map((mode) => (
                <Pressable key={mode} style={[styles.secondaryButtonFlex, eventTriggerMode === mode && styles.typeSelected]} onPress={() => setEventTriggerMode(mode)}>
                  <Text style={styles.secondaryText}>{eventTriggerModeLabels[mode]}</Text>
                </Pressable>
              ))}
            </View>
            {eventTriggerMode === "random" ? (
              <>
                <TextInput value={eventRandomChance} onChangeText={setEventRandomChance} placeholder="Random chance percent while moving" placeholderTextColor={colors.muted} style={styles.input} />
                <Text style={styles.debugLine}>Random encounters can trigger after the route reaches the distance marker above.</Text>
              </>
            ) : null}
            {eventType !== "battle" ? (
              <>
                <NpcPicker label="Reuse NPC for this dialogue/event" npcs={npcDefinitions} selectedId={eventDialogueNpcId} onSelect={selectEventDialogueNpc} />
                <TextInput value={eventBackgroundImage} onChangeText={setEventBackgroundImage} placeholder="Background image URL" placeholderTextColor={colors.muted} style={styles.input} />
                <AdminImageUploadButton folder="event-backgrounds" onUploaded={setEventBackgroundImage} onMessage={setAdminMessage} />
                <TextInput value={eventNpcName} onChangeText={setEventNpcName} placeholder="NPC name optional" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={eventNpcPortrait} onChangeText={setEventNpcPortrait} placeholder="NPC portrait URL optional" placeholderTextColor={colors.muted} style={styles.input} />
                <AdminImageUploadButton folder="event-npcs" onUploaded={setEventNpcPortrait} onMessage={setAdminMessage} />
                <TextInput value={eventDialogue} onChangeText={setEventDialogue} placeholder="Fallback dialogue text if no dialogue steps exist" placeholderTextColor={colors.muted} style={styles.input} />
              </>
            ) : (
              <>
                <Text style={styles.selectedTitle}>Enemy From Admin</Text>
                <TextInput value={eventBackgroundImage} onChangeText={setEventBackgroundImage} placeholder="Battleground image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
                <AdminImageUploadButton folder="battle-backgrounds" onUploaded={setEventBackgroundImage} onMessage={setAdminMessage} />
                <EnemyPicker enemies={enemyDefinitions} selectedId={eventEnemyId} onSelect={selectEventEnemy} />
                <NpcPicker label="Or select a battle-capable NPC" npcs={npcDefinitions} selectedId={eventNpcId} onSelect={selectEventBattleNpc} battleOnly />
                {eventNpcId ? (
                  <View style={styles.storyCard}>
                    <Text style={styles.markerName}>{getNpcName(npcDefinitions, eventNpcId)}</Text>
                    <Text style={styles.copy}>This battle will use the selected NPC's battle stats, abilities, rewards, and drops.</Text>
                  </View>
                ) : eventEnemyId ? (
                  <View style={styles.storyCard}>
                    <Text style={styles.markerName}>{getEnemyName(enemyDefinitions, eventEnemyId)}</Text>
                    <Text style={styles.copy}>This battle will use the selected admin enemy's stats, resources, abilities, rewards, and drops.</Text>
                  </View>
                ) : (
                  <View style={styles.storyCard}>
                    <Text style={styles.markerName}>Manual Enemy Fallback</Text>
                    <Text style={styles.copy}>Use these fields only when you have not created an enemy in Enemy Admin yet.</Text>
                    <TextInput value={enemyName} onChangeText={setEnemyName} placeholder="Enemy name" placeholderTextColor={colors.muted} style={styles.input} />
                    <TextInput value={enemyImage} onChangeText={setEnemyImage} placeholder="Enemy image URL" placeholderTextColor={colors.muted} style={styles.input} />
                    <AdminImageUploadButton folder="battle-enemies" onUploaded={setEnemyImage} onMessage={setAdminMessage} />
                    <TextInput value={enemyHp} onChangeText={setEnemyHp} placeholder="Enemy HP" placeholderTextColor={colors.muted} style={styles.input} />
                    <TextInput value={enemyAttack} onChangeText={setEnemyAttack} placeholder="Enemy attack damage" placeholderTextColor={colors.muted} style={styles.input} />
                  </View>
                )}
                <TextInput value={battleIntro} onChangeText={setBattleIntro} placeholder="Battle intro text" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={victoryText} onChangeText={setVictoryText} placeholder="Victory text" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={defeatText} onChangeText={setDefeatText} placeholder="Defeat text" placeholderTextColor={colors.muted} style={styles.input} />
                <BattlefieldLayoutEditor
                  eventId={editingEvent?.event_type === "battle" ? editingEvent.id : null}
                  backgroundImageUrl={eventBackgroundImage}
                  combatants={battlefieldCombatants}
                  enemies={enemyDefinitions}
                  npcs={npcDefinitions}
                  onSave={saveBattlefieldCombatant}
                  onDelete={removeBattlefieldCombatant}
                  onMessage={setAdminMessage}
                />
              </>
            )}
            <View style={styles.storyEditor}>
              <Text style={styles.selectedTitle}>Event Rewards</Text>
              <TextInput value={rewardXp} onChangeText={setRewardXp} placeholder="Reward XP" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={rewardGold} onChangeText={setRewardGold} placeholder="Reward gold" placeholderTextColor={colors.muted} style={styles.input} />
              <ItemPicker label="Reward item" items={itemDefinitions} selectedId={rewardItemId} onSelect={setRewardItemId} />
              <TextInput value={rewardItemQuantity} onChangeText={setRewardItemQuantity} placeholder="Reward item quantity" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={rewardItem} onChangeText={setRewardItem} placeholder="Legacy reward item text optional" placeholderTextColor={colors.muted} style={styles.input} />
            </View>
            <Pressable style={styles.primaryButton} onPress={() => void saveMapEvent()} disabled={!eventTitle.trim()}>
              <Text style={styles.primaryText}>{editingEvent ? "Update Dialogue / Event" : "Create Dialogue / Event"}</Text>
            </Pressable>
            {editingEvent ? (
              <Pressable style={styles.secondaryButton} onPress={clearEventForm}>
                <Text style={styles.secondaryText}>Cancel Edit</Text>
              </Pressable>
            ) : null}
            {adminMapEvents.map((event) => (
              <View key={event.id} style={styles.storyCard}>
                <Text style={styles.markerName}>{event.distance_marker_percent}% - {event.title}</Text>
                <Text style={styles.debugLine}>{event.linked_only ? "Linked Only / " : ""}{eventTriggerModeName(event)}</Text>
                <Text style={styles.copy}>
                  {event.event_type === "battle"
                    ? `${event.npc_id ? getNpcName(npcDefinitions, event.npc_id) : event.enemy_id ? getEnemyName(enemyDefinitions, event.enemy_id) : event.enemy_name || "Enemy"} - ${event.npc_id ? "Admin NPC" : event.enemy_id ? "Admin Enemy" : `HP ${event.enemy_hp}`}`
                    : `${eventTypeName(event.event_type)} - ${event.dialogue_text || "Add dialogue steps below."}`}
                </Text>
                <View style={styles.modeRow}>
                  <Pressable style={styles.secondaryButtonFlex} onPress={() => void previewMapEvent(event)}>
                    <Text style={styles.secondaryText}>Preview/Test</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButtonFlex} onPress={() => editMapEvent(event)}>
                    <Text style={styles.secondaryText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButtonFlex} onPress={() => void removeMapEvent(event.id)}>
                    <Text style={styles.dangerText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {renderBranchingDialogueEditor()}
          </View> : null}
          </AdminCollapsibleSection>
          {selectedMarker && editorMode === "Marker" ? (
            <AdminCollapsibleSection
              title="Selected Object Inspector"
              summary={`${selectedMarker.title} / ${selectedMarker.type}`}
              isOpen={isAdminPanelOpen("selected-object")}
              onToggle={() => toggleAdminPanel("selected-object")}
            >
            <View style={styles.adminActions}>
              <Text style={styles.selectedTitle}>Selected: {selectedMarker.title}</Text>
              <Pressable style={styles.secondaryButton} onPress={() => void moveSelectedMarker()} disabled={!clickedPercent}>
                <Text style={styles.secondaryText}>Move to Clicked Coordinates</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => void toggleSelectedMarker()}>
                <Text style={styles.secondaryText}>{selectedMarker.is_active ? "Hide Marker" : "Reveal Marker"}</Text>
              </Pressable>
              <Pressable style={styles.dangerButton} onPress={() => void removeSelectedMarker()}>
                <Text style={styles.dangerText}>Delete Marker</Text>
              </Pressable>
            </View>
            </AdminCollapsibleSection>
          ) : null}
        </Frame>
      ) : null}
      <GameToast toast={gameToast} onDismiss={() => setGameToast(null)} />
    </Screen>
  );
}

function getRouteSegmentsForRoutes(routes: MapRoute[], activeRouteId: string, dimensions = mapSize, revealConcealed = false) {
  return routes.flatMap((mapRoute) =>
    getRouteSegments(mapRoute.path_points, dimensions).map((segment, index) => ({
      ...segment,
      id: `${mapRoute.id}-${index}`,
      isActive: mapRoute.id === activeRouteId,
      isDraft: false,
      visibility: getRouteSegmentVisibility(mapRoute, index),
      revealConcealed,
    })),
  );
}

function getRouteSegmentVisibility(route: MapRoute, index: number) {
  return (route.path_segments ?? []).find((segment) => Number(segment.from_index) === index && Number(segment.to_index) === index + 1)?.visibility ?? "visible";
}

function resolveSceneImageUri(imagePath?: string | null) {
  const trimmed = imagePath?.trim();

  if (!trimmed) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replaceAll("\\", "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function metersToMiles(meters: number) {
  return (meters / 1609.344).toFixed(2);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

function parseChoices(value: string): MapEvent["choices"] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = "Continue", action = "Continue"] = line.split("|").map((part) => part.trim());
      const safeAction = choiceActions.includes(action as MapEvent["choices"][number]["action"]) ? (action as MapEvent["choices"][number]["action"]) : "Continue";
      return { label, action: safeAction };
    });
}

function LegendStylePicker({ items, onApply }: { items: MarkerLegendItem[]; onApply: (item: MarkerLegendItem) => void }) {
  const activeItems = items.filter((item) => item.is_active).sort((a, b) => a.sort_order - b.sort_order);

  if (activeItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Reuse Legend Marker Style</Text>
      <Text style={styles.copy}>Apply an existing legend icon, label, color, and marker type to this marker draft.</Text>
      <View style={styles.storyRoutePicker}>
        {activeItems.map((item) => (
          <Pressable key={item.id} style={styles.routeChip} onPress={() => onApply(item)}>
            <View style={styles.legendTemplateChip}>
              <MarkerIcon
                marker={{
                  type: item.marker_type,
                  icon_label: item.icon_label,
                  icon_image_url: item.icon_image_url,
                  icon_color: item.icon_color,
                }}
                compact
              />
              <Text style={styles.routeChipText}>{item.title}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function LinkedMarkerPathNotice({
  markerType,
  selectedRouteIds,
  routes,
  startsRouteOnAccept,
  requireAllLinkedRoutes,
}: {
  markerType: string;
  selectedRouteIds: string[];
  routes: MapRoute[];
  startsRouteOnAccept: boolean;
  requireAllLinkedRoutes: boolean;
}) {
  const linkedRoutes = selectedRouteIds
    .map((routeId) => routes.find((route) => route.id === routeId))
    .filter((route): route is MapRoute => Boolean(route));

  if (linkedRoutes.length === 0) {
    return null;
  }

  const isNpc = markerType === "NPC";
  const isStoryOrQuest = isStoryQuestMarker({ type: markerType });
  const roleText = startsRouteOnAccept
    ? "Starts travel when accepted"
    : isStoryOrQuest
      ? "Story path sequence"
      : requireAllLinkedRoutes
        ? "Requires all linked paths complete"
        : "Requires any linked path complete";

  return (
    <View style={[styles.linkedPathNotice, isNpc && styles.linkedPathWarning]}>
      <View style={styles.linkedPathNoticeHeader}>
        <Text style={styles.selectedTitle}>Linked Path Notice</Text>
        <Text style={styles.linkedPathBadge}>{roleText}</Text>
      </View>
      {isNpc ? (
        <Text style={styles.lockText}>
          This NPC has linked walking paths selected. In the new flow, NPCs should usually unlock Story markers instead of requiring paths.
        </Text>
      ) : null}
      <View style={styles.storyRoutePicker}>
        {linkedRoutes.map((route) => (
          <View key={route.id} style={styles.linkedPathPill}>
            <Text style={styles.routeChipText}>{route.sort_order}. {route.name}{route.mini_map_id ? " (Mini)" : " (World)"}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.debugLine}>To remove these links, deselect the highlighted path chips below and save the marker.</Text>
    </View>
  );
}

function SignPostRouteDirectionEditor({
  routes,
  selectedRouteIds,
  routeDirections,
  onSelectDirection,
}: {
  routes: MapRoute[];
  selectedRouteIds: string[];
  routeDirections: Record<string, MarkerRouteLink["start_direction"]>;
  onSelectDirection: (routeId: string, direction: MarkerRouteLink["start_direction"]) => void;
}) {
  const selectedRoutes = selectedRouteIds
    .map((routeId) => routes.find((route) => route.id === routeId))
    .filter((route): route is MapRoute => Boolean(route));

  if (selectedRoutes.length === 0) {
    return null;
  }

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Path Start Direction</Text>
      <Text style={styles.copy}>Forward starts at 0% and walks to 100%. Reverse starts at 100% and walks back to 0%.</Text>
      {selectedRoutes.map((selectedRoute) => {
        const selectedDirection = routeDirections[selectedRoute.id] ?? "forward";
        return (
          <View key={selectedRoute.id} style={styles.storyCard}>
            <Text style={styles.markerName}>{selectedRoute.sort_order}. {selectedRoute.name}</Text>
            <View style={styles.modeRow}>
              <Pressable style={[styles.secondaryButtonFlex, selectedDirection === "forward" && styles.typeSelected]} onPress={() => onSelectDirection(selectedRoute.id, "forward")}>
                <Text style={styles.secondaryText}>Forward 0% to 100%</Text>
              </Pressable>
              <Pressable style={[styles.secondaryButtonFlex, selectedDirection === "reverse" && styles.typeSelected]} onPress={() => onSelectDirection(selectedRoute.id, "reverse")}>
                <Text style={styles.secondaryText}>Reverse 100% to 0%</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function MiniMapMarkerAdminForm({
  activeSectionMarkerTypes,
  legendItems,
  onApplyLegendStyle,
  draftType,
  setDraftType,
  draftTitle,
  setDraftTitle,
  draftDescription,
  setDraftDescription,
  markerSceneBackground,
  setMarkerSceneBackground,
  markerNpcImage,
  setMarkerNpcImage,
  markerIconLabel,
  setMarkerIconLabel,
  markerIconImage,
  setMarkerIconImage,
  markerIconColor,
  setMarkerIconColor,
  markerSize,
  setMarkerSize,
  markerShopImage,
  setMarkerShopImage,
  markerShopBackground,
  setMarkerShopBackground,
  markerInteractionRadius,
  setMarkerInteractionRadius,
  markerInteractable,
  setMarkerInteractable,
  markerInitiallyUnlocked,
  setMarkerInitiallyUnlocked,
  markerQuestTitle,
  setMarkerQuestTitle,
  markerQuestDialogue,
  setMarkerQuestDialogue,
  markerQuestImage,
  setMarkerQuestImage,
  markerRewardXp,
  setMarkerRewardXp,
  markerRewardGold,
  setMarkerRewardGold,
  markerRewardItemId,
  setMarkerRewardItemId,
  markerRewardQuantity,
  setMarkerRewardQuantity,
  markerRewardFullHeal,
  setMarkerRewardFullHeal,
  markerRewardTiming,
  setMarkerRewardTiming,
  markerRepeatable,
  setMarkerRepeatable,
  markerRewardOnce,
  setMarkerRewardOnce,
  markerLinkedRouteId,
  setMarkerLinkedRouteId,
  markerLinkedRouteStartDirection,
  setMarkerLinkedRouteStartDirection,
  markerStartsRouteOnAccept,
  setMarkerStartsRouteOnAccept,
  markerVisibleStoryFlagKey,
  setMarkerVisibleStoryFlagKey,
  markerVisibleStoryFlagValue,
  setMarkerVisibleStoryFlagValue,
  knownStoryFlagKeys,
  markerStoryOrder,
  setMarkerStoryOrder,
  markerUnlockAfterId,
  setMarkerUnlockAfterId,
  markerHideWhenCompleted,
  setMarkerHideWhenCompleted,
  markerRequireAllLinkedRoutes,
  setMarkerRequireAllLinkedRoutes,
  markerRouteCompletionCondition,
  setMarkerRouteCompletionCondition,
  markerDialogueEventId,
  setMarkerDialogueEventId,
  markerBattleEventId,
  setMarkerBattleEventId,
  markerEnemyId,
  setMarkerEnemyId,
  markerNpcId,
  setMarkerNpcId,
  reusableMapEvents,
  enemyDefinitions,
  npcDefinitions,
  routes,
  continuationRoutes,
  storyRoutes,
  allMarkers,
  selectedMarkerRouteIds,
  selectedMarkerRouteDirections,
  toggleSignPostRoute,
  setSignPostRouteDirection,
  worldMarkers,
  storyScopeMarkers,
  miniMaps,
  markerExitTargetType,
  setMarkerExitTargetType,
  markerExitTargetMarkerId,
  setMarkerExitTargetMarkerId,
  markerExitTargetMiniMapId,
  setMarkerExitTargetMiniMapId,
  markerExitTargetSpawnMarkerId,
  setMarkerExitTargetSpawnMarkerId,
  itemDefinitions,
  markerMarketItems,
  marketItemId,
  setMarketItemId,
  marketBuyPrice,
  setMarketBuyPrice,
  marketSellPrice,
  setMarketSellPrice,
  marketStock,
  setMarketStock,
  marketUnlimited,
  setMarketUnlimited,
  marketListingMode,
  setMarketListingMode,
  selectedMarker,
  clickedPercent,
  onAddMarker,
  onSaveSelectedMarker,
  onSaveMarketItem,
  onRemoveMarketItem,
  selectedDialogueMarkerId,
  onLoadMarkerDialogue,
  onEditBattleEvent,
  battlefieldCombatants,
  onSaveMarkerBattlefieldCombatant,
  onRemoveMarkerBattlefieldCombatant,
  onMessage,
  renderMarkerDialogueEditor,
}: {
  activeSectionMarkerTypes: readonly string[];
  legendItems: MarkerLegendItem[];
  onApplyLegendStyle: (item: MarkerLegendItem) => void;
  draftType: string;
  setDraftType: (value: string) => void;
  draftTitle: string;
  setDraftTitle: (value: string) => void;
  draftDescription: string;
  setDraftDescription: (value: string) => void;
  markerSceneBackground: string;
  setMarkerSceneBackground: (value: string) => void;
  markerNpcImage: string;
  setMarkerNpcImage: (value: string) => void;
  markerIconLabel: string;
  setMarkerIconLabel: (value: string) => void;
  markerIconImage: string;
  setMarkerIconImage: (value: string) => void;
  markerIconColor: string;
  setMarkerIconColor: (value: string) => void;
  markerSize: string;
  setMarkerSize: (value: string) => void;
  markerShopImage: string;
  setMarkerShopImage: (value: string) => void;
  markerShopBackground: string;
  setMarkerShopBackground: (value: string) => void;
  markerInteractionRadius: string;
  setMarkerInteractionRadius: (value: string) => void;
  markerInteractable: boolean;
  setMarkerInteractable: (value: boolean | ((current: boolean) => boolean)) => void;
  markerInitiallyUnlocked: boolean;
  setMarkerInitiallyUnlocked: (value: boolean | ((current: boolean) => boolean)) => void;
  markerQuestTitle: string;
  setMarkerQuestTitle: (value: string) => void;
  markerQuestDialogue: string;
  setMarkerQuestDialogue: (value: string) => void;
  markerQuestImage: string;
  setMarkerQuestImage: (value: string) => void;
  markerRewardXp: string;
  setMarkerRewardXp: (value: string) => void;
  markerRewardGold: string;
  setMarkerRewardGold: (value: string) => void;
  markerRewardItemId: string | null;
  setMarkerRewardItemId: (value: string | null) => void;
  markerRewardQuantity: string;
  setMarkerRewardQuantity: (value: string) => void;
  markerRewardFullHeal: boolean;
  setMarkerRewardFullHeal: (value: boolean | ((current: boolean) => boolean)) => void;
  markerRewardTiming: MapMarker["reward_timing"];
  setMarkerRewardTiming: (value: MapMarker["reward_timing"]) => void;
  markerRepeatable: boolean;
  setMarkerRepeatable: (value: boolean | ((current: boolean) => boolean)) => void;
  markerRewardOnce: boolean;
  setMarkerRewardOnce: (value: boolean | ((current: boolean) => boolean)) => void;
  markerLinkedRouteId: string | null;
  setMarkerLinkedRouteId: (value: string | null) => void;
  markerLinkedRouteStartDirection: MapMarker["linked_route_start_direction"];
  setMarkerLinkedRouteStartDirection: (value: MapMarker["linked_route_start_direction"]) => void;
  markerStartsRouteOnAccept: boolean;
  setMarkerStartsRouteOnAccept: (value: boolean | ((current: boolean) => boolean)) => void;
  markerVisibleStoryFlagKey: string;
  setMarkerVisibleStoryFlagKey: (value: string) => void;
  markerVisibleStoryFlagValue: boolean;
  setMarkerVisibleStoryFlagValue: (value: boolean | ((current: boolean) => boolean)) => void;
  knownStoryFlagKeys: string[];
  markerStoryOrder: string;
  setMarkerStoryOrder: (value: string) => void;
  markerUnlockAfterId: string | null;
  setMarkerUnlockAfterId: (value: string | null) => void;
  markerHideWhenCompleted: boolean;
  setMarkerHideWhenCompleted: (value: boolean | ((current: boolean) => boolean)) => void;
  markerRequireAllLinkedRoutes: boolean;
  setMarkerRequireAllLinkedRoutes: (value: boolean | ((current: boolean) => boolean)) => void;
  markerRouteCompletionCondition: MarkerRouteLink["completion_condition"];
  setMarkerRouteCompletionCondition: (value: MarkerRouteLink["completion_condition"]) => void;
  markerDialogueEventId: string | null;
  setMarkerDialogueEventId: (value: string | null) => void;
  markerBattleEventId: string | null;
  setMarkerBattleEventId: (value: string | null) => void;
  markerEnemyId: string | null;
  setMarkerEnemyId: (value: string | null) => void;
  markerNpcId: string | null;
  setMarkerNpcId: (value: string | null) => void;
  reusableMapEvents: MapEvent[];
  enemyDefinitions: EnemyDefinition[];
  npcDefinitions: NpcDefinition[];
  routes: MapRoute[];
  continuationRoutes: MapRoute[];
  storyRoutes: MapRoute[];
  allMarkers: MapMarker[];
  selectedMarkerRouteIds: string[];
  selectedMarkerRouteDirections: Record<string, MarkerRouteLink["start_direction"]>;
  toggleSignPostRoute: (routeId: string) => void;
  setSignPostRouteDirection: (routeId: string, direction: MarkerRouteLink["start_direction"]) => void;
  worldMarkers: MapMarker[];
  storyScopeMarkers: MapMarker[];
  miniMaps: MiniMap[];
  markerExitTargetType: MapMarker["exit_target_type"];
  setMarkerExitTargetType: (value: MapMarker["exit_target_type"]) => void;
  markerExitTargetMarkerId: string | null;
  setMarkerExitTargetMarkerId: (value: string | null) => void;
  markerExitTargetMiniMapId: string | null;
  setMarkerExitTargetMiniMapId: (value: string | null) => void;
  markerExitTargetSpawnMarkerId: string | null;
  setMarkerExitTargetSpawnMarkerId: (value: string | null) => void;
  itemDefinitions: ItemDefinition[];
  markerMarketItems: MarkerMarketItem[];
  marketItemId: string | null;
  setMarketItemId: (value: string | null) => void;
  marketBuyPrice: string;
  setMarketBuyPrice: (value: string) => void;
  marketSellPrice: string;
  setMarketSellPrice: (value: string) => void;
  marketStock: string;
  setMarketStock: (value: string) => void;
  marketUnlimited: boolean;
  setMarketUnlimited: (value: boolean | ((current: boolean) => boolean)) => void;
  marketListingMode: MarkerMarketItem["listing_mode"];
  setMarketListingMode: (value: MarkerMarketItem["listing_mode"]) => void;
  selectedMarker: MapMarker | null;
  clickedPercent: { x: number; y: number } | null;
  onAddMarker: () => void;
  onSaveSelectedMarker: () => void;
  onSaveMarketItem: () => void;
  onRemoveMarketItem: (marketItemId: string) => void;
  selectedDialogueMarkerId: string | null;
  onLoadMarkerDialogue: (marker: MapMarker) => void;
  onEditBattleEvent: (event: MapEvent) => void;
  battlefieldCombatants: Array<BattleEventCombatant | MarkerBattleCombatant>;
  onSaveMarkerBattlefieldCombatant: (input: Partial<BattleEventCombatant> & { event_id: string }) => Promise<void>;
  onRemoveMarkerBattlefieldCombatant: (combatantId: string) => Promise<void>;
  onMessage: (message: string) => void;
  renderMarkerDialogueEditor: (marker: MapMarker) => ReactNode;
}) {
  const supportsQuest = isQuestMarkerType(draftType);
  const supportsMarket = draftType === "Market" || selectedMarker?.type === "Market";
  const supportsExit = isExitMarkerType(draftType);
  const supportsSignPost = draftType === "Sign Post";
  const supportsBattle = isBattleMarkerType(draftType);

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Create / Edit Mini Map Marker</Text>
      <MarkerTypeSelector types={activeSectionMarkerTypes} selectedType={draftType} onSelectType={setDraftType} />
      <LegendStylePicker items={legendItems} onApply={onApplyLegendStyle} />
      <TextInput value={draftTitle} onChangeText={setDraftTitle} placeholder="Marker title" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={draftDescription} onChangeText={setDraftDescription} placeholder="Marker description" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={markerSceneBackground} onChangeText={setMarkerSceneBackground} placeholder="Marker scene background image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
      <AdminImageUploadButton folder="mini-marker-backgrounds" onUploaded={setMarkerSceneBackground} onMessage={() => undefined} />
      <TextInput value={markerNpcImage} onChangeText={setMarkerNpcImage} placeholder="NPC / character image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
      <AdminImageUploadButton folder="mini-marker-npcs" onUploaded={setMarkerNpcImage} onMessage={() => undefined} />
      <MarkerStyleEditor
        iconLabel={markerIconLabel}
        iconImage={markerIconImage}
        iconColor={markerIconColor}
        markerSize={markerSize}
        uploadFolder="mini-marker-icons"
        onChangeIconLabel={setMarkerIconLabel}
        onChangeIconImage={setMarkerIconImage}
        onChangeIconColor={setMarkerIconColor}
        onChangeMarkerSize={setMarkerSize}
        onUploadMessage={onMessage}
      />
      <TextInput value={markerInteractionRadius} onChangeText={setMarkerInteractionRadius} placeholder="Interaction radius percent, example 4" placeholderTextColor={colors.muted} style={styles.input} />
      <Pressable style={[styles.secondaryButton, markerInteractable && styles.typeSelected]} onPress={() => setMarkerInteractable((value) => !value)}>
        <Text style={styles.secondaryText}>Interactable: {markerInteractable ? "true" : "false"}</Text>
      </Pressable>
      <Pressable style={[styles.secondaryButton, markerInitiallyUnlocked && styles.typeSelected]} onPress={() => setMarkerInitiallyUnlocked((value) => !value)}>
        <Text style={styles.secondaryText}>Initially Unlocked: {markerInitiallyUnlocked ? "true" : "false"}</Text>
      </Pressable>
      <MarkerStoryFlagVisibilityEditor
        storyFlagKeys={knownStoryFlagKeys}
        visibleStoryFlagKey={markerVisibleStoryFlagKey}
        visibleStoryFlagValue={markerVisibleStoryFlagValue}
        onChangeVisibleStoryFlagKey={setMarkerVisibleStoryFlagKey}
        onToggleVisibleStoryFlagValue={() => setMarkerVisibleStoryFlagValue((value) => !value)}
        onClear={() => {
          setMarkerVisibleStoryFlagKey("");
          setMarkerVisibleStoryFlagValue(true);
        }}
      />
      <LinkedMarkerPathNotice
        markerType={draftType}
        selectedRouteIds={selectedMarkerRouteIds}
        routes={routes}
        startsRouteOnAccept={markerStartsRouteOnAccept}
        requireAllLinkedRoutes={markerRequireAllLinkedRoutes}
      />
      {draftType === "NPC" ? (
        <View style={styles.storyEditor}>
          <Text style={styles.selectedTitle}>NPC Character</Text>
          <Text style={styles.copy}>Choose a reusable NPC for this mini-map marker. Dialogue, portrait, and optional battle can all use this same character.</Text>
          <NpcPicker
            label="Linked NPC"
            npcs={npcDefinitions}
            selectedId={markerNpcId}
            onSelect={(id) => {
              setMarkerNpcId(id);
              const npc = npcDefinitions.find((item) => item.id === id);
              if (npc) {
                if (!draftTitle.trim()) setDraftTitle(npc.name);
                if (!markerQuestTitle.trim()) setMarkerQuestTitle(npc.name);
                if (!markerNpcImage.trim()) setMarkerNpcImage(npc.image_url || "");
                if (!markerIconImage.trim()) setMarkerIconImage(npc.image_url || "");
              }
            }}
          />
        </View>
      ) : null}
      {supportsMarkerDialogue(draftType) ? (
        <View style={styles.storyEditor}>
          <Text style={styles.selectedTitle}>Marker Dialogue Tree</Text>
          <Text style={styles.copy}>This marker gets its own dialogue tree. Use choices to start quests, give rewards, branch the story, or start a battle.</Text>
          {selectedMarker ? (
            <>
              <Pressable style={styles.secondaryButton} onPress={() => onLoadMarkerDialogue(selectedMarker)}>
                <Text style={styles.secondaryText}>{selectedDialogueMarkerId === selectedMarker.id ? "Reload Marker Dialogue Tree" : "Build / Edit Marker Dialogue Tree"}</Text>
              </Pressable>
              {selectedDialogueMarkerId === selectedMarker.id ? renderMarkerDialogueEditor(selectedMarker) : null}
            </>
          ) : (
            <Text style={styles.debugLine}>Create or select this marker before building its dialogue tree.</Text>
          )}
        </View>
      ) : null}
      {supportsBattle ? (
        <View style={styles.storyEditor}>
          <Text style={styles.selectedTitle}>Battle Setup</Text>
          <Text style={styles.copy}>Link a saved Battle Event to use its battleground image, battlefield layout, rewards, and combatants. Or pick a direct Enemy/NPC for a simple standalone battle.</Text>
          <EventPicker
            label="Linked Battle Event"
            events={reusableMapEvents.filter((event) => event.event_type === "battle")}
            selectedId={markerBattleEventId}
            onSelect={setMarkerBattleEventId}
          />
          {markerBattleEventId ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                const linkedEvent = reusableMapEvents.find((event) => event.id === markerBattleEventId);
                if (linkedEvent) {
                  onEditBattleEvent(linkedEvent);
                }
              }}
            >
              <Text style={styles.secondaryText}>Edit Linked Battle Event Board</Text>
            </Pressable>
          ) : null}
          <EnemyPicker
            enemies={enemyDefinitions}
            selectedId={markerEnemyId}
            onSelect={(id) => {
              setMarkerEnemyId(id);
              if (id) setMarkerNpcId(null);
            }}
          />
          <NpcPicker
            label="Battle NPC"
            npcs={npcDefinitions}
            selectedId={markerNpcId}
            onSelect={(id) => {
              setMarkerNpcId(id);
              if (id) setMarkerEnemyId(null);
            }}
            battleOnly
          />
          <BattlefieldLayoutEditor
            title="Marker Battle Board"
            emptyText="Select or create this Battle marker first, then place enemies directly on its battleground."
            eventId={selectedMarker?.id ?? null}
            backgroundImageUrl={markerSceneBackground || markerQuestImage}
            combatants={battlefieldCombatants}
            enemies={enemyDefinitions}
            npcs={npcDefinitions}
            onSave={onSaveMarkerBattlefieldCombatant}
            onDelete={onRemoveMarkerBattlefieldCombatant}
            onMessage={onMessage}
          />
        </View>
      ) : null}
      {supportsSignPost ? (
        <View style={styles.storyEditor}>
          <Text style={styles.selectedTitle}>Linked Walking Paths</Text>
          <Text style={styles.copy}>Players choose from these existing paths when they interact with this Sign Post inside the mini map.</Text>
          <View style={styles.storyRoutePicker}>
            {routes.map((item) => (
              <Pressable key={item.id} style={[styles.routeChip, selectedMarkerRouteIds.includes(item.id) && styles.routeChipActive]} onPress={() => toggleSignPostRoute(item.id)}>
                <Text style={styles.routeChipText}>{item.sort_order}. {item.name}</Text>
              </Pressable>
            ))}
          </View>
          <SignPostRouteDirectionEditor
            routes={routes}
            selectedRouteIds={selectedMarkerRouteIds}
            routeDirections={selectedMarkerRouteDirections}
            onSelectDirection={setSignPostRouteDirection}
          />
          {routes.length === 0 ? <Text style={styles.copy}>No walking paths exist in this season/chapter yet.</Text> : null}
          {selectedMarker ? (
            <Text style={styles.debugLine}>Save Marker Details after changing linked paths.</Text>
          ) : (
            <Text style={styles.debugLine}>Selected paths will be linked when the Sign Post marker is created.</Text>
          )}
        </View>
      ) : null}
      {!supportsSignPost && !supportsQuest && !supportsBattle ? (
        <MarkerPathRequirementEditor
          title="Required Completed Paths"
          description={draftType === "Area/Town Entrance"
            ? "Players can enter after completing any one linked path that leads to this entrance. Use the unlock point below to choose whether the entrance opens at the path end, path start after reverse travel, or either side."
            : "Players must complete linked paths before this marker becomes interactable. Use the unlock point below for endpoint-style exits, gates, clues, and area transitions."}
          routes={routes}
          selectedRouteIds={selectedMarkerRouteIds}
          completionCondition={markerRouteCompletionCondition}
          onToggleRoute={toggleSignPostRoute}
          onSelectCompletionCondition={setMarkerRouteCompletionCondition}
          emptyText="No walking paths exist in this mini map yet."
          saveHint={selectedMarker ? "Save Marker Details after changing linked paths or the unlock point." : "Selected paths will be linked when this marker is created."}
        />
      ) : null}
      {supportsExit ? (
        <ExitTargetEditor
          targetType={markerExitTargetType}
          setTargetType={setMarkerExitTargetType}
          targetMarkerId={markerExitTargetMarkerId}
          setTargetMarkerId={setMarkerExitTargetMarkerId}
          targetMiniMapId={markerExitTargetMiniMapId}
          setTargetMiniMapId={setMarkerExitTargetMiniMapId}
          targetSpawnMarkerId={markerExitTargetSpawnMarkerId}
          setTargetSpawnMarkerId={setMarkerExitTargetSpawnMarkerId}
          worldMarkers={worldMarkers}
          miniMaps={miniMaps}
          spawnMarkers={allMarkers}
        />
      ) : null}
      {(draftType === "Area/Town Entrance" || supportsExit) ? (
        <MarkerContinuationRouteEditor
          markerType={draftType}
          routes={continuationRoutes}
          selectedRouteId={markerLinkedRouteId}
          startDirection={markerLinkedRouteStartDirection}
          startsRouteOnAccept={markerStartsRouteOnAccept}
          onSelectRoute={setMarkerLinkedRouteId}
          onSelectStartDirection={setMarkerLinkedRouteStartDirection}
          onToggleStartsRoute={() => setMarkerStartsRouteOnAccept((value) => !value)}
        />
      ) : null}
      {supportsQuest ? (
        <View style={styles.storyEditor}>
          <Text style={styles.selectedTitle}>Quest / Path Link</Text>
          <TextInput value={markerQuestTitle} onChangeText={setMarkerQuestTitle} placeholder="Quest title optional" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={markerQuestDialogue} onChangeText={setMarkerQuestDialogue} placeholder="Quest dialogue" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
          <TextInput value={markerQuestImage} onChangeText={setMarkerQuestImage} placeholder="Quest image URL" placeholderTextColor={colors.muted} style={styles.input} />
          <AdminImageUploadButton folder="mini-quest-images" onUploaded={setMarkerQuestImage} onMessage={() => undefined} />
          {isStoryQuestMarker({ type: draftType }) ? (
            <>
              <TextInput value={markerStoryOrder} onChangeText={setMarkerStoryOrder} placeholder="Story order, example 1" placeholderTextColor={colors.muted} style={styles.input} />
              <Text style={styles.selectedTitle}>Unlock After Story / Quest Marker</Text>
              <View style={styles.storyRoutePicker}>
                <Pressable style={[styles.routeChip, !markerUnlockAfterId && styles.routeChipActive]} onPress={() => setMarkerUnlockAfterId(null)}>
                  <Text style={styles.routeChipText}>Use story order</Text>
                </Pressable>
                {storyScopeMarkers.filter((marker) => isStoryQuestMarker(marker) && marker.id !== selectedMarker?.id).map((marker) => (
                  <Pressable key={marker.id} style={[styles.routeChip, markerUnlockAfterId === marker.id && styles.routeChipActive]} onPress={() => setMarkerUnlockAfterId(marker.id)}>
                    <Text style={styles.routeChipText}>{marker.story_order || 0}. {marker.title}{marker.mini_map_id ? " (Mini)" : " (World)"}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={[styles.secondaryButton, markerHideWhenCompleted && styles.typeSelected]} onPress={() => setMarkerHideWhenCompleted((value) => !value)}>
                <Text style={styles.secondaryText}>Hide After Completion: {markerHideWhenCompleted ? "Yes" : "No"}</Text>
              </Pressable>
              <Pressable style={[styles.secondaryButton, markerRequireAllLinkedRoutes && styles.typeSelected]} onPress={() => setMarkerRequireAllLinkedRoutes((value) => !value)}>
                <Text style={styles.secondaryText}>Require All Linked Paths: {markerRequireAllLinkedRoutes ? "Yes" : "No"}</Text>
              </Pressable>
            </>
          ) : null}
          <Text style={styles.selectedTitle}>Linked Walking Paths</Text>
          <Text style={styles.copy}>Select one or more paths. They run in the order shown by route sort/order.</Text>
          <View style={styles.storyRoutePicker}>
            {storyRoutes.map((item) => (
              <Pressable key={item.id} style={[styles.routeChip, selectedMarkerRouteIds.includes(item.id) && styles.routeChipActive]} onPress={() => toggleSignPostRoute(item.id)}>
                <Text style={styles.routeChipText}>{item.sort_order}. {item.name}{item.mini_map_id ? " (Mini)" : " (World)"}</Text>
              </Pressable>
            ))}
          </View>
          <RoutePicker routes={storyRoutes} selectedId={markerLinkedRouteId} onSelect={setMarkerLinkedRouteId} />
          <Pressable style={[styles.secondaryButton, markerStartsRouteOnAccept && styles.typeSelected]} onPress={() => setMarkerStartsRouteOnAccept((value) => !value)}>
            <Text style={styles.secondaryText}>Start Path On Accept: {markerStartsRouteOnAccept ? "Yes" : "No"}</Text>
          </Pressable>
          <TextInput value={markerRewardXp} onChangeText={setMarkerRewardXp} placeholder="XP reward" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={markerRewardGold} onChangeText={setMarkerRewardGold} placeholder="Gold reward" placeholderTextColor={colors.muted} style={styles.input} />
          <ItemPicker label="Item reward" items={itemDefinitions} selectedId={markerRewardItemId} onSelect={setMarkerRewardItemId} />
          <TextInput value={markerRewardQuantity} onChangeText={setMarkerRewardQuantity} placeholder="Reward item quantity" placeholderTextColor={colors.muted} style={styles.input} />
          <Pressable style={[styles.secondaryButton, markerRewardFullHeal && styles.typeSelected]} onPress={() => setMarkerRewardFullHeal((value) => !value)}>
            <Text style={styles.secondaryText}>Full Heal Reward: {markerRewardFullHeal ? "Yes" : "No"}</Text>
          </Pressable>
          <RewardTimingPicker value={markerRewardTiming} onSelect={setMarkerRewardTiming} />
          <View style={styles.modeRow}>
            <Pressable style={[styles.secondaryButtonFlex, markerRepeatable && styles.typeSelected]} onPress={() => setMarkerRepeatable((value) => !value)}>
              <Text style={styles.secondaryText}>Repeatable: {markerRepeatable ? "Yes" : "No"}</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButtonFlex, markerRewardOnce && styles.typeSelected]} onPress={() => setMarkerRewardOnce((value) => !value)}>
              <Text style={styles.secondaryText}>Reward Once: {markerRewardOnce ? "Yes" : "No"}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {selectedMarker ? (
        <Pressable style={styles.secondaryButton} onPress={onSaveSelectedMarker}>
          <Text style={styles.secondaryText}>Save Marker Details</Text>
        </Pressable>
      ) : null}
      {supportsMarket ? (
        <View style={styles.storyEditor}>
          <Text style={styles.selectedTitle}>Market / Shop Settings</Text>
          <Text style={styles.copy}>{selectedMarker ? "Choose items from the admin item database for this mini-map market." : "Create or select a Market marker before adding shop stock."}</Text>
          <TextInput value={markerQuestTitle} onChangeText={setMarkerQuestTitle} placeholder="Shop display name optional" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={markerQuestDialogue} onChangeText={setMarkerQuestDialogue} placeholder="Shop welcome text" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
          <TextInput value={markerShopImage} onChangeText={setMarkerShopImage} placeholder="Shop image URL" placeholderTextColor={colors.muted} style={styles.input} />
          <AdminImageUploadButton folder="mini-shop-images" onUploaded={setMarkerShopImage} onMessage={() => undefined} />
          <TextInput value={markerShopBackground} onChangeText={setMarkerShopBackground} placeholder="Shop background image URL" placeholderTextColor={colors.muted} style={styles.input} />
          <AdminImageUploadButton folder="mini-shop-backgrounds" onUploaded={setMarkerShopBackground} onMessage={() => undefined} />
          <ItemPicker label="Market item" items={itemDefinitions} selectedId={marketItemId} onSelect={setMarketItemId} />
          <MarketListingModePicker value={marketListingMode} onSelect={setMarketListingMode} />
          <TextInput value={marketBuyPrice} onChangeText={setMarketBuyPrice} placeholder="Buy price" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={marketSellPrice} onChangeText={setMarketSellPrice} placeholder="Sell price" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={marketStock} onChangeText={setMarketStock} placeholder="Stock quantity" placeholderTextColor={colors.muted} style={styles.input} />
          <Pressable style={[styles.secondaryButton, marketUnlimited && styles.typeSelected]} onPress={() => setMarketUnlimited((value) => !value)}>
            <Text style={styles.secondaryText}>Unlimited Stock: {marketUnlimited ? "Yes" : "No"}</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onSaveMarketItem} disabled={!selectedMarker || !marketItemId}>
            <Text style={styles.primaryText}>Save Market Item</Text>
          </Pressable>
          {selectedMarker?.type === "Market" ? null : <Text style={styles.copy}>Tip: save/select this marker as type Market before adding stock.</Text>}
          {markerMarketItems.length === 0 ? <Text style={styles.copy}>This mini-map market has no stock yet.</Text> : null}
          {markerMarketItems.map((marketItem) => (
            <View key={marketItem.id} style={styles.storyCard}>
              <Text style={styles.markerName}>{getItemName(itemDefinitions, marketItem.item_id)}</Text>
              <Text style={styles.copy}>{formatMarketListingMode(marketItem.listing_mode)} / Buy {marketItem.buy_price} / Sell {marketItem.sell_price} / {marketItem.unlimited_stock ? "Unlimited" : `Stock ${marketItem.stock_quantity ?? 0}`}</Text>
              <Pressable style={styles.secondaryButton} onPress={() => onRemoveMarketItem(marketItem.id)}>
                <Text style={styles.dangerText}>Remove Item</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {!clickedPercent ? <Text style={styles.lockText}>Tap the mini map image first to choose this marker's position.</Text> : null}
      {!draftTitle.trim() ? <Text style={styles.lockText}>Add a marker title before creating it.</Text> : null}
      <Pressable style={[styles.primaryButton, (!clickedPercent || !draftTitle.trim()) && styles.disabledAction]} onPress={onAddMarker}>
        <Text style={styles.primaryText}>{selectedMarker ? "Create New Marker At Clicked Spot" : "Create Mini Map Marker"}</Text>
      </Pressable>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function getAdminSectionMarkers(section: (typeof adminSections)[number], worldMarkers: MapMarker[], miniMapMarkers: MapMarker[]) {
  if (section === "Area/Town Markers") {
    return worldMarkers.filter((marker) => marker.type === "Area/Town Entrance");
  }

  if (section === "Mini Maps") {
    return miniMapMarkers;
  }

  return worldMarkers.filter((marker) => marker.type !== "Area/Town Entrance");
}

function resolveMapImageUri(imagePath?: string | null) {
  const trimmed = imagePath?.trim();

  if (!trimmed) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replaceAll("\\", "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function getJourneyObjective(marker: MapMarker | null | undefined, route: MapRoute, link?: MarkerRouteLink) {
  if (!marker) {
    return route.terrain || "Follow the selected trail.";
  }

  if (link?.destination_label) {
    return `Travel toward ${link.destination_label}.`;
  }

  const dialogue = marker.quest_dialogue?.trim();
  if (dialogue) {
    const firstLine = dialogue.split(/\n+/).map((line) => line.trim()).find(Boolean);
    if (firstLine) {
      return firstLine.length > 92 ? `${firstLine.slice(0, 89)}...` : firstLine;
    }
  }

  return marker.description?.trim() || route.terrain || "Continue the story path.";
}

function getJourneyDestinationMarker(route: MapRoute, markers: MapMarker[], routeLinks: MarkerRouteLink[], sourceMarkerId: string | null) {
  const linkedMarkerIds = new Set(
    routeLinks
      .filter((link) => link.route_id === route.id && link.marker_id !== sourceMarkerId)
      .map((link) => link.marker_id),
  );

  if (linkedMarkerIds.size === 0) {
    return null;
  }

  const candidates = markers.filter((marker) => linkedMarkerIds.has(marker.id) && marker.type !== "Player Spawn" && marker.type !== "World Spawn" && marker.type !== "Sign Post" && !isStoryQuestMarker(marker));
  const rankedTypes = ["Area/Town Entrance", "Exit", "Exit/Leave", "Market", "Quest", "Side Quest", "Point of Interest", "Training", "Battle", "Battle Zone"];

  return candidates.sort((a, b) => {
    const aRank = rankedTypes.indexOf(a.type);
    const bRank = rankedTypes.indexOf(b.type);
    return (aRank === -1 ? 99 : aRank) - (bRank === -1 ? 99 : bRank) || a.title.localeCompare(b.title);
  })[0] ?? null;
}

function getMarkerLinkedRouteImage(marker: MapMarker | null, routes: MapRoute[], routeLinks: MarkerRouteLink[]) {
  if (!marker) {
    return null;
  }

  const routeId =
    marker.linked_route_id ??
    routeLinks
      .filter((link) => link.marker_id === marker.id)
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))[0]?.route_id ??
    null;

  if (!routeId) {
    return null;
  }

  return routes.find((route) => route.id === routeId)?.image_url ?? null;
}

function compareEventsByRouteAndDistance(a: MapEvent, b: MapEvent) {
  return String(a.route_id ?? "").localeCompare(String(b.route_id ?? "")) || Number(a.distance_marker_percent) - Number(b.distance_marker_percent) || a.title.localeCompare(b.title);
}

function isQuestMarkerType(type: string) {
  return ["Quest", "Side Quest", "Story", "Point of Interest", "NPC"].includes(type);
}

function supportsMarkerDialogue(type: string) {
  return ["Quest", "Side Quest", "Story", "Point of Interest", "NPC"].includes(type);
}

function createMarkerDialogueEvent(marker: MapMarker): MapEvent {
  const now = new Date().toISOString();

  return {
    id: getSyntheticMarkerEventId(marker.id),
    event_type: "dialogue",
    title: marker.quest_title || marker.title,
    route_id: marker.linked_route_id,
    distance_marker_percent: 0,
    background_image_url: marker.scene_background_image_url ?? marker.quest_image_url ?? null,
    npc_name: null,
    npc_portrait_url: marker.scene_npc_image_url ?? marker.quest_image_url ?? null,
    dialogue_npc_id: marker.type === "NPC" ? marker.npc_id ?? null : null,
    npc_id: marker.type === "NPC" ? marker.npc_id ?? null : null,
    dialogue_text: marker.quest_dialogue || marker.description || "",
    choices: [],
    enemy_name: null,
    enemy_id: null,
    enemy_image_url: null,
    enemy_hp: 0,
    enemy_attack_damage: 0,
    battle_intro_text: null,
    victory_text: null,
    defeat_text: null,
    reward_xp: marker.reward_xp ?? 0,
    reward_gold: marker.reward_gold ?? 0,
    reward_item: null,
    reward_item_id: marker.reward_item_id ?? null,
    reward_item_quantity: marker.reward_item_quantity ?? 1,
    trigger_mode: "fixed",
    random_chance_percent: 0,
    linked_only: false,
    is_active: marker.is_active,
    season_number: marker.season_number ?? 1,
    chapter_number: marker.chapter_number ?? 1,
    created_by: null,
    created_at: now,
    updated_at: now,
  };
}

function getSyntheticMarkerEventId(markerId: string) {
  return `marker-${markerId}`;
}

function isBattleMarkerType(type: string) {
  return type === "Battle" || type === "Battle Zone" || type === "NPC";
}

function createMarkerBattleEvent(marker: MapMarker, enemies: EnemyDefinition[], npcs: NpcDefinition[]): MapEvent {
  const enemy = marker.enemy_id ? enemies.find((item) => item.id === marker.enemy_id) ?? null : null;
  const npc = marker.npc_id ? npcs.find((item) => item.id === marker.npc_id) ?? null : null;
  const opponent = enemy ?? npc;
  const now = new Date().toISOString();

  return {
    id: marker.id,
    event_type: "battle",
    title: marker.quest_title || marker.title,
    route_id: null,
    distance_marker_percent: 0,
    background_image_url: marker.scene_background_image_url ?? null,
    npc_name: null,
    npc_portrait_url: null,
    dialogue_npc_id: null,
    npc_id: npc?.id ?? null,
    dialogue_text: null,
    choices: [],
    enemy_name: opponent?.name ?? marker.title,
    enemy_id: enemy?.id ?? null,
    enemy_image_url: opponent?.image_url ?? marker.scene_npc_image_url ?? null,
    enemy_hp: Number(opponent?.health ?? 30) || 30,
    enemy_attack_damage: 0,
    battle_intro_text: marker.quest_dialogue || marker.description || `${opponent?.name ?? marker.title} blocks your path.`,
    victory_text: "Victory.",
    defeat_text: "Defeat.",
    reward_xp: Number(marker.reward_xp ?? 0) || 0,
    reward_gold: Number(marker.reward_gold ?? 0) || 0,
    reward_item: null,
    reward_item_id: marker.reward_item_id ?? null,
    reward_item_quantity: Number(marker.reward_item_quantity ?? 1) || 1,
    trigger_mode: "fixed",
    random_chance_percent: 0,
    linked_only: true,
    season_number: Number(marker.season_number ?? 1) || 1,
    chapter_number: Number(marker.chapter_number ?? 1) || 1,
    is_active: true,
    created_by: marker.created_by,
    created_at: marker.created_at ?? now,
    updated_at: marker.updated_at ?? now,
  };
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  headerText: {
    flex: 1,
  },
  brand: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 19,
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 3,
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
  },
  adminViewTool: {
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 12,
  },
  adminViewToolHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  adminViewToolCopy: {
    flex: 1,
    minWidth: 220,
    gap: 4,
  },
  viewModeControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  viewModeButton: {
    minHeight: 38,
    minWidth: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  toolButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 11,
    justifyContent: "center",
    backgroundColor: "rgba(8, 8, 7, 0.9)",
  },
  toolActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.7)",
  },
  toolText: {
    color: colors.gold,
    fontWeight: "800",
    fontSize: 12,
  },
  markerType: {
    color: colors.goldSoft,
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "900",
  },
  markerName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
    marginTop: 2,
  },
  playerInitial: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  panel: {
    marginHorizontal: 12,
    marginTop: 12,
    padding: 14,
    gap: 10,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
    flexShrink: 1,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: "uppercase",
  },
  gpsButton: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  gpsActive: {
    backgroundColor: colors.blue,
  },
  gpsText: {
    color: "#120e08",
    fontWeight: "900",
  },
  routePicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  routeChip: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  routeChipActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.7)",
  },
  routeChipLocked: {
    opacity: 0.45,
    borderStyle: "dashed",
  },
  routeChipText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 12,
  },
  gpsMessage: {
    color: colors.muted,
    lineHeight: 20,
  },
  journeyHud: {
    borderColor: "rgba(218, 164, 65, 0.42)",
    backgroundColor: "rgba(5, 8, 9, 0.96)",
    shadowColor: colors.blue,
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  journeyActionBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  journeyTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  journeyTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  journeyOverline: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 13,
    textTransform: "uppercase",
  },
  journeyTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 20,
    marginTop: 2,
  },
  journeySub: {
    color: colors.goldSoft,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  journeyRouteImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: "rgba(13, 19, 21, 0.88)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  journeyRoutePhoto: {
    width: "100%",
    height: "100%",
  },
  journeyRouteInitial: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 32,
  },
  journeyProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  journeyProgressTrack: {
    flex: 1,
    minWidth: 0,
  },
  journeyQuestCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(24, 178, 242, 0.25)",
    backgroundColor: "rgba(24, 178, 242, 0.075)",
    padding: 11,
    gap: 5,
  },
  journeyQuestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  journeyQuestLabel: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  journeyQuestMeta: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
  },
  journeyQuestTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  journeyQuestText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  journeyDestination: {
    marginTop: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(218, 164, 65, 0.24)",
    backgroundColor: "rgba(0,0,0,0.22)",
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  journeyDestinationCopy: {
    flex: 1,
    minWidth: 0,
  },
  journeyDestinationLabel: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  journeyDestinationTitle: {
    color: colors.text,
    fontWeight: "900",
    marginTop: 1,
  },
  journeyDestinationType: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 1,
  },
  journeyPercent: {
    color: colors.gold,
    width: 44,
    flexShrink: 0,
    textAlign: "right",
    fontWeight: "900",
  },
  journeyStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  journeyStat: {
    flex: 1,
    minWidth: 86,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(218, 164, 65, 0.22)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  journeyStatValue: {
    color: colors.text,
    fontWeight: "900",
    textAlign: "center",
  },
  journeyStatLabel: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
  },
  journeyResources: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  journeyResource: {
    flex: 1,
    minWidth: 112,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.22)",
    padding: 8,
    gap: 6,
  },
  journeyResourceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  journeyResourceLabel: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  journeyResourceValue: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
  },
  journeyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  journeyPrimary: {
    flex: 1,
    minWidth: 170,
    minHeight: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  journeyPrimaryText: {
    color: "#110e08",
    fontWeight: "900",
    textTransform: "uppercase",
  },
  journeySecondary: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  journeySecondaryText: {
    color: colors.blue,
    fontWeight: "900",
  },
  journeyDebugGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  journeyDebug: {
    color: colors.muted,
    fontSize: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  walkingNotice: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(24, 178, 242, 0.28)",
    backgroundColor: "rgba(24, 178, 242, 0.08)",
    padding: 10,
    gap: 4,
  },
  walkingNoticeTitle: {
    color: colors.blue,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 11,
  },
  walkingNoticeText: {
    color: colors.muted,
    lineHeight: 19,
    fontSize: 12,
  },
  mapInventoryDrawer: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(218, 164, 65, 0.28)",
    padding: 10,
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  closeCircleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  closeCircleText: {
    color: colors.gold,
    fontWeight: "900",
  },
  consumableGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  consumableCard: {
    width: 104,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 8,
    gap: 6,
    backgroundColor: "rgba(8, 12, 13, 0.92)",
  },
  consumableImageWrap: {
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  consumableImage: {
    width: "100%",
    height: "100%",
  },
  consumablePlaceholder: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  consumableQty: {
    position: "absolute",
    right: 4,
    top: 4,
    minWidth: 20,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.72)",
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  consumableName: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 12,
    minHeight: 30,
  },
  consumableMeta: {
    color: colors.muted,
    fontSize: 10,
    minHeight: 24,
  },
  consumableUseButton: {
    minHeight: 32,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  consumableUseText: {
    color: "#110e08",
    fontWeight: "900",
    fontSize: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingBottom: 8,
  },
  infoLabel: {
    color: colors.muted,
    flex: 1,
  },
  infoValue: {
    color: colors.text,
    fontWeight: "800",
    flex: 1.2,
    textAlign: "right",
  },
  feedItem: {
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  routeList: {
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  markerTableRow: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  markerTableInfo: {
    gap: 4,
  },
  legendTemplateChip: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  markerTableActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modeButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  adminMessage: {
    color: colors.blue,
    fontWeight: "800",
    lineHeight: 20,
  },
  debugLine: {
    color: colors.goldSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  secondaryText: {
    color: colors.blue,
    fontWeight: "900",
  },
  secondaryButtonFlex: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  disabledAction: {
    opacity: 0.45,
  },
  resourceBars: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  battleInventory: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  revivePrompt: {
    gap: 10,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(62, 15, 15, 0.34)",
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  typeSelected: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.7)",
  },
  typeText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 12,
  },
  linkedPathNotice: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: 10,
    padding: 12,
    backgroundColor: "rgba(20, 61, 86, 0.24)",
  },
  linkedPathWarning: {
    borderColor: "#f0a0a0",
    backgroundColor: "rgba(62, 15, 15, 0.22)",
  },
  linkedPathNoticeHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  linkedPathBadge: {
    color: colors.blue,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  linkedPathPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(218,164,65,0.1)",
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.text,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  flexInput: {
    flex: 1,
    minWidth: 150,
  },
  inlineInput: {
    minWidth: 190,
    flex: 1,
  },
  multiInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  primaryText: {
    color: "#120e08",
    fontWeight: "900",
  },
  pathEditor: {
    gap: 10,
  },
  storyEditor: {
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  shopPanel: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.42)",
    backgroundSize: "cover",
    backgroundPosition: "center",
  } as object,
  storyRoutePicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  storyCard: {
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  storyCardActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.35)",
  },
  marketGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  marketHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  marketGoldPill: {
    minWidth: 128,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(218,164,65,0.1)",
    alignItems: "flex-end",
  },
  marketCard: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 240,
    maxWidth: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  marketImageBox: {
    width: "100%",
    aspectRatio: 1.45,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(218,164,65,0.08)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  marketItemImage: {
    width: "100%",
    height: "100%",
  },
  marketItemFallback: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 30,
  },
  marketCardBody: {
    gap: 5,
  },
  marketItemName: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 17,
  },
  marketItemType: {
    color: colors.muted,
    fontSize: 12,
    textTransform: "capitalize",
  },
  marketPriceRow: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(218,164,65,0.08)",
  },
  marketPriceLabel: {
    color: colors.muted,
    fontWeight: "800",
    textTransform: "uppercase",
    fontSize: 11,
  },
  marketBuyPrice: {
    color: colors.gold,
    fontWeight: "900",
  },
  marketSellPrice: {
    color: colors.blue,
    fontWeight: "900",
  },
  marketStockText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  marketActionButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  marketSellButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,61,86,0.28)",
  },
  lockedCard: {
    borderStyle: "dashed",
    opacity: 0.68,
  },
  lockText: {
    color: "#f0a0a0",
    fontWeight: "800",
    lineHeight: 18,
  },
  unlockText: {
    color: colors.blue,
    fontWeight: "800",
  },
  builderStatus: {
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    backgroundColor: "rgba(232, 181, 94, 0.08)",
  },
  choicePreviewList: {
    gap: 6,
  },
  choicePreview: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(232, 181, 94, 0.25)",
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  choicePreviewTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
  },
  choicePreviewAction: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  flowPreview: {
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(54, 171, 224, 0.42)",
    padding: 10,
    backgroundColor: "rgba(9, 22, 32, 0.5)",
  },
  flowStep: {
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  flowStepTitle: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 13,
  },
  flowDialogue: {
    color: colors.muted,
    lineHeight: 18,
    fontSize: 12,
  },
  flowChoice: {
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(232, 181, 94, 0.25)",
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  flowChoiceText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
  },
  flowTarget: {
    color: colors.blue,
    fontWeight: "800",
    fontSize: 12,
  },
  flowWarning: {
    color: "#ffb4aa",
    fontWeight: "900",
    fontSize: 12,
  },
  adminActions: {
    gap: 10,
    paddingTop: 6,
  },
  selectedTitle: {
    color: colors.gold,
    fontWeight: "900",
  },
  dangerButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ffb4aa",
  },
  dangerText: {
    color: "#ffb4aa",
    fontWeight: "900",
  },
  battleArena: {
    minHeight: 340,
    justifyContent: "space-between",
    gap: 18,
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  battleScreenFrame: {
    overflow: "hidden",
  },
  battleBackdrop: {
    gap: 10,
    padding: 10,
    paddingTop: 12,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  battleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  phasePill: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(7, 16, 22, 0.82)",
  },
  phaseText: {
    color: colors.blue,
    fontWeight: "900",
    fontSize: 12,
  },
  enemyPanel: {
    alignSelf: "flex-end",
    width: "84%",
    maxWidth: 360,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 180, 170, 0.52)",
    padding: 9,
    backgroundColor: "rgba(12, 8, 8, 0.58)",
    shadowColor: "#ff6d63",
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  playerPanel: {
    alignSelf: "flex-start",
    width: "84%",
    maxWidth: 360,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(54, 171, 224, 0.5)",
    padding: 9,
    backgroundColor: "rgba(6, 16, 24, 0.62)",
    shadowColor: colors.blue,
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  combatantActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.68)",
    shadowColor: colors.blue,
    shadowOpacity: 0.42,
    shadowRadius: 16,
  },
  combatantInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  combatantName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
  combatantSub: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  combatImageWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  combatImageHit: {
    transform: [{ scale: 1.04 }],
    shadowColor: colors.red,
    shadowOpacity: 0.48,
    shadowRadius: 14,
  },
  enemyImage: {
    width: 126,
    height: 126,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ffb4aa",
  },
  enemyImagePlaceholder: {
    width: 126,
    height: 126,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ffb4aa",
    backgroundColor: "rgba(100, 20, 20, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  battlePortrait: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: colors.blue,
  },
  enemyIntentBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  enemyIntentLabel: {
    color: "#ffb4aa",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  enemyIntentText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 1,
  },
  abilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  battleUtilityRow: {
    flexDirection: "row",
    gap: 8,
  },
  inventoryBattleButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(54, 171, 224, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6, 23, 34, 0.58)",
  },
  fleeBattleButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 180, 170, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(62, 15, 15, 0.4)",
  },
  battleResultPanel: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(9, 15, 13, 0.86)",
  },
  battleLogPanel: {
    gap: 7,
    borderWidth: 1,
    borderColor: "rgba(232, 181, 94, 0.22)",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  battleLogTitle: {
    color: colors.gold,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  battleLogLine: {
    color: colors.text,
    lineHeight: 18,
    fontSize: 12,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingTop: 6,
  },
  errorText: {
    color: colors.red,
    fontWeight: "800",
    fontSize: 11,
  },
});


