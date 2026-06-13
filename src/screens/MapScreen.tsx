import { distance as turfDistance } from "@turf/turf";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { CharacterWithDetails } from "../services/characterService";
import {
  completeMapEvent,
  createMapRoute,
  createMapEvent,
  createMapMarker,
  createStoryInstance,
  deleteMapEvent,
  deleteMapMarker,
  deleteStoryInstance,
  fallbackRoute,
  getCurrentRole,
  getMapMarkers,
  getMapRoutes,
  getMapEvents,
  getEventCompletions,
  getRouteProgress,
  getRouteProgressForRoutes,
  getStoryInstances,
  MapMarker,
  MapEvent,
  MapRoute,
  MapStoryInstance,
  Role,
  saveRouteProgress,
  updateMapEvent,
  updateStoryInstance,
  updateMapMarker,
  updateMapRoute,
} from "../services/mapService";

const forgottenMarches = require("../../assets/TheForgottenMarches.png");
const mapSize = { width: 1800, height: 1400 };
const markerTypes = ["Town", "Village", "Quest", "Dungeon", "Battle", "Boss", "Merchant", "Training Area", "Landmark", "Occult Clue", "Guild", "Custom"];
const editorModes = ["Marker", "Walking Path"] as const;
const storyTriggerTypes = ["progress", "random"] as const;
const eventTypes = ["story", "battle"] as const;
const choiceActions = ["Continue", "Investigate", "Ask Questions", "Start Battle", "Complete Event"] as const;

type MapScreenProps = {
  character: CharacterWithDetails;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

export function MapScreen({ character }: MapScreenProps) {
  const [route, setRoute] = useState<MapRoute>(fallbackRoute);
  const [routes, setRoutes] = useState<MapRoute[]>([fallbackRoute]);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [storyInstances, setStoryInstances] = useState<MapStoryInstance[]>([]);
  const [mapEvents, setMapEvents] = useState<MapEvent[]>([]);
  const [completedEventIds, setCompletedEventIds] = useState<Set<string>>(new Set());
  const [activeEvent, setActiveEvent] = useState<MapEvent | null>(null);
  const [activeBattle, setActiveBattle] = useState<MapEvent | null>(null);
  const [battlePlayerHp, setBattlePlayerHp] = useState(100);
  const [battleEnemyHp, setBattleEnemyHp] = useState(0);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [battleFinished, setBattleFinished] = useState<"victory" | "defeat" | null>(null);
  const [role, setRole] = useState<Role>("player");
  const [distanceWalked, setDistanceWalked] = useState(0);
  const [savedPlayerPosition, setSavedPlayerPosition] = useState<{ x: number; y: number } | null>(null);
  const [lastPosition, setLastPosition] = useState<Coordinate | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [gpsMessage, setGpsMessage] = useState("GPS is off. Start tracking to count real-world walking distance.");
  const [routeProgressRows, setRouteProgressRows] = useState<Array<{ route_id: string; progress_percent: number }>>([]);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [clickedPercent, setClickedPercent] = useState<{ x: number; y: number } | null>(null);
  const [draftType, setDraftType] = useState(markerTypes[0]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [editorMode, setEditorMode] = useState<(typeof editorModes)[number]>("Marker");
  const [pathDraft, setPathDraft] = useState<Array<{ x: number; y: number }>>([]);
  const [routeName, setRouteName] = useState("");
  const [routeOrder, setRouteOrder] = useState("1");
  const [routeTerrain, setRouteTerrain] = useState("");
  const [routeDanger, setRouteDanger] = useState("");
  const [routeDistance, setRouteDistance] = useState("");
  const [storyTitle, setStoryTitle] = useState("");
  const [storyBody, setStoryBody] = useState("");
  const [storyTriggerType, setStoryTriggerType] = useState<(typeof storyTriggerTypes)[number]>("progress");
  const [storyTriggerPercent, setStoryTriggerPercent] = useState("50");
  const [storyChancePercent, setStoryChancePercent] = useState("25");
  const [editingEvent, setEditingEvent] = useState<MapEvent | null>(null);
  const [eventType, setEventType] = useState<(typeof eventTypes)[number]>("story");
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
  const [battleIntro, setBattleIntro] = useState("");
  const [victoryText, setVictoryText] = useState("");
  const [defeatText, setDefeatText] = useState("");
  const [rewardXp, setRewardXp] = useState("0");
  const [rewardItem, setRewardItem] = useState("");
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
  const lastCaptureRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const isAdmin = role === "admin";
  const scaledMapSize = useMemo(() => ({ width: mapSize.width * scale, height: mapSize.height * scale }), [scale]);

  const progressPercent = Math.min(100, Math.max(0, (distanceWalked / route.distance_required_meters) * 100));
  const orderedRoutes = useMemo(() => [...routes].sort(compareRoutes), [routes]);
  const routeProgressPosition = useMemo(() => getPointOnRoute(route.path_points, progressPercent), [route.path_points, progressPercent]);
  const playerPosition = savedPlayerPosition ?? routeProgressPosition;
  const routeSegments = useMemo(() => getRouteSegmentsForRoutes(orderedRoutes, route.id), [orderedRoutes, route.id]);
  const draftSegments = useMemo(() => getRouteSegments(pathDraft).map((segment) => ({ ...segment, id: `draft-${segment.left}-${segment.top}`, isActive: true, isDraft: true })), [pathDraft]);
  const visibleMarkers = isAdmin ? markers : markers.filter((marker) => marker.is_active && marker.is_unlocked);
  const unlockedRouteIds = useMemo(() => getUnlockedRouteIds(orderedRoutes, routeProgressRows), [orderedRoutes, routeProgressRows]);

  useEffect(() => {
    void loadMap();

    return () => {
      if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

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
    if (activeEvent || activeBattle) {
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
      startBattle(nextEvent);
      return;
    }

    setActiveEvent(nextEvent);
  }, [activeBattle, activeEvent, completedEventIds, mapEvents, progressPercent, route.id]);

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

    const [progress, stories, events] = await Promise.all([getRouteProgress(nextRoute.id), getStoryInstances(nextRoute.id), getMapEvents(nextRoute.id)]);
    setStoryInstances(stories);
    setMapEvents(events);
    const completions = await getEventCompletions(events.map((event) => event.id));
    setCompletedEventIds(new Set(completions.map((completion) => completion.event_id)));

    if (progress) {
      setDistanceWalked(Number(progress.distance_walked_meters));
      if (progress.current_x_percent !== null && progress.current_y_percent !== null) {
        setSavedPlayerPosition({ x: Number(progress.current_x_percent), y: Number(progress.current_y_percent) });
      }
      if (progress.last_lat !== null && progress.last_lng !== null) {
        setLastPosition({ latitude: Number(progress.last_lat), longitude: Number(progress.last_lng) });
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
            return next;
          }

          const activeRoute = routeRef.current;
          const meters = turfDistance([previous.longitude, previous.latitude], [next.longitude, next.latitude], { units: "kilometers" }) * 1000;
          const cleanMeters = meters > 2 && meters < 250 ? meters : 0;
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
    setGpsMessage("GPS paused. Route progress is saved in Supabase.");
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
      setMarkers((current) => [...current, created]);
      setDraftTitle("");
      setDraftDescription("");
      setClickedPercent(null);
      setAdminMessage("Marker created.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to create marker. Confirm the Supabase migration has run."));
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

    try {
      await deleteMapMarker(selectedMarker.id);
      setMarkers((current) => current.filter((marker) => marker.id !== selectedMarker.id));
      setSelectedMarker(null);
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

  async function addStoryInstance() {
    if (!storyTitle.trim()) {
      setAdminMessage("Add a story title first.");
      return;
    }

    try {
      const created = await createStoryInstance({
        route_id: route.id,
        title: storyTitle.trim(),
        body: storyBody.trim() || null,
        trigger_type: storyTriggerType,
        trigger_percent: storyTriggerType === "progress" ? clamp(Number(storyTriggerPercent) || 0, 0, 100) : null,
        chance_percent: clamp(Number(storyChancePercent) || 0, 0, 100),
        is_active: true,
      });
      setStoryInstances((current) => [...current, created]);
      setStoryTitle("");
      setStoryBody("");
      setAdminMessage("Story instance added.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to create story instance. Confirm the Supabase migration has run."));
    }
  }

  async function toggleStoryInstance(story: MapStoryInstance) {
    try {
      const updated = await updateStoryInstance(story.id, { is_active: !story.is_active });
      setStoryInstances((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setAdminMessage(updated.is_active ? "Story instance enabled." : "Story instance disabled.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to update story instance."));
    }
  }

  async function removeStoryInstance(storyId: string) {
    try {
      await deleteStoryInstance(storyId);
      setStoryInstances((current) => current.filter((story) => story.id !== storyId));
      setAdminMessage("Story instance deleted.");
    } catch (error) {
      setAdminMessage(getErrorMessage(error, "Unable to delete story instance."));
    }
  }

  function startBattle(event: MapEvent) {
    setActiveEvent(null);
    setActiveBattle(event);
    setBattlePlayerHp(100);
    setBattleEnemyHp(Number(event.enemy_hp) || 30);
    setBattleFinished(null);
    setBattleLog([event.battle_intro_text || `${event.enemy_name || "An enemy"} blocks the trail.`]);
  }

  async function finishEvent(event: MapEvent) {
    try {
      await completeMapEvent(event.id);
      setCompletedEventIds((current) => new Set([...current, event.id]));
      setActiveEvent(null);
      setActiveBattle(null);
      setGpsMessage(`${event.title} completed.`);
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
        startBattle(linkedBattle);
        return;
      }
      setBattleLog(["No linked battle exists on this trail yet."]);
      return;
    }

    setGpsMessage(`${activeEvent.title}: ${action}`);
  }

  function handleBattleAction(action: "Strike" | "Guard" | "Heavy Attack") {
    if (!activeBattle || battleFinished) {
      return;
    }

    const playerDamage = action === "Heavy Attack" ? 18 : action === "Guard" ? 6 : 10;
    const nextEnemyHp = Math.max(0, battleEnemyHp - playerDamage);
    const nextLog = [`${action} deals ${playerDamage} damage.`];

    if (nextEnemyHp <= 0) {
      setBattleEnemyHp(0);
      setBattleFinished("victory");
      setBattleLog((current) => [...nextLog, activeBattle.victory_text || "Victory.", ...current].slice(0, 8));
      return;
    }

    const incoming = Math.max(1, Number(activeBattle.enemy_attack_damage) || 5);
    const enemyDamage = action === "Guard" ? Math.ceil(incoming / 2) : incoming;
    const nextPlayerHp = Math.max(0, battlePlayerHp - enemyDamage);
    nextLog.push(`${activeBattle.enemy_name || "Enemy"} hits for ${enemyDamage}.`);

    setBattleEnemyHp(nextEnemyHp);
    setBattlePlayerHp(nextPlayerHp);

    if (nextPlayerHp <= 0) {
      setBattleFinished("defeat");
      nextLog.push(activeBattle.defeat_text || "Defeat.");
    }

    setBattleLog((current) => [...nextLog, ...current].slice(0, 8));
  }

  function editMapEvent(event: MapEvent) {
    setEditingEvent(event);
    setEventType(event.event_type);
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
    setBattleIntro(event.battle_intro_text ?? "");
    setVictoryText(event.victory_text ?? "");
    setDefeatText(event.defeat_text ?? "");
    setRewardXp(String(event.reward_xp));
    setRewardItem(event.reward_item ?? "");
  }

  function clearEventForm() {
    setEditingEvent(null);
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
    setBattleIntro("");
    setVictoryText("");
    setDefeatText("");
    setRewardXp("0");
    setRewardItem("");
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
      enemy_image_url: enemyImage.trim() || null,
      enemy_hp: Number(enemyHp) || 30,
      enemy_attack_damage: Number(enemyAttack) || 5,
      battle_intro_text: battleIntro.trim() || null,
      victory_text: victoryText.trim() || null,
      defeat_text: defeatText.trim() || null,
      reward_xp: Number(rewardXp) || 0,
      reward_item: rewardItem.trim() || null,
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

  function undoPathPoint() {
    setPathDraft((current) => current.slice(0, -1));
  }

  function loadSelectedPathIntoDraft() {
    setPathDraft(route.path_points);
    setAdminMessage(`Loaded ${route.name} into the walking path editor.`);
  }

  if (activeEvent) {
    return <StoryInstanceScreen event={activeEvent} onChoice={handleStoryChoice} />;
  }

  if (activeBattle) {
    return (
      <BattleEventScreen
        character={character}
        event={activeBattle}
        playerHp={battlePlayerHp}
        enemyHp={battleEnemyHp}
        battleLog={battleLog}
        result={battleFinished}
        onAction={handleBattleAction}
        onRetry={() => startBattle(activeBattle)}
        onComplete={() => void finishEvent(activeBattle)}
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
                setSelectedMarker(marker);
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
        <Info label="Terrain" value={route.terrain} />
        <Info label="Danger Level" value={route.danger_level} />
        <Info label="Estimated Encounters" value={String(route.estimated_encounters)} />
        <ProgressBar value={progressPercent} max={100} color={colors.blue} height={9} />
        <Text style={styles.gpsMessage}>{gpsMessage}</Text>
      </Frame>

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
              <Pressable style={styles.primaryButton} onPress={() => void addMarker()} disabled={!clickedPercent || !draftTitle.trim()}>
                <Text style={styles.primaryText}>Create Marker</Text>
              </Pressable>
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
            <Text style={styles.selectedTitle}>Story Instances on {route.name}</Text>
            <Text style={styles.copy}>Select the route before adding a story instance. Random stories use the chance percent below when travel progress reaches a new 10% route bucket.</Text>
            <View style={styles.storyRoutePicker}>
              {orderedRoutes.map((item) => (
                <Pressable key={item.id} style={[styles.routeChip, route.id === item.id && styles.routeChipActive]} onPress={() => void selectRoute(item, true)}>
                  <Text style={styles.routeChipText}>{item.sort_order}. {item.name}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={storyTitle} onChangeText={setStoryTitle} placeholder="Story title" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput value={storyBody} onChangeText={setStoryBody} placeholder="Story text or encounter note" placeholderTextColor={colors.muted} style={styles.input} />
            <View style={styles.modeRow}>
              {storyTriggerTypes.map((type) => (
                <Pressable key={type} style={[styles.modeButton, storyTriggerType === type && styles.typeSelected]} onPress={() => setStoryTriggerType(type)}>
                  <Text style={styles.typeText}>{type === "progress" ? "At Route %" : "Random"}</Text>
                </Pressable>
              ))}
            </View>
            {storyTriggerType === "progress" ? (
              <TextInput value={storyTriggerPercent} onChangeText={setStoryTriggerPercent} placeholder="Trigger percent, 0-100" placeholderTextColor={colors.muted} style={styles.input} />
            ) : (
              <TextInput value={storyChancePercent} onChangeText={setStoryChancePercent} placeholder="Encounter chance percent per 10% route progress" placeholderTextColor={colors.muted} style={styles.input} />
            )}
            <Pressable style={styles.primaryButton} onPress={() => void addStoryInstance()} disabled={!storyTitle.trim()}>
              <Text style={styles.primaryText}>Add Story Instance</Text>
            </Pressable>
            {storyInstances.map((story) => (
              <View key={story.id} style={styles.storyCard}>
                <Text style={styles.markerName}>{story.title}</Text>
                <Text style={styles.copy}>{story.body || "No story text yet."}</Text>
                <Info
                  label="Trigger"
                  value={story.trigger_type === "progress" ? `${story.trigger_percent ?? 0}%` : `Random ${story.chance_percent}%`}
                />
                <View style={styles.modeRow}>
                  <Pressable style={styles.secondaryButtonFlex} onPress={() => void toggleStoryInstance(story)}>
                    <Text style={styles.secondaryText}>{story.is_active ? "Disable" : "Enable"}</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButtonFlex} onPress={() => void removeStoryInstance(story.id)}>
                    <Text style={styles.dangerText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.storyEditor}>
            <Text style={styles.selectedTitle}>Events on {route.name}</Text>
            <Text style={styles.copy}>Create story or battle events for the selected trail. The distance marker is the route progress percent where the event opens for players.</Text>
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
                  <Text style={styles.typeText}>{type === "story" ? "Story Event" : "Battle Event"}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={eventTitle} onChangeText={setEventTitle} placeholder="Event title" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput value={eventDistance} onChangeText={setEventDistance} placeholder="Distance marker on trail, 0-100" placeholderTextColor={colors.muted} style={styles.input} />
            {eventType === "story" ? (
              <>
                <TextInput value={eventBackgroundImage} onChangeText={setEventBackgroundImage} placeholder="Background image URL" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={eventNpcName} onChangeText={setEventNpcName} placeholder="NPC name optional" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={eventNpcPortrait} onChangeText={setEventNpcPortrait} placeholder="NPC portrait URL optional" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={eventDialogue} onChangeText={setEventDialogue} placeholder="Dialogue text" placeholderTextColor={colors.muted} style={styles.input} />
                <Text style={styles.copy}>Choices format: Button Label|Action. Actions: {choiceActions.join(", ")}.</Text>
                <TextInput value={eventChoices} onChangeText={setEventChoices} placeholder="Continue|Continue" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
              </>
            ) : (
              <>
                <TextInput value={enemyName} onChangeText={setEnemyName} placeholder="Enemy name" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={enemyImage} onChangeText={setEnemyImage} placeholder="Enemy image URL" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={enemyHp} onChangeText={setEnemyHp} placeholder="Enemy HP" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={enemyAttack} onChangeText={setEnemyAttack} placeholder="Enemy attack damage" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={battleIntro} onChangeText={setBattleIntro} placeholder="Battle intro text" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={victoryText} onChangeText={setVictoryText} placeholder="Victory text" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={defeatText} onChangeText={setDefeatText} placeholder="Defeat text" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={rewardXp} onChangeText={setRewardXp} placeholder="Reward XP" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput value={rewardItem} onChangeText={setRewardItem} placeholder="Optional reward item" placeholderTextColor={colors.muted} style={styles.input} />
              </>
            )}
            <Pressable style={styles.primaryButton} onPress={() => void saveMapEvent()} disabled={!eventTitle.trim()}>
              <Text style={styles.primaryText}>{editingEvent ? "Update Event" : "Create Event"}</Text>
            </Pressable>
            {editingEvent ? (
              <Pressable style={styles.secondaryButton} onPress={clearEventForm}>
                <Text style={styles.secondaryText}>Cancel Edit</Text>
              </Pressable>
            ) : null}
            {mapEvents.map((event) => (
              <View key={event.id} style={styles.storyCard}>
                <Text style={styles.markerName}>{event.distance_marker_percent}% · {event.title}</Text>
                <Text style={styles.copy}>{event.event_type === "story" ? event.dialogue_text || "Story event" : `${event.enemy_name || "Enemy"} · HP ${event.enemy_hp}`}</Text>
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

function StoryInstanceScreen({ event, onChoice }: { event: MapEvent; onChoice: (action: MapEvent["choices"][number]["action"]) => void }) {
  const choices = event.choices.length > 0 ? event.choices : [{ label: "Continue", action: "Continue" as const }];

  return (
    <Screen>
      <Frame style={styles.eventScreen}>
        {event.background_image_url ? <Image source={{ uri: event.background_image_url }} style={styles.eventImage} /> : <View style={styles.eventImagePlaceholder} />}
        {event.npc_portrait_url ? <Image source={{ uri: event.npc_portrait_url }} style={styles.npcPortrait} /> : null}
        <Text style={styles.sectionTitle}>{event.title}</Text>
        {event.npc_name ? <Text style={styles.selectedTitle}>{event.npc_name}</Text> : null}
        <Text style={styles.dialogueText}>{event.dialogue_text || "The trail grows quiet."}</Text>
        <View style={styles.choiceStack}>
          {choices.map((choice, index) => (
            <Pressable key={`${choice.label}-${index}`} style={styles.primaryButton} onPress={() => onChoice(choice.action)}>
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
  enemyHp,
  battleLog,
  result,
  onAction,
  onRetry,
  onComplete,
}: {
  character: CharacterWithDetails;
  event: MapEvent;
  playerHp: number;
  enemyHp: number;
  battleLog: string[];
  result: "victory" | "defeat" | null;
  onAction: (action: "Strike" | "Guard" | "Heavy Attack") => void;
  onRetry: () => void;
  onComplete: () => void;
}) {
  return (
    <Screen>
      <Frame style={styles.eventScreen}>
        <Text style={styles.sectionTitle}>{event.title}</Text>
        <View style={styles.battleArena}>
          <View style={styles.enemyPanel}>
            {event.enemy_image_url ? <Image source={{ uri: event.enemy_image_url }} style={styles.enemyImage} /> : <View style={styles.enemyImagePlaceholder} />}
            <Text style={styles.markerName}>{event.enemy_name || "Enemy"}</Text>
            <Text style={styles.copy}>HP {enemyHp}</Text>
          </View>
          <View style={styles.playerPanel}>
            {character.portrait_url ? <Image source={{ uri: character.portrait_url }} style={styles.battlePortrait} /> : <Text style={styles.playerInitial}>{character.name.slice(0, 1).toUpperCase()}</Text>}
            <Text style={styles.markerName}>{character.name}</Text>
            <Text style={styles.copy}>HP {playerHp}</Text>
          </View>
        </View>
        <View style={styles.modeRow}>
          {(["Strike", "Guard", "Heavy Attack"] as const).map((action) => (
            <Pressable key={action} style={styles.secondaryButtonFlex} onPress={() => onAction(action)} disabled={Boolean(result)}>
              <Text style={styles.secondaryText}>{action}</Text>
            </Pressable>
          ))}
        </View>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
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
