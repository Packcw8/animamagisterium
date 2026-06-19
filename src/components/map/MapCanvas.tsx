import { useRef } from "react";
import type { MutableRefObject } from "react";
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from "react-native";
import type { MapMarker } from "../../services/mapService";
import { getMarkerRenderStyle } from "../../utils/mapVisibility";
import { colors, fonts } from "../theme";
import { MarkerIcon } from "./MarkerIcon";

export type MapViewportRef = {
  scrollLeft?: number;
  scrollTop?: number;
  clientWidth?: number;
  clientHeight?: number;
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
  scrollTo?: (options: { left: number; top: number; behavior?: "smooth" | "auto" }) => void;
};

export type PinchZoomPayload = {
  delta: number;
  centerClientX: number;
  centerClientY: number;
};

export type RouteSegmentView = {
  id: string;
  left: number;
  top: number;
  length: number;
  angle: number;
  isActive: boolean;
  isDraft?: boolean;
};

type PercentPoint = {
  x: number;
  y: number;
};

type SharedCanvasProps = {
  routeSegments: RouteSegmentView[];
  draftSegments: RouteSegmentView[];
  pathDraft: PercentPoint[];
  showDraft: boolean;
  clickedPercent: PercentPoint | null;
  showTempMarker: boolean;
  markers: MapMarker[];
  playerPosition: PercentPoint;
  playerName: string;
  playerPortraitUrl?: string | null;
  onMapPointer?: (event: unknown) => void;
  onSelectMarker: (marker: MapMarker) => void;
};

export function OverworldMapCanvas({
  viewportRef,
  scaledMapSize,
  imageSource,
  onWheel,
  onPinchZoom,
  canCapturePointer,
  ...shared
}: SharedCanvasProps & {
  viewportRef: MutableRefObject<MapViewportRef | null>;
  scaledMapSize: { width: number; height: number };
  imageSource: ImageSourcePropType;
  onWheel: (event: { nativeEvent?: { deltaY?: number } }) => void;
  onPinchZoom?: (payload: PinchZoomPayload) => void;
  canCapturePointer: boolean;
}) {
  const pinch = usePinchZoom(onPinchZoom);

  return (
    <View ref={viewportRef as never} style={styles.viewport} {...({ onWheel } as object)}>
      <View
        style={[
          styles.mapSurface,
          {
            width: scaledMapSize.width,
            height: scaledMapSize.height,
          },
        ]}
        {...({
          onClick: (event: unknown) => {
            if (pinch.shouldSuppressClick()) {
              return;
            }
            shared.onMapPointer?.(event);
          },
          onTouchStart: pinch.onTouchStart,
          onTouchMove: pinch.onTouchMove,
          onTouchEnd: pinch.onTouchEnd,
          onTouchCancel: pinch.onTouchEnd,
          onStartShouldSetResponder: () => canCapturePointer,
        } as object)}
      >
        <Image source={imageSource} style={styles.mapImage} {...({ pointerEvents: "none" } as object)} />
        <MapCanvasLayers {...shared} markerSize={34} />
      </View>
    </View>
  );
}

export function MiniMapCanvas({
  imageUri,
  fallbackText = "No mini map image set.",
  canCapturePointer,
  ...shared
}: SharedCanvasProps & {
  imageUri: string | null;
  fallbackText?: string;
  canCapturePointer: boolean;
}) {
  return (
    <View
      style={styles.miniMapSurface}
      {...(canCapturePointer
        ? ({
            onClick: shared.onMapPointer,
            onStartShouldSetResponder: () => true,
          } as object)
        : {})}
    >
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.miniMapImage} /> : <View style={styles.miniMapFallback}><Text style={styles.copy}>{fallbackText}</Text></View>}
      <MapCanvasLayers {...shared} markerSize={25} mini />
    </View>
  );
}

function MapCanvasLayers({
  routeSegments,
  draftSegments,
  pathDraft,
  showDraft,
  clickedPercent,
  showTempMarker,
  markers,
  playerPosition,
  playerName,
  playerPortraitUrl,
  onSelectMarker,
  markerSize,
  mini = false,
}: SharedCanvasProps & { markerSize: number; mini?: boolean }) {
  return (
    <>
      {routeSegments.map((segment, index) => (
        <RouteSegment key={`${segment.id}-${index}`} segment={segment} />
      ))}
      {showDraft ? draftSegments.map((segment, index) => (
        <RouteSegment key={`${segment.id}-${index}`} segment={segment} draft />
      )) : null}
      {showDraft ? pathDraft.map((point, index) => (
        <View key={`${point.x}-${point.y}-${index}`} pointerEvents="none" style={[styles.pathPoint, { left: `${point.x}%`, top: `${point.y}%` }]}>
          <Text style={styles.pathPointText}>{index + 1}</Text>
        </View>
      )) : null}
      <View
        style={[
          styles.playerPin,
          mini && styles.miniMapPlayerPin,
          {
            left: `${playerPosition.x}%`,
            top: `${playerPosition.y}%`,
          },
          !mini && ({ transitionDuration: "450ms" } as object),
        ]}
      >
        {playerPortraitUrl ? (
          <Image source={{ uri: playerPortraitUrl }} style={styles.playerPortrait} />
        ) : (
          <Text style={[styles.playerInitial, mini && styles.miniMapPlayerInitial]}>{playerName.slice(0, 1).toUpperCase()}</Text>
        )}
      </View>
      {showTempMarker && clickedPercent ? (
        <View pointerEvents="none" style={[styles.tempMarker, { left: `${clickedPercent.x}%`, top: `${clickedPercent.y}%` }]}>
          <View style={styles.tempPulse} />
          <Text style={styles.tempMarkerText}>New Marker</Text>
        </View>
      ) : null}
      {markers.map((marker) => (
        <Pressable
          key={marker.id}
          style={[styles.marker, mini && styles.miniMapMarker, (!marker.is_active || !marker.is_unlocked) && styles.markerHidden, getMarkerRenderStyle(marker, playerPosition, markerSize)]}
          onPress={(event) => {
            event.stopPropagation();
            onSelectMarker(marker);
          }}
          {...({ onClick: (event: { stopPropagation?: () => void }) => event.stopPropagation?.() } as object)}
        >
          <MarkerIcon marker={marker} mini={mini} />
        </Pressable>
      ))}
    </>
  );
}

function RouteSegment({ segment, draft = false }: { segment: RouteSegmentView; draft?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.routeSegment,
        !segment.isActive && styles.routeSegmentInactive,
        draft && styles.routeSegmentDraft,
        {
          left: `${segment.left}%`,
          top: `${segment.top}%`,
          width: `${segment.length}%`,
          transform: [{ rotate: `${segment.angle}deg` }],
        },
      ]}
    />
  );
}

type TouchLike = {
  clientX?: number;
  clientY?: number;
};

type TouchEventLike = {
  nativeEvent?: {
    touches?: TouchLike[];
    changedTouches?: TouchLike[];
  };
};

function usePinchZoom(onPinchZoom?: (payload: PinchZoomPayload) => void) {
  const lastDistanceRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef(0);

  function getTouchGesture(event: TouchEventLike) {
    const touches = event.nativeEvent?.touches ?? [];

    if (touches.length < 2) {
      return null;
    }

    const [first, second] = touches;
    const firstX = first?.clientX ?? 0;
    const firstY = first?.clientY ?? 0;
    const secondX = second?.clientX ?? 0;
    const secondY = second?.clientY ?? 0;
    return {
      distance: Math.hypot(secondX - firstX, secondY - firstY),
      centerClientX: (firstX + secondX) / 2,
      centerClientY: (firstY + secondY) / 2,
    };
  }

  return {
    onTouchStart: (event: TouchEventLike) => {
      const gesture = getTouchGesture(event);
      if (gesture) {
        lastDistanceRef.current = gesture.distance;
        suppressClickUntilRef.current = Date.now() + 450;
      }
    },
    onTouchMove: (event: TouchEventLike) => {
      const gesture = getTouchGesture(event);
      const lastDistance = lastDistanceRef.current;

      if (!gesture || lastDistance === null || !onPinchZoom) {
        return;
      }

      const rawDelta = (gesture.distance - lastDistance) / 280;
      const delta = Math.max(-0.06, Math.min(0.06, rawDelta));
      if (Math.abs(delta) >= 0.01) {
        onPinchZoom({
          delta,
          centerClientX: gesture.centerClientX,
          centerClientY: gesture.centerClientY,
        });
        lastDistanceRef.current = gesture.distance;
        suppressClickUntilRef.current = Date.now() + 450;
      }
    },
    onTouchEnd: (event: TouchEventLike) => {
      const remainingTouches = event.nativeEvent?.touches?.length ?? 0;
      if (remainingTouches < 2) {
        lastDistanceRef.current = null;
      }
    },
    shouldSuppressClick: () => Date.now() < suppressClickUntilRef.current,
  };
}

const styles = StyleSheet.create({
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
    touchAction: "pan-x pan-y",
    userSelect: "none",
  } as object,
  mapImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  miniMapSurface: {
    position: "relative",
    width: "100%",
    aspectRatio: 1.35,
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  miniMapImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  miniMapFallback: {
    position: "absolute",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
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
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  miniMapMarker: {
    width: 25,
    height: 25,
  },
  markerHidden: {
    opacity: 0.46,
    borderStyle: "dashed",
  },
  playerPin: {
    position: "absolute",
    zIndex: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: colors.blue,
    backgroundColor: "#061118",
    overflow: "hidden",
    transform: [{ translateX: -28 }, { translateY: -28 }],
    alignItems: "center",
    justifyContent: "center",
  },
  miniMapPlayerPin: {
    width: 35,
    height: 35,
    borderRadius: 18,
    borderWidth: 2,
    transform: [{ translateX: -18 }, { translateY: -18 }],
  },
  playerPortrait: {
    width: "100%",
    height: "100%",
  },
  playerInitial: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 22,
  },
  miniMapPlayerInitial: {
    fontSize: 14,
  },
});
