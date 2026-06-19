import { distance as turfDistance } from "@turf/turf";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AdminImageUploadButton } from "../components/admin/AdminImageUploadButton";
import { BattleActionCard, CombatIndicatorStack, ResourceMeter, type CombatIndicator } from "../components/battle/BattleDisplay";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { AdminCoordinatePanel } from "../components/map/AdminCoordinatePanel";
import { AdminMapEditorHeader } from "../components/map/AdminMapEditorHeader";
import { MiniMapCanvas, OverworldMapCanvas, type MapViewportRef } from "../components/map/MapCanvas";
import { MarkerIcon } from "../components/map/MarkerIcon";
import { MarkerInteractionPanel } from "../components/map/MarkerInteractionPanel";
import { LegendEditor } from "../components/map/LegendEditor";
import { MarkerAdminList } from "../components/map/MarkerAdminList";
import { MarkerLegend } from "../components/map/MarkerLegend";
import { MarkerSceneScreen } from "../components/map/MarkerSceneScreen";
import { MiniMapEditor } from "../components/map/MiniMapEditor";
import { WalkingPathAdminPanel } from "../components/map/WalkingPathAdminPanel";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { CharacterWithDetails, updateCharacterHealth } from "../services/characterService";
import { AbilityDefinition, CharacterResources, clampHealth, getCharacterResources, getCombatLoadout, getCurrentHealth } from "../services/abilityService";
import { CombatAbility, EnemyDefinition, EnemyWithLoadout, getEnemies, getEnemyLoadout, getNpcLoadout, getNpcs, NpcDefinition, NpcWithLoadout, resolveEnemyImageUri } from "../services/combatAdminService";
import { canUseItemInContext, consumeInventoryItem, getBattleUsableItems, getInventoryResourceBonuses, getInventoryState, grantItemToCharacter, InventoryItem, ItemDefinition, isReviveBattleItem, resolveInventoryImageUri } from "../services/inventoryService";
import { recordEnemyKill } from "../services/progressionService";
import { chooseWeightedEnemyAbility, classifyMovement, metersPerSecondToMph, movementSpeedThresholdMph, rollD20Attack } from "../utils/combatMath";
import { clamp, getPercentDistance, getPointOnRoute, getRouteSegments, MAP_SIZE as mapSize, roundPercent } from "../utils/mapGeometry";
import {
  canPlayerSeeMarker,
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
  applyRewards,
  buyMarketItem,
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
  getMarkerLegendItems,
  getMarkerRouteLinks,
  getMiniMaps,
  getTutorialSteps,
  getDialogueChoices,
  getDialogueNodes,
  getEventCompletions,
  getStoryMarkerCompletions,
  getRouteProgress,
  getRouteProgressForRoutes,
  MapMarker,
  MapEvent,
  MapRoute,
  MapChapter,
  MapSeason,
  MarkerMarketItem,
  marketListingModes,
  MarkerLegendItem,
  MarkerRouteLink,
  MiniMap,
  Role,
  resetRouteProgress,
  StoryDialogueChoice,
  StoryDialogueNode,
  saveMarkerMarketItem,
  saveMarkerLegendItem,
  saveMarkerRouteLinks,
  saveMiniMap,
  saveMapChapter,
  saveMapSeason,
  saveRouteProgress,
  saveTutorialStep,
  setCurrentRoute,
  sellMarketInventoryItem,
  TutorialStep,
  updateDialogueChoice,
  updateDialogueNode,
  updateMapEvent,
  updateMapMarker,
  updateMarkerSettings,
  updateMapRoute,
} from "../services/mapService";

const forgottenMarches = require("../../assets/TheForgottenMarches.png");
const markerTypes = ["Story", "Side Quest", "Market", "Point of Interest", "Battle Zone", "Training Spot", "Area/Town Entrance", "Sign Post", "Player Spawn"];
const miniMapMarkerTypes = ["Player Spawn", "Sign Post", "Story", "Quest", "Side Quest", "Point of Interest", "Market", "Battle", "Training", "Dungeon Room", "Exit", "Exit/Leave"];
const exitTargetTypes = ["world_marker", "mini_map"] as const;
const legendMarkerTypes = Array.from(new Set([...markerTypes, ...miniMapMarkerTypes, "Custom"]));
const editorModes = ["Marker", "Walking Path"] as const;
const adminSections = ["World Markers", "Area/Town Markers", "Mini Maps", "Walking Paths", "Tutorials", "Rewards/Interactions", "Legend"] as const;
const miniMapTypes = ["town", "forest", "dungeon", "area", "tutorial"] as const;
const eventTypes = ["dialogue", "battle", "clue", "reward"] as const;
const eventTriggerModes = ["fixed", "random"] as const;
const lockTypes = ["public", "story_locked", "quest_locked"] as const;
const lockTypeLabels: Record<(typeof lockTypes)[number], string> = {
  public: "Public",
  story_locked: "Story Locked",
  quest_locked: "Quest Locked",
};
const rewardTimings = ["on_interact", "on_path_complete"] as const;
const rewardTimingLabels: Record<(typeof rewardTimings)[number], string> = {
  on_interact: "When Interacted",
  on_path_complete: "After Linked Path Completion",
};
const choiceActions = ["Continue", "Investigate", "Ask Questions", "Start Battle", "Complete Event"] as const;
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

export function MapScreen({ character, onCharacterUpdated }: MapScreenProps) {
  const [route, setRoute] = useState<MapRoute>(fallbackRoute);
  const [routes, setRoutes] = useState<MapRoute[]>([fallbackRoute]);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [legendItems, setLegendItems] = useState<MarkerLegendItem[]>([]);
  const [legendOpen, setLegendOpen] = useState(false);
  const [mapEvents, setMapEvents] = useState<MapEvent[]>([]);
  const [allMapEvents, setAllMapEvents] = useState<MapEvent[]>([]);
  const [completedEventIds, setCompletedEventIds] = useState<Set<string>>(new Set());
  const [completedStoryMarkerIds, setCompletedStoryMarkerIds] = useState<Set<string>>(new Set());
  const [activeEvent, setActiveEvent] = useState<MapEvent | null>(null);
  const [activeBattle, setActiveBattle] = useState<MapEvent | null>(null);
  const [adminPreviewMode, setAdminPreviewMode] = useState<"story" | "battle" | null>(null);
  const [dialogueNodes, setDialogueNodes] = useState<StoryDialogueNode[]>([]);
  const [dialogueChoices, setDialogueChoices] = useState<StoryDialogueChoice[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [dialogueLog, setDialogueLog] = useState<string[]>([]);
  const [battlePlayerHp, setBattlePlayerHp] = useState(100);
  const [battleStamina, setBattleStamina] = useState(0);
  const [battleMagicka, setBattleMagicka] = useState(0);
  const [battleEnemyHp, setBattleEnemyHp] = useState(0);
  const [battleEnemyStamina, setBattleEnemyStamina] = useState(0);
  const [battleEnemyMagika, setBattleEnemyMagika] = useState(0);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [battleFinished, setBattleFinished] = useState<"victory" | "defeat" | null>(null);
  const [revivePromptOpen, setRevivePromptOpen] = useState(false);
  const [activeEnemy, setActiveEnemy] = useState<EnemyWithLoadout | NpcWithLoadout | null>(null);
  const [combatIndicators, setCombatIndicators] = useState<CombatIndicator[]>([]);
  const [combatResources, setCombatResources] = useState<CharacterResources>(() => getCharacterResources(character));
  const [equippedAbilities, setEquippedAbilities] = useState<Array<AbilityDefinition | null>>([null, null, null, null]);
  const [enemyDefinitions, setEnemyDefinitions] = useState<EnemyDefinition[]>([]);
  const [npcDefinitions, setNpcDefinitions] = useState<NpcDefinition[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [itemDefinitions, setItemDefinitions] = useState<ItemDefinition[]>([]);
  const [equippedItems, setEquippedItems] = useState<Record<string, ItemDefinition | null>>({});
  const [battleInventoryOpen, setBattleInventoryOpen] = useState(false);
  const [mapInventoryOpen, setMapInventoryOpen] = useState(false);
  const [mapItemMessage, setMapItemMessage] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("player");
  const [adminMapViewMode, setAdminMapViewMode] = useState<"admin" | "player">("admin");
  const currentHealth = getCurrentHealth(character, combatResources);
  const [distanceWalked, setDistanceWalked] = useState(0);
  const [savedPlayerPosition, setSavedPlayerPosition] = useState<{ x: number; y: number } | null>(null);
  const [lastPosition, setLastPosition] = useState<Coordinate | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [gpsMessage, setGpsMessage] = useState("GPS is off. Start tracking to count real-world walking distance.");
  const [playerMovementState, setPlayerMovementState] = useState<PlayerMovementState>("IDLE");
  const [movementStatus, setMovementStatus] = useState<MovementStatus>({
    label: "IDLE",
    speedMph: 0,
    countedMeters: 0,
    blockedReason: null,
  });
  const [routeProgressRows, setRouteProgressRows] = useState<Array<{ route_id: string; progress_percent: number; is_current?: boolean }>>([]);
  const [routeDirection, setRouteDirection] = useState<"forward" | "reverse">("forward");
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [activeMiniMap, setActiveMiniMap] = useState<MiniMap | null>(null);
  const [clickedPercent, setClickedPercent] = useState<{ x: number; y: number } | null>(null);
  const [adminSection, setAdminSection] = useState<(typeof adminSections)[number]>("World Markers");
  const [miniMaps, setMiniMaps] = useState<MiniMap[]>([]);
  const [mapSeasons, setMapSeasons] = useState<MapSeason[]>([]);
  const [mapChapters, setMapChapters] = useState<MapChapter[]>([]);
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
  const [miniMapActive, setMiniMapActive] = useState(true);
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
  const [markerInteractionRadius, setMarkerInteractionRadius] = useState("4");
  const [markerInteractable, setMarkerInteractable] = useState(true);
  const [markerRewardXp, setMarkerRewardXp] = useState("0");
  const [markerRewardGold, setMarkerRewardGold] = useState("0");
  const [markerRewardItemId, setMarkerRewardItemId] = useState<string | null>(null);
  const [markerRewardQuantity, setMarkerRewardQuantity] = useState("1");
  const [markerRewardTiming, setMarkerRewardTiming] = useState<MapMarker["reward_timing"]>("on_interact");
  const [markerRepeatable, setMarkerRepeatable] = useState(false);
  const [markerRewardOnce, setMarkerRewardOnce] = useState(true);
  const [markerLinkedRouteId, setMarkerLinkedRouteId] = useState<string | null>(null);
  const [markerStartsRouteOnAccept, setMarkerStartsRouteOnAccept] = useState(false);
  const [markerExitTargetType, setMarkerExitTargetType] = useState<MapMarker["exit_target_type"]>("world_marker");
  const [markerExitTargetMarkerId, setMarkerExitTargetMarkerId] = useState<string | null>(null);
  const [markerExitTargetMiniMapId, setMarkerExitTargetMiniMapId] = useState<string | null>(null);
  const [markerLockType, setMarkerLockType] = useState<MapMarker["lock_type"]>("public");
  const [markerLockMessage, setMarkerLockMessage] = useState("");
  const [markerStoryOrder, setMarkerStoryOrder] = useState("0");
  const [markerUnlockAfterId, setMarkerUnlockAfterId] = useState<string | null>(null);
  const [markerHideWhenCompleted, setMarkerHideWhenCompleted] = useState(true);
  const [markerRequireAllLinkedRoutes, setMarkerRequireAllLinkedRoutes] = useState(true);
  const [markerMarketItems, setMarkerMarketItems] = useState<MarkerMarketItem[]>([]);
  const [marketPurchaseCounts, setMarketPurchaseCounts] = useState<Record<string, number>>({});
  const [markerRouteLinks, setMarkerRouteLinks] = useState<MarkerRouteLink[]>([]);
  const [selectedMarkerRouteIds, setSelectedMarkerRouteIds] = useState<string[]>([]);
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
  const [reuseEventId, setReuseEventId] = useState<string | null>(null);
  const [reuseEventOpen, setReuseEventOpen] = useState(false);
  const [selectedDialogueEventId, setSelectedDialogueEventId] = useState<string | null>(null);
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
  const [choiceSortOrder, setChoiceSortOrder] = useState("0");
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [scale, setScale] = useState(0.86);
  const [followPlayer, setFollowPlayer] = useState(true);
  const [completedRouteId, setCompletedRouteId] = useState<string | null>(null);
  const viewportRef = useRef<MapViewportRef | null>(null);
  const watchId = useRef<number | null>(null);
  const distanceWalkedRef = useRef(0);
  const routeRef = useRef(fallbackRoute);
  const routeDirectionRef = useRef<"forward" | "reverse">("forward");
  const movementStateRef = useRef<PlayerMovementState>("IDLE");
  const movementCandidateRef = useRef<{ state: PlayerMovementState; since: number } | null>(null);
  const lastCaptureRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const actualIsAdmin = role === "admin";
  const isAdmin = actualIsAdmin && adminMapViewMode === "admin";
  const isAdminPlayerPreview = actualIsAdmin && adminMapViewMode === "player";
  const scaledMapSize = useMemo(() => ({ width: mapSize.width * scale, height: mapSize.height * scale }), [scale]);

  const progressPercent = Math.min(100, Math.max(0, (distanceWalked / route.distance_required_meters) * 100));
  const orderedRoutes = useMemo(() => [...routes].sort(compareRoutes), [routes]);
  const adminRoutes = useMemo(() => orderedRoutes.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter)), [orderedRoutes, selectedChapter, selectedSeason]);
  const adminWorldRoutes = useMemo(() => adminRoutes.filter((item) => !item.mini_map_id), [adminRoutes]);
  const adminMiniMapRoutes = useMemo(() => adminRoutes.filter((item) => item.mini_map_id === activeMiniMap?.id), [activeMiniMap?.id, adminRoutes]);
  const activeRouteScopeRoutes = activeMiniMap ? adminMiniMapRoutes : adminWorldRoutes;
  const routeProgressPosition = useMemo(() => getPointOnRoute(route.path_points, progressPercent), [route.path_points, progressPercent]);
  const playerPosition = savedPlayerPosition ?? routeProgressPosition;
  const routeSegments = useMemo(() => getRouteSegmentsForRoutes(isAdmin ? adminWorldRoutes : route.mini_map_id ? [] : [route], route.id), [adminWorldRoutes, isAdmin, route]);
  const miniMapRouteSegments = useMemo(() => getRouteSegmentsForRoutes(isAdmin ? adminMiniMapRoutes : route.mini_map_id === activeMiniMap?.id ? [route] : [], route.id), [activeMiniMap?.id, adminMiniMapRoutes, isAdmin, route]);
  const draftSegments = useMemo(() => getRouteSegments(pathDraft).map((segment) => ({ ...segment, id: `draft-${segment.left}-${segment.top}`, isActive: true, isDraft: true })), [pathDraft]);
  const worldMarkers = useMemo(() => markers.filter((marker) => !marker.mini_map_id), [markers]);
  const miniMapMarkers = useMemo(() => markers.filter((marker) => marker.mini_map_id === activeMiniMap?.id), [markers, activeMiniMap?.id]);
  const miniMapSpawnMarker = useMemo(() => miniMapMarkers.find((marker) => marker.type === "Player Spawn") ?? null, [miniMapMarkers]);
  const miniMapSpawnPosition = miniMapSpawnMarker ? { x: Number(miniMapSpawnMarker.x_percent), y: Number(miniMapSpawnMarker.y_percent) } : { x: 50, y: 50 };
  const miniMapPlayerPosition = route.mini_map_id === activeMiniMap?.id ? playerPosition : miniMapSpawnPosition;
  const currentInteractionPosition = activeMiniMap ? miniMapPlayerPosition : playerPosition;
  const adminWorldMarkers = useMemo(() => worldMarkers.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter)), [selectedChapter, selectedSeason, worldMarkers]);
  const adminMiniMapMarkers = useMemo(() => miniMapMarkers.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter)), [miniMapMarkers, selectedChapter, selectedSeason]);
  const adminStoryMarkers = useMemo(() => markers.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter) && isStoryQuestMarker(item)), [markers, selectedChapter, selectedSeason]);
  const adminMiniMaps = useMemo(() => miniMaps.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter)), [miniMaps, selectedChapter, selectedSeason]);
  const adminTutorialSteps = useMemo(() => tutorialSteps.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter)), [selectedChapter, selectedSeason, tutorialSteps]);
  const adminLegendItems = useMemo(() => legendItems.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter)), [legendItems, selectedChapter, selectedSeason]);
  const adminMapEvents = useMemo(() => mapEvents.filter((item) => isInSelectedChapter(item, selectedSeason, selectedChapter)), [mapEvents, selectedChapter, selectedSeason]);
  const availableSeasons = useMemo(() => mergeSeasonRecords(mapSeasons, getAvailableNumbers([routes, markers, miniMaps, tutorialSteps, legendItems, mapEvents].flat(), "season_number")), [legendItems, mapEvents, mapSeasons, markers, miniMaps, routes, tutorialSteps]);
  const availableChapters = useMemo(
    () => mergeChapterRecords(
      mapChapters.filter((chapter) => Number(chapter.season_number) === selectedSeason),
      getAvailableNumbers([routes, markers, miniMaps, tutorialSteps, legendItems, mapEvents].flat().filter((item) => Number(item.season_number ?? 1) === selectedSeason), "chapter_number"),
      selectedSeason,
    ),
    [legendItems, mapChapters, mapEvents, markers, miniMaps, routes, selectedSeason, tutorialSteps],
  );
  const visibleMarkers = isAdmin ? worldMarkers : worldMarkers.filter((marker) => canPlayerSeeMarker(marker, playerPosition) && canPlayerSeeStoryMarker(marker, markers, completedStoryMarkerIds));
  const visibleMiniMapMarkers = isAdmin ? adminMiniMapMarkers : miniMapMarkers.filter((marker) => canPlayerSeeMarker(marker, miniMapPlayerPosition) && canPlayerSeeStoryMarker(marker, markers, completedStoryMarkerIds));
  const selectedDialogueEvent = useMemo(() => mapEvents.find((event) => event.id === selectedDialogueEventId) ?? null, [mapEvents, selectedDialogueEventId]);
  const selectedChoiceNode = useMemo(() => dialogueNodes.find((node) => node.id === choiceNodeId) ?? null, [choiceNodeId, dialogueNodes]);
  const selectedNodeChoices = useMemo(
    () => (choiceNodeId ? dialogueChoices.filter((choice) => choice.node_id === choiceNodeId).sort((a, b) => a.sort_order - b.sort_order) : []),
    [choiceNodeId, dialogueChoices],
  );
  const selectedMarkerDistance = selectedMarker ? getPercentDistance(currentInteractionPosition, { x: Number(selectedMarker.x_percent), y: Number(selectedMarker.y_percent) }) : 0;
  const selectedMarkerRadius = Number(selectedMarker?.interaction_radius_percent ?? 4) || 4;
  const canUseSelectedMarker = isAdmin || Boolean(selectedMarker && canPlayerSeeMarker(selectedMarker, currentInteractionPosition));
  const selectedMarkerLocked = !isAdmin && Boolean(selectedMarker && isMarkerLocked(selectedMarker));
  const selectedMiniMap = useMemo(() => miniMaps.find((miniMap) => miniMap.id === selectedMiniMapId) ?? null, [miniMaps, selectedMiniMapId]);
  const activeSectionMarkerTypes = adminSection === "Area/Town Markers" ? ["Area/Town Entrance"] : markerTypes;
  const routeEvents = useMemo(() => mapEvents.filter((event) => event.route_id === route.id), [mapEvents, route.id]);
  const reusableMapEvents = useMemo(() => allMapEvents.filter((event) => isInSelectedChapter(event, selectedSeason, selectedChapter)), [allMapEvents, selectedChapter, selectedSeason]);
  const completedRouteEvents = useMemo(() => routeEvents.filter((event) => completedEventIds.has(event.id)).length, [completedEventIds, routeEvents]);
  const routePotentialXp = useMemo(() => routeEvents.reduce((total, event) => total + Number(event.reward_xp ?? 0), 0), [routeEvents]);
  const routePotentialGold = useMemo(() => routeEvents.reduce((total, event) => total + Number(event.reward_gold ?? 0), 0), [routeEvents]);
  const mapConsumables = useMemo(
    () =>
      inventoryItems.filter(
        (entry) =>
          entry.quantity > 0 &&
          ["potion", "revive potion", "consumable", "food"].includes(entry.item.type) &&
          canUseItemInContext(entry.item, "outside"),
      ),
    [inventoryItems],
  );

  useEffect(() => {
    void loadMap();
    void loadCombatLoadout();
    void loadInventory();
    void loadEnemies();

    return () => {
      if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
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
    routeDirectionRef.current = routeDirection;
  }, [routeDirection]);

  useEffect(() => {
    if (routeDirection === "reverse" || progressPercent < 100 || completedRouteId === route.id) {
      return;
    }

    setCompletedRouteId(route.id);
    setGpsMessage(`${route.name} completed. Return to a Sign Post to choose your next path.`);
    void grantPathCompletionMarkerReward(route.id);
  }, [completedRouteId, progressPercent, route, routeDirection]);

  useEffect(() => {
    if (activeEvent || activeBattle || routeDirection === "reverse" || playerMovementState !== "MOVING") {
      return;
    }

    const eligibleEvents = mapEvents.filter(
      (event) =>
        event.is_active &&
        !event.linked_only &&
        event.route_id === route.id &&
        !completedEventIds.has(event.id) &&
        Number(event.distance_marker_percent) <= progressPercent,
    );
    const fixedEvent = eligibleEvents.find((event) => (event.trigger_mode ?? "fixed") !== "random");
    const randomEvents = eligibleEvents.filter((event) => (event.trigger_mode ?? "fixed") === "random");
    const randomEvent = randomEvents.find((event) => Math.random() * 100 < Number(event.random_chance_percent ?? 0));
    const nextEvent = fixedEvent ?? randomEvent;

    if (!nextEvent) {
      return;
    }

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
      setActiveNodeId(null);
      setDialogueLog([]);
      return;
    }

    void loadDialogueForEvent(activeEvent);
  }, [activeEvent]);

  async function loadMap() {
    const [loadedRoutes, loadedMarkers, loadedMiniMaps, loadedTutorials, loadedLegendItems, loadedSeasons, loadedChapters, loadedRole, loadedEvents] = await Promise.all([
      getMapRoutes(),
      getMapMarkers(),
      getMiniMaps(),
      getTutorialSteps(),
      getMarkerLegendItems(),
      getMapSeasons(),
      getMapChapters(),
      getCurrentRole(),
      getMapEvents(),
    ]);
    const nextRoutes = [...loadedRoutes].sort(compareRoutes);
    const progressRows = await getRouteProgressForRoutes(nextRoutes.map((item) => item.id));
    const storyCompletions = await getStoryMarkerCompletions(loadedMarkers.filter(isStoryQuestMarker).map((item) => item.id));
    const currentProgressRow = progressRows.find((row) => row.is_current);
    const currentRoute = nextRoutes.find((item) => item.id === currentProgressRow?.route_id) ?? null;
    const firstRoute = currentRoute ?? nextRoutes.find((item) => item.is_active) ?? nextRoutes[0] ?? fallbackRoute;
    setRouteProgressRows(progressRows);
    setCompletedStoryMarkerIds(new Set(storyCompletions.map((completion) => completion.marker_id)));
    setRoutes(nextRoutes);
    setPathDraft([]);
    setMarkers(loadedMarkers);
    setMiniMaps(loadedMiniMaps);
    setTutorialSteps(loadedTutorials);
    setLegendItems(loadedLegendItems);
    setMapSeasons(loadedSeasons);
    setMapChapters(loadedChapters);
    setRole(loadedRole);
    setAllMapEvents(loadedEvents);
    await selectRoute(firstRoute, true);
    if (!currentRoute) {
      setGpsMessage("Choose a path from a Sign Post to begin travel.");
    }
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
    distanceWalkedRef.current = 0;
    setSavedPlayerPosition(null);
    setDistanceWalked(0);
    setRouteDirection("forward");
    setLastPosition(null);

    const [progress, events] = await Promise.all([getRouteProgress(nextRoute.id), getMapEvents(nextRoute.id)]);
    setMapEvents(events);
    const completions = await getEventCompletions(events.map((event) => event.id));
    setCompletedEventIds(new Set(completions.map((completion) => completion.event_id)));

    if (progress) {
      const savedDistance = Number(progress.distance_walked_meters);
      distanceWalkedRef.current = savedDistance;
      setDistanceWalked(savedDistance);
      setRouteDirection(progress.travel_direction ?? "forward");
      if (progress.current_x_percent !== null && progress.current_y_percent !== null) {
        setSavedPlayerPosition({ x: Number(progress.current_x_percent), y: Number(progress.current_y_percent) });
      }
    }
  }

  function startGpsTracking() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsMessage("Geolocation is not available in this browser.");
      return;
    }

    if (watchId.current !== null) {
      return;
    }

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
          void saveRouteProgress(activeRoute.id, {
            distance_walked_meters: nextDistance,
            progress_percent: nextProgress,
            current_x_percent: nextMapPosition.x,
            current_y_percent: nextMapPosition.y,
            last_lat: next.latitude,
            last_lng: next.longitude,
            travel_direction: direction,
            is_current: true,
          });
          setGpsMessage(direction === "reverse" && nextDistance <= 0
            ? "You returned to the starting sign post."
            : `State: MOVING. ${direction === "reverse" ? "Backtracked" : "Counted"} ${Math.round(cleanMeters)}m at ${speedMph.toFixed(1)} mph.`);

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
    setIsTracking(false);
    setLastPosition(null);
    movementStateRef.current = "IDLE";
    movementCandidateRef.current = null;
    setPlayerMovementState("IDLE");
    setGpsMessage("GPS paused. Route progress is saved in Supabase.");
    setMovementStatus((current) => ({ ...current, label: "IDLE", speedMph: 0, countedMeters: 0 }));
  }

  function zoomBy(delta: number) {
    setScale((current) => clamp(current + delta, 0.5, 2.7));
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
    setSelectedMarker(null);
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

    try {
      const created = await createMapMarker({
        type: draftType,
        title: draftTitle.trim(),
        description: draftDescription.trim() || null,
        x_percent: clickedPercent.x,
        y_percent: clickedPercent.y,
        is_active: true,
        is_unlocked: true,
        route_id: isMiniMapMarker ? null : route.id,
        quest_key: null,
        linked_mini_map_id: draftType === "Area/Town Entrance" ? selectedMiniMapId : (draftType === "Exit" || draftType === "Exit/Leave") && markerExitTargetType === "mini_map" ? markerExitTargetMiniMapId : null,
        mini_map_id: activeMiniMapId,
        parent_marker_id: isMiniMapMarker ? selectedMarker?.id ?? null : null,
        exit_target_type: draftType === "Exit" || draftType === "Exit/Leave" ? markerExitTargetType : null,
        exit_target_marker_id: draftType === "Exit" || draftType === "Exit/Leave" ? markerExitTargetMarkerId : null,
        linked_route_id: isQuestMarkerType(draftType) ? markerLinkedRouteId : null,
        starts_route_on_accept: isQuestMarkerType(draftType) && markerStartsRouteOnAccept,
        icon_label: markerIconLabel.trim() || null,
        icon_image_url: markerIconImage.trim() || null,
        icon_color: markerIconColor.trim() || null,
        lock_type: markerLockType,
        lock_message: markerLockMessage.trim() || null,
        story_order: Number(markerStoryOrder) || 0,
        unlock_after_marker_id: markerUnlockAfterId,
        hide_when_completed: markerHideWhenCompleted,
        require_all_linked_routes: markerRequireAllLinkedRoutes,
        season_number: selectedSeason,
        chapter_number: selectedChapter,
      });
      const configured = await updateMarkerSettings(created.id, getMarkerSettingsPayload());
      if (activeMiniMapId && configured.mini_map_id !== activeMiniMapId) {
        throw new Error("Mini-map marker was saved without the open mini map id. Try again after reopening the mini map.");
      }
      if (draftType === "Sign Post" || isStoryQuestMarker(configured)) {
        const links = await saveMarkerRouteLinks(configured.id, selectedMarkerRouteIds, selectedSeason, selectedChapter);
        setMarkerRouteLinks(links);
      }
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

  function getMarkerSettingsPayload() {
    const activeMiniMapId = activeMiniMap?.id ?? null;

    return {
      type: draftType,
      title: draftTitle.trim() || selectedMarker?.title || "Untitled Marker",
      description: draftDescription.trim() || null,
      is_interactable: markerInteractable,
      quest_title: markerQuestTitle.trim() || null,
      quest_dialogue: markerQuestDialogue.trim() || null,
      quest_image_url: markerQuestImage.trim() || null,
      shop_image_url: markerShopImage.trim() || null,
      shop_background_image_url: markerShopBackground.trim() || null,
      scene_background_image_url: markerSceneBackground.trim() || null,
      scene_npc_image_url: markerNpcImage.trim() || null,
      icon_label: markerIconLabel.trim() || null,
      icon_image_url: markerIconImage.trim() || null,
      icon_color: markerIconColor.trim() || null,
      lock_type: markerLockType,
      lock_message: markerLockMessage.trim() || null,
      story_order: Number(markerStoryOrder) || 0,
      unlock_after_marker_id: markerUnlockAfterId,
      hide_when_completed: markerHideWhenCompleted,
      require_all_linked_routes: markerRequireAllLinkedRoutes,
      interaction_radius_percent: Math.max(0.5, Number(markerInteractionRadius) || 4),
      reward_xp: Number(markerRewardXp) || 0,
      reward_gold: Number(markerRewardGold) || 0,
      reward_item_id: markerRewardItemId,
      reward_item_quantity: Math.max(1, Number(markerRewardQuantity) || 1),
      reward_timing: markerRewardTiming,
      repeatable: markerRepeatable,
      reward_once_per_player: markerRewardOnce,
      linked_mini_map_id: draftType === "Area/Town Entrance" ? selectedMiniMapId : (draftType === "Exit" || draftType === "Exit/Leave") && markerExitTargetType === "mini_map" ? markerExitTargetMiniMapId : null,
      mini_map_id: activeMiniMapId ?? selectedMarker?.mini_map_id ?? null,
      parent_marker_id: activeMiniMapId ? null : selectedMarker?.parent_marker_id ?? null,
      exit_target_type: draftType === "Exit" || draftType === "Exit/Leave" ? markerExitTargetType : null,
      exit_target_marker_id: draftType === "Exit" || draftType === "Exit/Leave" ? markerExitTargetMarkerId : null,
      linked_route_id: isQuestMarkerType(draftType) ? markerLinkedRouteId : null,
      starts_route_on_accept: isQuestMarkerType(draftType) && markerStartsRouteOnAccept,
      season_number: selectedSeason,
      chapter_number: selectedChapter,
    };
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
    setMarkerLockType(marker.lock_type ?? "public");
    setMarkerLockMessage(marker.lock_message ?? "");
    setMarkerStoryOrder(String(marker.story_order ?? 0));
    setMarkerUnlockAfterId(marker.unlock_after_marker_id ?? null);
    setMarkerHideWhenCompleted(marker.hide_when_completed ?? true);
    setMarkerRequireAllLinkedRoutes(marker.require_all_linked_routes ?? true);
    setMarkerInteractionRadius(String(marker.interaction_radius_percent ?? 4));
    setMarkerInteractable(marker.is_interactable ?? true);
    setMarkerRewardXp(String(marker.reward_xp ?? 0));
    setMarkerRewardGold(String(marker.reward_gold ?? 0));
    setMarkerRewardItemId(marker.reward_item_id ?? null);
    setMarkerRewardQuantity(String(marker.reward_item_quantity ?? 1));
    setMarkerRewardTiming(marker.reward_timing ?? "on_interact");
    setMarkerRepeatable(Boolean(marker.repeatable));
    setMarkerRewardOnce(marker.reward_once_per_player ?? true);
    setMarkerLinkedRouteId(marker.linked_route_id ?? null);
    setMarkerStartsRouteOnAccept(Boolean(marker.starts_route_on_accept));
    setMarkerExitTargetType(marker.exit_target_type ?? "world_marker");
    setMarkerExitTargetMarkerId(marker.exit_target_marker_id ?? null);
    setMarkerExitTargetMiniMapId(marker.exit_target_type === "mini_map" ? marker.linked_mini_map_id : null);
    setSelectedMiniMapId(marker.linked_mini_map_id ?? marker.mini_map_id ?? selectedMiniMapId);
    setMarkerPanelMessage(null);

    try {
      await loadMarkerMarketState(marker.id);
      if (marker.type === "Sign Post" || isStoryQuestMarker(marker)) {
        const links = await getMarkerRouteLinks(marker.id);
        setMarkerRouteLinks(links);
        setSelectedMarkerRouteIds(links.map((link) => link.route_id));
      } else {
        setMarkerRouteLinks([]);
        setSelectedMarkerRouteIds([]);
      }
    } catch (error) {
      setMarkerPanelMessage(getErrorMessage(error, "Unable to load marker market."));
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

    try {
      const moved = clickedPercent
        ? await updateMapMarker(selectedMarker.id, {
            x_percent: clickedPercent.x,
            y_percent: clickedPercent.y,
          })
        : selectedMarker;
      const updated = await updateMarkerSettings(moved.id, getMarkerSettingsPayload());
      if (updated.type === "Sign Post" || isStoryQuestMarker(updated)) {
        const links = await saveMarkerRouteLinks(updated.id, selectedMarkerRouteIds, selectedSeason, selectedChapter);
        setMarkerRouteLinks(links);
      }
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
        repeatable: selectedMarker.repeatable,
        rewardOncePerPlayer: selectedMarker.reward_once_per_player,
        markerId: selectedMarker.id,
      });
      if (isStoryQuestMarker(selectedMarker)) {
        await completeStoryMarker(selectedMarker.id);
        setCompletedStoryMarkerIds((current) => new Set([...current, selectedMarker.id]));
        setSelectedMarker(null);
        setPreviewMarkerScene(false);
        setMarkerPanelMessage(null);
        setGpsMessage(result.claimed ? `${selectedMarker.quest_title || selectedMarker.title} completed. ${result.message}` : `${selectedMarker.quest_title || selectedMarker.title} completed.`);
        await loadInventory();
        return;
      }
      setMarkerPanelMessage(result.message);
      await loadInventory();
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
      await loadInventory();
    } catch (error) {
      setMarkerPanelMessage(getErrorMessage(error, "Unable to complete story quest."));
    }
  }

  async function acceptSelectedMarkerQuest() {
    if (!selectedMarker) {
      return;
    }

    if (!selectedMarker.starts_route_on_accept && markerRouteLinks.length === 0) {
      await claimSelectedMarkerReward();
      return;
    }

    const orderedLinks = getOrderedMarkerRouteLinks(markerRouteLinks);
    const firstIncompleteLink = orderedLinks.find((link) => {
      const progress = routeProgressRows.find((row) => row.route_id === link.route_id)?.progress_percent ?? 0;
      return progress < 100;
    });

    if (orderedLinks.length > 0 && !firstIncompleteLink) {
      await completeSelectedStoryMarker(selectedMarker);
      return;
    }

    const routeId = firstIncompleteLink?.route_id ?? selectedMarker.linked_route_id;
    const linkedRoute = routes.find((item) => item.id === routeId);

    if (!linkedRoute) {
      setMarkerPanelMessage("This quest is linked to a walking path that could not be found.");
      return;
    }

    try {
      const startPoint = linkedRoute.path_points[0] ?? { x: 33.8, y: 73.81 };
      const targetMiniMap = linkedRoute.mini_map_id ? miniMaps.find((item) => item.id === linkedRoute.mini_map_id) ?? null : null;
      setActiveMiniMap(targetMiniMap);
      setSelectedMiniMapId(targetMiniMap?.id ?? null);
      setSelectedMarker(null);
      setPreviewMarkerScene(false);
      setMarkerPanelMessage(null);
      setRouteProgressRows((current) => upsertRouteProgressRow(current, linkedRoute.id, 0));
      await saveRouteProgress(linkedRoute.id, {
        distance_walked_meters: 0,
        progress_percent: 0,
        current_x_percent: startPoint.x,
        current_y_percent: startPoint.y,
        last_lat: null,
        last_lng: null,
        source_marker_id: selectedMarker.id,
      });
      await selectRoute(linkedRoute, true);
      setSavedPlayerPosition(startPoint);
      distanceWalkedRef.current = 0;
      setDistanceWalked(0);
      setGpsMessage(`${selectedMarker.quest_title || selectedMarker.title} accepted. ${linkedRoute.name} is now the active walking path.`);
    } catch (error) {
      setMarkerPanelMessage(getErrorMessage(error, "Unable to start linked walking path."));
    }
  }

  async function grantPathCompletionMarkerReward(routeId: string) {
    try {
      const progress = await getRouteProgress(routeId);
      if (!progress?.source_marker_id) {
        return;
      }

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
        await startLinkedStoryRoute(sourceMarker, nextRoute);
        setGpsMessage(`${route.name} completed. Next story path started: ${nextRoute.name}.`);
        return;
      }

      const result = await applyRewards(character, {
        xp: sourceMarker.reward_xp,
        gold: sourceMarker.reward_gold,
        itemId: sourceMarker.reward_item_id,
        itemQuantity: sourceMarker.reward_item_quantity,
        repeatable: sourceMarker.repeatable,
        rewardOncePerPlayer: sourceMarker.reward_once_per_player,
        markerId: sourceMarker.id,
      });

      if (isStoryQuestMarker(sourceMarker)) {
        await completeStoryMarker(sourceMarker.id);
        setCompletedStoryMarkerIds((current) => new Set([...current, sourceMarker.id]));
      }

      setGpsMessage(result.claimed ? `${route.name} completed. ${result.message}` : `${route.name} completed. ${sourceMarker.quest_title || sourceMarker.title} is now complete.`);
      await loadInventory();
    } catch (error) {
      setGpsMessage(getErrorMessage(error, "Path completed, but the linked quest reward could not be granted."));
    }
  }

  function toggleSignPostRoute(routeId: string) {
    setSelectedMarkerRouteIds((current) => current.includes(routeId) ? current.filter((id) => id !== routeId) : [...current, routeId]);
  }

  async function startPathFromSignPost(nextRoute: MapRoute) {
    if (!isAdmin && isRouteLocked(nextRoute)) {
      setMarkerPanelMessage(getRouteLockMessage(nextRoute));
      return;
    }

    const progress = await getRouteProgress(nextRoute.id);
    const existingDistance = Number(progress?.distance_walked_meters ?? 0);
    const nextProgress = Math.min(100, Math.max(0, progress?.progress_percent ?? (existingDistance / nextRoute.distance_required_meters) * 100));
    const nextPoint = getPointOnRoute(nextRoute.path_points, nextProgress);

    await setCurrentRoute(nextRoute.id);
    setRouteDirection("forward");
    routeDirectionRef.current = "forward";
    distanceWalkedRef.current = existingDistance;
    setDistanceWalked(existingDistance);
    setSavedPlayerPosition(nextPoint);
    setRouteProgressRows((current) => upsertRouteProgressRow(current, nextRoute.id, nextProgress).map((row) => ({ ...row, is_current: row.route_id === nextRoute.id })));
    await saveRouteProgress(nextRoute.id, {
      distance_walked_meters: existingDistance,
      progress_percent: nextProgress,
      current_x_percent: nextPoint.x,
      current_y_percent: nextPoint.y,
      last_lat: null,
      last_lng: null,
      travel_direction: "forward",
      is_current: true,
      source_marker_id: null,
    });
    setSelectedMarker(null);
    setPreviewMarkerScene(false);
    setMarkerPanelMessage(null);
    const nextMiniMap = nextRoute.mini_map_id ? miniMaps.find((item) => item.id === nextRoute.mini_map_id) ?? null : null;
    setActiveMiniMap(nextMiniMap);
    setSelectedMiniMapId(nextMiniMap?.id ?? null);
    await selectRoute(nextRoute, true);
    setGpsMessage(`${nextRoute.name} is now your active walking path.`);
  }

  async function startLinkedStoryRoute(sourceMarker: MapMarker, nextRoute: MapRoute) {
    const startPoint = nextRoute.path_points[0] ?? { x: 33.8, y: 73.81 };
    await setCurrentRoute(nextRoute.id);
    setRouteDirection("forward");
    routeDirectionRef.current = "forward";
    distanceWalkedRef.current = 0;
    setDistanceWalked(0);
    setSavedPlayerPosition(startPoint);
    setRouteProgressRows((current) =>
      upsertRouteProgressRow(current, nextRoute.id, 0).map((row) => ({ ...row, is_current: row.route_id === nextRoute.id })),
    );
    await saveRouteProgress(nextRoute.id, {
      distance_walked_meters: 0,
      progress_percent: 0,
      current_x_percent: startPoint.x,
      current_y_percent: startPoint.y,
      last_lat: null,
      last_lng: null,
      travel_direction: "forward",
      is_current: true,
      source_marker_id: sourceMarker.id,
    });
    const nextMiniMap = nextRoute.mini_map_id ? miniMaps.find((item) => item.id === nextRoute.mini_map_id) ?? null : null;
    setActiveMiniMap(nextMiniMap);
    setSelectedMiniMapId(nextMiniMap?.id ?? null);
    await selectRoute(nextRoute, true);
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

  async function reduceCurrentRouteProgress(percent: number) {
    const meters = route.distance_required_meters * (percent / 100);
    const nextDistance = Math.max(0, distanceWalkedRef.current - meters);
    const nextProgress = Math.max(0, (nextDistance / route.distance_required_meters) * 100);
    const nextPoint = getPointOnRoute(route.path_points, nextProgress);
    distanceWalkedRef.current = nextDistance;
    setDistanceWalked(nextDistance);
    setSavedPlayerPosition(nextPoint);
    setRouteProgressRows((current) => upsertRouteProgressRow(current, route.id, nextProgress));
    await saveRouteProgress(route.id, {
      distance_walked_meters: nextDistance,
      progress_percent: nextProgress,
      current_x_percent: nextPoint.x,
      current_y_percent: nextPoint.y,
      last_lat: null,
      last_lng: null,
      travel_direction: routeDirectionRef.current,
      is_current: true,
    });
  }

  async function moveSelectedMarker() {
    if (!selectedMarker || !clickedPercent) {
      return;
    }

    try {
      const updated = await updateMapMarker(selectedMarker.id, {
        x_percent: clickedPercent.x,
        y_percent: clickedPercent.y,
      });
      setMarkers((current) => current.map((marker) => (marker.id === updated.id ? updated : marker)));
      setSelectedMarker(updated);
      setAdminMessage("Marker moved.");
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
        background_image_url: miniMapBackground,
        description: miniMapDescription,
        is_active: miniMapActive,
        season_number: selectedSeason,
        chapter_number: selectedChapter,
      });
      setMiniMaps((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSelectedMiniMapId(saved.id);
      if (activeMiniMap?.id === saved.id) {
        setActiveMiniMap(saved);
        setEditingMiniMapId(saved.id);
      } else {
        setEditingMiniMapId(null);
        setMiniMapName("");
        setMiniMapBackground("");
        setMiniMapDescription("");
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
    setMiniMapBackground(miniMap.background_image_url ?? "");
    setMiniMapDescription(miniMap.description ?? "");
    setMiniMapActive(miniMap.is_active);
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

  function openMiniMap(miniMap: MiniMap) {
    setActiveMiniMap(miniMap);
    setSelectedMiniMapId(miniMap.id);
    editMiniMap(miniMap);
    setAdminSection("Mini Maps");
    setEditorMode("Marker");
    setSelectedMarker(null);
    setPreviewMarkerScene(false);
    setClickedPercent(null);
  }

  async function leaveMiniMap(targetPosition?: { x: number; y: number }) {
    const shouldRestoreWorldRoute = Boolean(route.mini_map_id);
    const nextWorldRoute = orderedRoutes.find((item) => !item.mini_map_id && item.is_active) ?? orderedRoutes.find((item) => !item.mini_map_id) ?? fallbackRoute;

    setActiveMiniMap(null);
    setEditingMiniMapId(null);
    setMiniMapName("");
    setMiniMapBackground("");
    setMiniMapDescription("");
    setMiniMapActive(true);
    setSelectedMarker(null);
    setPreviewMarkerScene(false);
    setMarkerPanelMessage(null);
    setClickedPercent(null);
    setPathDraft([]);

    if (shouldRestoreWorldRoute) {
      await setCurrentRoute(nextWorldRoute.id);
      await selectRoute(nextWorldRoute, true);
    }

    if (targetPosition) {
      const existingProgress = await getRouteProgress(nextWorldRoute.id);
      const nextDistance = Number(existingProgress?.distance_walked_meters ?? 0);
      const nextProgress = Number(existingProgress?.progress_percent ?? 0);
      await saveRouteProgress(nextWorldRoute.id, {
        distance_walked_meters: nextDistance,
        progress_percent: nextProgress,
        current_x_percent: targetPosition.x,
        current_y_percent: targetPosition.y,
        last_lat: null,
        last_lng: null,
        travel_direction: existingProgress?.travel_direction ?? "forward",
        is_current: true,
        source_marker_id: null,
      });
      distanceWalkedRef.current = nextDistance;
      setDistanceWalked(nextDistance);
      setRouteProgressRows((current) => upsertRouteProgressRow(current, nextWorldRoute.id, nextProgress).map((row) => ({ ...row, is_current: row.route_id === nextWorldRoute.id })));
      setSavedPlayerPosition(targetPosition);
    }
  }

  async function openExitMarker(marker: MapMarker) {
    if (marker.exit_target_type === "mini_map" && marker.linked_mini_map_id) {
      const nextMiniMap = miniMaps.find((item) => item.id === marker.linked_mini_map_id);
      if (nextMiniMap) {
        openMiniMap(nextMiniMap);
        return;
      }
    }

    if (marker.exit_target_type === "world_marker" && marker.exit_target_marker_id) {
      const worldMarker = markers.find((item) => item.id === marker.exit_target_marker_id);
      if (worldMarker) {
        await leaveMiniMap({ x: Number(worldMarker.x_percent), y: Number(worldMarker.y_percent) });
        return;
      }
    }

    await leaveMiniMap();
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
        image_url: routeImage.trim() || null,
        lock_type: routeLockType,
        lock_message: routeLockMessage.trim() || null,
        mini_map_id: activeMiniMap?.id ?? route.mini_map_id ?? null,
        season_number: selectedSeason,
        chapter_number: selectedChapter,
      });
      setRoute(updated);
      setRoutes((current) => current.map((item) => (item.id === updated.id ? updated : item)).sort(compareRoutes));
      setAdminMessage("Walking path saved.");
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
        image_url: routeImage.trim() || null,
        is_active: true,
        lock_type: routeLockType,
        lock_message: routeLockMessage.trim() || null,
        mini_map_id: activeMiniMap?.id ?? null,
        season_number: selectedSeason,
        chapter_number: selectedChapter,
      });
      setRoutes((current) => [...current, created].sort(compareRoutes));
      await selectRoute(created, true);
      setAdminMessage("New walking path created.");
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
    const startNode = nodes.find((node) => node.is_start) ?? nodes[0] ?? null;
    setDialogueNodes(nodes);
    setDialogueChoices(choices);
    setActiveNodeId(startNode?.id ?? null);
    setDialogueLog([]);
  }

  async function loadDialogueEditor(eventId: string) {
    setSelectedDialogueEventId(eventId);
    const nodes = await getDialogueNodes(eventId);
    const choices = await getDialogueChoices(nodes.map((node) => node.id));
    setDialogueNodes(nodes);
    setDialogueChoices(choices);
    setChoiceNodeId(nodes[0]?.id ?? null);
    clearDialogueNodeForm();
    clearDialogueChoiceForm();
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
    setActiveBattle(null);
    setActiveEnemy(null);
    setAdminPreviewMode(null);
    setBattleFinished(null);
    setRevivePromptOpen(false);
    setBattleInventoryOpen(false);
    setBattleLog([]);
    setDialogueLog([]);
  }

  function startNewDialogueStep() {
    clearDialogueNodeForm();
    setNodeSortOrder(String(getNextDialogueNodeOrder(dialogueNodes)));
    setNodeIsStart(dialogueNodes.length === 0);
  }

  async function startBattle(event: MapEvent, preview = false) {
    try {
      const enemy = event.enemy_id ? await getEnemyLoadout(event.enemy_id) : null;
      const npcEnemy = !enemy && event.npc_id ? await getNpcLoadout(event.npc_id) : null;
      const opponent = enemy ?? npcEnemy;

      if (event.enemy_id && !enemy) {
        setAdminMessage("Battle enemy could not be loaded from Enemy Admin. Check the selected enemy.");
        setBattleLog(["Battle enemy could not be loaded from Enemy Admin. Check the selected enemy."]);
        return;
      }

      if (event.npc_id && !npcEnemy) {
        setAdminMessage("Battle NPC could not be loaded from NPC Admin. Check the selected NPC.");
        setBattleLog(["Battle NPC could not be loaded from NPC Admin. Check the selected NPC."]);
        return;
      }

      const enemyImage = resolveEnemyImageUri(opponent?.image_url ?? event.enemy_image_url);
      setActiveEvent(null);
      setActiveBattle(event);
      setAdminPreviewMode(preview ? "battle" : null);
      setActiveEnemy(opponent);
      setCombatIndicators([]);
      setBattlePlayerHp(currentHealth);
      setBattleStamina(combatResources.maxStamina);
      setBattleMagicka(combatResources.maxMagicka);
      setBattleEnemyHp(Number(opponent?.health ?? event.enemy_hp) || 30);
      setBattleEnemyStamina(Number(opponent?.stamina ?? 0) || 0);
      setBattleEnemyMagika(Number(opponent?.magika ?? 0) || 0);
      setBattleFinished(null);
      setRevivePromptOpen(false);
      setBattleLog([
        event.battle_intro_text || `${opponent?.name || event.enemy_name || "An enemy"} blocks the trail.`,
        opponent?.id ? `Loaded ${opponent.abilities.length} abilities and ${opponent.drops.length} drop entries from Admin.` : "Using manual battle enemy data.",
        enemyImage ? "Enemy image ready." : "Enemy image missing. A placeholder will be shown.",
      ]);
    } catch (error) {
      const message = getErrorMessage(error, "Unable to load battle enemy data.");
      setAdminMessage(message);
      setBattleLog([message]);
    }
  }

  async function finishEvent(event: MapEvent) {
    if (adminPreviewMode) {
      setGpsMessage(`Preview complete: ${event.title}.`);
      closeAdminPreview();
      return;
    }

    try {
      const rewardResult = await applyRewards(character, {
        xp: (event.reward_xp ?? 0) + (activeEnemy?.xp_reward ?? 0),
        gold: (event.reward_gold ?? 0) + (activeEnemy?.gold_reward ?? 0),
        itemId: event.reward_item_id,
        itemQuantity: event.reward_item_quantity,
        eventId: event.id,
      });
      const drops: string[] = [];
      for (const drop of activeEnemy?.drops ?? []) {
        if (Math.random() * 100 <= Number(drop.drop_chance)) {
          await grantItemToCharacter(character.id, drop.item_id, drop.quantity);
          drops.push(`item x${drop.quantity}`);
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
      await completeMapEvent(event.id);
      setCompletedEventIds((current) => new Set([...current, event.id]));
      setActiveEvent(null);
      setActiveBattle(null);
      setActiveEnemy(null);
      setGpsMessage(`${event.title} completed. ${rewardResult.message}${drops.length ? ` Drops: ${drops.join(", ")}.` : ""}${killMessage}`);
      await loadInventory();
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to complete event."));
    }
  }

  function pushCombatIndicator(target: CombatIndicator["target"], text: string, color: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setCombatIndicators((current) => [...current, { id, target, text, color }].slice(-8));
    setTimeout(() => {
      setCombatIndicators((current) => current.filter((indicator) => indicator.id !== id));
    }, 1150);
  }

  async function savePlayerHealth(nextHealth: number) {
    const safeHealth = clampHealth(nextHealth, combatResources.maxHp);
    setBattlePlayerHp(safeHealth);
    if (adminPreviewMode) {
      return safeHealth;
    }
    await updateCharacterHealth(character.id, safeHealth);
    onCharacterUpdated({ ...character, current_health: safeHealth });
    return safeHealth;
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

    if (choice.player_dialogue_text) {
      setDialogueLog((current) => [`You: ${choice.player_dialogue_text}`, ...current].slice(0, 4));
    }

    if (choice.action === "go_to_node") {
      if (choice.next_node_id && dialogueNodes.some((node) => node.id === choice.next_node_id)) {
        setActiveNodeId(choice.next_node_id);
        return;
      }
      setDialogueLog((current) => ["The conversation path is missing. Return to the map when ready.", ...current].slice(0, 4));
      return;
    }

    if (choice.action === "start_battle") {
      const battle = mapEvents.find((event) => event.id === choice.battle_event_id) ?? mapEvents.find((event) => event.event_type === "battle" && event.route_id === activeEvent.route_id);
      if (battle) {
        void startBattle(battle, adminPreviewMode === "story");
        return;
      }
      setDialogueLog((current) => ["No battle is linked yet.", ...current].slice(0, 4));
      return;
    }

    if (choice.action === "complete_event" || choice.action === "unlock_next_event") {
      await finishEvent(activeEvent);
      return;
    }

    if (choice.action === "give_reward") {
      if (adminPreviewMode) {
        setDialogueLog((current) => [`Preview reward: ${choice.reward_xp} XP, ${choice.reward_gold} gold.`, ...current].slice(0, 4));
        return;
      }

      const rewardResult = await applyRewards(character, {
        xp: choice.reward_xp,
        gold: choice.reward_gold,
        itemId: choice.reward_item_id,
        itemQuantity: choice.reward_item_quantity,
        choiceId: choice.id,
      });
      setDialogueLog((current) => [rewardResult.message, ...current].slice(0, 4));
      await loadInventory();
      return;
    }

    if (adminPreviewMode) {
      closeAdminPreview();
      return;
    }

    setActiveEvent(null);
  }

  async function endDialogueChat(completeEvent: boolean) {
    if (adminPreviewMode && !completeEvent) {
      closeAdminPreview();
      return;
    }

    if (activeEvent && completeEvent) {
      await finishEvent(activeEvent);
      return;
    }

    setActiveEvent(null);
  }

  async function handleBattleAction(ability: AbilityDefinition) {
    if (!activeBattle || battleFinished) {
      return;
    }

    if (ability.sourceWeapon) {
      await handleWeaponAction(ability.sourceWeapon);
      return;
    }

    const currentResource = ability.resource === "stamina" ? battleStamina : ability.resource === "magicka" ? battleMagicka : ability.resource === "health" ? battlePlayerHp : Number.POSITIVE_INFINITY;

    if (currentResource < ability.cost) {
      setBattleLog((current) => [`Not enough ${ability.resource === "magicka" ? "Mana" : ability.resource === "none" ? "power" : ability.resource} for ${ability.name}.`, ...current].slice(0, 8));
      return;
    }

    if (ability.resource === "stamina") {
      setBattleStamina((current) => Math.max(0, current - ability.cost));
    } else if (ability.resource === "magicka") {
      setBattleMagicka((current) => Math.max(0, current - ability.cost));
    } else if (ability.resource === "health") {
      await savePlayerHealth(Math.max(1, battlePlayerHp - ability.cost));
    }

    const healthRestore = Math.max(0, Number(ability.adminAbility?.healing ?? 0));
    const staminaRestore = Math.max(0, Number(ability.adminAbility?.stamina_restore ?? 0));
    const magikaRestore = Math.max(0, Number(ability.adminAbility?.magika_restore ?? 0));
    const isPureRestoreAbility = ability.adminAbility && ability.adminAbility.type === "heal" && Number(ability.adminAbility.damage ?? 0) <= 0;

    if (isPureRestoreAbility) {
      const nextLog: string[] = [];
      if (healthRestore > 0) {
        pushCombatIndicator("player", `+${healthRestore}`, "#42d77d");
        nextLog.push(`${ability.name} restores ${healthRestore} Health.`);
      }
      if (staminaRestore > 0) {
        pushCombatIndicator("player", `+${staminaRestore} Stamina`, "#3b82f6");
        setBattleStamina((current) => Math.min(combatResources.maxStamina, current + staminaRestore));
        nextLog.push(`${ability.name} restores ${staminaRestore} Stamina.`);
      }
      if (magikaRestore > 0) {
        pushCombatIndicator("player", `+${magikaRestore} Mana`, "#7dd3fc");
        setBattleMagicka((current) => Math.min(combatResources.maxMagicka, current + magikaRestore));
        nextLog.push(`${ability.name} restores ${magikaRestore} Mana.`);
      }
      if (nextLog.length === 0) {
        nextLog.push(`${ability.name} has no restore amount configured.`);
      }
      const counter = resolveEnemyCounterAttack();
      const nextPlayerHp = Math.max(0, Math.min(combatResources.maxHp, battlePlayerHp + healthRestore) - counter.damage);
      nextLog.push(...counter.log);
      await savePlayerHealth(nextPlayerHp);
      if (nextPlayerHp <= 0) {
        await resolvePlayerDefeat(nextLog);
      }
      setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
      return;
    }

    const enemyDefense = getEnemyDefense();
    const attackRoll = rollD20Attack(getAbilityAttributeLevel(ability, "player"), getAbilityAttackBonus(ability), enemyDefense, ability.adminAbility?.critical_chance ?? 0, ability.adminAbility?.critical_multiplier ?? 2);
    const nextLog = [`${ability.name}: d20 ${attackRoll.roll} + bonuses = ${attackRoll.total} vs Defense ${enemyDefense}.`];

    if (!attackRoll.hit) {
      pushCombatIndicator("enemy", "MISS", "#9ca3af");
      nextLog.push(attackRoll.roll === 1 ? "Natural 1. Automatic miss." : `${ability.name} misses.`);
      const counter = resolveEnemyCounterAttack();
      const nextPlayerHp = Math.max(0, battlePlayerHp - counter.damage);
      nextLog.push(...counter.log);
      await savePlayerHealth(nextPlayerHp);
      if (nextPlayerHp <= 0) {
        await resolvePlayerDefeat(nextLog);
      }
      setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
      return;
    }

    const rawDamage = getAbilityBaseDamage(ability) + getAbilityAttributeLevel(ability, "player") + getEquipmentDamageBonus();
    const reducedDamage = Math.max(1, rawDamage - getEnemyArmorReduction());
    const totalDamage = attackRoll.critical ? Math.ceil(reducedDamage * Number(attackRoll.criticalMultiplier || 2)) : reducedDamage;
    const nextEnemyHp = Math.max(0, battleEnemyHp - totalDamage);
    pushCombatIndicator("enemy", attackRoll.critical ? `CRITICAL -${totalDamage}` : `-${totalDamage}`, attackRoll.critical ? "#f6d365" : "#ff5c5c");
    nextLog.push(`${ability.name} hits for ${attackRoll.critical ? "Critical " : ""}${totalDamage} ${ability.kind} damage.`);
    applyAbilityStatusToTarget(ability, "enemy", nextLog);
    let postAbilityPlayerHp = battlePlayerHp;
    if (healthRestore > 0) {
      postAbilityPlayerHp = Math.min(combatResources.maxHp, battlePlayerHp + healthRestore);
      pushCombatIndicator("player", `+${healthRestore}`, "#42d77d");
      nextLog.push(`${ability.name} restores ${healthRestore} Health.`);
    }
    if (staminaRestore > 0) {
      pushCombatIndicator("player", `+${staminaRestore} Stamina`, "#3b82f6");
      setBattleStamina((current) => Math.min(combatResources.maxStamina, current + staminaRestore));
      nextLog.push(`${ability.name} restores ${staminaRestore} Stamina.`);
    }
    if (magikaRestore > 0) {
      pushCombatIndicator("player", `+${magikaRestore} Mana`, "#7dd3fc");
      setBattleMagicka((current) => Math.min(combatResources.maxMagicka, current + magikaRestore));
      nextLog.push(`${ability.name} restores ${magikaRestore} Mana.`);
    }

    if (nextEnemyHp <= 0) {
      if (healthRestore > 0) {
        await savePlayerHealth(postAbilityPlayerHp);
      }
      setBattleEnemyHp(0);
      setBattleFinished("victory");
      setBattleLog((current) => [...nextLog, activeBattle.victory_text || "Victory.", ...current].slice(0, 8));
      return;
    }

    const counter = resolveEnemyCounterAttack();
    const nextPlayerHp = Math.max(0, postAbilityPlayerHp - counter.damage);
    nextLog.push(...counter.log);

    setBattleEnemyHp(nextEnemyHp);
    await savePlayerHealth(nextPlayerHp);

    if (nextPlayerHp <= 0) {
      await resolvePlayerDefeat(nextLog);
    }

    setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
  }

  async function handleWeaponAction(weapon: ItemDefinition) {
    if (!activeBattle || battleFinished) {
      return;
    }

    const costType = weapon.ability_cost_type;
    const cost = weapon.ability_cost_amount;

    if (costType === "health" && battlePlayerHp <= cost) {
      setBattleLog((current) => [`Not enough Health for ${weapon.ability_name || weapon.name}.`, ...current].slice(0, 8));
      return;
    }
    if (costType === "stamina" && battleStamina < cost) {
      setBattleLog((current) => [`Not enough Stamina for ${weapon.ability_name || weapon.name}.`, ...current].slice(0, 8));
      return;
    }
    if (costType === "magika" && battleMagicka < cost) {
      setBattleLog((current) => [`Not enough Mana for ${weapon.ability_name || weapon.name}.`, ...current].slice(0, 8));
      return;
    }

    if (costType === "health") {
      await savePlayerHealth(Math.max(1, battlePlayerHp - cost));
    } else if (costType === "stamina") {
      setBattleStamina((current) => Math.max(0, current - cost));
    } else if (costType === "magika") {
      setBattleMagicka((current) => Math.max(0, current - cost));
    }

    const bonuses = getInventoryResourceBonuses(equippedItems as Record<"weapon" | "armor" | "necklace" | "ring" | "charm" | "relic", ItemDefinition | null>);
    const enemyDefense = getEnemyDefense();
    const attackRoll = rollD20Attack(character.attributes?.strength ?? 0, bonuses.damage, enemyDefense, 0, 2);
    const actionName = weapon.ability_name || weapon.name;
    const nextLog = [`${actionName}: d20 ${attackRoll.roll} + bonuses = ${attackRoll.total} vs Defense ${enemyDefense}.`];

    if (!attackRoll.hit) {
      pushCombatIndicator("enemy", "MISS", "#9ca3af");
      nextLog.push(attackRoll.roll === 1 ? "Natural 1. Automatic miss." : `${actionName} misses.`);
      const counter = resolveEnemyCounterAttack(bonuses.defense);
      const nextPlayerHp = Math.max(0, battlePlayerHp - counter.damage);
      nextLog.push(...counter.log);
      await savePlayerHealth(nextPlayerHp);
      if (nextPlayerHp <= 0) {
        await resolvePlayerDefeat(nextLog);
      }
      setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
      return;
    }

    const weaponDamage = Number(weapon.damage_amount ?? 0) + Number(weapon.elemental_damage_amount ?? 0) + bonuses.damage + Math.floor((character.attributes?.strength ?? 0) / 2);
    const totalDamage = attackRoll.critical ? Math.ceil(Math.max(1, weaponDamage - getEnemyArmorReduction()) * 2) : Math.max(1, weaponDamage - getEnemyArmorReduction());
    const nextEnemyHp = Math.max(0, battleEnemyHp - totalDamage);
    pushCombatIndicator("enemy", attackRoll.critical ? `CRITICAL -${totalDamage}` : `-${totalDamage}`, attackRoll.critical ? "#f6d365" : "#ff5c5c");
    nextLog.push(`${actionName} hits for ${attackRoll.critical ? "Critical " : ""}${totalDamage} damage${weapon.elemental_damage_type !== "none" ? ` with ${weapon.elemental_damage_type}` : ""}.`);

    if (weapon.on_hit_effect === "restore health per hit") {
      await savePlayerHealth(Math.min(combatResources.maxHp, battlePlayerHp + Math.max(1, weapon.buff_amount || 2)));
      nextLog.push("On-hit effect restores Health.");
    } else if (weapon.on_hit_effect === "restore stamina per hit") {
      setBattleStamina((current) => Math.min(combatResources.maxStamina, current + Math.max(1, weapon.buff_amount || 2)));
      nextLog.push("On-hit effect restores Stamina.");
    } else if (weapon.on_hit_effect === "restore magika per hit") {
      setBattleMagicka((current) => Math.min(combatResources.maxMagicka, current + Math.max(1, weapon.buff_amount || 2)));
      nextLog.push("On-hit effect restores Mana.");
    } else if (weapon.on_hit_effect) {
      nextLog.push(`On-hit effect: ${weapon.on_hit_effect}.`);
    }

    if (nextEnemyHp <= 0) {
      setBattleEnemyHp(0);
      setBattleFinished("victory");
      setBattleLog((current) => [...nextLog, activeBattle.victory_text || "Victory.", ...current].slice(0, 8));
      return;
    }

    const counter = resolveEnemyCounterAttack(bonuses.defense);
    const nextPlayerHp = Math.max(0, battlePlayerHp - counter.damage);
    nextLog.push(...counter.log);
    setBattleEnemyHp(nextEnemyHp);
    await savePlayerHealth(nextPlayerHp);

    if (nextPlayerHp <= 0) {
      await resolvePlayerDefeat(nextLog);
    }

    setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
  }

  async function fleeBattle() {
    if (!activeBattle || battleFinished) {
      return;
    }

    const fleeDamage = Math.max(1, Math.ceil((Number(activeEnemy?.health ?? activeBattle.enemy_hp ?? 30) || 30) * 0.12));
    const nextHp = Math.max(1, battlePlayerHp - fleeDamage);
    await savePlayerHealth(nextHp);
    pushCombatIndicator("player", `-${fleeDamage}`, "#ff5c5c");
    if (adminPreviewMode) {
      setBattleLog((current) => ["Preview flee. No route progress was changed.", ...current].slice(0, 8));
      closeAdminPreview();
      return;
    }
    await reduceCurrentRouteProgress(3);
    setBattleLog((current) => ["You escaped, but took damage and lost ground.", ...current].slice(0, 8));
    setActiveBattle(null);
    setBattleFinished(null);
    setRevivePromptOpen(false);
    setGpsMessage("You escaped, but took damage and lost ground.");
  }

  function resolveEnemyCounterAttack(extraPlayerDefense = 0) {
    const enemyName = activeEnemy?.name || activeBattle?.enemy_name || "Enemy";
    const ability = chooseWeightedEnemyAbility(activeEnemy, battleEnemyStamina, battleEnemyMagika, battleEnemyHp);
    const playerDefense = getPlayerDefense(extraPlayerDefense);

    if (!ability) {
      const roll = rollD20Attack(Number(activeEnemy?.strength ?? 0), 0, playerDefense, 0, 2);
      if (!roll.hit) {
        pushCombatIndicator("player", "MISS", "#9ca3af");
        return { damage: 0, log: [`${enemyName} misses. d20 ${roll.roll} vs Defense ${playerDefense}.`] };
      }
      const damage = Math.max(1, (Number(activeBattle?.enemy_attack_damage) || 5) - extraPlayerDefense);
      const totalDamage = roll.critical ? Math.ceil(damage * 2) : damage;
      pushCombatIndicator("player", roll.critical ? `CRITICAL -${totalDamage}` : `-${totalDamage}`, roll.critical ? "#f6d365" : "#ff5c5c");
      return { damage: totalDamage, log: [`${enemyName} hits for ${roll.critical ? "Critical " : ""}${totalDamage}.`] };
    }

    if (ability.stamina_cost > 0) {
      setBattleEnemyStamina((current) => Math.max(0, current - ability.stamina_cost));
    }
    if (ability.magika_cost > 0) {
      setBattleEnemyMagika((current) => Math.max(0, current - ability.magika_cost));
    }

    if (ability.type === "heal") {
      const logs: string[] = [];
      const healing = Math.max(0, Number(ability.healing) || 0);
      const staminaRestore = Math.max(0, Number(ability.stamina_restore) || 0);
      const magikaRestore = Math.max(0, Number(ability.magika_restore) || 0);
      if (healing > 0) {
        setBattleEnemyHp((current) => Math.min(Number(activeEnemy?.health ?? activeBattle?.enemy_hp ?? 30), current + healing));
        pushCombatIndicator("enemy", `+${healing}`, "#42d77d");
        logs.push(`${enemyName} heals ${healing}.`);
      }
      if (staminaRestore > 0) {
        setBattleEnemyStamina((current) => Math.min(Number(activeEnemy?.stamina ?? 0), current + staminaRestore));
        pushCombatIndicator("enemy", `+${staminaRestore} Stamina`, "#3b82f6");
        logs.push(`${enemyName} restores ${staminaRestore} Stamina.`);
      }
      if (magikaRestore > 0) {
        setBattleEnemyMagika((current) => Math.min(Number(activeEnemy?.magika ?? 0), current + magikaRestore));
        pushCombatIndicator("enemy", `+${magikaRestore} Mana`, "#7dd3fc");
        logs.push(`${enemyName} restores ${magikaRestore} Mana.`);
      }
      return { damage: 0, log: [`${enemyName} uses ${ability.name}.`, ...(logs.length > 0 ? logs : ["No restore amount is configured."])] };
    }

    if (ability.type === "defense" || ability.type === "buff" || ability.type === "passive") {
      return { damage: 0, log: [`${enemyName} uses ${ability.name}. ${ability.status_effect !== "none" ? `Status: ${ability.status_effect}.` : "It braces for the next exchange."}`] };
    }

    const statBonus = Number(activeEnemy?.strength ?? 0);
    const roll = rollD20Attack(statBonus, ability.attack_bonus, playerDefense, ability.critical_chance, ability.critical_multiplier);
    if (!roll.hit) {
      pushCombatIndicator("player", "MISS", "#9ca3af");
      return { damage: 0, log: [`${enemyName} uses ${ability.name} and misses. d20 ${roll.roll} vs Defense ${playerDefense}.`] };
    }

    const baseDamage = Math.max(1, Number(ability.damage) || 1);
    const reducedDamage = Math.max(1, baseDamage - extraPlayerDefense);
    const damage = roll.critical ? Math.ceil(reducedDamage * Number(ability.critical_multiplier || 2)) : reducedDamage;
    const statusText = ability.status_effect !== "none" ? ` ${ability.status_effect} may linger.` : "";
    pushCombatIndicator("player", roll.critical ? `CRITICAL -${damage}` : `-${damage}`, roll.critical ? "#f6d365" : "#ff5c5c");
    pushStatusIndicator("player", ability.status_effect, ability.effect_amount);
    return { damage, log: [`${enemyName} uses ${ability.name} for ${roll.critical ? "Critical " : ""}${damage}.${statusText}`] };
  }

  function getPlayerDefense(extraDefense = 0) {
    const bonuses = getInventoryResourceBonuses(equippedItems as Record<"weapon" | "armor" | "necklace" | "ring" | "charm" | "relic", ItemDefinition | null>);
    return 10 + Math.floor((character.attributes?.endurance ?? 0) / 2) + Math.floor((character.attributes?.agility ?? 0) / 2) + bonuses.defense + extraDefense;
  }

  function getEnemyDefense() {
    return Number(activeEnemy?.defense ?? 10) + Math.floor(Number(activeEnemy?.endurance ?? 0) / 2) + Math.floor(Number(activeEnemy?.agility ?? 0) / 2) + Number(activeEnemy?.armor_rating ?? 0);
  }

  function getEnemyArmorReduction() {
    return Math.floor(Number(activeEnemy?.armor_rating ?? 0) / 2);
  }

  function getEquipmentDamageBonus() {
    const bonuses = getInventoryResourceBonuses(equippedItems as Record<"weapon" | "armor" | "necklace" | "ring" | "charm" | "relic", ItemDefinition | null>);
    return bonuses.damage;
  }

  function getAbilityAttackBonus(ability: AbilityDefinition) {
    return Number(ability.adminAbility?.attack_bonus ?? 0);
  }

  function getAbilityBaseDamage(ability: AbilityDefinition) {
    return Math.max(1, Number(ability.adminAbility?.damage ?? ability.baseDamage) || 1);
  }

  function getAbilityAttributeLevel(ability: AbilityDefinition, side: "player" | "enemy") {
    const key = ability.attribute ?? ability.adminAbility?.required_attribute ?? (ability.adminAbility?.linked_stat && ability.adminAbility.linked_stat !== "none" && ability.adminAbility.linked_stat !== "weapon" && ability.adminAbility.linked_stat !== "item" ? ability.adminAbility.linked_stat : null);

    if (!key) {
      return 0;
    }

    if (side === "enemy") {
      return Number(activeEnemy?.[key] ?? 0);
    }

    return Number(character.attributes?.[key] ?? 0);
  }

  function applyAbilityStatusToTarget(ability: AbilityDefinition, target: CombatIndicator["target"], log: string[]) {
    const status = ability.adminAbility?.status_effect;

    if (!status || status === "none") {
      return;
    }

    const amount = Number(ability.adminAbility?.effect_amount ?? 0);
    const duration = Number(ability.adminAbility?.effect_duration ?? 0);
    pushStatusIndicator(target, status, amount);
    log.push(`${status} applied${duration ? ` for ${duration} turns` : ""}.`);
  }

  function pushStatusIndicator(target: CombatIndicator["target"], status: string | null | undefined, amount: number) {
    if (!status || status === "none" || amount <= 0) {
      return;
    }

    if (status === "poison") {
      pushCombatIndicator(target, `Poison -${amount}`, "#b55cff");
    } else if (status === "burn") {
      pushCombatIndicator(target, `Burn -${amount}`, "#ff8a2a");
    } else if (status === "regen") {
      pushCombatIndicator(target, `+${amount}`, "#42d77d");
    }
  }

  async function resolvePlayerDefeat(log: string[]) {
    setBattleFinished("defeat");
    await savePlayerHealth(1);
    log.push(activeBattle?.defeat_text || "Defeat.");

    if (adminPreviewMode) {
      setRevivePromptOpen(false);
      log.push("Preview defeat. No route progress or Health was changed.");
      return;
    }

    const reviveItem = inventoryItems.find((entry) => entry.quantity > 0 && isReviveBattleItem(entry.item));

    if (reviveItem) {
      setRevivePromptOpen(true);
      setBattleInventoryOpen(false);
      log.push(`${reviveItem.item.name} is available. Use it now or return to the trail start.`);
      return;
    }

    setRevivePromptOpen(false);
    log.push("No Revive Scroll found. Returning to the start of this trail.");
    await resetCurrentRouteAfterDefeat();
  }

  async function declineReviveAfterDefeat() {
    setRevivePromptOpen(false);
    if (adminPreviewMode) {
      setBattleLog((current) => ["Preview ended after defeat.", ...current].slice(0, 8));
      closeAdminPreview();
      return;
    }
    setBattleLog((current) => ["No revive used. Returning to the start of this trail.", ...current].slice(0, 8));
    await resetCurrentRouteAfterDefeat();
  }

  async function useBattleItem(entry: InventoryItem) {
    const item = entry.item;
    const defeated = battlePlayerHp <= 0 || battleFinished === "defeat";

    if (defeated && !isReviveBattleItem(item)) {
      setBattleLog((current) => ["Only Revive Scrolls can be used after defeat.", ...current].slice(0, 8));
      return;
    }

    if (item.type !== "potion" && !isReviveBattleItem(item)) {
      setBattleLog((current) => [`${item.name} has no battle use yet.`, ...current].slice(0, 8));
      return;
    }

    const target = defeated ? "health" : item.potion_target ?? "health";
    const restoreFromPercent = item.restore_percent ? Math.ceil((target === "health" ? combatResources.maxHp : target === "stamina" ? combatResources.maxStamina : combatResources.maxMagicka) * (item.restore_percent / 100)) : 0;
    const amount = Math.max(item.restore_amount, restoreFromPercent, defeated ? Math.ceil(combatResources.maxHp * 0.5) : 0);

    if (target === "health") {
      await savePlayerHealth(Math.min(combatResources.maxHp, battlePlayerHp + amount));
      pushCombatIndicator("player", `+${amount}`, "#42d77d");
      if (defeated) {
        setBattleFinished(null);
        setRevivePromptOpen(false);
      }
    } else if (target === "stamina") {
      setBattleStamina((current) => Math.min(combatResources.maxStamina, current + amount));
      pushCombatIndicator("player", `+${amount}`, "#2f80ed");
    } else {
      setBattleMagicka((current) => Math.min(combatResources.maxMagicka, current + amount));
      pushCombatIndicator("player", `+${amount}`, "#7fdcff");
    }

    if (!adminPreviewMode) {
      await consumeInventoryItem(entry, 1);
      await loadInventory();
    }
    setBattleInventoryOpen(false);
    setBattleLog((current) => [`Used ${item.name}. Restored ${amount} ${target}.`, ...current].slice(0, 8));
  }

  async function resetCurrentRouteAfterDefeat() {
    const startPoint = route.path_points[0] ?? { x: 33.8, y: 73.81 };
    const resetProgress = await resetRouteProgress(route.id, startPoint);

    if (!resetProgress) {
      setBattleLog((current) => ["Unable to save trail reset. Please check your connection and try Return to Trail Start again.", ...current].slice(0, 8));
      return;
    }

    distanceWalkedRef.current = 0;
    setDistanceWalked(0);
    setSavedPlayerPosition(startPoint);
    setRouteDirection("forward");
    routeDirectionRef.current = "forward";
    setCompletedRouteId(null);
    setRouteProgressRows((current) => upsertRouteProgressRow(current, route.id, 0, true));
    setActiveBattle(null);
    setActiveEnemy(null);
    setBattleFinished(null);
    setRevivePromptOpen(false);
    setBattleInventoryOpen(false);
    setCombatIndicators([]);
    setGpsMessage("Defeated. Route progress reset to the start of this path.");
  }

  function editMapEvent(event: MapEvent) {
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
    if (!selectedDialogueEventId || !nodeTitle.trim()) {
      setAdminMessage("Select a dialogue/event and add a dialogue step title.");
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
        : await createDialogueNode({ ...input, event_id: selectedDialogueEventId });
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
      setDialogueChoices((current) => current.filter((choice) => choice.node_id !== nodeId));
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
        next_node_id: choiceAction === "go_to_node" ? choiceNextNodeId : null,
        battle_event_id: choiceAction === "start_battle" ? choiceBattleEventId : null,
        reward_xp: Number(choiceRewardXp) || 0,
        reward_gold: Number(choiceRewardGold) || 0,
        reward_item: choiceRewardItem.trim() || null,
        reward_item_id: choiceRewardItemId,
        reward_item_quantity: Math.max(1, Number(choiceRewardItemQuantity) || 1),
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
    if (!selectedDialogueEvent) {
      setAdminMessage("Select a dialogue event before creating a linked battle.");
      return;
    }

    const existingBattle = choiceBattleEventId ? mapEvents.find((event) => event.id === choiceBattleEventId) ?? allMapEvents.find((event) => event.id === choiceBattleEventId) ?? null : null;
    const title = choiceBattleTitle.trim() || existingBattle?.title || `${selectedDialogueEvent.title} Battle`;
    const values = {
      event_type: "battle" as const,
      title,
      route_id: selectedDialogueEvent.route_id,
      distance_marker_percent: Number(selectedDialogueEvent.distance_marker_percent) || 0,
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
      season_number: selectedSeason,
      chapter_number: selectedChapter,
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
      setAdminMessage("Dialogue choice deleted.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to delete dialogue choice."));
    }
  }

  function undoPathPoint() {
    setPathDraft((current) => current.slice(0, -1));
  }

  function loadSelectedPathIntoDraft() {
    setPathDraft(route.path_points);
    setAdminMessage(`Loaded ${route.name} into the walking path editor.`);
  }

  async function editWalkingPath(nextRoute: MapRoute) {
    setEditorMode("Walking Path");
    await selectRoute(nextRoute, true);
    setPathDraft(nextRoute.path_points);
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

  function renderBranchingDialogueEditor() {
    return (
      <View style={styles.storyEditor}>
        <Text style={styles.selectedTitle}>Branching Dialogue Editor</Text>
        <Text style={styles.copy}>Select a dialogue, clue, or reward event, then add dialogue steps and player choices. Start Battle choices can create or link a battle event from here.</Text>
        <View style={styles.storyRoutePicker}>
          {adminMapEvents.filter((event) => event.event_type !== "battle").map((event) => (
            <Pressable
              key={event.id}
              style={[styles.routeChip, selectedDialogueEventId === event.id && styles.routeChipActive]}
              onPress={() => void loadDialogueEditor(event.id)}
            >
              <Text style={styles.routeChipText}>{event.title}</Text>
            </Pressable>
          ))}
        </View>
        {selectedDialogueEvent ? (
          <View style={styles.builderStatus}>
            <Text style={styles.selectedTitle}>Editing: {selectedDialogueEvent.title}</Text>
            <Text style={styles.copy}>{dialogueNodes.length} dialogue steps - {dialogueChoices.length} player choices</Text>
          </View>
        ) : (
          <Text style={styles.adminMessage}>Select a dialogue, clue, or reward event before adding steps.</Text>
        )}
        <Pressable style={styles.secondaryButton} onPress={startNewDialogueStep} disabled={!selectedDialogueEventId}>
          <Text style={styles.secondaryText}>New Dialogue Step</Text>
        </Pressable>
        {selectedDialogueEvent ? (
          <View style={styles.flowPreview}>
            <Text style={styles.selectedTitle}>Dialogue Link Preview</Text>
            {dialogueNodes.length === 0 ? (
              <Text style={styles.copy}>No dialogue steps yet. Add a start step first.</Text>
            ) : (
              dialogueNodes.map((node) => {
                const nodeChoices = dialogueChoices.filter((choice) => choice.node_id === node.id).sort((a, b) => a.sort_order - b.sort_order);
                return (
                  <View key={`preview-${node.id}`} style={styles.flowStep}>
                    <Text style={styles.flowStepTitle}>{node.sort_order}. {node.title}{node.is_start ? " - Start" : ""}{node.is_ending ? " - Ending" : ""}</Text>
                    <Text style={styles.flowDialogue}>{node.npc_name ? `${node.npc_name}: ` : ""}{node.dialogue_text || "No NPC dialogue entered."}</Text>
                    {nodeChoices.length === 0 ? (
                      <Text style={styles.flowWarning}>No choices connected to this step.</Text>
                    ) : (
                      nodeChoices.map((choice) => {
                        const target = getChoiceTargetSummary(choice, dialogueNodes, mapEvents);
                        return (
                          <Pressable key={`preview-choice-${choice.id}`} style={styles.flowChoice} onPress={() => editDialogueChoice(choice)}>
                            <Text style={styles.flowChoiceText}>If player chooses: {choice.button_text}</Text>
                            {choice.player_dialogue_text ? <Text style={styles.flowDialogue}>Player says: {choice.player_dialogue_text}</Text> : null}
                            <Text style={[styles.flowTarget, target.isBroken && styles.flowWarning]}>{target.label}</Text>
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : null}
        <TextInput value={nodeTitle} onChangeText={setNodeTitle} placeholder="Dialogue step title / internal label" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={nodeKey} onChangeText={setNodeKey} placeholder="Optional node key" placeholderTextColor={colors.muted} style={styles.input} />
        <NpcPicker label="Reuse NPC for this dialogue step" npcs={npcDefinitions} selectedId={nodeNpcId} onSelect={selectNodeDialogueNpc} />
        <TextInput value={nodeNpcName} onChangeText={setNodeNpcName} placeholder="NPC name" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={nodeNpcPortrait} onChangeText={setNodeNpcPortrait} placeholder="NPC portrait URL optional" placeholderTextColor={colors.muted} style={styles.input} />
        <AdminImageUploadButton folder="dialogue-npcs" onUploaded={setNodeNpcPortrait} onMessage={setAdminMessage} />
        <TextInput value={nodeBackgroundImage} onChangeText={setNodeBackgroundImage} placeholder="Background image URL optional" placeholderTextColor={colors.muted} style={styles.input} />
        <AdminImageUploadButton folder="dialogue-backgrounds" onUploaded={setNodeBackgroundImage} onMessage={setAdminMessage} />
        <TextInput value={nodeDialogue} onChangeText={setNodeDialogue} placeholder="NPC dialogue text" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
        <TextInput value={nodeSortOrder} onChangeText={setNodeSortOrder} placeholder="Dialogue step order" placeholderTextColor={colors.muted} style={styles.input} />
        <View style={styles.typeGrid}>
          <Pressable style={[styles.typeButton, nodeIsStart && styles.typeSelected]} onPress={() => setNodeIsStart((value) => !value)}><Text style={styles.typeText}>Start Step</Text></Pressable>
          <Pressable style={[styles.typeButton, nodeIsEnding && styles.typeSelected]} onPress={() => setNodeIsEnding((value) => !value)}><Text style={styles.typeText}>Ending Step</Text></Pressable>
          <Pressable style={[styles.typeButton, nodeAllowEndChat && styles.typeSelected]} onPress={() => setNodeAllowEndChat((value) => !value)}><Text style={styles.typeText}>Allow End Chat</Text></Pressable>
          <Pressable style={[styles.typeButton, nodeEndCompletesEvent && styles.typeSelected]} onPress={() => setNodeEndCompletesEvent((value) => !value)}><Text style={styles.typeText}>End Completes</Text></Pressable>
        </View>
        <Pressable style={styles.primaryButton} onPress={() => void saveDialogueNode()} disabled={!selectedDialogueEventId || !nodeTitle.trim()}>
          <Text style={styles.primaryText}>{editingNode ? "Update Dialogue Step" : "Add Dialogue Step"}</Text>
        </Pressable>
        {editingNode ? <Pressable style={styles.secondaryButton} onPress={clearDialogueNodeForm}><Text style={styles.secondaryText}>Cancel Step Edit</Text></Pressable> : null}
        {dialogueNodes.map((node) => {
          const nodeChoices = dialogueChoices.filter((choice) => choice.node_id === node.id).sort((a, b) => a.sort_order - b.sort_order);
          return (
            <View key={node.id} style={[styles.storyCard, choiceNodeId === node.id && styles.storyCardActive]}>
              <Text style={styles.markerName}>{node.sort_order}. {node.title}{node.is_start ? " - Start" : ""}{node.is_ending ? " - Ending" : ""}</Text>
              <Text style={styles.copy}>{node.dialogue_text || "No dialogue yet."}</Text>
              {nodeChoices.length > 0 ? (
                <View style={styles.choicePreviewList}>
                  {nodeChoices.map((choice) => (
                    <Pressable key={choice.id} style={styles.choicePreview} onPress={() => editDialogueChoice(choice)}>
                      <Text style={styles.choicePreviewTitle}>{choice.sort_order}. {choice.button_text}</Text>
                      <Text style={styles.choicePreviewAction}>{choiceActionLabel(choice.action)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : <Text style={styles.debugLine}>No player choices yet.</Text>}
              <View style={styles.modeRow}>
                <Pressable style={styles.secondaryButtonFlex} onPress={() => selectDialogueNode(node.id)}><Text style={styles.secondaryText}>Select Step</Text></Pressable>
                <Pressable style={styles.secondaryButtonFlex} onPress={() => editDialogueNode(node)}><Text style={styles.secondaryText}>Edit Step</Text></Pressable>
                <Pressable style={styles.secondaryButtonFlex} onPress={() => startChoiceForNode(node)}><Text style={styles.secondaryText}>Add Choice</Text></Pressable>
                <Pressable style={styles.secondaryButtonFlex} onPress={() => void removeDialogueNode(node.id)}><Text style={styles.dangerText}>Delete</Text></Pressable>
              </View>
            </View>
          );
        })}
        <Text style={styles.selectedTitle}>Player Choices{selectedChoiceNode ? ` for ${selectedChoiceNode.title}` : ""}</Text>
        <Text style={styles.copy}>{selectedChoiceNode ? "Create choices for the selected dialogue step. Choices can move the conversation, start battle, reward the player, or return to the map." : "Select a dialogue step first."}</Text>
        <View style={styles.storyRoutePicker}>
          {dialogueNodes.map((node) => (
            <Pressable key={node.id} style={[styles.routeChip, choiceNodeId === node.id && styles.routeChipActive]} onPress={() => selectDialogueNode(node.id)}>
              <Text style={styles.routeChipText}>{node.sort_order}. {node.title}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={choiceButtonText} onChangeText={setChoiceButtonText} placeholder="Player button text" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={choicePlayerText} onChangeText={setChoicePlayerText} placeholder="Optional player dialogue text" placeholderTextColor={colors.muted} style={styles.input} />
        <View style={styles.typeGrid}>
          {(["go_to_node", "start_battle", "complete_event", "unlock_next_event", "give_reward", "end_conversation", "return_to_map"] as const).map((action) => (
            <Pressable key={action} style={[styles.typeButton, choiceAction === action && styles.typeSelected]} onPress={() => setChoiceAction(action)}>
              <Text style={styles.typeText}>{choiceActionLabel(action)}</Text>
            </Pressable>
          ))}
        </View>
        {choiceAction === "go_to_node" ? (
          <View style={styles.storyRoutePicker}>
            {dialogueNodes.map((node) => (
              <Pressable key={node.id} style={[styles.routeChip, choiceNextNodeId === node.id && styles.routeChipActive]} onPress={() => setChoiceNextNodeId(node.id)}>
                <Text style={styles.routeChipText}>Next: {node.title}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {choiceAction === "start_battle" ? renderLinkedBattleBuilder() : null}
        {choiceAction === "give_reward" ? (
          <>
            <TextInput value={choiceRewardXp} onChangeText={setChoiceRewardXp} placeholder="Reward XP" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput value={choiceRewardGold} onChangeText={setChoiceRewardGold} placeholder="Reward gold" placeholderTextColor={colors.muted} style={styles.input} />
            <ItemPicker label="Reward item" items={itemDefinitions} selectedId={choiceRewardItemId} onSelect={setChoiceRewardItemId} />
            <TextInput value={choiceRewardItemQuantity} onChangeText={setChoiceRewardItemQuantity} placeholder="Reward item quantity" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput value={choiceRewardItem} onChangeText={setChoiceRewardItem} placeholder="Legacy reward item text optional" placeholderTextColor={colors.muted} style={styles.input} />
          </>
        ) : null}
        <TextInput value={choiceSortOrder} onChangeText={setChoiceSortOrder} placeholder="Choice order" placeholderTextColor={colors.muted} style={styles.input} />
        <Pressable style={styles.primaryButton} onPress={() => void saveDialogueChoice()} disabled={!choiceNodeId || !choiceButtonText.trim()}>
          <Text style={styles.primaryText}>{editingChoice ? "Update Player Choice" : "Add Player Choice"}</Text>
        </Pressable>
        {editingChoice ? <Pressable style={styles.secondaryButton} onPress={clearDialogueChoiceForm}><Text style={styles.secondaryText}>Cancel Choice Edit</Text></Pressable> : null}
        {selectedNodeChoices.map((choice) => (
          <View key={choice.id} style={styles.storyCard}>
            <Text style={styles.markerName}>{choice.button_text}</Text>
            <Text style={styles.copy}>{choiceActionLabel(choice.action)}{choice.player_dialogue_text ? ` - "${choice.player_dialogue_text}"` : ""}</Text>
            <View style={styles.modeRow}>
              <Pressable style={styles.secondaryButtonFlex} onPress={() => editDialogueChoice(choice)}><Text style={styles.secondaryText}>Edit Choice</Text></Pressable>
              <Pressable style={styles.secondaryButtonFlex} onPress={() => void removeDialogueChoice(choice.id)}><Text style={styles.dangerText}>Delete</Text></Pressable>
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (activeEvent) {
    return (
      <StoryInstanceScreen
        event={activeEvent}
        nodes={dialogueNodes}
        choices={dialogueChoices}
        npcs={npcDefinitions}
        activeNodeId={activeNodeId}
        dialogueLog={dialogueLog}
        previewMode={adminPreviewMode === "story"}
        onLegacyChoice={handleStoryChoice}
        onChoice={(choice) => void handleDialogueChoice(choice)}
        onEndChat={(completeEvent) => void endDialogueChat(completeEvent)}
        onExitPreview={closeAdminPreview}
      />
    );
  }

  if (activeBattle) {
    return (
      <BattleEventScreen
        character={character}
        event={activeBattle}
        playerHp={battlePlayerHp}
        stamina={battleStamina}
        magicka={battleMagicka}
        resources={combatResources}
        enemyHp={battleEnemyHp}
        activeEnemy={activeEnemy}
        equippedAbilities={equippedAbilities}
        weapon={equippedItems.weapon ?? null}
        battleItems={getBattleUsableItems(inventoryItems, battlePlayerHp <= 0 || battleFinished === "defeat")}
        inventoryOpen={battleInventoryOpen}
        battleLog={battleLog}
        combatIndicators={combatIndicators}
        revivePromptOpen={revivePromptOpen}
        result={battleFinished}
        previewMode={adminPreviewMode === "battle"}
        onAction={(ability) => void handleBattleAction(ability)}
        onWeaponAction={(weapon) => void handleWeaponAction(weapon)}
        onFlee={() => void fleeBattle()}
        onUseItem={(item) => void useBattleItem(item)}
        onToggleInventory={() => setBattleInventoryOpen((current) => !current)}
        onDeclineRevive={() => void declineReviveAfterDefeat()}
        onReturnToStart={() => void resetCurrentRouteAfterDefeat()}
        onComplete={() => void finishEvent(activeBattle)}
        onExitPreview={closeAdminPreview}
      />
    );
  }

  if (selectedMarker && (previewMarkerScene || (!isAdmin && canUseSelectedMarker && !selectedMarkerLocked))) {
    return (
      <MarkerSceneScreen
        marker={selectedMarker}
        characterGold={character.gold}
        marketItems={markerMarketItems}
        marketPurchaseCounts={marketPurchaseCounts}
        routeLinks={markerRouteLinks}
        routes={routes}
        routeProgressRows={routeProgressRows}
        inventoryItems={inventoryItems}
        itemDefinitions={itemDefinitions}
        message={markerPanelMessage}
        onExit={closeMarkerScene}
        onBuy={(marketItem) => void buyFromMarker(marketItem)}
        onSell={(entry) => void sellToMarker(entry)}
        onClaimReward={() => void claimSelectedMarkerReward()}
        onAcceptQuest={() => void acceptSelectedMarkerQuest()}
        onStartPath={(nextRoute) => void startPathFromSignPost(nextRoute)}
        onUseExit={() => void openExitMarker(selectedMarker)}
        onEnterArea={() => {
          const miniMap = miniMaps.find((item) => item.id === selectedMarker.linked_mini_map_id);
          if (miniMap) {
            openMiniMap(miniMap);
          } else {
            setMarkerPanelMessage("No mini map is linked to this entrance yet.");
          }
        }}
      />
    );
  }

  function renderJourneyPanel() {
    const remainingMeters = Math.max(0, route.distance_required_meters - distanceWalked);
    const routeImageUri = route.image_url ? resolveMapImageUri(route.image_url) : null;
    const travelTitle = routeDirection === "reverse" ? "Returning" : "To Destination";
    const primaryLabel = isTracking ? "Pause GPS" : "Continue Walking";
    const turnLabel = routeDirection === "reverse" ? "Travel Forward" : "Turn Back";

    return (
      <Frame style={[styles.panel, styles.journeyHud]}>
        <View style={styles.journeyTop}>
          <View style={styles.journeyTitleBlock}>
            <Text style={styles.journeyOverline}>{travelTitle}</Text>
            <Text style={styles.journeyTitle}>{route.name}</Text>
            <Text style={styles.journeySub}>{metersToMiles(remainingMeters)} miles remaining</Text>
          </View>
          <View style={styles.journeyRouteImage}>
            {routeImageUri ? <Image source={{ uri: routeImageUri }} style={styles.journeyRoutePhoto} /> : <Text style={styles.journeyRouteInitial}>{route.name.slice(0, 1).toUpperCase()}</Text>}
          </View>
        </View>

        <View style={styles.journeyProgressRow}>
          <ProgressBar value={progressPercent} max={100} color={colors.gold} height={8} />
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
            <Text style={styles.journeyStatValue}>{completedRouteEvents}/{routeEvents.length}</Text>
            <Text style={styles.journeyStatLabel}>Events Done</Text>
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
          <Pressable style={[styles.journeyPrimary, isTracking && styles.gpsActive]} onPress={isTracking ? stopGpsTracking : startGpsTracking}>
            <Text style={styles.journeyPrimaryText}>{primaryLabel}</Text>
          </Pressable>
          <Pressable style={[styles.journeySecondary, routeDirection === "reverse" && styles.gpsActive, progressPercent <= 0 && styles.disabledAction]} onPress={() => void turnBackOnCurrentPath()} disabled={progressPercent <= 0}>
            <Text style={styles.journeySecondaryText}>{turnLabel}</Text>
          </Pressable>
          <Pressable style={[styles.journeySecondary, mapInventoryOpen && styles.gpsActive]} onPress={() => setMapInventoryOpen((value) => !value)}>
            <Text style={styles.journeySecondaryText}>{mapInventoryOpen ? "Hide Items" : `Inventory (${mapConsumables.length})`}</Text>
          </Pressable>
        </View>

        <View style={styles.journeyDebugGrid}>
          <Text style={styles.journeyDebug}>State {playerMovementState}</Text>
          <Text style={styles.journeyDebug}>Speed {movementStatus.speedMph.toFixed(1)} mph</Text>
          <Text style={styles.journeyDebug}>{route.terrain}</Text>
        </View>
        <View style={styles.walkingNotice}>
          <Text style={styles.walkingNoticeTitle}>Keep App Open While Walking</Text>
          <Text style={styles.walkingNoticeText}>Browser tracking only counts reliably while this screen stays active. Treadmill step tracking is planned for the future iOS app.</Text>
        </View>
        <Text style={styles.gpsMessage}>{gpsMessage}</Text>

        {mapInventoryOpen ? (
          <View style={styles.mapInventoryDrawer}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.selectedTitle}>Inventory</Text>
                <Text style={styles.copy}>Consumables</Text>
              </View>
              <Pressable style={styles.closeCircleButton} onPress={() => setMapInventoryOpen(false)}>
                <Text style={styles.closeCircleText}>X</Text>
              </Pressable>
            </View>
            {mapItemMessage ? <Text style={styles.adminMessage}>{mapItemMessage}</Text> : null}
            {mapConsumables.length === 0 ? <Text style={styles.copy}>No usable consumables.</Text> : null}
            <View style={styles.consumableGrid}>
              {mapConsumables.map((entry) => {
                const imageUri = resolveInventoryImageUri(entry.item.image_path);
                return (
                  <View key={entry.id} style={styles.consumableCard}>
                    <View style={styles.consumableImageWrap}>
                      {imageUri ? <Image source={{ uri: imageUri }} style={styles.consumableImage} /> : <Text style={styles.consumablePlaceholder}>{entry.item.name.slice(0, 1).toUpperCase()}</Text>}
                      <Text style={styles.consumableQty}>{entry.quantity}</Text>
                    </View>
                    <Text style={styles.consumableName} numberOfLines={2}>{entry.item.name}</Text>
                    <Text style={styles.consumableMeta}>{getConsumableSummary(entry.item)}</Text>
                    <Pressable style={styles.consumableUseButton} onPress={() => void useMapConsumable(entry)}>
                      <Text style={styles.consumableUseText}>Use</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
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
            canCapturePointer={isAdmin}
            onMapPointer={(event) => handleMapPointer(event as Parameters<typeof handleMapPointer>[0], "mini")}
            routeSegments={miniMapRouteSegments}
            draftSegments={draftSegments}
            pathDraft={pathDraft}
            showDraft={isAdmin && editorMode === "Walking Path"}
            clickedPercent={clickedPercent}
            showTempMarker={isAdmin && editorMode === "Marker"}
            markers={visibleMiniMapMarkers}
            playerPosition={miniMapPlayerPosition}
            playerName={character.name}
            playerPortraitUrl={character.portrait_url}
            onSelectMarker={(marker) => void selectMarker(marker)}
          />
        </Frame>
        <MarkerLegend items={legendItems} open={legendOpen} onToggle={() => setLegendOpen((value) => !value)} />
        {route.mini_map_id === activeMiniMap.id ? renderJourneyPanel() : null}
        {isAdmin ? (
          <Frame style={styles.panel}>
            <Text style={styles.sectionTitle}>Mini Map Admin Preview</Text>
            <Text style={styles.copy}>Click this mini map image to capture percentage coordinates, then create or edit markers inside {activeMiniMap.name}.</Text>
            {adminMessage ? <Text style={styles.adminMessage}>{adminMessage}</Text> : null}
            <View style={styles.storyEditor}>
              <Text style={styles.selectedTitle}>Mini Map Details</Text>
              <TextInput value={miniMapName} onChangeText={setMiniMapName} placeholder="Mini map name" placeholderTextColor={colors.muted} style={styles.input} />
              <View style={styles.storyRoutePicker}>
                {miniMapTypes.map((type) => (
                  <Pressable key={type} style={[styles.routeChip, miniMapType === type && styles.routeChipActive]} onPress={() => setMiniMapType(type)}>
                    <Text style={styles.routeChipText}>{type}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={miniMapBackground} onChangeText={setMiniMapBackground} placeholder="Background image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
              <AdminImageUploadButton folder="mini-maps" onUploaded={setMiniMapBackground} onMessage={setAdminMessage} />
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
            />
            {editorMode === "Marker" ? <MiniMapMarkerAdminForm
              activeSectionMarkerTypes={miniMapMarkerTypes}
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
              markerShopImage={markerShopImage}
              setMarkerShopImage={setMarkerShopImage}
              markerShopBackground={markerShopBackground}
              setMarkerShopBackground={setMarkerShopBackground}
              markerInteractionRadius={markerInteractionRadius}
              setMarkerInteractionRadius={setMarkerInteractionRadius}
              markerInteractable={markerInteractable}
              setMarkerInteractable={setMarkerInteractable}
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
              markerRepeatable={markerRepeatable}
              setMarkerRepeatable={setMarkerRepeatable}
              markerRewardOnce={markerRewardOnce}
              setMarkerRewardOnce={setMarkerRewardOnce}
              markerLinkedRouteId={markerLinkedRouteId}
              setMarkerLinkedRouteId={setMarkerLinkedRouteId}
              markerStartsRouteOnAccept={markerStartsRouteOnAccept}
              setMarkerStartsRouteOnAccept={setMarkerStartsRouteOnAccept}
              markerStoryOrder={markerStoryOrder}
              setMarkerStoryOrder={setMarkerStoryOrder}
              markerUnlockAfterId={markerUnlockAfterId}
              setMarkerUnlockAfterId={setMarkerUnlockAfterId}
              markerHideWhenCompleted={markerHideWhenCompleted}
              setMarkerHideWhenCompleted={setMarkerHideWhenCompleted}
              markerRequireAllLinkedRoutes={markerRequireAllLinkedRoutes}
              setMarkerRequireAllLinkedRoutes={setMarkerRequireAllLinkedRoutes}
              routes={activeRouteScopeRoutes}
              storyRoutes={adminRoutes}
              selectedMarkerRouteIds={selectedMarkerRouteIds}
              toggleSignPostRoute={toggleSignPostRoute}
              worldMarkers={adminWorldMarkers}
              storyScopeMarkers={adminStoryMarkers}
              miniMaps={adminMiniMaps}
              markerExitTargetType={markerExitTargetType}
              setMarkerExitTargetType={setMarkerExitTargetType}
              markerExitTargetMarkerId={markerExitTargetMarkerId}
              setMarkerExitTargetMarkerId={setMarkerExitTargetMarkerId}
              markerExitTargetMiniMapId={markerExitTargetMiniMapId}
              setMarkerExitTargetMiniMapId={setMarkerExitTargetMiniMapId}
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
                <View style={styles.modeRow}>
                  <Pressable style={styles.secondaryButtonFlex} onPress={loadSelectedPathIntoDraft}>
                    <Text style={styles.secondaryText}>Load Selected Path</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButtonFlex} onPress={() => setPathDraft([])}>
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

      {actualIsAdmin ? (
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
      ) : null}

      <OverworldMapCanvas
        viewportRef={viewportRef}
        scaledMapSize={scaledMapSize}
        imageSource={forgottenMarches}
        onWheel={handleWheel}
        canCapturePointer={isAdmin}
        onMapPointer={(event) => handleMapPointer(event as Parameters<typeof handleMapPointer>[0])}
        routeSegments={routeSegments}
        draftSegments={draftSegments}
        pathDraft={pathDraft}
        showDraft={isAdmin && adminSection === "Walking Paths" && editorMode === "Walking Path"}
        clickedPercent={clickedPercent}
        showTempMarker={isAdmin && editorMode === "Marker"}
        markers={visibleMarkers}
        playerPosition={playerPosition}
        playerName={character.name}
        playerPortraitUrl={character.portrait_url}
        onSelectMarker={(marker) => void selectMarker(marker)}
      />

      <MarkerLegend items={legendItems} open={legendOpen} onToggle={() => setLegendOpen((value) => !value)} />

      {renderJourneyPanel()}

      {selectedMarker && !isAdmin ? (
        <MarkerInteractionPanel
          marker={selectedMarker}
          message={markerPanelMessage}
          locked={selectedMarkerLocked}
          canUse={canUseSelectedMarker}
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
          onStartPath={(nextRoute) => void startPathFromSignPost(nextRoute)}
          onEnterArea={() => {
            const miniMap = miniMaps.find((item) => item.id === selectedMarker.linked_mini_map_id);
            if (miniMap) {
              openMiniMap(miniMap);
            } else {
              setMarkerPanelMessage("No mini map is linked to this entrance yet.");
            }
          }}
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
          />
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
              active={miniMapActive}
              onChangeName={setMiniMapName}
              onChangeType={setMiniMapType}
              onChangeBackground={setMiniMapBackground}
              onChangeDescription={setMiniMapDescription}
              onToggleActive={() => setMiniMapActive((value) => !value)}
              onSave={() => void saveMiniMapForm()}
              onOpen={(miniMap) => {
                setSelectedMiniMapId(miniMap.id);
                openMiniMap(miniMap);
              }}
              onDelete={(miniMapId) => void removeMiniMap(miniMapId)}
              onUploadMessage={setAdminMessage}
            />
          ) : null}
          {editorMode === "Marker" && ["World Markers", "Area/Town Markers"].includes(adminSection) ? (
            <>
              <View style={styles.typeGrid}>
                {activeSectionMarkerTypes.map((type) => (
                  <Pressable key={type} style={[styles.typeButton, draftType === type && styles.typeSelected]} onPress={() => setDraftType(type)}>
                    <Text style={styles.typeText}>{type}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={draftTitle} onChangeText={setDraftTitle} placeholder="Marker title" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={draftDescription} onChangeText={setDraftDescription} placeholder="Marker description" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={markerSceneBackground} onChangeText={setMarkerSceneBackground} placeholder="Marker scene background image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
              <AdminImageUploadButton folder="marker-backgrounds" onUploaded={setMarkerSceneBackground} onMessage={setAdminMessage} />
              <TextInput value={markerNpcImage} onChangeText={setMarkerNpcImage} placeholder="NPC / character image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
              <AdminImageUploadButton folder="marker-npcs" onUploaded={setMarkerNpcImage} onMessage={setAdminMessage} />
              <TextInput value={markerIconLabel} onChangeText={setMarkerIconLabel} placeholder="Marker icon text, example MKT" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={markerIconImage} onChangeText={setMarkerIconImage} placeholder="Marker icon image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
              <AdminImageUploadButton folder="marker-icons" onUploaded={setMarkerIconImage} onMessage={setAdminMessage} />
              <TextInput value={markerIconColor} onChangeText={setMarkerIconColor} placeholder="Marker icon color, example #d9a441" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={markerInteractionRadius} onChangeText={setMarkerInteractionRadius} placeholder="Interaction radius percent, example 4" placeholderTextColor={colors.muted} style={styles.input} />
              <LockPicker label="Marker lock" value={markerLockType} onSelect={setMarkerLockType} />
              {markerLockType !== "public" ? <TextInput value={markerLockMessage} onChangeText={setMarkerLockMessage} placeholder="Lock message shown to players" placeholderTextColor={colors.muted} style={styles.input} /> : null}
              {draftType === "Area/Town Entrance" ? <MiniMapPicker miniMaps={adminMiniMaps} selectedId={selectedMiniMapId} onSelect={setSelectedMiniMapId} /> : null}
              {isExitMarkerType(draftType) ? (
                <ExitTargetEditor
                  targetType={markerExitTargetType}
                  setTargetType={setMarkerExitTargetType}
                  targetMarkerId={markerExitTargetMarkerId}
                  setTargetMarkerId={setMarkerExitTargetMarkerId}
                  targetMiniMapId={markerExitTargetMiniMapId}
                  setTargetMiniMapId={setMarkerExitTargetMiniMapId}
                  worldMarkers={adminWorldMarkers}
                  miniMaps={adminMiniMaps}
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
                  {selectedMarker ? (
                    <Text style={styles.debugLine}>Save Selected Marker Settings after changing linked paths.</Text>
                  ) : (
                    <Text style={styles.debugLine}>Selected paths will be linked when the Sign Post marker is created.</Text>
                  )}
                </View>
              ) : null}
              <Pressable style={[styles.secondaryButton, markerInteractable && styles.typeSelected]} onPress={() => setMarkerInteractable((value) => !value)}>
                <Text style={styles.secondaryText}>Interactable: {markerInteractable ? "true" : "false"}</Text>
              </Pressable>
              {(draftType === "Side Quest" || draftType === "Story" || draftType === "Point of Interest") ? (
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
              <View style={styles.modeRow}>
                <Pressable style={styles.secondaryButtonFlex} onPress={loadSelectedPathIntoDraft}>
                  <Text style={styles.secondaryText}>Load Selected Path</Text>
                </Pressable>
                <Pressable style={styles.secondaryButtonFlex} onPress={() => setPathDraft([])}>
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
            <View style={styles.storyEditor}>
              <Text style={styles.selectedTitle}>Branching Dialogue Editor</Text>
              <Text style={styles.copy}>1. Select an event. 2. Add dialogue steps. 3. Select a step and add player choices under it.</Text>
              <View style={styles.storyRoutePicker}>
                {adminMapEvents.filter((event) => event.event_type !== "battle").map((event) => (
                  <Pressable
                    key={event.id}
                    style={[styles.routeChip, selectedDialogueEventId === event.id && styles.routeChipActive]}
                    onPress={() => void loadDialogueEditor(event.id)}
                  >
                    <Text style={styles.routeChipText}>{event.title}</Text>
                  </Pressable>
                ))}
              </View>
              {selectedDialogueEvent ? (
                <View style={styles.builderStatus}>
                  <Text style={styles.selectedTitle}>Editing: {selectedDialogueEvent.title}</Text>
                  <Text style={styles.copy}>{dialogueNodes.length} dialogue steps - {dialogueChoices.length} player choices</Text>
                </View>
              ) : (
                <Text style={styles.adminMessage}>Select a dialogue, clue, or reward event before adding steps.</Text>
              )}
              <Pressable style={styles.secondaryButton} onPress={startNewDialogueStep} disabled={!selectedDialogueEventId}>
                <Text style={styles.secondaryText}>New Dialogue Step</Text>
              </Pressable>
              {selectedDialogueEvent ? (
                <View style={styles.flowPreview}>
                  <Text style={styles.selectedTitle}>Dialogue Link Preview</Text>
                  {dialogueNodes.length === 0 ? (
                    <Text style={styles.copy}>No dialogue steps yet. Add a start step first.</Text>
                  ) : (
                    dialogueNodes.map((node) => {
                      const nodeChoices = dialogueChoices.filter((choice) => choice.node_id === node.id).sort((a, b) => a.sort_order - b.sort_order);
                      return (
                        <View key={`preview-${node.id}`} style={styles.flowStep}>
                          <Text style={styles.flowStepTitle}>{node.sort_order}. {node.title}{node.is_start ? " - Start" : ""}{node.is_ending ? " - Ending" : ""}</Text>
                          <Text style={styles.flowDialogue}>{node.npc_name ? `${node.npc_name}: ` : ""}{node.dialogue_text || "No NPC dialogue entered."}</Text>
                          {nodeChoices.length === 0 ? (
                            <Text style={styles.flowWarning}>No choices connected to this step.</Text>
                          ) : (
                            nodeChoices.map((choice) => {
                              const target = getChoiceTargetSummary(choice, dialogueNodes, mapEvents);
                              return (
                                <Pressable key={`preview-choice-${choice.id}`} style={styles.flowChoice} onPress={() => editDialogueChoice(choice)}>
                                  <Text style={styles.flowChoiceText}>If player chooses: {choice.button_text}</Text>
                                  {choice.player_dialogue_text ? <Text style={styles.flowDialogue}>Player says: {choice.player_dialogue_text}</Text> : null}
                                  <Text style={[styles.flowTarget, target.isBroken && styles.flowWarning]}>{target.label}</Text>
                                </Pressable>
                              );
                            })
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              ) : null}
              <TextInput value={nodeTitle} onChangeText={setNodeTitle} placeholder="Dialogue step title / internal label" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={nodeKey} onChangeText={setNodeKey} placeholder="Optional node key" placeholderTextColor={colors.muted} style={styles.input} />
              <NpcPicker label="Reuse NPC for this dialogue step" npcs={npcDefinitions} selectedId={nodeNpcId} onSelect={selectNodeDialogueNpc} />
              <TextInput value={nodeNpcName} onChangeText={setNodeNpcName} placeholder="NPC name" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={nodeNpcPortrait} onChangeText={setNodeNpcPortrait} placeholder="NPC portrait URL optional" placeholderTextColor={colors.muted} style={styles.input} />
              <AdminImageUploadButton folder="dialogue-npcs" onUploaded={setNodeNpcPortrait} onMessage={setAdminMessage} />
              <TextInput value={nodeBackgroundImage} onChangeText={setNodeBackgroundImage} placeholder="Background image URL optional" placeholderTextColor={colors.muted} style={styles.input} />
              <AdminImageUploadButton folder="dialogue-backgrounds" onUploaded={setNodeBackgroundImage} onMessage={setAdminMessage} />
              <TextInput value={nodeDialogue} onChangeText={setNodeDialogue} placeholder="NPC dialogue text" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
              <TextInput value={nodeSortOrder} onChangeText={setNodeSortOrder} placeholder="Dialogue step order" placeholderTextColor={colors.muted} style={styles.input} />
              <View style={styles.typeGrid}>
                <Pressable style={[styles.typeButton, nodeIsStart && styles.typeSelected]} onPress={() => setNodeIsStart((value) => !value)}>
                  <Text style={styles.typeText}>Start Step</Text>
                </Pressable>
                <Pressable style={[styles.typeButton, nodeIsEnding && styles.typeSelected]} onPress={() => setNodeIsEnding((value) => !value)}>
                  <Text style={styles.typeText}>Ending Step</Text>
                </Pressable>
                <Pressable style={[styles.typeButton, nodeAllowEndChat && styles.typeSelected]} onPress={() => setNodeAllowEndChat((value) => !value)}>
                  <Text style={styles.typeText}>Allow End Chat</Text>
                </Pressable>
                <Pressable style={[styles.typeButton, nodeEndCompletesEvent && styles.typeSelected]} onPress={() => setNodeEndCompletesEvent((value) => !value)}>
                  <Text style={styles.typeText}>End Completes</Text>
                </Pressable>
              </View>
              <Pressable style={styles.primaryButton} onPress={() => void saveDialogueNode()} disabled={!selectedDialogueEventId || !nodeTitle.trim()}>
                <Text style={styles.primaryText}>{editingNode ? "Update Dialogue Step" : "Add Dialogue Step"}</Text>
              </Pressable>
              {editingNode ? <Pressable style={styles.secondaryButton} onPress={clearDialogueNodeForm}><Text style={styles.secondaryText}>Cancel Step Edit</Text></Pressable> : null}
              {dialogueNodes.map((node) => {
                const nodeChoices = dialogueChoices.filter((choice) => choice.node_id === node.id).sort((a, b) => a.sort_order - b.sort_order);
                return (
                <View key={node.id} style={[styles.storyCard, choiceNodeId === node.id && styles.storyCardActive]}>
                  <Text style={styles.markerName}>{node.sort_order}. {node.title}{node.is_start ? " - Start" : ""}{node.is_ending ? " - Ending" : ""}</Text>
                  <Text style={styles.copy}>{node.dialogue_text || "No dialogue yet."}</Text>
                  {nodeChoices.length > 0 ? (
                    <View style={styles.choicePreviewList}>
                      {nodeChoices.map((choice) => (
                        <Pressable key={choice.id} style={styles.choicePreview} onPress={() => editDialogueChoice(choice)}>
                          <Text style={styles.choicePreviewTitle}>{choice.sort_order}. {choice.button_text}</Text>
                          <Text style={styles.choicePreviewAction}>{choiceActionLabel(choice.action)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.debugLine}>No player choices yet.</Text>
                  )}
                  <View style={styles.modeRow}>
                    <Pressable style={styles.secondaryButtonFlex} onPress={() => selectDialogueNode(node.id)}><Text style={styles.secondaryText}>Select Step</Text></Pressable>
                    <Pressable style={styles.secondaryButtonFlex} onPress={() => editDialogueNode(node)}><Text style={styles.secondaryText}>Edit Step</Text></Pressable>
                    <Pressable style={styles.secondaryButtonFlex} onPress={() => startChoiceForNode(node)}><Text style={styles.secondaryText}>Add Choice</Text></Pressable>
                    <Pressable style={styles.secondaryButtonFlex} onPress={() => void removeDialogueNode(node.id)}><Text style={styles.dangerText}>Delete</Text></Pressable>
                  </View>
                </View>
              )})}
              <Text style={styles.selectedTitle}>Player Choices{selectedChoiceNode ? ` for ${selectedChoiceNode.title}` : ""}</Text>
              <Text style={styles.copy}>{selectedChoiceNode ? "Create choices for the selected dialogue step. Choices can move the conversation, start battle, reward the player, or return to the map." : "Select a dialogue step first."}</Text>
              <View style={styles.storyRoutePicker}>
                {dialogueNodes.map((node) => (
                  <Pressable key={node.id} style={[styles.routeChip, choiceNodeId === node.id && styles.routeChipActive]} onPress={() => selectDialogueNode(node.id)}>
                    <Text style={styles.routeChipText}>{node.sort_order}. {node.title}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={choiceButtonText} onChangeText={setChoiceButtonText} placeholder="Player button text" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={choicePlayerText} onChangeText={setChoicePlayerText} placeholder="Optional player dialogue text" placeholderTextColor={colors.muted} style={styles.input} />
              <View style={styles.typeGrid}>
                {(["go_to_node", "start_battle", "complete_event", "unlock_next_event", "give_reward", "end_conversation", "return_to_map"] as const).map((action) => (
                  <Pressable key={action} style={[styles.typeButton, choiceAction === action && styles.typeSelected]} onPress={() => setChoiceAction(action)}>
                    <Text style={styles.typeText}>{choiceActionLabel(action)}</Text>
                  </Pressable>
                ))}
              </View>
              {choiceAction === "go_to_node" ? (
                <View style={styles.storyRoutePicker}>
                  {dialogueNodes.map((node) => (
                    <Pressable key={node.id} style={[styles.routeChip, choiceNextNodeId === node.id && styles.routeChipActive]} onPress={() => setChoiceNextNodeId(node.id)}>
                      <Text style={styles.routeChipText}>Next: {node.title}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {choiceAction === "start_battle" ? renderLinkedBattleBuilder() : null}
              {choiceAction === "give_reward" ? (
                <>
                  <TextInput value={choiceRewardXp} onChangeText={setChoiceRewardXp} placeholder="Reward XP" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={choiceRewardGold} onChangeText={setChoiceRewardGold} placeholder="Reward gold" placeholderTextColor={colors.muted} style={styles.input} />
                  <ItemPicker label="Reward item" items={itemDefinitions} selectedId={choiceRewardItemId} onSelect={setChoiceRewardItemId} />
                  <TextInput value={choiceRewardItemQuantity} onChangeText={setChoiceRewardItemQuantity} placeholder="Reward item quantity" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={choiceRewardItem} onChangeText={setChoiceRewardItem} placeholder="Legacy reward item text optional" placeholderTextColor={colors.muted} style={styles.input} />
                </>
              ) : null}
              <TextInput value={choiceSortOrder} onChangeText={setChoiceSortOrder} placeholder="Choice order" placeholderTextColor={colors.muted} style={styles.input} />
              <Pressable style={styles.primaryButton} onPress={() => void saveDialogueChoice()} disabled={!choiceNodeId || !choiceButtonText.trim()}>
                <Text style={styles.primaryText}>{editingChoice ? "Update Player Choice" : "Add Player Choice"}</Text>
              </Pressable>
              {editingChoice ? <Pressable style={styles.secondaryButton} onPress={clearDialogueChoiceForm}><Text style={styles.secondaryText}>Cancel Choice Edit</Text></Pressable> : null}
              {selectedNodeChoices.map((choice) => (
                <View key={choice.id} style={styles.storyCard}>
                  <Text style={styles.markerName}>{choice.button_text}</Text>
                  <Text style={styles.copy}>{choiceActionLabel(choice.action)}{choice.player_dialogue_text ? ` - "${choice.player_dialogue_text}"` : ""}</Text>
                  <View style={styles.modeRow}>
                    <Pressable style={styles.secondaryButtonFlex} onPress={() => editDialogueChoice(choice)}><Text style={styles.secondaryText}>Edit Choice</Text></Pressable>
                    <Pressable style={styles.secondaryButtonFlex} onPress={() => void removeDialogueChoice(choice.id)}><Text style={styles.dangerText}>Delete</Text></Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View> : null}
          {selectedMarker && editorMode === "Marker" ? (
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
          ) : null}
        </Frame>
      ) : null}
    </Screen>
  );
}

function getRouteSegmentsForRoutes(routes: MapRoute[], activeRouteId: string) {
  return routes.flatMap((mapRoute) =>
    getRouteSegments(mapRoute.path_points).map((segment, index) => ({
      ...segment,
      id: `${mapRoute.id}-${index}`,
      isActive: mapRoute.id === activeRouteId,
      isDraft: false,
    })),
  );
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

function getConsumableSummary(item: ItemDefinition) {
  const target = item.potion_target ?? "health";
  const targetLabel = target === "magika" ? "mana" : target;
  const flat = Number(item.restore_amount ?? 0);
  const percent = Number(item.restore_percent ?? 0);

  if (flat > 0 && percent > 0) {
    return `Restores ${flat} + ${percent}% ${targetLabel}`;
  }

  if (percent > 0) {
    return `Restores ${percent}% ${targetLabel}`;
  }

  if (flat > 0) {
    return `Restores ${flat} ${targetLabel}`;
  }

  return item.description || "Quick use item";
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

function eventTypeName(type: MapEvent["event_type"]) {
  if (type === "battle") {
    return "Battle Event";
  }

  if (type === "clue") {
    return "Clue / Investigation Event";
  }

  if (type === "reward") {
    return "Reward Event";
  }

  return "Dialogue Event";
}

function eventTriggerModeName(event: MapEvent) {
  if ((event.trigger_mode ?? "fixed") === "random") {
    return `Random ${Number(event.random_chance_percent ?? 0)}% after ${event.distance_marker_percent}%`;
  }

  return `Fixed at ${event.distance_marker_percent}%`;
}

function choiceActionLabel(action: StoryDialogueChoice["action"]) {
  if (action === "go_to_node") {
    return "Go to another dialogue step";
  }

  if (action === "start_battle") {
    return "Start linked battle event";
  }

  if (action === "complete_event") {
    return "Complete this event";
  }

  if (action === "unlock_next_event") {
    return "Unlock next event";
  }

  if (action === "give_reward") {
    return "Give reward";
  }

  if (action === "end_conversation") {
    return "End conversation";
  }

  return "Return to map";
}

function formatResourceName(resource: string) {
  if (resource === "magicka" || resource === "magika") {
    return "Mana";
  }
  if (resource === "health") {
    return "Health";
  }
  if (resource === "stamina") {
    return "Stamina";
  }
  return resource;
}

function getChoiceTargetSummary(choice: StoryDialogueChoice, nodes: StoryDialogueNode[], events: MapEvent[]) {
  if (choice.action === "go_to_node") {
    const nextNode = nodes.find((node) => node.id === choice.next_node_id);
    return nextNode
      ? { label: `Then show dialogue step: ${nextNode.sort_order}. ${nextNode.title}`, isBroken: false }
      : { label: "Broken link: choose a target dialogue step", isBroken: true };
  }

  if (choice.action === "start_battle") {
    const battle = events.find((event) => event.id === choice.battle_event_id);
    return battle
      ? { label: `Then start battle: ${battle.title}`, isBroken: false }
      : { label: "Broken link: choose a target battle event", isBroken: true };
  }

  if (choice.action === "complete_event") {
    return { label: "Then complete this event", isBroken: false };
  }

  if (choice.action === "unlock_next_event") {
    return { label: "Then unlock the next trail event", isBroken: false };
  }

  if (choice.action === "give_reward") {
    return { label: `Then give reward: ${choice.reward_xp} XP${choice.reward_item ? ` and ${choice.reward_item}` : ""}`, isBroken: false };
  }

  if (choice.action === "end_conversation") {
    return { label: "Then end conversation", isBroken: false };
  }

  return { label: "Then return to map", isBroken: false };
}

function StoryInstanceScreen({
  event,
  nodes,
  choices,
  npcs,
  activeNodeId,
  dialogueLog,
  previewMode = false,
  onLegacyChoice,
  onChoice,
  onEndChat,
  onExitPreview,
}: {
  event: MapEvent;
  nodes: StoryDialogueNode[];
  choices: StoryDialogueChoice[];
  npcs: NpcDefinition[];
  activeNodeId: string | null;
  dialogueLog: string[];
  previewMode?: boolean;
  onLegacyChoice: (action: MapEvent["choices"][number]["action"]) => void;
  onChoice: (choice: StoryDialogueChoice) => void;
  onEndChat: (completeEvent: boolean) => void;
  onExitPreview?: () => void;
}) {
  const activeNode = nodes.find((node) => node.id === activeNodeId) ?? nodes.find((node) => node.is_start) ?? nodes[0] ?? null;
  const nodeChoices = activeNode ? choices.filter((choice) => choice.node_id === activeNode.id) : [];
  const legacyChoices = event.choices.length > 0 ? event.choices : [{ label: "Return to Map", action: "Continue" as const }];
  const nodeNpc = npcs.find((npc) => npc.id === activeNode?.npc_id);
  const eventNpc = npcs.find((npc) => npc.id === event.dialogue_npc_id);
  const npcName = nodeNpc?.name ?? activeNode?.npc_name ?? eventNpc?.name ?? event.npc_name;
  const npcPortrait = nodeNpc?.image_url ?? activeNode?.npc_portrait_url ?? eventNpc?.image_url ?? event.npc_portrait_url;

  return (
    <Screen>
      <Frame style={styles.eventScreen}>
        {previewMode ? (
          <View style={styles.previewBanner}>
            <Text style={styles.previewText}>Admin Preview - no rewards or progress will be saved.</Text>
            <Pressable style={styles.previewExitButton} onPress={onExitPreview}>
              <Text style={styles.secondaryText}>Exit Preview</Text>
            </Pressable>
          </View>
        ) : null}
        {(activeNode?.background_image_url ?? event.background_image_url) ? <Image source={{ uri: activeNode?.background_image_url ?? event.background_image_url ?? "" }} style={styles.eventImage} /> : <View style={styles.eventImagePlaceholder} />}
        {npcPortrait ? <Image source={{ uri: resolveEnemyImageUri(npcPortrait) ?? npcPortrait }} style={styles.npcPortrait} /> : null}
        <Text style={styles.sectionTitle}>{event.title}</Text>
        {npcName ? <Text style={styles.selectedTitle}>{npcName}</Text> : null}
        <Text style={styles.dialogueText}>{activeNode?.dialogue_text || event.dialogue_text || "The trail grows quiet."}</Text>
        {dialogueLog.map((line, index) => (
          <Text key={`${line}-${index}`} style={styles.copy}>{line}</Text>
        ))}
        <View style={styles.choiceStack}>
          {activeNode ? (
            <>
              {nodeChoices.map((choice) => (
                <Pressable key={choice.id} style={styles.primaryButton} onPress={() => onChoice(choice)}>
                  <Text style={styles.primaryText}>{choice.button_text}</Text>
                </Pressable>
              ))}
              {nodeChoices.length === 0 || activeNode.is_ending ? (
                <Pressable style={styles.primaryButton} onPress={() => onEndChat(activeNode.end_completes_event)}>
                  <Text style={styles.primaryText}>{activeNode.end_completes_event ? "Complete Event" : "Return to Map"}</Text>
                </Pressable>
              ) : null}
              {activeNode.allow_end_chat ? (
                <Pressable style={styles.secondaryButton} onPress={() => onEndChat(activeNode.end_completes_event)}>
                  <Text style={styles.secondaryText}>End Chat</Text>
                </Pressable>
              ) : null}
            </>
          ) : legacyChoices.map((choice, index) => (
            <Pressable key={`${choice.label}-${index}`} style={styles.primaryButton} onPress={() => onLegacyChoice(choice.action)}>
              <Text style={styles.primaryText}>{choice.label}</Text>
            </Pressable>
          ))}
        </View>
      </Frame>
    </Screen>
  );
}

function BattleEventScreen({
  character,
  event,
  playerHp,
  stamina,
  magicka,
  resources,
  enemyHp,
  activeEnemy,
  equippedAbilities,
  weapon,
  battleItems,
  inventoryOpen,
  battleLog,
  combatIndicators,
  revivePromptOpen,
  result,
  previewMode = false,
  onAction,
  onWeaponAction,
  onFlee,
  onUseItem,
  onToggleInventory,
  onDeclineRevive,
  onReturnToStart,
  onComplete,
  onExitPreview,
}: {
  character: CharacterWithDetails;
  event: MapEvent;
  playerHp: number;
  stamina: number;
  magicka: number;
  resources: CharacterResources;
  enemyHp: number;
  activeEnemy: EnemyWithLoadout | NpcWithLoadout | null;
  equippedAbilities: Array<AbilityDefinition | null>;
  weapon: ItemDefinition | null;
  battleItems: InventoryItem[];
  inventoryOpen: boolean;
  battleLog: string[];
  combatIndicators: CombatIndicator[];
  revivePromptOpen: boolean;
  result: "victory" | "defeat" | null;
  previewMode?: boolean;
  onAction: (ability: AbilityDefinition) => void;
  onWeaponAction: (weapon: ItemDefinition) => void;
  onFlee: () => void;
  onUseItem: (item: InventoryItem) => void;
  onToggleInventory: () => void;
  onDeclineRevive: () => void;
  onReturnToStart: () => void;
  onComplete: () => void;
  onExitPreview?: () => void;
}) {
  const [enemyImageFailed, setEnemyImageFailed] = useState(false);
  const [playerImageFailed, setPlayerImageFailed] = useState(false);
  const enemyImageUri = resolveEnemyImageUri(activeEnemy?.image_url ?? event.enemy_image_url);
  const backgroundUri = resolveSceneImageUri(event.background_image_url);
  const enemyMaxHp = Number(activeEnemy?.health ?? event.enemy_hp) || 30;
  const rewardXp = Number(event.reward_xp ?? 0) + Number(activeEnemy?.xp_reward ?? 0);
  const rewardGold = Number(event.reward_gold ?? 0) + Number(activeEnemy?.gold_reward ?? 0);
  const battlePhase = result === "victory" ? "Victory" : result === "defeat" ? "Defeat" : revivePromptOpen ? "Revive Choice" : "Your Turn";
  const playerTurnActive = !result && !revivePromptOpen;
  const enemyIntent = getEnemyIntent(activeEnemy, event);
  const enemyLevel = getBattleEnemyLevel(enemyMaxHp);

  useEffect(() => {
    setEnemyImageFailed(false);
  }, [enemyImageUri]);

  useEffect(() => {
    setPlayerImageFailed(false);
  }, [character.portrait_url]);

  const enemyIndicators = combatIndicators.filter((indicator) => indicator.target === "enemy");
  const playerIndicators = combatIndicators.filter((indicator) => indicator.target === "player");
  const reviveItem = battleItems.find((entry) => isReviveBattleItem(entry.item));

  return (
    <Screen>
      <Frame style={backgroundUri ? [styles.eventScreen, styles.battleScreenFrame, ({ backgroundImage: `url(${backgroundUri})`, backgroundSize: "cover", backgroundPosition: "center" } as never)] : [styles.eventScreen, styles.battleScreenFrame]}>
        <View style={styles.battleBackdrop}>
        {previewMode ? (
          <View style={styles.previewBanner}>
            <Text style={styles.previewText}>Admin Battle Preview - no Health, items, rewards, or route progress will be saved.</Text>
            <Pressable style={styles.previewExitButton} onPress={onExitPreview}>
              <Text style={styles.secondaryText}>Exit Preview</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.battleHeader}>
          <View>
            <Text style={styles.sectionTitle}>{event.title}</Text>
            <Text style={styles.copy}>{event.battle_intro_text || "Battle encounter"}</Text>
          </View>
          <View style={styles.phasePill}>
            <Text style={styles.phaseText}>{battlePhase}</Text>
          </View>
        </View>
        <View style={styles.battleArena}>
          <View style={[styles.enemyPanel, !playerTurnActive && !result && styles.combatantActive]}>
            <View style={styles.combatantInfo}>
              <Text style={styles.combatantName} numberOfLines={1}>{activeEnemy?.name || event.enemy_name || "Enemy"}</Text>
              <Text style={styles.combatantSub} numberOfLines={1}>{activeEnemy?.type || "Enemy"} / Level {enemyLevel}</Text>
              <ResourceMeter label="HP" value={enemyHp} max={enemyMaxHp} color={colors.red} />
              <View style={styles.enemyIntentBox}>
                <Text style={styles.enemyIntentLabel}>Intent</Text>
                <Text style={styles.enemyIntentText} numberOfLines={1}>{enemyIntent}</Text>
              </View>
              {enemyImageUri && enemyImageFailed ? <Text style={styles.errorText}>Enemy image failed to load.</Text> : null}
            </View>
            <View style={[styles.combatImageWrap, enemyIndicators.length > 0 && styles.combatImageHit]}>
              {enemyImageUri && !enemyImageFailed ? <Image source={{ uri: enemyImageUri }} style={styles.enemyImage} onError={() => setEnemyImageFailed(true)} /> : <View style={styles.enemyImagePlaceholder}><Text style={styles.copy}>Enemy image missing</Text></View>}
              <CombatIndicatorStack indicators={enemyIndicators} />
            </View>
          </View>
          <View style={[styles.playerPanel, playerTurnActive && styles.combatantActive]}>
            <View style={[styles.combatImageWrap, playerIndicators.length > 0 && styles.combatImageHit]}>
              {character.portrait_url && !playerImageFailed ? <Image source={{ uri: character.portrait_url }} style={styles.battlePortrait} onError={() => setPlayerImageFailed(true)} /> : <Text style={styles.playerInitial}>{character.name.slice(0, 1).toUpperCase()}</Text>}
              <CombatIndicatorStack indicators={playerIndicators} />
            </View>
            <View style={styles.combatantInfo}>
              <Text style={styles.combatantName} numberOfLines={1}>{character.name}</Text>
              <Text style={styles.combatantSub} numberOfLines={1}>{character.origin || "Adventurer"}</Text>
              <ResourceMeter label="HP" value={playerHp} max={resources.maxHp} color={colors.red} />
              <ResourceMeter label="Stamina" value={stamina} max={resources.maxStamina} color={colors.gold} compact />
              <ResourceMeter label="Mana" value={magicka} max={resources.maxMagicka} color={colors.blue} compact />
            </View>
          </View>
        </View>
        <View style={styles.abilityGrid}>
          {equippedAbilities.map((ability, index) => {
            const resourcePool = ability?.resource === "stamina" ? stamina : ability?.resource === "magicka" ? magicka : ability?.resource === "health" ? playerHp : Number.POSITIVE_INFINITY;
            const hasResource = ability ? resourcePool >= ability.cost : false;
            return (
              <BattleActionCard
                key={`ability-${index}`}
                ability={ability}
                slotNumber={index + 1}
                disabled={!ability || !hasResource || Boolean(result)}
                unavailableReason={ability && !hasResource ? "Not enough resource" : null}
                onPress={() => ability ? onAction(ability) : undefined}
              />
          )})}
        </View>
        <View style={styles.battleUtilityRow}>
          <Pressable style={styles.inventoryBattleButton} onPress={onToggleInventory}>
            <Text style={styles.secondaryText}>Inventory</Text>
          </Pressable>
          {!result ? (
            <Pressable style={styles.fleeBattleButton} onPress={onFlee}>
              <Text style={styles.dangerText}>Flee</Text>
            </Pressable>
          ) : null}
        </View>
        {revivePromptOpen ? (
          <View style={styles.revivePrompt}>
            <Text style={styles.selectedTitle}>You have fallen</Text>
            <Text style={styles.copy}>
              {reviveItem ? `${reviveItem.item.name} is in your inventory. Use it to continue this battle, or return to the start of the trail.` : "No Revive Scroll found. Return to the start of the trail."}
            </Text>
            <View style={styles.modeRow}>
              {reviveItem ? (
                <Pressable style={styles.primaryButton} onPress={() => onUseItem(reviveItem)}>
                  <Text style={styles.primaryText}>Use {reviveItem.item.name}</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.secondaryButtonFlex} onPress={onDeclineRevive}>
                <Text style={styles.secondaryText}>Return to Trail Start</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {inventoryOpen ? (
          <View style={styles.battleInventory}>
            {battleItems.length === 0 ? <Text style={styles.copy}>No usable battle items.</Text> : null}
            {battleItems.map((entry) => (
              <Pressable key={entry.id} style={styles.feedItem} onPress={() => onUseItem(entry)}>
                <Text style={styles.markerName}>{entry.item.name} x{entry.quantity}</Text>
              <Text style={styles.copy}>{entry.item.type} - restores {entry.item.restore_amount || entry.item.restore_percent || 0} {formatResourceName(entry.item.potion_target ?? "health")}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {result === "victory" ? (
          <View style={styles.battleResultPanel}>
            <Text style={styles.selectedTitle}>Victory Rewards</Text>
            <Text style={styles.copy}>{event.victory_text || "The enemy falls."}</Text>
            <Text style={styles.copy}>XP {rewardXp} / Gold {rewardGold}{event.reward_item_id ? ` / Item reward ready` : ""}</Text>
            <Pressable style={styles.primaryButton} onPress={onComplete}>
              <Text style={styles.primaryText}>Claim Rewards</Text>
            </Pressable>
          </View>
        ) : null}
        {result === "defeat" && !revivePromptOpen ? (
          <View style={styles.battleResultPanel}>
            <Text style={styles.selectedTitle}>Defeated</Text>
            <Text style={styles.copy}>Defeat is final for this attempt. Return to the trail start to continue.</Text>
            <Pressable style={styles.primaryButton} onPress={onReturnToStart}>
              <Text style={styles.primaryText}>Return to Trail Start</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.battleLogPanel}>
          <Text style={styles.battleLogTitle}>Battle Log</Text>
          {battleLog.slice(0, 5).map((line, index) => (
            <Text key={`${line}-${index}`} style={styles.battleLogLine}>{line}</Text>
          ))}
        </View>
        </View>
      </Frame>
    </Screen>
  );
}

function getEnemyIntent(enemy: EnemyWithLoadout | NpcWithLoadout | null, event: MapEvent) {
  const strongestAbility = enemy?.abilities
    ?.filter((entry) => entry.ability)
    .sort((a, b) => Number(b.use_weight ?? 0) - Number(a.use_weight ?? 0))[0]?.ability;

  if (strongestAbility) {
    return strongestAbility.type === "attack"
      ? `Preparing ${strongestAbility.name}`
      : `May use ${strongestAbility.name}`;
  }

  return event.enemy_attack_damage > 0 ? `Attack for ${event.enemy_attack_damage}` : "Watching your move";
}

function getBattleEnemyLevel(enemyMaxHp: number) {
  return Math.max(1, Math.round(enemyMaxHp / 25));
}

function MiniMapMarkerAdminForm({
  activeSectionMarkerTypes,
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
  markerShopImage,
  setMarkerShopImage,
  markerShopBackground,
  setMarkerShopBackground,
  markerInteractionRadius,
  setMarkerInteractionRadius,
  markerInteractable,
  setMarkerInteractable,
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
  markerRepeatable,
  setMarkerRepeatable,
  markerRewardOnce,
  setMarkerRewardOnce,
  markerLinkedRouteId,
  setMarkerLinkedRouteId,
  markerStartsRouteOnAccept,
  setMarkerStartsRouteOnAccept,
  markerStoryOrder,
  setMarkerStoryOrder,
  markerUnlockAfterId,
  setMarkerUnlockAfterId,
  markerHideWhenCompleted,
  setMarkerHideWhenCompleted,
  markerRequireAllLinkedRoutes,
  setMarkerRequireAllLinkedRoutes,
  routes,
  storyRoutes,
  selectedMarkerRouteIds,
  toggleSignPostRoute,
  worldMarkers,
  storyScopeMarkers,
  miniMaps,
  markerExitTargetType,
  setMarkerExitTargetType,
  markerExitTargetMarkerId,
  setMarkerExitTargetMarkerId,
  markerExitTargetMiniMapId,
  setMarkerExitTargetMiniMapId,
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
}: {
  activeSectionMarkerTypes: readonly string[];
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
  markerShopImage: string;
  setMarkerShopImage: (value: string) => void;
  markerShopBackground: string;
  setMarkerShopBackground: (value: string) => void;
  markerInteractionRadius: string;
  setMarkerInteractionRadius: (value: string) => void;
  markerInteractable: boolean;
  setMarkerInteractable: (value: boolean | ((current: boolean) => boolean)) => void;
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
  markerRepeatable: boolean;
  setMarkerRepeatable: (value: boolean | ((current: boolean) => boolean)) => void;
  markerRewardOnce: boolean;
  setMarkerRewardOnce: (value: boolean | ((current: boolean) => boolean)) => void;
  markerLinkedRouteId: string | null;
  setMarkerLinkedRouteId: (value: string | null) => void;
  markerStartsRouteOnAccept: boolean;
  setMarkerStartsRouteOnAccept: (value: boolean | ((current: boolean) => boolean)) => void;
  markerStoryOrder: string;
  setMarkerStoryOrder: (value: string) => void;
  markerUnlockAfterId: string | null;
  setMarkerUnlockAfterId: (value: string | null) => void;
  markerHideWhenCompleted: boolean;
  setMarkerHideWhenCompleted: (value: boolean | ((current: boolean) => boolean)) => void;
  markerRequireAllLinkedRoutes: boolean;
  setMarkerRequireAllLinkedRoutes: (value: boolean | ((current: boolean) => boolean)) => void;
  routes: MapRoute[];
  storyRoutes: MapRoute[];
  selectedMarkerRouteIds: string[];
  toggleSignPostRoute: (routeId: string) => void;
  worldMarkers: MapMarker[];
  storyScopeMarkers: MapMarker[];
  miniMaps: MiniMap[];
  markerExitTargetType: MapMarker["exit_target_type"];
  setMarkerExitTargetType: (value: MapMarker["exit_target_type"]) => void;
  markerExitTargetMarkerId: string | null;
  setMarkerExitTargetMarkerId: (value: string | null) => void;
  markerExitTargetMiniMapId: string | null;
  setMarkerExitTargetMiniMapId: (value: string | null) => void;
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
}) {
  const supportsQuest = isQuestMarkerType(draftType);
  const supportsMarket = draftType === "Market" || selectedMarker?.type === "Market";
  const supportsExit = isExitMarkerType(draftType);
  const supportsSignPost = draftType === "Sign Post";

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Create / Edit Mini Map Marker</Text>
      <View style={styles.typeGrid}>
        {activeSectionMarkerTypes.map((type) => (
          <Pressable key={type} style={[styles.typeButton, draftType === type && styles.typeSelected]} onPress={() => setDraftType(type)}>
            <Text style={styles.typeText}>{type}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={draftTitle} onChangeText={setDraftTitle} placeholder="Marker title" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={draftDescription} onChangeText={setDraftDescription} placeholder="Marker description" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={markerSceneBackground} onChangeText={setMarkerSceneBackground} placeholder="Marker scene background image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
      <AdminImageUploadButton folder="mini-marker-backgrounds" onUploaded={setMarkerSceneBackground} onMessage={() => undefined} />
      <TextInput value={markerNpcImage} onChangeText={setMarkerNpcImage} placeholder="NPC / character image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
      <AdminImageUploadButton folder="mini-marker-npcs" onUploaded={setMarkerNpcImage} onMessage={() => undefined} />
      <TextInput value={markerIconLabel} onChangeText={setMarkerIconLabel} placeholder="Marker icon text, example MKT" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={markerIconImage} onChangeText={setMarkerIconImage} placeholder="Marker icon image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
      <AdminImageUploadButton folder="mini-marker-icons" onUploaded={setMarkerIconImage} onMessage={() => undefined} />
      <TextInput value={markerIconColor} onChangeText={setMarkerIconColor} placeholder="Marker icon color, example #d9a441" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={markerInteractionRadius} onChangeText={setMarkerInteractionRadius} placeholder="Interaction radius percent, example 4" placeholderTextColor={colors.muted} style={styles.input} />
      <Pressable style={[styles.secondaryButton, markerInteractable && styles.typeSelected]} onPress={() => setMarkerInteractable((value) => !value)}>
        <Text style={styles.secondaryText}>Interactable: {markerInteractable ? "true" : "false"}</Text>
      </Pressable>
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
          {routes.length === 0 ? <Text style={styles.copy}>No walking paths exist in this season/chapter yet.</Text> : null}
          {selectedMarker ? (
            <Text style={styles.debugLine}>Save Marker Details after changing linked paths.</Text>
          ) : (
            <Text style={styles.debugLine}>Selected paths will be linked when the Sign Post marker is created.</Text>
          )}
        </View>
      ) : null}
      {supportsExit ? (
        <ExitTargetEditor
          targetType={markerExitTargetType}
          setTargetType={setMarkerExitTargetType}
          targetMarkerId={markerExitTargetMarkerId}
          setTargetMarkerId={setMarkerExitTargetMarkerId}
          targetMiniMapId={markerExitTargetMiniMapId}
          setTargetMiniMapId={setMarkerExitTargetMiniMapId}
          worldMarkers={worldMarkers}
          miniMaps={miniMaps}
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

function ItemPicker({ label, items, selectedId, onSelect }: { label: string; items: ItemDefinition[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>{label}</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedId === null && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>None</Text>
        </Pressable>
        {items.map((item) => (
          <Pressable key={item.id} style={[styles.routeChip, selectedId === item.id && styles.routeChipActive]} onPress={() => onSelect(item.id)}>
            <Text style={styles.routeChipText}>{item.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function LockPicker({ label, value, onSelect }: { label: string; value: (typeof lockTypes)[number]; onSelect: (value: (typeof lockTypes)[number]) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>{label}</Text>
      <View style={styles.storyRoutePicker}>
        {lockTypes.map((type) => (
          <Pressable key={type} style={[styles.routeChip, value === type && styles.routeChipActive]} onPress={() => onSelect(type)}>
            <Text style={styles.routeChipText}>{lockTypeLabels[type]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function RewardTimingPicker({ value, onSelect }: { value: (typeof rewardTimings)[number]; onSelect: (value: (typeof rewardTimings)[number]) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Reward Timing</Text>
      <View style={styles.storyRoutePicker}>
        {rewardTimings.map((timing) => (
          <Pressable key={timing} style={[styles.routeChip, value === timing && styles.routeChipActive]} onPress={() => onSelect(timing)}>
            <Text style={styles.routeChipText}>{rewardTimingLabels[timing]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ExitTargetEditor({
  targetType,
  setTargetType,
  targetMarkerId,
  setTargetMarkerId,
  targetMiniMapId,
  setTargetMiniMapId,
  worldMarkers,
  miniMaps,
}: {
  targetType: MapMarker["exit_target_type"];
  setTargetType: (value: MapMarker["exit_target_type"]) => void;
  targetMarkerId: string | null;
  setTargetMarkerId: (value: string | null) => void;
  targetMiniMapId: string | null;
  setTargetMiniMapId: (value: string | null) => void;
  worldMarkers: MapMarker[];
  miniMaps: MiniMap[];
}) {
  const safeType = targetType ?? "world_marker";
  const worldTargets = worldMarkers.filter((marker) => !marker.mini_map_id);

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Exit Target</Text>
      <View style={styles.storyRoutePicker}>
        {exitTargetTypes.map((type) => (
          <Pressable
            key={type}
            style={[styles.routeChip, safeType === type && styles.routeChipActive]}
            onPress={() => {
              setTargetType(type);
              if (type === "world_marker") {
                setTargetMiniMapId(null);
              } else {
                setTargetMarkerId(null);
              }
            }}
          >
            <Text style={styles.routeChipText}>{type === "world_marker" ? "Return To World Marker" : "Open Another Mini Map"}</Text>
          </Pressable>
        ))}
      </View>
      {safeType === "world_marker" ? (
        <MarkerPicker label="World return marker" markers={worldTargets} selectedId={targetMarkerId} onSelect={setTargetMarkerId} />
      ) : (
        <MiniMapPicker miniMaps={miniMaps} selectedId={targetMiniMapId} onSelect={setTargetMiniMapId} />
      )}
    </View>
  );
}

function MarketListingModePicker({ value, onSelect }: { value: MarkerMarketItem["listing_mode"]; onSelect: (value: MarkerMarketItem["listing_mode"]) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Listing Mode</Text>
      <View style={styles.storyRoutePicker}>
        {marketListingModes.map((mode) => (
          <Pressable key={mode} style={[styles.routeChip, value === mode && styles.routeChipActive]} onPress={() => onSelect(mode)}>
            <Text style={styles.routeChipText}>{formatMarketListingMode(mode)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.copy}>Sell Only means this market buys the item from players but does not sell it as stock.</Text>
    </View>
  );
}

function MiniMapPicker({ miniMaps, selectedId, onSelect }: { miniMaps: MiniMap[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Linked Mini Map</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedId === null && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>None</Text>
        </Pressable>
        {miniMaps.map((miniMap) => (
          <Pressable key={miniMap.id} style={[styles.routeChip, selectedId === miniMap.id && styles.routeChipActive]} onPress={() => onSelect(miniMap.id)}>
            <Text style={styles.routeChipText}>{miniMap.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MarkerPicker({ label, markers, selectedId, onSelect }: { label: string; markers: MapMarker[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>{label}</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedId === null && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>None</Text>
        </Pressable>
        {markers.map((marker) => (
          <Pressable key={marker.id} style={[styles.routeChip, selectedId === marker.id && styles.routeChipActive]} onPress={() => onSelect(marker.id)}>
            <Text style={styles.routeChipText}>{marker.title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function RoutePicker({ routes, selectedId, onSelect }: { routes: MapRoute[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Linked Walking Path</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedId === null && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>None</Text>
        </Pressable>
        {routes.map((route) => (
          <Pressable key={route.id} style={[styles.routeChip, selectedId === route.id && styles.routeChipActive]} onPress={() => onSelect(route.id)}>
            <Text style={styles.routeChipText}>{route.sort_order}. {route.name}</Text>
          </Pressable>
        ))}
      </View>
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

function EnemyPicker({ enemies, selectedId, onSelect }: { enemies: EnemyDefinition[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.copy}>Select an enemy created in Home / Abilities / Enemy Admin.</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedId === null && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>Manual Enemy</Text>
        </Pressable>
        {enemies.map((enemy) => (
          <Pressable key={enemy.id} style={[styles.routeChip, selectedId === enemy.id && styles.routeChipActive]} onPress={() => onSelect(enemy.id)}>
            <Text style={styles.routeChipText}>{enemy.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function NpcPicker({ label, npcs, selectedId, onSelect, battleOnly = false }: { label: string; npcs: NpcDefinition[]; selectedId: string | null; onSelect: (id: string | null) => void; battleOnly?: boolean }) {
  const options = battleOnly ? npcs.filter((npc) => npc.can_battle) : npcs;
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.copy}>{label}</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedId === null && styles.routeChipActive]} onPress={() => onSelect(null)}>
          <Text style={styles.routeChipText}>None</Text>
        </Pressable>
        {options.map((npc) => (
          <Pressable key={npc.id} style={[styles.routeChip, selectedId === npc.id && styles.routeChipActive]} onPress={() => onSelect(npc.id)}>
            <Text style={styles.routeChipText}>{npc.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function getItemName(items: ItemDefinition[], itemId: string | null) {
  return items.find((item) => item.id === itemId)?.name ?? "Unknown Item";
}

function formatMarketListingMode(mode: MarkerMarketItem["listing_mode"] | null | undefined) {
  if (mode === "buy_only") {
    return "Buy Only";
  }
  if (mode === "sell_only") {
    return "Sell Only";
  }
  return "Buy and Sell";
}

function getEnemyName(enemies: EnemyDefinition[], enemyId: string | null) {
  return enemies.find((enemy) => enemy.id === enemyId)?.name ?? "Unknown Enemy";
}

function getNpcName(npcs: NpcDefinition[], npcId: string | null) {
  return npcs.find((npc) => npc.id === npcId)?.name ?? "Unknown NPC";
}

function getRouteName(routes: MapRoute[], routeId: string) {
  return routes.find((route) => route.id === routeId)?.name ?? "Unknown Path";
}

function compareEventsByRouteAndDistance(a: MapEvent, b: MapEvent) {
  return String(a.route_id ?? "").localeCompare(String(b.route_id ?? "")) || Number(a.distance_marker_percent) - Number(b.distance_marker_percent) || a.title.localeCompare(b.title);
}

function isQuestMarkerType(type: string) {
  return ["Quest", "Side Quest", "Story", "Point of Interest"].includes(type);
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
    backgroundColor: "rgba(5, 8, 9, 0.94)",
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
  },
  journeyPercent: {
    color: colors.gold,
    minWidth: 38,
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
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.text,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.28)",
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
  eventScreen: {
    margin: 12,
    padding: 14,
    gap: 12,
  },
  previewBanner: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.42)",
    padding: 10,
    gap: 8,
  },
  previewText: {
    color: colors.text,
    fontWeight: "800",
    lineHeight: 18,
  },
  previewExitButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  eventImage: {
    width: "100%",
    height: 220,
    borderRadius: 8,
  },
  eventImagePlaceholder: {
    width: "100%",
    height: 160,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(20, 61, 86, 0.35)",
  },
  npcPortrait: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  dialogueText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  choiceStack: {
    gap: 10,
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
