import { distance as turfDistance } from "@turf/turf";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { CharacterWithDetails } from "../services/characterService";
import { AbilityDefinition, CharacterResources, getAbilityCostLabel, getAbilityDamage, getCharacterResources, getCombatLoadout } from "../services/abilityService";
import { CombatAbility, EnemyDefinition, EnemyWithLoadout, getEnemies, getEnemyLoadout } from "../services/combatAdminService";
import { consumeInventoryItem, getBattleUsableItems, getInventoryResourceBonuses, getInventoryState, grantItemToCharacter, InventoryItem, ItemDefinition } from "../services/inventoryService";
import {
  completeMapEvent,
  applyRewards,
  buyMarketItem,
  createDialogueChoice,
  createDialogueNode,
  createMapRoute,
  createMapEvent,
  createMapMarker,
  deleteMarkerMarketItem,
  deleteDialogueChoice,
  deleteDialogueNode,
  deleteMapEvent,
  deleteMapMarker,
  fallbackRoute,
  getCurrentRole,
  getMapMarkers,
  getMapRoutes,
  getMapEvents,
  getMarkerMarketItems,
  getDialogueChoices,
  getDialogueNodes,
  getEventCompletions,
  getRouteProgress,
  getRouteProgressForRoutes,
  MapMarker,
  MapEvent,
  MapRoute,
  MarkerMarketItem,
  Role,
  resetRouteProgress,
  StoryDialogueChoice,
  StoryDialogueNode,
  saveMarkerMarketItem,
  saveRouteProgress,
  sellMarketInventoryItem,
  updateDialogueChoice,
  updateDialogueNode,
  updateMapEvent,
  updateMapMarker,
  updateMarkerSettings,
  updateMapRoute,
} from "../services/mapService";

const forgottenMarches = require("../../assets/TheForgottenMarches.png");
const mapSize = { width: 1800, height: 1400 };
const markerTypes = ["Story", "Side Quest", "Market", "Point of Interest", "Battle Zone", "Training Spot"];
const editorModes = ["Marker", "Walking Path"] as const;
const eventTypes = ["dialogue", "battle", "clue", "reward"] as const;
const choiceActions = ["Continue", "Investigate", "Ask Questions", "Start Battle", "Complete Event"] as const;
const eventTypeLabels: Record<(typeof eventTypes)[number], string> = {
  dialogue: "Dialogue Event",
  battle: "Battle Event",
  clue: "Clue / Investigation Event",
  reward: "Reward Event",
};
const maxGpsAccuracyMeters = 50;
const maxTrackingGapSeconds = 60;
const movementSpeedThresholdMph = 1;
const movementStateDebounceMs = 5000;
const maxHumanSpeedMph = 12;
const minCountedGpsMeters = 0.5;

type MapScreenProps = {
  character: CharacterWithDetails;
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

export function MapScreen({ character }: MapScreenProps) {
  const [route, setRoute] = useState<MapRoute>(fallbackRoute);
  const [routes, setRoutes] = useState<MapRoute[]>([fallbackRoute]);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [mapEvents, setMapEvents] = useState<MapEvent[]>([]);
  const [completedEventIds, setCompletedEventIds] = useState<Set<string>>(new Set());
  const [activeEvent, setActiveEvent] = useState<MapEvent | null>(null);
  const [activeBattle, setActiveBattle] = useState<MapEvent | null>(null);
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
  const [activeEnemy, setActiveEnemy] = useState<EnemyWithLoadout | null>(null);
  const [combatResources, setCombatResources] = useState<CharacterResources>(() => getCharacterResources(character));
  const [equippedAbilities, setEquippedAbilities] = useState<Array<AbilityDefinition | null>>([null, null, null, null]);
  const [enemyDefinitions, setEnemyDefinitions] = useState<EnemyDefinition[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [itemDefinitions, setItemDefinitions] = useState<ItemDefinition[]>([]);
  const [equippedItems, setEquippedItems] = useState<Record<string, ItemDefinition | null>>({});
  const [battleInventoryOpen, setBattleInventoryOpen] = useState(false);
  const [role, setRole] = useState<Role>("player");
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
  const [routeProgressRows, setRouteProgressRows] = useState<Array<{ route_id: string; progress_percent: number }>>([]);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [clickedPercent, setClickedPercent] = useState<{ x: number; y: number } | null>(null);
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
  const [markerInteractionRadius, setMarkerInteractionRadius] = useState("4");
  const [markerInteractable, setMarkerInteractable] = useState(true);
  const [markerRewardXp, setMarkerRewardXp] = useState("0");
  const [markerRewardGold, setMarkerRewardGold] = useState("0");
  const [markerRewardItemId, setMarkerRewardItemId] = useState<string | null>(null);
  const [markerRewardQuantity, setMarkerRewardQuantity] = useState("1");
  const [markerRepeatable, setMarkerRepeatable] = useState(false);
  const [markerRewardOnce, setMarkerRewardOnce] = useState(true);
  const [markerMarketItems, setMarkerMarketItems] = useState<MarkerMarketItem[]>([]);
  const [marketItemId, setMarketItemId] = useState<string | null>(null);
  const [marketBuyPrice, setMarketBuyPrice] = useState("0");
  const [marketSellPrice, setMarketSellPrice] = useState("0");
  const [marketStock, setMarketStock] = useState("0");
  const [marketUnlimited, setMarketUnlimited] = useState(true);
  const [markerPanelMessage, setMarkerPanelMessage] = useState<string | null>(null);
  const [previewMarkerScene, setPreviewMarkerScene] = useState(false);
  const [editorMode, setEditorMode] = useState<(typeof editorModes)[number]>("Marker");
  const [pathDraft, setPathDraft] = useState<Array<{ x: number; y: number }>>([]);
  const [routeName, setRouteName] = useState("");
  const [routeOrder, setRouteOrder] = useState("1");
  const [routeTerrain, setRouteTerrain] = useState("");
  const [routeDanger, setRouteDanger] = useState("");
  const [routeDistance, setRouteDistance] = useState("");
  const [editingEvent, setEditingEvent] = useState<MapEvent | null>(null);
  const [eventType, setEventType] = useState<(typeof eventTypes)[number]>("dialogue");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDistance, setEventDistance] = useState("25");
  const [eventBackgroundImage, setEventBackgroundImage] = useState("");
  const [eventNpcName, setEventNpcName] = useState("");
  const [eventNpcPortrait, setEventNpcPortrait] = useState("");
  const [eventDialogue, setEventDialogue] = useState("");
  const [eventChoices, setEventChoices] = useState("Continue|Continue\nInvestigate|Investigate\nStart Battle|Start Battle");
  const [enemyName, setEnemyName] = useState("");
  const [enemyImage, setEnemyImage] = useState("");
  const [enemyHp, setEnemyHp] = useState("30");
  const [enemyAttack, setEnemyAttack] = useState("5");
  const [eventEnemyId, setEventEnemyId] = useState<string | null>(null);
  const [battleIntro, setBattleIntro] = useState("");
  const [victoryText, setVictoryText] = useState("");
  const [defeatText, setDefeatText] = useState("");
  const [rewardXp, setRewardXp] = useState("0");
  const [rewardGold, setRewardGold] = useState("0");
  const [rewardItem, setRewardItem] = useState("");
  const [rewardItemId, setRewardItemId] = useState<string | null>(null);
  const [rewardItemQuantity, setRewardItemQuantity] = useState("1");
  const [selectedDialogueEventId, setSelectedDialogueEventId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<StoryDialogueNode | null>(null);
  const [editingChoice, setEditingChoice] = useState<StoryDialogueChoice | null>(null);
  const [nodeTitle, setNodeTitle] = useState("");
  const [nodeKey, setNodeKey] = useState("");
  const [nodeNpcName, setNodeNpcName] = useState("");
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
  const [choiceRewardXp, setChoiceRewardXp] = useState("0");
  const [choiceRewardGold, setChoiceRewardGold] = useState("0");
  const [choiceRewardItem, setChoiceRewardItem] = useState("");
  const [choiceRewardItemId, setChoiceRewardItemId] = useState<string | null>(null);
  const [choiceRewardItemQuantity, setChoiceRewardItemQuantity] = useState("1");
  const [choiceSortOrder, setChoiceSortOrder] = useState("0");
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [scale, setScale] = useState(0.86);
  const [followPlayer, setFollowPlayer] = useState(true);
  const [completedRouteId, setCompletedRouteId] = useState<string | null>(null);
  const viewportRef = useRef<{
    scrollLeft?: number;
    scrollTop?: number;
    clientWidth?: number;
    clientHeight?: number;
    scrollTo?: (options: { left: number; top: number; behavior?: "smooth" | "auto" }) => void;
  } | null>(null);
  const watchId = useRef<number | null>(null);
  const distanceWalkedRef = useRef(0);
  const routeRef = useRef(fallbackRoute);
  const movementStateRef = useRef<PlayerMovementState>("IDLE");
  const movementCandidateRef = useRef<{ state: PlayerMovementState; since: number } | null>(null);
  const lastCaptureRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const isAdmin = role === "admin";
  const scaledMapSize = useMemo(() => ({ width: mapSize.width * scale, height: mapSize.height * scale }), [scale]);

  const progressPercent = Math.min(100, Math.max(0, (distanceWalked / route.distance_required_meters) * 100));
  const orderedRoutes = useMemo(() => [...routes].sort(compareRoutes), [routes]);
  const routeProgressPosition = useMemo(() => getPointOnRoute(route.path_points, progressPercent), [route.path_points, progressPercent]);
  const playerPosition = savedPlayerPosition ?? routeProgressPosition;
  const routeSegments = useMemo(() => getRouteSegmentsForRoutes(orderedRoutes, route.id), [orderedRoutes, route.id]);
  const draftSegments = useMemo(() => getRouteSegments(pathDraft).map((segment) => ({ ...segment, id: `draft-${segment.left}-${segment.top}`, isActive: true, isDraft: true })), [pathDraft]);
  const visibleMarkers = isAdmin ? markers : markers.filter((marker) => canPlayerSeeMarker(marker, playerPosition));
  const unlockedRouteIds = useMemo(() => getUnlockedRouteIds(orderedRoutes, routeProgressRows), [orderedRoutes, routeProgressRows]);
  const selectedDialogueEvent = useMemo(() => mapEvents.find((event) => event.id === selectedDialogueEventId) ?? null, [mapEvents, selectedDialogueEventId]);
  const selectedChoiceNode = useMemo(() => dialogueNodes.find((node) => node.id === choiceNodeId) ?? null, [choiceNodeId, dialogueNodes]);
  const selectedNodeChoices = useMemo(
    () => (choiceNodeId ? dialogueChoices.filter((choice) => choice.node_id === choiceNodeId).sort((a, b) => a.sort_order - b.sort_order) : []),
    [choiceNodeId, dialogueChoices],
  );
  const selectedMarkerDistance = selectedMarker ? getPercentDistance(playerPosition, { x: Number(selectedMarker.x_percent), y: Number(selectedMarker.y_percent) }) : 0;
  const selectedMarkerRadius = Number(selectedMarker?.interaction_radius_percent ?? 4) || 4;
  const canUseSelectedMarker = isAdmin || Boolean(selectedMarker && canPlayerSeeMarker(selectedMarker, playerPosition));

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
      setEnemyDefinitions(await getEnemies());
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to load enemies."));
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
    if (progressPercent < 100 || completedRouteId === route.id) {
      return;
    }

    setCompletedRouteId(route.id);
    const nextRoute = getNextRoute(orderedRoutes, route);

    if (!nextRoute) {
      setGpsMessage(`${route.name} completed. No next walking path is active yet.`);
      return;
    }

    setGpsMessage(`${route.name} completed. Beginning ${nextRoute.name}.`);
    void selectRoute(nextRoute, true);
  }, [completedRouteId, orderedRoutes, progressPercent, route]);

  useEffect(() => {
    if (activeEvent || activeBattle || playerMovementState !== "MOVING") {
      return;
    }

    const nextEvent = mapEvents.find(
      (event) =>
        event.is_active &&
        event.route_id === route.id &&
        !completedEventIds.has(event.id) &&
        Number(event.distance_marker_percent) <= progressPercent,
    );

    if (!nextEvent) {
      return;
    }

    if (nextEvent.event_type === "battle") {
        void startBattle(nextEvent);
      return;
    }

    setActiveEvent(nextEvent);
  }, [activeBattle, activeEvent, completedEventIds, mapEvents, playerMovementState, progressPercent, route.id]);

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
    const [loadedRoutes, loadedMarkers, loadedRole] = await Promise.all([getMapRoutes(), getMapMarkers(), getCurrentRole()]);
    const nextRoutes = [...loadedRoutes].sort(compareRoutes);
    const progressRows = await getRouteProgressForRoutes(nextRoutes.map((item) => item.id));
    const firstRoute = getFirstUnfinishedRoute(nextRoutes, progressRows) ?? nextRoutes.find((item) => item.is_active) ?? nextRoutes[0] ?? fallbackRoute;
    setRouteProgressRows(progressRows);
    setRoutes(nextRoutes);
    setPathDraft([]);
    setMarkers(loadedMarkers);
    setRole(loadedRole);
    await selectRoute(firstRoute, true);
  }

  async function selectRoute(nextRoute: MapRoute, force = false) {
    if (!force && !isAdmin && !unlockedRouteIds.has(nextRoute.id)) {
      setGpsMessage("That trail is locked. Complete earlier trails first.");
      return;
    }

    setRoute(nextRoute);
    setRouteName(nextRoute.name);
    setRouteOrder(String(nextRoute.sort_order));
    setRouteTerrain(nextRoute.terrain);
    setRouteDanger(nextRoute.danger_level);
    setRouteDistance(String(Math.round(nextRoute.distance_required_meters)));
    setPathDraft([]);
    distanceWalkedRef.current = 0;
    setSavedPlayerPosition(null);
    setDistanceWalked(0);
    setLastPosition(null);

    const [progress, events] = await Promise.all([getRouteProgress(nextRoute.id), getMapEvents(nextRoute.id)]);
    setMapEvents(events);
    const completions = await getEventCompletions(events.map((event) => event.id));
    setCompletedEventIds(new Set(completions.map((completion) => completion.event_id)));

    if (progress) {
      setDistanceWalked(Number(progress.distance_walked_meters));
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
          const nextDistance = Math.min(activeRoute.distance_required_meters, distanceWalkedRef.current + cleanMeters);
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
          });
          setGpsMessage(`State: MOVING. Counted +${Math.round(cleanMeters)}m at ${speedMph.toFixed(1)} mph.`);

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
    currentTarget?: { getBoundingClientRect?: () => { left: number; top: number; width: number; height: number } };
    nativeEvent?: {
      clientX?: number;
      clientY?: number;
      locationX?: number;
      locationY?: number;
      changedTouches?: Array<{ clientX?: number; clientY?: number }>;
      touches?: Array<{ clientX?: number; clientY?: number }>;
    };
  }) {
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

    if (nativeEvent.locationX !== undefined && nativeEvent.locationY !== undefined) {
      const x = clamp((nativeEvent.locationX / scaledMapSize.width) * 100, 0, 100);
      const y = clamp((nativeEvent.locationY / scaledMapSize.height) * 100, 0, 100);
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
    if (!clickedPercent || !draftTitle.trim()) {
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
        route_id: route.id,
        quest_key: null,
      });
      const configured = await updateMarkerSettings(created.id, getMarkerSettingsPayload());
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
      interaction_radius_percent: Math.max(0.5, Number(markerInteractionRadius) || 4),
      reward_xp: Number(markerRewardXp) || 0,
      reward_gold: Number(markerRewardGold) || 0,
      reward_item_id: markerRewardItemId,
      reward_item_quantity: Math.max(1, Number(markerRewardQuantity) || 1),
      repeatable: markerRepeatable,
      reward_once_per_player: markerRewardOnce,
    };
  }

  async function selectMarker(marker: MapMarker) {
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
    setMarkerInteractionRadius(String(marker.interaction_radius_percent ?? 4));
    setMarkerInteractable(marker.is_interactable ?? true);
    setMarkerRewardXp(String(marker.reward_xp ?? 0));
    setMarkerRewardGold(String(marker.reward_gold ?? 0));
    setMarkerRewardItemId(marker.reward_item_id ?? null);
    setMarkerRewardQuantity(String(marker.reward_item_quantity ?? 1));
    setMarkerRepeatable(Boolean(marker.repeatable));
    setMarkerRewardOnce(marker.reward_once_per_player ?? true);
    setMarkerPanelMessage(null);

    try {
      setMarkerMarketItems(await getMarkerMarketItems(marker.id));
    } catch (error) {
      setMarkerPanelMessage(getErrorMessage(error, "Unable to load marker market."));
    }
  }

  async function previewMarker(marker: MapMarker) {
    await selectMarker(marker);
    setPreviewMarkerScene(true);
  }

  function closeMarkerScene() {
    setPreviewMarkerScene(false);
    setSelectedMarker(null);
    setMarkerPanelMessage(null);
  }

  async function saveSelectedMarkerSettings() {
    if (!selectedMarker) {
      return;
    }

    try {
      const updated = await updateMarkerSettings(selectedMarker.id, getMarkerSettingsPayload());
      setMarkers((current) => current.map((marker) => (marker.id === updated.id ? updated : marker)));
      setSelectedMarker(updated);
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

  async function buyFromMarker(marketItem: MarkerMarketItem) {
    try {
      await buyMarketItem(character, marketItem);
      setMarkerPanelMessage("Item purchased.");
      await loadInventory();
      if (selectedMarker) {
        setMarkerMarketItems(await getMarkerMarketItems(selectedMarker.id));
      }
    } catch (error) {
      setMarkerPanelMessage(getErrorMessage(error, "Unable to buy item."));
    }
  }

  async function sellToMarker(entry: InventoryItem) {
    const marketItem = markerMarketItems.find((item) => item.item_id === entry.item_id);
    const sellPrice = marketItem?.sell_price ?? entry.item.gold_value;

    try {
      await sellMarketInventoryItem(character, entry, sellPrice);
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
      setMarkerPanelMessage(result.message);
      await loadInventory();
    } catch (error) {
      setMarkerPanelMessage(getErrorMessage(error, "Unable to claim marker reward."));
    }
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

  async function saveWalkingPath() {
    if (pathDraft.length < 2) {
      setAdminMessage("Add at least two path points before saving.");
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
        sort_order: Number(routeOrder) || getNextRouteOrder(routes),
        terrain: routeTerrain.trim() || "Unknown road",
        danger_level: routeDanger.trim() || "Low",
        distance_required_meters: Number(routeDistance) || 1000,
        estimated_encounters: route.estimated_encounters,
        path_points: pathDraft,
        is_active: true,
      });
      setRoutes((current) => [...current, created].sort(compareRoutes));
      await selectRoute(created, true);
      setAdminMessage("New walking path created.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to create walking path. Confirm the Supabase migration has run."));
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

  function startNewDialogueStep() {
    clearDialogueNodeForm();
    setNodeSortOrder(String(getNextDialogueNodeOrder(dialogueNodes)));
    setNodeIsStart(dialogueNodes.length === 0);
  }

  async function startBattle(event: MapEvent) {
    const enemy = event.enemy_id ? await getEnemyLoadout(event.enemy_id) : null;
    setActiveEvent(null);
    setActiveBattle(event);
    setActiveEnemy(enemy);
    setBattlePlayerHp(combatResources.maxHp);
    setBattleStamina(combatResources.maxStamina);
    setBattleMagicka(combatResources.maxMagicka);
    setBattleEnemyHp(Number(enemy?.health ?? event.enemy_hp) || 30);
    setBattleEnemyStamina(Number(enemy?.stamina ?? 0) || 0);
    setBattleEnemyMagika(Number(enemy?.magika ?? 0) || 0);
    setBattleFinished(null);
    setBattleLog([event.battle_intro_text || `${enemy?.name || event.enemy_name || "An enemy"} blocks the trail.`]);
  }

  async function finishEvent(event: MapEvent) {
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
      await completeMapEvent(event.id);
      setCompletedEventIds((current) => new Set([...current, event.id]));
      setActiveEvent(null);
      setActiveBattle(null);
      setActiveEnemy(null);
      setGpsMessage(`${event.title} completed. ${rewardResult.message}${drops.length ? ` Drops: ${drops.join(", ")}.` : ""}`);
      await loadInventory();
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
        void completeMapEvent(activeEvent.id);
        setCompletedEventIds((current) => new Set([...current, activeEvent.id]));
        void startBattle(linkedBattle);
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
        void startBattle(battle);
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

    setActiveEvent(null);
  }

  async function endDialogueChat(completeEvent: boolean) {
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
      setBattleLog((current) => [`Not enough ${ability.resource === "magicka" ? "Magika" : ability.resource === "none" ? "power" : ability.resource} for ${ability.name}.`, ...current].slice(0, 8));
      return;
    }

    if (ability.resource === "stamina") {
      setBattleStamina((current) => Math.max(0, current - ability.cost));
    } else if (ability.resource === "magicka") {
      setBattleMagicka((current) => Math.max(0, current - ability.cost));
    } else if (ability.resource === "health") {
      setBattlePlayerHp((current) => Math.max(1, current - ability.cost));
    }

    const damageResult = getAbilityDamage(ability, character);
    const nextEnemyHp = Math.max(0, battleEnemyHp - damageResult.damage);
    const nextLog = [`${ability.name} deals ${damageResult.damage} ${ability.kind} damage${damageResult.crit ? " (critical)" : ""}.`];

    if (nextEnemyHp <= 0) {
      setBattleEnemyHp(0);
      setBattleFinished("victory");
      setBattleLog((current) => [...nextLog, activeBattle.victory_text || "Victory.", ...current].slice(0, 8));
      return;
    }

    const counter = resolveEnemyCounterAttack();
    const nextPlayerHp = Math.max(0, battlePlayerHp - counter.damage);
    nextLog.push(...counter.log);

    setBattleEnemyHp(nextEnemyHp);
    setBattlePlayerHp(nextPlayerHp);

    if (nextPlayerHp <= 0) {
      setBattleFinished("defeat");
      nextLog.push(activeBattle.defeat_text || "Defeat.");
      await resetCurrentRouteAfterDefeat();
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
      setBattleLog((current) => [`Not enough Magika for ${weapon.ability_name || weapon.name}.`, ...current].slice(0, 8));
      return;
    }

    if (costType === "health") {
      setBattlePlayerHp((current) => Math.max(1, current - cost));
    } else if (costType === "stamina") {
      setBattleStamina((current) => Math.max(0, current - cost));
    } else if (costType === "magika") {
      setBattleMagicka((current) => Math.max(0, current - cost));
    }

    const bonuses = getInventoryResourceBonuses(equippedItems as Record<"weapon" | "armor" | "necklace" | "ring" | "charm" | "relic", ItemDefinition | null>);
    const totalDamage = weapon.damage_amount + weapon.elemental_damage_amount + bonuses.damage;
    const nextEnemyHp = Math.max(0, battleEnemyHp - totalDamage);
    const actionName = weapon.ability_name || weapon.name;
    const nextLog = [`${actionName} deals ${totalDamage} damage${weapon.elemental_damage_type !== "none" ? ` with ${weapon.elemental_damage_type}` : ""}.`];

    if (weapon.on_hit_effect === "restore health per hit") {
      setBattlePlayerHp((current) => Math.min(combatResources.maxHp, current + Math.max(1, weapon.buff_amount || 2)));
      nextLog.push("On-hit effect restores Health.");
    } else if (weapon.on_hit_effect === "restore stamina per hit") {
      setBattleStamina((current) => Math.min(combatResources.maxStamina, current + Math.max(1, weapon.buff_amount || 2)));
      nextLog.push("On-hit effect restores Stamina.");
    } else if (weapon.on_hit_effect === "restore magika per hit") {
      setBattleMagicka((current) => Math.min(combatResources.maxMagicka, current + Math.max(1, weapon.buff_amount || 2)));
      nextLog.push("On-hit effect restores Magika.");
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
    setBattlePlayerHp(nextPlayerHp);

    if (nextPlayerHp <= 0) {
      setBattleFinished("defeat");
      nextLog.push(activeBattle.defeat_text || "Defeat.");
      await resetCurrentRouteAfterDefeat();
    }

    setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
  }

  function resolveEnemyCounterAttack(extraPlayerDefense = 0) {
    const enemyName = activeEnemy?.name || activeBattle?.enemy_name || "Enemy";
    const ability = chooseWeightedEnemyAbility(activeEnemy, battleEnemyStamina, battleEnemyMagika);
    const playerDefense = getPlayerDefense(extraPlayerDefense);

    if (!ability) {
      const roll = rollD20Attack(Number(activeEnemy?.strength ?? 0), 0, playerDefense, 0, 2);
      if (!roll.hit) {
        return { damage: 0, log: [`${enemyName} misses. d20 ${roll.roll} vs Defense ${playerDefense}.`] };
      }
      const damage = Math.max(1, (Number(activeBattle?.enemy_attack_damage) || 5) - extraPlayerDefense);
      return { damage: roll.critical ? Math.ceil(damage * 2) : damage, log: [`${enemyName} hits for ${roll.critical ? "Critical " : ""}${roll.critical ? Math.ceil(damage * 2) : damage}.`] };
    }

    if (ability.stamina_cost > 0) {
      setBattleEnemyStamina((current) => Math.max(0, current - ability.stamina_cost));
    }
    if (ability.magika_cost > 0) {
      setBattleEnemyMagika((current) => Math.max(0, current - ability.magika_cost));
    }

    if (ability.type === "heal") {
      const healing = Math.max(1, Number(ability.healing) || 1);
      setBattleEnemyHp((current) => Math.min(Number(activeEnemy?.health ?? activeBattle?.enemy_hp ?? 30), current + healing));
      return { damage: 0, log: [`${enemyName} uses ${ability.name} and heals ${healing}.`] };
    }

    if (ability.type === "defense" || ability.type === "buff" || ability.type === "passive") {
      return { damage: 0, log: [`${enemyName} uses ${ability.name}. ${ability.status_effect !== "none" ? `Status: ${ability.status_effect}.` : "It braces for the next exchange."}`] };
    }

    const statBonus = Number(activeEnemy?.strength ?? 0);
    const roll = rollD20Attack(statBonus, ability.attack_bonus, playerDefense, ability.critical_chance, ability.critical_multiplier);
    if (!roll.hit) {
      return { damage: 0, log: [`${enemyName} uses ${ability.name} and misses. d20 ${roll.roll} vs Defense ${playerDefense}.`] };
    }

    const baseDamage = Math.max(1, Number(ability.damage) || 1);
    const reducedDamage = Math.max(1, baseDamage - extraPlayerDefense);
    const damage = roll.critical ? Math.ceil(reducedDamage * Number(ability.critical_multiplier || 2)) : reducedDamage;
    const statusText = ability.status_effect !== "none" ? ` ${ability.status_effect} may linger.` : "";
    return { damage, log: [`${enemyName} uses ${ability.name} for ${roll.critical ? "Critical " : ""}${damage}.${statusText}`] };
  }

  function getPlayerDefense(extraDefense = 0) {
    const bonuses = getInventoryResourceBonuses(equippedItems as Record<"weapon" | "armor" | "necklace" | "ring" | "charm" | "relic", ItemDefinition | null>);
    return 10 + Math.floor((character.attributes?.agility ?? 0) / 2) + bonuses.defense + extraDefense;
  }

  async function useBattleItem(entry: InventoryItem) {
    const item = entry.item;
    const defeated = battlePlayerHp <= 0 || battleFinished === "defeat";

    if (defeated && item.type !== "revive potion") {
      setBattleLog((current) => ["Only revive potions can be used after defeat.", ...current].slice(0, 8));
      return;
    }

    if (item.type !== "potion" && item.type !== "revive potion") {
      setBattleLog((current) => [`${item.name} has no battle use yet.`, ...current].slice(0, 8));
      return;
    }

    const target = item.potion_target ?? "health";
    const restoreFromPercent = item.restore_percent ? Math.ceil((target === "health" ? combatResources.maxHp : target === "stamina" ? combatResources.maxStamina : combatResources.maxMagicka) * (item.restore_percent / 100)) : 0;
    const amount = Math.max(item.restore_amount, restoreFromPercent);

    if (target === "health") {
      setBattlePlayerHp((current) => Math.min(combatResources.maxHp, current + amount));
      if (defeated) {
        setBattleFinished(null);
      }
    } else if (target === "stamina") {
      setBattleStamina((current) => Math.min(combatResources.maxStamina, current + amount));
    } else {
      setBattleMagicka((current) => Math.min(combatResources.maxMagicka, current + amount));
    }

    await consumeInventoryItem(entry, 1);
    await loadInventory();
    setBattleInventoryOpen(false);
    setBattleLog((current) => [`Used ${item.name}. Restored ${amount} ${target}.`, ...current].slice(0, 8));
  }

  async function resetCurrentRouteAfterDefeat() {
    const startPoint = route.path_points[0] ?? { x: 33.8, y: 73.81 };
    distanceWalkedRef.current = 0;
    setDistanceWalked(0);
    setSavedPlayerPosition(startPoint);
    setRouteProgressRows((current) => upsertRouteProgressRow(current, route.id, 0));
    await resetRouteProgress(route.id, startPoint);
    setGpsMessage("Defeated. Route progress reset to the start of this path.");
  }

  function editMapEvent(event: MapEvent) {
    setEditingEvent(event);
    setEventType(event.event_type === "story" ? "dialogue" : event.event_type);
    setEventTitle(event.title);
    setEventDistance(String(event.distance_marker_percent));
    setEventBackgroundImage(event.background_image_url ?? "");
    setEventNpcName(event.npc_name ?? "");
    setEventNpcPortrait(event.npc_portrait_url ?? "");
    setEventDialogue(event.dialogue_text ?? "");
    setEventChoices(event.choices.map((choice) => `${choice.label}|${choice.action}`).join("\n"));
    setEnemyName(event.enemy_name ?? "");
    setEnemyImage(event.enemy_image_url ?? "");
    setEnemyHp(String(event.enemy_hp));
    setEnemyAttack(String(event.enemy_attack_damage));
    setEventEnemyId(event.enemy_id ?? null);
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

  function clearEventForm() {
    setEditingEvent(null);
    setEventType("dialogue");
    setEventTitle("");
    setEventDistance("25");
    setEventBackgroundImage("");
    setEventNpcName("");
    setEventNpcPortrait("");
    setEventDialogue("");
    setEventChoices("Continue|Continue\nInvestigate|Investigate\nStart Battle|Start Battle");
    setEnemyName("");
    setEnemyImage("");
    setEnemyHp("30");
    setEnemyAttack("5");
    setEventEnemyId(null);
    setBattleIntro("");
    setVictoryText("");
    setDefeatText("");
    setRewardXp("0");
    setRewardGold("0");
    setRewardItem("");
    setRewardItemId(null);
    setRewardItemQuantity("1");
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
      background_image_url: eventBackgroundImage.trim() || null,
      npc_name: eventNpcName.trim() || null,
      npc_portrait_url: eventNpcPortrait.trim() || null,
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
      is_active: true,
    };

    try {
      const saved = editingEvent ? await updateMapEvent(editingEvent.id, values) : await createMapEvent(values);
      setMapEvents((current) => {
        const next = editingEvent ? current.map((event) => (event.id === saved.id ? saved : event)) : [...current, saved];
        return next.sort((a, b) => Number(a.distance_marker_percent) - Number(b.distance_marker_percent));
      });
      clearEventForm();
      setAdminMessage("Event saved.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to save event. Confirm the Supabase migration has run."));
    }
  }

  async function removeMapEvent(eventId: string) {
    try {
      await deleteMapEvent(eventId);
      setMapEvents((current) => current.filter((event) => event.id !== eventId));
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
    setChoiceRewardXp("0");
    setChoiceRewardGold("0");
    setChoiceRewardItem("");
    setChoiceRewardItemId(null);
    setChoiceRewardItemQuantity("1");
    setChoiceSortOrder(String(choiceNodeId ? getNextChoiceOrder(dialogueChoices, choiceNodeId) : 0));
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

  if (activeEvent) {
    return (
      <StoryInstanceScreen
        event={activeEvent}
        nodes={dialogueNodes}
        choices={dialogueChoices}
        activeNodeId={activeNodeId}
        dialogueLog={dialogueLog}
        onLegacyChoice={handleStoryChoice}
        onChoice={(choice) => void handleDialogueChoice(choice)}
        onEndChat={(completeEvent) => void endDialogueChat(completeEvent)}
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
        result={battleFinished}
        onAction={(ability) => void handleBattleAction(ability)}
        onWeaponAction={(weapon) => void handleWeaponAction(weapon)}
        onUseItem={(item) => void useBattleItem(item)}
        onToggleInventory={() => setBattleInventoryOpen((current) => !current)}
        onRetry={() => void startBattle(activeBattle)}
        onComplete={() => void finishEvent(activeBattle)}
      />
    );
  }

  if (selectedMarker && (previewMarkerScene || (!isAdmin && canUseSelectedMarker))) {
    return (
      <MarkerSceneScreen
        marker={selectedMarker}
        marketItems={markerMarketItems}
        inventoryItems={inventoryItems}
        itemDefinitions={itemDefinitions}
        message={markerPanelMessage}
        onExit={closeMarkerScene}
        onBuy={(marketItem) => void buyFromMarker(marketItem)}
        onSell={(entry) => void sellToMarker(entry)}
        onClaimReward={() => void claimSelectedMarkerReward()}
      />
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
      <Text style={styles.mapHint}>Scroll the map frame horizontally and vertically to explore the full image. Use the controls or mouse wheel to zoom. Click the image in admin mode to capture X/Y coordinates.</Text>

      <View ref={viewportRef as never} style={styles.viewport} {...({ onWheel: handleWheel } as object)}>
        <View
          style={[
            styles.mapSurface,
            {
              width: scaledMapSize.width,
              height: scaledMapSize.height,
            },
          ]}
          {...({
            onMouseDown: handleMapPointer,
            onTouchEnd: handleMapPointer,
            onClick: handleMapPointer,
            onStartShouldSetResponder: () => isAdmin,
            onResponderRelease: handleMapPointer,
          } as object)}
        >
          <Image source={forgottenMarches} style={styles.mapImage} {...({ pointerEvents: "none" } as object)} />
          {routeSegments.map((segment, index) => (
            <View
              key={`${segment.id}-${index}`}
              pointerEvents="none"
              style={[
                styles.routeSegment,
                !segment.isActive && styles.routeSegmentInactive,
                {
                  left: `${segment.left}%`,
                  top: `${segment.top}%`,
                  width: segment.length,
                  transform: [{ rotate: `${segment.angle}deg` }],
                },
              ]}
            />
          ))}
          {draftSegments.map((segment, index) => (
            <View
              key={`${segment.id}-${index}`}
              pointerEvents="none"
              style={[
                styles.routeSegment,
                styles.routeSegmentDraft,
                {
                  left: `${segment.left}%`,
                  top: `${segment.top}%`,
                  width: segment.length,
                  transform: [{ rotate: `${segment.angle}deg` }],
                },
              ]}
            />
          ))}
          {pathDraft.map((point, index) => (
            <View key={`${point.x}-${point.y}-${index}`} pointerEvents="none" style={[styles.pathPoint, { left: `${point.x}%`, top: `${point.y}%` }]}>
              <Text style={styles.pathPointText}>{index + 1}</Text>
            </View>
          ))}
          {clickedPercent ? (
            <View pointerEvents="none" style={[styles.tempMarker, { left: `${clickedPercent.x}%`, top: `${clickedPercent.y}%` }]}>
              <View style={styles.tempPulse} />
              <Text style={styles.tempMarkerText}>New Marker</Text>
            </View>
          ) : null}
          {visibleMarkers.map((marker) => (
            <Pressable
              key={marker.id}
              style={[styles.marker, (!marker.is_active || !marker.is_unlocked) && styles.markerHidden, { left: `${marker.x_percent}%`, top: `${marker.y_percent}%` }]}
              onPress={(event) => {
                event.stopPropagation();
                void selectMarker(marker);
              }}
              {...({ onClick: (event: { stopPropagation?: () => void }) => event.stopPropagation?.() } as object)}
            >
              <View style={styles.markerDot} />
              <Text style={styles.markerType}>{marker.type}</Text>
              <Text style={styles.markerName}>{marker.title}</Text>
            </Pressable>
          ))}
          <View
            style={[
              styles.playerPin,
              {
                left: `${playerPosition.x}%`,
                top: `${playerPosition.y}%`,
              },
              { transitionDuration: "450ms" } as object,
            ]}
          >
            {character.portrait_url ? <Image source={{ uri: character.portrait_url }} style={styles.playerPortrait} /> : <Text style={styles.playerInitial}>{character.name.slice(0, 1).toUpperCase()}</Text>}
          </View>
        </View>
      </View>

      <Frame style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Journey Panel</Text>
          <Pressable style={[styles.gpsButton, isTracking && styles.gpsActive]} onPress={isTracking ? stopGpsTracking : startGpsTracking}>
            <Text style={styles.gpsText}>{isTracking ? "Pause GPS" : "Track Walk"}</Text>
          </Pressable>
        </View>
        <View style={styles.routePicker}>
          {orderedRoutes.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.routeChip, route.id === item.id && styles.routeChipActive, !isAdmin && !unlockedRouteIds.has(item.id) && styles.routeChipLocked]}
              onPress={() => void selectRoute(item)}
            >
              <Text style={styles.routeChipText}>{item.sort_order}. {item.name}{!isAdmin && !unlockedRouteIds.has(item.id) ? " (Locked)" : ""}</Text>
            </Pressable>
          ))}
        </View>
        <Info label="Current Route" value={route.name} />
        <Info label="Distance Walked" value={`${metersToMiles(distanceWalked)} mi`} />
        <Info label="Distance Remaining" value={`${metersToMiles(Math.max(0, route.distance_required_meters - distanceWalked))} mi`} />
        <Info label="Progress" value={`${Math.round(progressPercent)}%`} />
        <Info label="State" value={playerMovementState} />
        <Info label="Movement" value={movementStatus.label} />
        <Info label="Current Speed" value={`${movementStatus.speedMph.toFixed(1)} mph`} />
        <Info label="Last Counted" value={`${Math.round(movementStatus.countedMeters)} m`} />
        <Info label="Terrain" value={route.terrain} />
        <Info label="Danger Level" value={route.danger_level} />
        <Info label="Estimated Encounters" value={String(route.estimated_encounters)} />
        <ProgressBar value={progressPercent} max={100} color={colors.blue} height={9} />
        <Text style={styles.gpsMessage}>{gpsMessage}</Text>
      </Frame>

      {selectedMarker && !isAdmin ? (
        <Frame style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.sectionTitle}>{selectedMarker.title}</Text>
              <Text style={styles.copy}>{selectedMarker.type}</Text>
            </View>
            <Pressable style={styles.secondaryButtonFlex} onPress={() => setSelectedMarker(null)}>
              <Text style={styles.secondaryText}>Close</Text>
            </Pressable>
          </View>
          {selectedMarker.description ? <Text style={styles.copy}>{selectedMarker.description}</Text> : null}
          {markerPanelMessage ? <Text style={styles.adminMessage}>{markerPanelMessage}</Text> : null}
          {!canUseSelectedMarker ? (
            <View style={styles.storyEditor}>
              {selectedMarker.quest_image_url || selectedMarker.shop_image_url ? <Image source={{ uri: selectedMarker.shop_image_url || selectedMarker.quest_image_url || "" }} style={styles.eventImage} /> : null}
              <Text style={styles.selectedTitle}>Travel Required</Text>
              <Text style={styles.copy}>
                You need to travel closer before entering. Distance: {selectedMarkerDistance.toFixed(2)}% / Required: {selectedMarkerRadius.toFixed(2)}%.
              </Text>
              <Pressable style={styles.primaryButton} onPress={isTracking ? undefined : startGpsTracking}>
                <Text style={styles.primaryText}>{isTracking ? "Tracking Walk" : "Start Tracking Walk"}</Text>
              </Pressable>
            </View>
          ) : selectedMarker.type === "Market" ? (
            <View style={[styles.shopPanel, selectedMarker.shop_background_image_url ? ({ backgroundImage: `url(${selectedMarker.shop_background_image_url})` } as object) : null]}>
              {selectedMarker.shop_image_url ? <Image source={{ uri: selectedMarker.shop_image_url }} style={styles.eventImage} /> : null}
              <Text style={styles.selectedTitle}>{selectedMarker.quest_title || selectedMarker.title}</Text>
              {selectedMarker.quest_dialogue ? <Text style={styles.dialogueText}>{selectedMarker.quest_dialogue}</Text> : null}
              <Text style={styles.selectedTitle}>Buy</Text>
              {markerMarketItems.length === 0 ? <Text style={styles.copy}>This market has no stock yet.</Text> : null}
              {markerMarketItems.map((marketItem) => (
                <View key={marketItem.id} style={styles.storyCard}>
                  <Text style={styles.markerName}>{getItemName(itemDefinitions, marketItem.item_id)}</Text>
                  <Text style={styles.copy}>{marketItem.buy_price} gold / {marketItem.unlimited_stock ? "Unlimited stock" : `${marketItem.stock_quantity ?? 0} left`}</Text>
                  <Pressable style={styles.primaryButton} onPress={() => void buyFromMarker(marketItem)}>
                    <Text style={styles.primaryText}>Buy</Text>
                  </Pressable>
                </View>
              ))}
              <Text style={styles.selectedTitle}>Sell</Text>
              {inventoryItems.filter((entry) => entry.item.sellable).length === 0 ? <Text style={styles.copy}>No sellable items.</Text> : null}
              {inventoryItems.filter((entry) => entry.item.sellable).map((entry) => {
                const marketItem = markerMarketItems.find((item) => item.item_id === entry.item_id);
                const price = marketItem?.sell_price ?? entry.item.gold_value;
                return (
                  <View key={entry.id} style={styles.storyCard}>
                    <Text style={styles.markerName}>{entry.item.name} x{entry.quantity}</Text>
                    <Text style={styles.copy}>Sell for {price} gold</Text>
                    <Pressable style={styles.secondaryButton} onPress={() => void sellToMarker(entry)}>
                      <Text style={styles.secondaryText}>Sell One</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.storyEditor}>
              {selectedMarker.quest_image_url ? <Image source={{ uri: selectedMarker.quest_image_url }} style={styles.eventImage} /> : null}
              <Text style={styles.selectedTitle}>{selectedMarker.quest_title || selectedMarker.title}</Text>
              {selectedMarker.quest_dialogue ? <Text style={styles.dialogueText}>{selectedMarker.quest_dialogue}</Text> : null}
              <Text style={styles.copy}>
                Rewards: {selectedMarker.reward_xp ?? 0} XP / {selectedMarker.reward_gold ?? 0} gold
                {selectedMarker.reward_item_id ? ` / ${selectedMarker.reward_item_quantity ?? 1} ${getItemName(itemDefinitions, selectedMarker.reward_item_id)}` : ""}
              </Text>
              <Pressable style={styles.primaryButton} onPress={() => void claimSelectedMarkerReward()}>
                <Text style={styles.primaryText}>Claim Reward</Text>
              </Pressable>
            </View>
          )}
        </Frame>
      ) : null}

      {isAdmin ? (
        <Frame style={styles.panel}>
          <Text style={styles.sectionTitle}>Admin Map Editor</Text>
          <Text style={styles.copy}>Choose a mode, then click the map. All map content uses percentage coordinates, never pixels or GPS coordinates.</Text>
          <View style={styles.routeList}>
            <Text style={styles.selectedTitle}>Walking Path Order</Text>
            {orderedRoutes.map((item) => (
              <Pressable key={item.id} style={[styles.routeRow, route.id === item.id && styles.routeRowActive]} onPress={() => void selectRoute(item, true)}>
                <Text style={styles.routeNumber}>{item.sort_order}</Text>
                <View style={styles.routeRowText}>
                  <Text style={styles.markerName}>{item.name}</Text>
                  <Text style={styles.copy}>{item.is_active ? "Active" : "Hidden"} · {metersToMiles(item.distance_required_meters)} mi · {item.terrain}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          <View style={styles.modeRow}>
            {editorModes.map((mode) => (
              <Pressable key={mode} style={[styles.modeButton, editorMode === mode && styles.typeSelected]} onPress={() => setEditorMode(mode)}>
                <Text style={styles.typeText}>{mode}</Text>
              </Pressable>
            ))}
          </View>
          {adminMessage ? <Text style={styles.adminMessage}>{adminMessage}</Text> : null}
          <View style={styles.routeList}>
            <Text style={styles.selectedTitle}>Existing Markers</Text>
            {markers.length === 0 ? <Text style={styles.copy}>No markers created yet.</Text> : null}
            {markers.map((marker) => (
              <View key={marker.id} style={styles.markerTableRow}>
                <View style={styles.markerTableInfo}>
                  <Text style={styles.markerName}>{marker.title}</Text>
                  <Text style={styles.copy}>
                    {marker.type} / X {Number(marker.x_percent).toFixed(2)}% / Y {Number(marker.y_percent).toFixed(2)}% / Radius {Number(marker.interaction_radius_percent ?? 4).toFixed(2)}%
                  </Text>
                  <Text style={styles.debugLine}>
                    Interactable: {marker.is_interactable ? "true" : "false"} / Visible: {marker.is_active ? "true" : "false"} / Unlocked: {marker.is_unlocked ? "true" : "false"}
                  </Text>
                </View>
                <View style={styles.markerTableActions}>
                  <Pressable style={styles.secondaryButtonFlex} onPress={() => { setEditorMode("Marker"); void selectMarker(marker); }}>
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
          <Info label="Clicked Coordinates" value={clickedPercent ? `X ${clickedPercent.x}% / Y ${clickedPercent.y}%` : "Tap the map"} />
          <Text style={styles.debugLine}>Last click: x: {clickedPercent ? `${clickedPercent.x}%` : "--"}, y: {clickedPercent ? `${clickedPercent.y}%` : "--"}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => void copyCoordinates()} disabled={!clickedPercent}>
            <Text style={styles.secondaryText}>Copy Coordinates</Text>
          </Pressable>
          {editorMode === "Marker" ? (
            <>
              <View style={styles.typeGrid}>
                {markerTypes.map((type) => (
                  <Pressable key={type} style={[styles.typeButton, draftType === type && styles.typeSelected]} onPress={() => setDraftType(type)}>
                    <Text style={styles.typeText}>{type}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={draftTitle} onChangeText={setDraftTitle} placeholder="Marker title" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={draftDescription} onChangeText={setDraftDescription} placeholder="Marker description" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={markerSceneBackground} onChangeText={setMarkerSceneBackground} placeholder="Marker scene background image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={markerNpcImage} onChangeText={setMarkerNpcImage} placeholder="NPC / character image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={markerInteractionRadius} onChangeText={setMarkerInteractionRadius} placeholder="Interaction radius percent, example 4" placeholderTextColor={colors.muted} style={styles.input} />
              <Pressable style={[styles.secondaryButton, markerInteractable && styles.typeSelected]} onPress={() => setMarkerInteractable((value) => !value)}>
                <Text style={styles.secondaryText}>Interactable: {markerInteractable ? "true" : "false"}</Text>
              </Pressable>
              {(draftType === "Side Quest" || draftType === "Story" || draftType === "Point of Interest") ? (
                <View style={styles.storyEditor}>
                  <Text style={styles.selectedTitle}>Marker Rewards / Quest Settings</Text>
                  <TextInput value={markerQuestTitle} onChangeText={setMarkerQuestTitle} placeholder="Quest title optional" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={markerQuestDialogue} onChangeText={setMarkerQuestDialogue} placeholder="Quest dialogue" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
                  <TextInput value={markerQuestImage} onChangeText={setMarkerQuestImage} placeholder="Quest image URL" placeholderTextColor={colors.muted} style={styles.input} />
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
              {draftType === "Market" ? (
                <View style={styles.storyEditor}>
                  <Text style={styles.selectedTitle}>Market / Shop Settings</Text>
                  <Text style={styles.copy}>{selectedMarker ? "Choose items from the admin item database for this market." : "Create or select a Market marker before adding shop stock."}</Text>
                  <TextInput value={markerQuestTitle} onChangeText={setMarkerQuestTitle} placeholder="Shop display name optional" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={markerQuestDialogue} onChangeText={setMarkerQuestDialogue} placeholder="Shop welcome text" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
                  <TextInput value={markerShopImage} onChangeText={setMarkerShopImage} placeholder="Shop image URL" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={markerShopBackground} onChangeText={setMarkerShopBackground} placeholder="Shop background image URL" placeholderTextColor={colors.muted} style={styles.input} />
                  <TextInput value={markerInteractionRadius} onChangeText={setMarkerInteractionRadius} placeholder="Interaction radius percent, example 4" placeholderTextColor={colors.muted} style={styles.input} />
                  <ItemPicker label="Market item" items={itemDefinitions} selectedId={marketItemId} onSelect={setMarketItemId} />
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
                      <Text style={styles.copy}>Buy {marketItem.buy_price} / Sell {marketItem.sell_price} / {marketItem.unlimited_stock ? "Unlimited" : `Stock ${marketItem.stock_quantity ?? 0}`}</Text>
                      <Pressable style={styles.secondaryButton} onPress={() => void removeMarketItem(marketItem.id)}>
                        <Text style={styles.dangerText}>Remove Item</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <Pressable style={styles.primaryButton} onPress={() => void addMarker()} disabled={!clickedPercent || !draftTitle.trim()}>
                <Text style={styles.primaryText}>Create Marker</Text>
              </Pressable>
              {selectedMarker ? (
                <Pressable style={styles.secondaryButton} onPress={() => void saveSelectedMarkerSettings()}>
                  <Text style={styles.secondaryText}>Save Selected Marker Settings</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <View style={styles.pathEditor}>
              <TextInput value={routeName} onChangeText={setRouteName} placeholder="Route name" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={routeOrder} onChangeText={setRouteOrder} placeholder="Route order" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={routeTerrain} onChangeText={setRouteTerrain} placeholder="Terrain" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={routeDanger} onChangeText={setRouteDanger} placeholder="Danger level" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={routeDistance} onChangeText={setRouteDistance} placeholder="Required walking distance in meters" placeholderTextColor={colors.muted} style={styles.input} />
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
          )}
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>Dialogue / Event Builder on {route.name}</Text>
            <Text style={styles.copy}>Create dialogue, investigation, reward, or battle events for the selected trail. The distance marker is the route progress percent where the event opens for players.</Text>
            <View style={styles.storyRoutePicker}>
              {orderedRoutes.map((item) => (
                <Pressable key={item.id} style={[styles.routeChip, route.id === item.id && styles.routeChipActive]} onPress={() => void selectRoute(item, true)}>
                  <Text style={styles.routeChipText}>{item.sort_order}. {item.name}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modeRow}>
              {eventTypes.map((type) => (
                <Pressable key={type} style={[styles.modeButton, eventType === type && styles.typeSelected]} onPress={() => setEventType(type)}>
                  <Text style={styles.typeText}>{eventTypeLabels[type]}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={eventTitle} onChangeText={setEventTitle} placeholder="Event title" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput value={eventDistance} onChangeText={setEventDistance} placeholder="Distance marker on trail, 0-100" placeholderTextColor={colors.muted} style={styles.input} />
            {eventType !== "battle" ? (
              <>
                <TextInput value={eventBackgroundImage} onChangeText={setEventBackgroundImage} placeholder="Background image URL" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={eventNpcName} onChangeText={setEventNpcName} placeholder="NPC name optional" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={eventNpcPortrait} onChangeText={setEventNpcPortrait} placeholder="NPC portrait URL optional" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={eventDialogue} onChangeText={setEventDialogue} placeholder="Fallback dialogue text if no dialogue steps exist" placeholderTextColor={colors.muted} style={styles.input} />
              </>
            ) : (
              <>
                <Text style={styles.selectedTitle}>Enemy From Admin</Text>
                <EnemyPicker enemies={enemyDefinitions} selectedId={eventEnemyId} onSelect={selectEventEnemy} />
                {eventEnemyId ? (
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
            {mapEvents.map((event) => (
              <View key={event.id} style={styles.storyCard}>
                <Text style={styles.markerName}>{event.distance_marker_percent}% - {event.title}</Text>
                <Text style={styles.copy}>
                  {event.event_type === "battle"
                    ? `${event.enemy_id ? getEnemyName(enemyDefinitions, event.enemy_id) : event.enemy_name || "Enemy"} - ${event.enemy_id ? "Admin Enemy" : `HP ${event.enemy_hp}`}`
                    : `${eventTypeName(event.event_type)} - ${event.dialogue_text || "Add dialogue steps below."}`}
                </Text>
                <View style={styles.modeRow}>
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
                {mapEvents.filter((event) => event.event_type !== "battle").map((event) => (
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
              <TextInput value={nodeNpcName} onChangeText={setNodeNpcName} placeholder="NPC name" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={nodeNpcPortrait} onChangeText={setNodeNpcPortrait} placeholder="NPC portrait URL optional" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={nodeBackgroundImage} onChangeText={setNodeBackgroundImage} placeholder="Background image URL optional" placeholderTextColor={colors.muted} style={styles.input} />
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
              {choiceAction === "start_battle" ? (
                <View style={styles.storyRoutePicker}>
                  {mapEvents.filter((event) => event.event_type === "battle").map((event) => (
                    <Pressable key={event.id} style={[styles.routeChip, choiceBattleEventId === event.id && styles.routeChipActive]} onPress={() => setChoiceBattleEventId(event.id)}>
                      <Text style={styles.routeChipText}>{event.title}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
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
          </View>
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

function getPointOnRoute(points: Array<{ x: number; y: number }>, progressPercent: number) {
  if (points.length === 0) {
    return { x: 50, y: 50 };
  }

  if (points.length === 1) {
    return points[0];
  }

  const target = clamp(progressPercent, 0, 100) / 100;
  const segmentLengths = points.slice(1).map((point, index) => {
    const previous = points[index];
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const total = segmentLengths.reduce((sum, value) => sum + value, 0);
  let traveled = 0;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segment = segmentLengths[index];
    const nextTraveled = traveled + segment;

    if (target * total <= nextTraveled) {
      const local = (target * total - traveled) / segment;
      const start = points[index];
      const end = points[index + 1];
      return {
        x: start.x + (end.x - start.x) * local,
        y: start.y + (end.y - start.y) * local,
      };
    }

    traveled = nextTraveled;
  }

  return points[points.length - 1];
}

function getRouteSegments(points: Array<{ x: number; y: number }>) {
  return points.slice(1).map((point, index) => {
    const previous = points[index];
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;

    return {
      left: previous.x,
      top: previous.y,
      length: (Math.hypot(dx, dy) / 100) * mapSize.width,
      angle: Math.atan2(dy * mapSize.height, dx * mapSize.width) * (180 / Math.PI),
    };
  });
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function getPercentDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function chooseWeightedEnemyAbility(enemy: EnemyWithLoadout | null, stamina: number, magika: number) {
  const valid = (enemy?.abilities ?? []).filter((row) => row.ability && row.ability.is_active && row.ability.stamina_cost <= stamina && row.ability.magika_cost <= magika);
  const totalWeight = valid.reduce((sum, row) => sum + Math.max(1, Number(row.use_weight) || 1), 0);

  if (valid.length === 0 || totalWeight <= 0) {
    return null;
  }

  let roll = Math.random() * totalWeight;
  for (const row of valid) {
    roll -= Math.max(1, Number(row.use_weight) || 1);
    if (roll <= 0) {
      return row.ability ?? null;
    }
  }

  return valid[0].ability ?? null;
}

function rollD20Attack(statBonus: number, abilityBonus: number, defense: number, criticalChance: number, criticalMultiplier: number) {
  const roll = Math.ceil(Math.random() * 20);
  const naturalCritical = roll === 20;
  const naturalMiss = roll === 1;
  const critical = naturalCritical || Math.random() * 100 < criticalChance;
  const total = roll + Math.floor(statBonus / 2) + abilityBonus;

  return {
    roll,
    total,
    hit: !naturalMiss && (naturalCritical || total >= defense),
    critical,
    criticalMultiplier,
  };
}

function canPlayerSeeMarker(marker: MapMarker, playerPosition: { x: number; y: number }) {
  if (!marker.is_active || !marker.is_unlocked || marker.is_interactable === false) {
    return false;
  }

  const radius = Number(marker.interaction_radius_percent ?? 4) || 4;
  return getPercentDistance(playerPosition, { x: Number(marker.x_percent), y: Number(marker.y_percent) }) <= radius;
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

function metersPerSecondToMph(metersPerSecond: number) {
  return metersPerSecond * 2.23694;
}

function classifyMovement({
  meters,
  elapsedSeconds,
  speedMph,
  accuracy,
}: {
  meters: number;
  elapsedSeconds: number;
  speedMph: number;
  accuracy: number | null;
}) {
  if (accuracy !== null && accuracy > maxGpsAccuracyMeters) {
    return {
      label: "Low GPS accuracy",
      countedMeters: 0,
      blockedReason: `Travel paused: GPS accuracy is ${Math.round(accuracy)}m. Move somewhere with a clearer signal.`,
    };
  }

  if (elapsedSeconds <= 0) {
    return {
      label: "Waiting for GPS",
      countedMeters: 0,
      blockedReason: "Travel paused: waiting for the next GPS sample.",
    };
  }

  if (elapsedSeconds > maxTrackingGapSeconds) {
    return {
      label: "Tracking gap",
      countedMeters: 0,
      blockedReason: "Travel paused: GPS was inactive too long to count this jump.",
    };
  }

  if (meters < minCountedGpsMeters || speedMph <= movementSpeedThresholdMph) {
    return {
      label: "IDLE",
      countedMeters: 0,
      blockedReason: null,
    };
  }

  if (speedMph > maxHumanSpeedMph) {
    return {
      label: "Vehicle speed",
      countedMeters: 0,
      blockedReason: `Travel paused: ${speedMph.toFixed(1)} mph is too fast for walking progress.`,
    };
  }

  return {
    label: "MOVING",
    countedMeters: meters,
    blockedReason: null,
  };
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

function compareRoutes(a: MapRoute, b: MapRoute) {
  if (a.sort_order !== b.sort_order) {
    return a.sort_order - b.sort_order;
  }

  return a.created_at.localeCompare(b.created_at);
}

function getNextRoute(routes: MapRoute[], currentRoute: MapRoute) {
  const currentIndex = routes.findIndex((item) => item.id === currentRoute.id);
  return routes.slice(currentIndex + 1).find((item) => item.is_active) ?? null;
}

function getFirstUnfinishedRoute(routes: MapRoute[], progressRows: Array<{ route_id: string; progress_percent: number }>) {
  const progressByRoute = new Map(progressRows.map((progress) => [progress.route_id, Number(progress.progress_percent)]));
  return routes.find((mapRoute) => mapRoute.is_active && (progressByRoute.get(mapRoute.id) ?? 0) < 100) ?? null;
}

function getUnlockedRouteIds(routes: MapRoute[], progressRows: Array<{ route_id: string; progress_percent: number }>) {
  const progressByRoute = new Map(progressRows.map((progress) => [progress.route_id, Number(progress.progress_percent)]));
  const unlocked = new Set<string>();

  for (const route of routes.filter((item) => item.is_active)) {
    unlocked.add(route.id);

    if ((progressByRoute.get(route.id) ?? 0) < 100) {
      break;
    }
  }

  return unlocked;
}

function upsertRouteProgressRow(rows: Array<{ route_id: string; progress_percent: number }>, routeId: string, progressPercent: number) {
  const existing = rows.some((row) => row.route_id === routeId);

  if (existing) {
    return rows.map((row) => (row.route_id === routeId ? { ...row, progress_percent: progressPercent } : row));
  }

  return [...rows, { route_id: routeId, progress_percent: progressPercent }];
}

function getNextRouteOrder(routes: MapRoute[]) {
  return routes.reduce((highest, item) => Math.max(highest, item.sort_order), 0) + 1;
}

function getNextDialogueNodeOrder(nodes: StoryDialogueNode[]) {
  return nodes.reduce((highest, item) => Math.max(highest, item.sort_order), 0) + 1;
}

function getNextChoiceOrder(choices: StoryDialogueChoice[], nodeId: string) {
  return choices.filter((choice) => choice.node_id === nodeId).reduce((highest, item) => Math.max(highest, item.sort_order), 0) + 1;
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
    return "Magika";
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
  activeNodeId,
  dialogueLog,
  onLegacyChoice,
  onChoice,
  onEndChat,
}: {
  event: MapEvent;
  nodes: StoryDialogueNode[];
  choices: StoryDialogueChoice[];
  activeNodeId: string | null;
  dialogueLog: string[];
  onLegacyChoice: (action: MapEvent["choices"][number]["action"]) => void;
  onChoice: (choice: StoryDialogueChoice) => void;
  onEndChat: (completeEvent: boolean) => void;
}) {
  const activeNode = nodes.find((node) => node.id === activeNodeId) ?? nodes.find((node) => node.is_start) ?? nodes[0] ?? null;
  const nodeChoices = activeNode ? choices.filter((choice) => choice.node_id === activeNode.id) : [];
  const legacyChoices = event.choices.length > 0 ? event.choices : [{ label: "Return to Map", action: "Continue" as const }];

  return (
    <Screen>
      <Frame style={styles.eventScreen}>
        {(activeNode?.background_image_url ?? event.background_image_url) ? <Image source={{ uri: activeNode?.background_image_url ?? event.background_image_url ?? "" }} style={styles.eventImage} /> : <View style={styles.eventImagePlaceholder} />}
        {(activeNode?.npc_portrait_url ?? event.npc_portrait_url) ? <Image source={{ uri: activeNode?.npc_portrait_url ?? event.npc_portrait_url ?? "" }} style={styles.npcPortrait} /> : null}
        <Text style={styles.sectionTitle}>{event.title}</Text>
        {(activeNode?.npc_name ?? event.npc_name) ? <Text style={styles.selectedTitle}>{activeNode?.npc_name ?? event.npc_name}</Text> : null}
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
  result,
  onAction,
  onWeaponAction,
  onUseItem,
  onToggleInventory,
  onRetry,
  onComplete,
}: {
  character: CharacterWithDetails;
  event: MapEvent;
  playerHp: number;
  stamina: number;
  magicka: number;
  resources: CharacterResources;
  enemyHp: number;
  activeEnemy: EnemyWithLoadout | null;
  equippedAbilities: Array<AbilityDefinition | null>;
  weapon: ItemDefinition | null;
  battleItems: InventoryItem[];
  inventoryOpen: boolean;
  battleLog: string[];
  result: "victory" | "defeat" | null;
  onAction: (ability: AbilityDefinition) => void;
  onWeaponAction: (weapon: ItemDefinition) => void;
  onUseItem: (item: InventoryItem) => void;
  onToggleInventory: () => void;
  onRetry: () => void;
  onComplete: () => void;
}) {
  return (
    <Screen>
      <Frame style={styles.eventScreen}>
        <Text style={styles.sectionTitle}>{event.title}</Text>
        <View style={styles.battleArena}>
          <View style={styles.enemyPanel}>
            {(activeEnemy?.image_url || event.enemy_image_url) ? <Image source={{ uri: activeEnemy?.image_url || event.enemy_image_url || "" }} style={styles.enemyImage} /> : <View style={styles.enemyImagePlaceholder} />}
            <Text style={styles.markerName}>{activeEnemy?.name || event.enemy_name || "Enemy"}</Text>
            <Text style={styles.copy}>HP {enemyHp}</Text>
          </View>
          <View style={styles.playerPanel}>
            {character.portrait_url ? <Image source={{ uri: character.portrait_url }} style={styles.battlePortrait} /> : <Text style={styles.playerInitial}>{character.name.slice(0, 1).toUpperCase()}</Text>}
            <Text style={styles.markerName}>{character.name}</Text>
            <Text style={styles.copy}>HP {playerHp}</Text>
          </View>
        </View>
        <View style={styles.resourceBars}>
          <Text style={styles.copy}>HP {playerHp} / {resources.maxHp}</Text>
          <ProgressBar value={playerHp} max={resources.maxHp} color={colors.red} height={7} />
          <Text style={styles.copy}>Stamina {stamina} / {resources.maxStamina}</Text>
          <ProgressBar value={stamina} max={resources.maxStamina} color={colors.gold} height={7} />
          <Text style={styles.copy}>Magika {magicka} / {resources.maxMagicka}</Text>
          <ProgressBar value={magicka} max={resources.maxMagicka} color={colors.blue} height={7} />
        </View>
        <View style={styles.modeRow}>
          {equippedAbilities.map((ability, index) => {
            const resourcePool = ability?.resource === "stamina" ? stamina : ability?.resource === "magicka" ? magicka : ability?.resource === "health" ? playerHp : Number.POSITIVE_INFINITY;
            const hasResource = ability ? resourcePool >= ability.cost : false;
            return (
            <Pressable
              key={`ability-${index}`}
              style={[styles.secondaryButtonFlex, (!ability || !hasResource || Boolean(result)) && styles.disabledAction]}
              onPress={() => ability ? onAction(ability) : undefined}
              disabled={!ability || !hasResource || Boolean(result)}
            >
              <Text style={styles.secondaryText}>{ability?.name ?? `Empty Slot ${index + 1}`}</Text>
              {ability ? <Text style={styles.actionCost}>{getAbilityCostLabel(ability)}</Text> : null}
            </Pressable>
          )})}
        </View>
        <Pressable style={styles.secondaryButton} onPress={onToggleInventory}>
          <Text style={styles.secondaryText}>Inventory</Text>
        </Pressable>
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
          <Pressable style={styles.primaryButton} onPress={onComplete}>
            <Text style={styles.primaryText}>Complete Battle</Text>
          </Pressable>
        ) : null}
        {result === "defeat" ? (
          <Pressable style={styles.primaryButton} onPress={onRetry}>
            <Text style={styles.primaryText}>Retry</Text>
          </Pressable>
        ) : null}
        {battleLog.map((line, index) => (
          <Text key={`${line}-${index}`} style={styles.feedItem}>{line}</Text>
        ))}
      </Frame>
    </Screen>
  );
}

function MarkerSceneScreen({
  marker,
  marketItems,
  inventoryItems,
  itemDefinitions,
  message,
  onExit,
  onBuy,
  onSell,
  onClaimReward,
}: {
  marker: MapMarker;
  marketItems: MarkerMarketItem[];
  inventoryItems: InventoryItem[];
  itemDefinitions: ItemDefinition[];
  message: string | null;
  onExit: () => void;
  onBuy: (marketItem: MarkerMarketItem) => void;
  onSell: (item: InventoryItem) => void;
  onClaimReward: () => void;
}) {
  const backgroundUri = resolveSceneImageUri(marker.scene_background_image_url || marker.shop_background_image_url);
  const npcUri = resolveSceneImageUri(marker.scene_npc_image_url || marker.shop_image_url || marker.quest_image_url);

  return (
    <Screen>
      <Frame style={backgroundUri ? [styles.eventScreen, ({ backgroundImage: `url(${backgroundUri})`, backgroundSize: "cover", backgroundPosition: "center" } as never)] : styles.eventScreen}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.sectionTitle}>{marker.quest_title || marker.title}</Text>
            <Text style={styles.copy}>{marker.type}</Text>
          </View>
          <Pressable style={styles.secondaryButtonFlex} onPress={onExit}>
            <Text style={styles.secondaryText}>Leave</Text>
          </Pressable>
        </View>
        {npcUri ? <Image source={{ uri: npcUri }} style={marker.type === "Market" ? styles.eventImage : styles.npcPortrait} /> : null}
        {marker.description ? <Text style={styles.copy}>{marker.description}</Text> : null}
        {marker.quest_dialogue ? <Text style={styles.dialogueText}>{marker.quest_dialogue}</Text> : null}
        {message ? <Text style={styles.adminMessage}>{message}</Text> : null}
        {marker.type === "Market" ? (
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>Market</Text>
            {marketItems.length === 0 ? <Text style={styles.copy}>This market has no stock yet.</Text> : null}
            {marketItems.map((marketItem) => (
              <View key={marketItem.id} style={styles.storyCard}>
                <Text style={styles.markerName}>{getItemName(itemDefinitions, marketItem.item_id)}</Text>
                <Text style={styles.copy}>{marketItem.buy_price} gold / {marketItem.unlimited_stock ? "Unlimited stock" : `${marketItem.stock_quantity ?? 0} left`}</Text>
                <Pressable style={styles.primaryButton} onPress={() => onBuy(marketItem)}>
                  <Text style={styles.primaryText}>Buy</Text>
                </Pressable>
              </View>
            ))}
            <Text style={styles.selectedTitle}>Sell</Text>
            {inventoryItems.filter((entry) => entry.item.sellable).length === 0 ? <Text style={styles.copy}>No sellable items.</Text> : null}
            {inventoryItems.filter((entry) => entry.item.sellable).map((entry) => {
              const marketItem = marketItems.find((item) => item.item_id === entry.item_id);
              const price = marketItem?.sell_price ?? entry.item.gold_value;
              return (
                <View key={entry.id} style={styles.storyCard}>
                  <Text style={styles.markerName}>{entry.item.name} x{entry.quantity}</Text>
                  <Text style={styles.copy}>Sell for {price} gold</Text>
                  <Pressable style={styles.secondaryButton} onPress={() => onSell(entry)}>
                    <Text style={styles.secondaryText}>Sell One</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>Options</Text>
            <Text style={styles.copy}>
              Rewards: {marker.reward_xp ?? 0} XP / {marker.reward_gold ?? 0} gold
              {marker.reward_item_id ? ` / ${marker.reward_item_quantity ?? 1} ${getItemName(itemDefinitions, marker.reward_item_id)}` : ""}
            </Text>
            <Pressable style={styles.primaryButton} onPress={onClaimReward}>
              <Text style={styles.primaryText}>{marker.type === "Side Quest" ? "Complete Quest" : "Claim Reward"}</Text>
            </Pressable>
          </View>
        )}
        <Pressable style={styles.secondaryButton} onPress={onExit}>
          <Text style={styles.secondaryText}>Exit to Map</Text>
        </Pressable>
      </Frame>
    </Screen>
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

function getItemName(items: ItemDefinition[], itemId: string | null) {
  return items.find((item) => item.id === itemId)?.name ?? "Unknown Item";
}

function getEnemyName(enemies: EnemyDefinition[], enemyId: string | null) {
  return enemies.find((enemy) => enemy.id === enemyId)?.name ?? "Unknown Enemy";
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
  mapHint: {
    color: colors.muted,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingBottom: 10,
    fontSize: 12,
  },
  viewport: {
    height: 520,
    marginHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: "auto",
    overflowX: "auto",
    overflowY: "auto",
    backgroundColor: "#061010",
    cursor: "crosshair",
    touchAction: "pan-x pan-y",
    overscrollBehavior: "contain",
    userSelect: "none",
    WebkitOverflowScrolling: "touch",
  } as object,
  mapSurface: {
    position: "relative",
    transformOrigin: "0 0",
    touchAction: "auto",
    userSelect: "none",
  } as object,
  mapImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  routeSegment: {
    position: "absolute",
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(66, 178, 232, 0.62)",
    transformOrigin: "0 50%",
  } as object,
  routeSegmentInactive: {
    height: 3,
    backgroundColor: "rgba(213, 164, 65, 0.42)",
  },
  routeSegmentDraft: {
    height: 6,
    backgroundColor: "rgba(127, 231, 255, 0.88)",
  },
  pathPoint: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.blue,
    backgroundColor: "rgba(4, 6, 6, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -14 }, { translateY: -14 }],
  },
  pathPointText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 11,
  },
  tempMarker: {
    position: "absolute",
    width: 102,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -51 }, { translateY: -21 }],
  },
  tempPulse: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: "#7fe7ff",
    backgroundColor: "rgba(30, 168, 236, 0.42)",
    shadowColor: "#7fe7ff",
    shadowOpacity: 1,
    shadowRadius: 14,
  },
  tempMarkerText: {
    color: "#071011",
    backgroundColor: "#7fe7ff",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontWeight: "900",
    fontSize: 11,
    marginTop: 40,
  },
  marker: {
    position: "absolute",
    width: 136,
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(213, 164, 65, 0.82)",
    backgroundColor: "rgba(4, 6, 6, 0.78)",
    padding: 8,
    transform: [{ translateX: -48 }, { translateY: -29 }],
  },
  markerHidden: {
    opacity: 0.46,
    borderStyle: "dashed",
  },
  markerDot: {
    position: "absolute",
    left: 10,
    top: -8,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.blue,
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
  playerPin: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: colors.blue,
    backgroundColor: "#061118",
    overflow: "hidden",
    transform: [{ translateX: -35 }, { translateY: -35 }],
    alignItems: "center",
    justifyContent: "center",
  },
  playerPortrait: {
    width: "100%",
    height: "100%",
  },
  playerInitial: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 28,
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
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  routeRowActive: {
    borderColor: colors.blue,
    backgroundColor: "rgba(20, 61, 86, 0.55)",
  },
  routeNumber: {
    minWidth: 30,
    minHeight: 30,
    borderRadius: 15,
    overflow: "hidden",
    textAlign: "center",
    textAlignVertical: "center",
    color: "#120e08",
    backgroundColor: colors.gold,
    fontWeight: "900",
  },
  routeRowText: {
    flex: 1,
    gap: 2,
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
  actionCost: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    textTransform: "capitalize",
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
    minHeight: 260,
    justifyContent: "space-between",
    gap: 12,
  },
  enemyPanel: {
    alignSelf: "flex-end",
    alignItems: "center",
    gap: 6,
  },
  playerPanel: {
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
  },
  enemyImage: {
    width: 124,
    height: 124,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ffb4aa",
  },
  enemyImagePlaceholder: {
    width: 124,
    height: 124,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ffb4aa",
    backgroundColor: "rgba(100, 20, 20, 0.38)",
  },
  battlePortrait: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: colors.blue,
  },
});
