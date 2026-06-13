import { distance as turfDistance } from "@turf/turf";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Frame } from "../components/Frame";
import { ProgressBar } from "../components/ProgressBar";
import { Screen } from "../components/Screen";
import { colors, fonts } from "../components/theme";
import { CharacterWithDetails } from "../services/characterService";
import {
  createMapMarker,
  deleteMapMarker,
  fallbackRoute,
  getActiveRoute,
  getCurrentRole,
  getMapMarkers,
  getRouteProgress,
  MapMarker,
  MapRoute,
  Role,
  saveRouteProgress,
  updateMapMarker,
} from "../services/mapService";

const forgottenMarches = require("../../assets/TheForgottenMarches.png");
const mapSize = { width: 1800, height: 1400 };
const markerTypes = ["Town", "Village", "Quest", "Dungeon", "Battle", "Boss", "Merchant", "Training Area", "Landmark", "Occult Clue", "Guild", "Custom"];
const feedSeeds = ["Wolf tracks discovered", "Merchant caravan spotted", "Broken Moon symbol found", "Cultist activity nearby"];
const encounterTypes = ["Wolves", "Bandits", "Merchants", "Quest discoveries", "Bosses", "Occult events"];

type MapScreenProps = {
  character: CharacterWithDetails;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

export function MapScreen({ character }: MapScreenProps) {
  const [route, setRoute] = useState<MapRoute>(fallbackRoute);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [role, setRole] = useState<Role>("player");
  const [distanceWalked, setDistanceWalked] = useState(0);
  const [lastPosition, setLastPosition] = useState<Coordinate | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [gpsMessage, setGpsMessage] = useState("GPS is off. Start tracking to count real-world walking distance.");
  const [feed, setFeed] = useState(feedSeeds);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [clickedPercent, setClickedPercent] = useState<{ x: number; y: number } | null>(null);
  const [draftType, setDraftType] = useState(markerTypes[0]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [scale, setScale] = useState(0.72);
  const [offset, setOffset] = useState({ x: -320, y: -210 });
  const [followPlayer, setFollowPlayer] = useState(true);
  const [pinchDistance, setPinchDistance] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);
  const lastEncounterBucket = useRef(0);
  const panStart = useRef(offset);
  const distanceWalkedRef = useRef(0);
  const isAdmin = role === "admin";

  const progressPercent = Math.min(100, Math.max(0, (distanceWalked / route.distance_required_meters) * 100));
  const playerPosition = useMemo(() => getPointOnRoute(route.path_points, progressPercent), [route.path_points, progressPercent]);
  const visibleMarkers = markers.filter((marker) => marker.is_active && marker.is_unlocked);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          panStart.current = offset;
          const touches = event.nativeEvent.touches;
          if (touches?.length === 2) {
            setPinchDistance(getTouchDistance(touches));
          }
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          if (touches?.length === 2 && pinchDistance) {
            const nextDistance = getTouchDistance(touches);
            setScale((current) => clamp(current * (nextDistance / pinchDistance), 0.5, 2.7));
            setPinchDistance(nextDistance);
            return;
          }

          setOffset({
            x: panStart.current.x + gesture.dx,
            y: panStart.current.y + gesture.dy,
          });
          setFollowPlayer(false);
        },
        onPanResponderRelease: () => setPinchDistance(null),
      }),
    [offset, pinchDistance],
  );

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
    const bucket = Math.floor(progressPercent / 15);

    if (bucket > lastEncounterBucket.current) {
      lastEncounterBucket.current = bucket;
      const encounter = encounterTypes[Math.floor(Math.random() * encounterTypes.length)];
      setFeed((current) => [`${encounter} encountered near ${route.name}`, ...current].slice(0, 8));
    }
  }, [progressPercent, route.name]);

  async function loadMap() {
    const [loadedRoute, loadedMarkers, loadedRole] = await Promise.all([getActiveRoute(), getMapMarkers(), getCurrentRole()]);
    setRoute(loadedRoute);
    setMarkers(loadedMarkers);
    setRole(loadedRole);

    const progress = await getRouteProgress(loadedRoute.id);
    if (progress) {
      setDistanceWalked(Number(progress.distance_walked_meters));
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
            void saveRouteProgress(route.id, {
              distance_walked_meters: distanceWalkedRef.current,
              progress_percent: (distanceWalkedRef.current / route.distance_required_meters) * 100,
              last_lat: next.latitude,
              last_lng: next.longitude,
            });
            return next;
          }

          const meters = turfDistance([previous.longitude, previous.latitude], [next.longitude, next.latitude], { units: "kilometers" }) * 1000;
          const cleanMeters = meters > 2 && meters < 250 ? meters : 0;
          const nextDistance = Math.min(route.distance_required_meters, distanceWalkedRef.current + cleanMeters);
          const nextProgress = Math.min(100, (nextDistance / route.distance_required_meters) * 100);

          distanceWalkedRef.current = nextDistance;
          setDistanceWalked(nextDistance);
          void saveRouteProgress(route.id, {
            distance_walked_meters: nextDistance,
            progress_percent: nextProgress,
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
    setScale(0.72);
    setOffset({ x: -320, y: -210 });
    setFollowPlayer(false);
  }

  function centerOnPlayer() {
    centerOn(playerPosition.x, playerPosition.y);
    setFollowPlayer(true);
  }

  function centerOn(xPercent: number, yPercent: number) {
    setOffset({
      x: 180 - (xPercent / 100) * mapSize.width * scale,
      y: 210 - (yPercent / 100) * mapSize.height * scale,
    });
  }

  function handleWheel(event: { nativeEvent?: { deltaY?: number }; preventDefault?: () => void }) {
    event.preventDefault?.();
    const deltaY = event.nativeEvent?.deltaY ?? 0;
    zoomBy(deltaY > 0 ? -0.08 : 0.08);
  }

  function handleMapPress(event: { nativeEvent: { locationX: number; locationY: number } }) {
    if (!isAdmin) {
      return;
    }

    const x = clamp((event.nativeEvent.locationX / mapSize.width) * 100, 0, 100);
    const y = clamp((event.nativeEvent.locationY / mapSize.height) * 100, 0, 100);
    setClickedPercent({ x: roundPercent(x), y: roundPercent(y) });
    setSelectedMarker(null);
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
  }

  async function moveSelectedMarker() {
    if (!selectedMarker || !clickedPercent) {
      return;
    }

    const updated = await updateMapMarker(selectedMarker.id, {
      x_percent: clickedPercent.x,
      y_percent: clickedPercent.y,
    });
    setMarkers((current) => current.map((marker) => (marker.id === updated.id ? updated : marker)));
    setSelectedMarker(updated);
  }

  async function toggleSelectedMarker() {
    if (!selectedMarker) {
      return;
    }

    const updated = await updateMapMarker(selectedMarker.id, {
      is_active: !selectedMarker.is_active,
    });
    setMarkers((current) => current.map((marker) => (marker.id === updated.id ? updated : marker)));
    setSelectedMarker(updated);
  }

  async function removeSelectedMarker() {
    if (!selectedMarker) {
      return;
    }

    await deleteMapMarker(selectedMarker.id);
    setMarkers((current) => current.filter((marker) => marker.id !== selectedMarker.id));
    setSelectedMarker(null);
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

      <View style={styles.viewport} {...panResponder.panHandlers} {...({ onWheel: handleWheel } as object)}>
        <Pressable
          style={[
            styles.mapSurface,
            {
              width: mapSize.width,
              height: mapSize.height,
              transform: [{ translateX: offset.x }, { translateY: offset.y }, { scale }],
            },
          ]}
          onPress={handleMapPress}
        >
          <Image source={forgottenMarches} style={styles.mapImage} />
          <View style={styles.routeLine} />
          {visibleMarkers.map((marker) => (
            <Pressable
              key={marker.id}
              style={[styles.marker, { left: `${marker.x_percent}%`, top: `${marker.y_percent}%` }]}
              onPress={(event) => {
                event.stopPropagation();
                setSelectedMarker(marker);
              }}
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
        </Pressable>
      </View>

      <Frame style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Journey Panel</Text>
          <Pressable style={[styles.gpsButton, isTracking && styles.gpsActive]} onPress={isTracking ? stopGpsTracking : startGpsTracking}>
            <Text style={styles.gpsText}>{isTracking ? "Pause GPS" : "Track Walk"}</Text>
          </Pressable>
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

      <Frame style={styles.panel}>
        <Text style={styles.sectionTitle}>Travel Feed</Text>
        {feed.map((item, index) => (
          <Text key={`${item}-${index}`} style={styles.feedItem}>{item}</Text>
        ))}
      </Frame>

      {isAdmin ? (
        <Frame style={styles.panel}>
          <Text style={styles.sectionTitle}>Admin Map Editor</Text>
          <Text style={styles.copy}>Click the map to inspect percentage coordinates, create markers, or move a selected marker.</Text>
          <Info label="Clicked Coordinates" value={clickedPercent ? `X ${clickedPercent.x}% / Y ${clickedPercent.y}%` : "Tap the map"} />
          <Pressable style={styles.secondaryButton} onPress={() => void copyCoordinates()} disabled={!clickedPercent}>
            <Text style={styles.secondaryText}>Copy Coordinates</Text>
          </Pressable>
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
          {selectedMarker ? (
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

function getTouchDistance(touches: Array<{ pageX: number; pageY: number }>) {
  const [first, second] = touches;
  return Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function metersToMiles(meters: number) {
  return (meters / 1609.344).toFixed(2);
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
  viewport: {
    height: 520,
    marginHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: "hidden",
    backgroundColor: "#061010",
    cursor: "grab",
  } as object,
  mapSurface: {
    position: "relative",
    transformOrigin: "0 0",
  } as object,
  mapImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  routeLine: {
    position: "absolute",
    left: "18%",
    top: "38%",
    width: "50%",
    height: "32%",
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderColor: "rgba(66, 178, 232, 0.55)",
    borderBottomLeftRadius: 120,
    transform: [{ rotate: "-14deg" }],
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
});
