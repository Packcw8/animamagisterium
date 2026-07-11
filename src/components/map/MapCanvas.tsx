import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Image, ImageSourcePropType, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import type { MapMarker } from "../../services/mapService";
import { getCenteredMapOffset } from "../../utils/mapCamera";
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
  visibility?: "visible" | "hidden" | "cave" | "fog";
  revealConcealed?: boolean;
};

type PercentPoint = {
  x: number;
  y: number;
};

export type RouteEventPin = PercentPoint & {
  id: string;
  title: string;
  percent: number;
  eventType: string;
  linkedOnly?: boolean;
};

type SharedCanvasProps = {
  routeSegments: RouteSegmentView[];
  draftSegments: RouteSegmentView[];
  pathDraft: PercentPoint[];
  eventPins?: RouteEventPin[];
  showDraft: boolean;
  clickedPercent: PercentPoint | null;
  showTempMarker: boolean;
  markers: MapMarker[];
  playerPosition: PercentPoint;
  playerName: string;
  playerPortraitUrl?: string | null;
  onMapPointer?: (event: unknown) => void;
  onSelectMarker: (marker: MapMarker) => void;
  playerPathVisibility?: "visible" | "hidden" | "cave" | "fog";
  playerScale?: number;
  markerScale?: number;
};

export function OverworldMapCanvas({
  viewportRef,
  scaledMapSize,
  imageSource,
  onWheel,
  onPinchZoom,
  canCapturePointer,
  lockedToPlayer = false,
  ...shared
}: SharedCanvasProps & {
  viewportRef: MutableRefObject<MapViewportRef | null>;
  scaledMapSize: { width: number; height: number };
  imageSource: ImageSourcePropType;
  onWheel: (event: { nativeEvent?: { deltaY?: number } }) => void;
  onPinchZoom?: (payload: PinchZoomPayload) => void;
  canCapturePointer: boolean;
  lockedToPlayer?: boolean;
}) {
  const pinch = usePinchZoom(onPinchZoom);
  const nativeViewport = useNativeMapViewport(viewportRef);
  const [lockedViewportSize, setLockedViewportSize] = useState({ width: 360, height: 560 });
  const lockedOffset = getCenteredMapOffset(shared.playerPosition, scaledMapSize, lockedViewportSize);

  const surface = (
    <View
      style={[
        styles.mapSurface,
        {
          width: scaledMapSize.width,
          height: scaledMapSize.height,
        },
      ]}
      {...(Platform.OS === "web"
        ? ({
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
          } as object)
        : ({
            onTouchStart: pinch.onTouchStart,
            onTouchMove: pinch.onTouchMove,
            onTouchEnd: (event: unknown) => {
              pinch.onTouchEnd(event as TouchEventLike);
              if (canCapturePointer && !pinch.shouldSuppressClick()) {
                shared.onMapPointer?.(withNativeTargetSize(event, scaledMapSize.width, scaledMapSize.height));
              }
            },
          } as object))}
    >
      <Image source={imageSource} style={styles.mapImage} {...({ pointerEvents: "none" } as object)} />
      <MapCanvasLayers {...shared} markerSize={34} />
    </View>
  );

  if (lockedToPlayer) {
    return (
      <View
        style={styles.lockedViewport}
        onLayout={(event) => {
          setLockedViewportSize({
            width: Math.max(1, event.nativeEvent.layout.width),
            height: Math.max(1, event.nativeEvent.layout.height),
          });
        }}
      >
        <View
          style={[
            styles.lockedSurface,
            {
              width: scaledMapSize.width,
              height: scaledMapSize.height,
              transform: [{ translateX: lockedOffset.left }, { translateY: lockedOffset.top }],
            },
          ]}
        >
          {surface}
        </View>
        <View pointerEvents="none" style={styles.lockedVignette} />
      </View>
    );
  }

  if (Platform.OS !== "web") {
    return (
      <ScrollView
        ref={nativeViewport.verticalRef}
        style={styles.nativeViewport}
        contentContainerStyle={{ minHeight: scaledMapSize.height }}
        nestedScrollEnabled
        scrollEventThrottle={16}
        onLayout={nativeViewport.onLayout}
        onScroll={nativeViewport.onVerticalScroll}
      >
        <ScrollView
          ref={nativeViewport.horizontalRef}
          horizontal
          nestedScrollEnabled
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator
          onScroll={nativeViewport.onHorizontalScroll}
        >
          {surface}
        </ScrollView>
      </ScrollView>
    );
  }

  return (
    <View ref={viewportRef as never} style={styles.viewport} {...({ onWheel } as object)}>
      {surface}
    </View>
  );
}

export function MiniMapCanvas({
  imageUri,
  fallbackText = "No mini map image set.",
  height,
  width,
  canCapturePointer,
  lockedToPlayer = false,
  fixedView = false,
  zoomEnabled = false,
  ...shared
}: SharedCanvasProps & {
  imageUri: string | null;
  fallbackText?: string;
  height?: number;
  width?: number;
  canCapturePointer: boolean;
  lockedToPlayer?: boolean;
  fixedView?: boolean;
  zoomEnabled?: boolean;
}) {
  const [imageAspectRatio, setImageAspectRatio] = useState(1.35);
  const [lockedViewportSize, setLockedViewportSize] = useState({ width: 360, height: 420 });
  const [zoomScale, setZoomScale] = useState(1);
  const surfaceHeight = Math.max(280, Number(height) || 520);
  const surfaceWidth = Math.max(320, Number(width) || Math.round(surfaceHeight * imageAspectRatio));
  const effectiveZoomScale = zoomEnabled ? zoomScale : 1;
  const renderedSurfaceHeight = surfaceHeight * effectiveZoomScale;
  const renderedSurfaceWidth = surfaceWidth * effectiveZoomScale;
  const lockedOffset = getCenteredMapOffset(shared.playerPosition, { width: renderedSurfaceWidth, height: renderedSurfaceHeight }, lockedViewportSize);

  function handleMiniMapImageLoad(event: { nativeEvent?: { source?: { width?: number; height?: number } } }) {
    const width = Number(event.nativeEvent?.source?.width) || 0;
    const nextHeight = Number(event.nativeEvent?.source?.height) || 0;
    if (width > 0 && nextHeight > 0) {
      setImageAspectRatio(Math.max(0.4, Math.min(3.5, width / nextHeight)));
    }
  }

  const miniMapSurface = (
    <View
      style={[
        styles.miniMapSurface,
        {
          width: renderedSurfaceWidth,
          height: renderedSurfaceHeight,
        },
      ]}
      {...(canCapturePointer
        ? Platform.OS === "web"
          ? ({
              onClick: shared.onMapPointer,
              onStartShouldSetResponder: () => true,
            } as object)
          : ({
              onTouchEnd: (event: unknown) => shared.onMapPointer?.(withNativeTargetSize(event, renderedSurfaceWidth, renderedSurfaceHeight)),
            } as object)
        : {})}
    >
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.miniMapImage}
          resizeMode="stretch"
          onLoad={handleMiniMapImageLoad}
          {...({ pointerEvents: "none" } as object)}
        />
      ) : (
        <View style={styles.miniMapFallback}><Text style={styles.copy}>{fallbackText}</Text></View>
      )}
      <MapCanvasLayers {...shared} markerSize={25} mini />
      {zoomEnabled && !canCapturePointer ? (
        <View style={styles.miniMapZoomControls}>
          <Pressable style={styles.miniMapZoomButton} onPress={() => setZoomScale((value) => Math.min(2, value + 0.15))}>
            <Text style={styles.miniMapZoomText}>+</Text>
          </Pressable>
          <Pressable style={styles.miniMapZoomButton} onPress={() => setZoomScale((value) => Math.max(0.75, value - 0.15))}>
            <Text style={styles.miniMapZoomText}>-</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const miniMapEdgeFill = imageUri ? (
    <Image
      source={{ uri: imageUri }}
      style={styles.miniMapEdgeFill}
      resizeMode="cover"
      blurRadius={Platform.OS === "web" ? 0 : 8}
      {...({ pointerEvents: "none" } as object)}
    />
  ) : null;

  if (Platform.OS !== "web") {
    if (lockedToPlayer) {
      return (
        <View
          style={[styles.lockedMiniMapViewport, { height: Math.min(520, surfaceHeight) }]}
          onLayout={(event) => {
            setLockedViewportSize({
              width: Math.max(1, event.nativeEvent.layout.width),
              height: Math.max(1, event.nativeEvent.layout.height),
            });
          }}
        >
          {miniMapEdgeFill}
          <View
            style={[
              styles.lockedSurface,
              {
                width: renderedSurfaceWidth,
                height: renderedSurfaceHeight,
                transform: [{ translateX: lockedOffset.left }, { translateY: lockedOffset.top }],
              },
            ]}
          >
            {miniMapSurface}
          </View>
          <View pointerEvents="none" style={styles.lockedVignette} />
        </View>
      );
    }

    if (fixedView) {
      return (
        <View style={[styles.fixedMiniMapViewport, { height: Math.min(520, surfaceHeight) }]}>
          {miniMapEdgeFill}
          {miniMapSurface}
        </View>
      );
    }

    return (
      <ScrollView style={[styles.nativeMiniMapViewport, { height: surfaceHeight }]} nestedScrollEnabled>
        <ScrollView horizontal nestedScrollEnabled>
          {miniMapSurface}
        </ScrollView>
      </ScrollView>
    );
  }

  if (lockedToPlayer) {
    return (
      <View
        style={[styles.lockedMiniMapViewport, { height: Math.min(520, surfaceHeight) } as object]}
        onLayout={(event) => {
          setLockedViewportSize({
            width: Math.max(1, event.nativeEvent.layout.width),
            height: Math.max(1, event.nativeEvent.layout.height),
          });
        }}
      >
        {miniMapEdgeFill}
        <View
          style={[
              styles.lockedSurface,
              {
              width: renderedSurfaceWidth,
              height: renderedSurfaceHeight,
              transform: [{ translateX: lockedOffset.left }, { translateY: lockedOffset.top }],
            },
          ]}
        >
          {miniMapSurface}
        </View>
        <View pointerEvents="none" style={styles.lockedVignette} />
      </View>
    );
  }

  if (fixedView) {
    return (
      <View style={[styles.fixedMiniMapViewport, { height: Math.min(520, surfaceHeight) } as object]}>
        {miniMapEdgeFill}
        {miniMapSurface}
      </View>
    );
  }

  return (
    <View style={[styles.miniMapViewport, { height: surfaceHeight } as object]}>
      {miniMapSurface}
    </View>
  );
}

function useNativeMapViewport(viewportRef: MutableRefObject<MapViewportRef | null>) {
  const verticalRef = useRef<ScrollView | null>(null);
  const horizontalRef = useRef<ScrollView | null>(null);
  const metricsRef = useRef({ left: 0, top: 0, width: 360, height: 520 });

  function syncViewport() {
    viewportRef.current = {
      scrollLeft: metricsRef.current.left,
      scrollTop: metricsRef.current.top,
      clientWidth: metricsRef.current.width,
      clientHeight: metricsRef.current.height,
      scrollTo: ({ left, top }) => {
        metricsRef.current.left = Math.max(0, Number(left) || 0);
        metricsRef.current.top = Math.max(0, Number(top) || 0);
        horizontalRef.current?.scrollTo({ x: metricsRef.current.left, animated: true });
        verticalRef.current?.scrollTo({ y: metricsRef.current.top, animated: true });
      },
    };
  }

  return {
    verticalRef,
    horizontalRef,
    onLayout: (event: LayoutChangeEvent) => {
      metricsRef.current.width = event.nativeEvent.layout.width;
      metricsRef.current.height = event.nativeEvent.layout.height;
      syncViewport();
    },
    onVerticalScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      metricsRef.current.top = event.nativeEvent.contentOffset.y;
      syncViewport();
    },
    onHorizontalScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      metricsRef.current.left = event.nativeEvent.contentOffset.x;
      syncViewport();
    },
  };
}

function withNativeTargetSize(event: unknown, width: number, height: number) {
  return {
    ...(typeof event === "object" && event ? event : {}),
    currentTarget: {
      clientWidth: width,
      clientHeight: height,
    },
  };
}

function MapCanvasLayers({
  routeSegments,
  draftSegments,
  pathDraft,
  eventPins = [],
  showDraft,
  clickedPercent,
  showTempMarker,
  markers,
  playerPosition,
  playerName,
  playerPortraitUrl,
  playerPathVisibility,
  onSelectMarker,
  markerSize,
  mini = false,
  playerScale = 1,
  markerScale = 1,
}: SharedCanvasProps & { markerSize: number; mini?: boolean }) {
  const safePlayerScale = Math.max(0.35, Math.min(2, Number(playerScale) || 1));
  const safeMarkerScale = Math.max(0.35, Math.min(2, Number(markerScale) || 1));
  const playerPinOffset = mini ? 18 : 14;
  const scaledMarkerSize = Math.max(12, Math.round(markerSize * safeMarkerScale));

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
      {eventPins.map((pin) => (
        <View key={pin.id} pointerEvents="none" style={[styles.eventPin, { left: `${pin.x}%`, top: `${pin.y}%` }]}>
          <View style={[styles.eventPinDot, pin.eventType === "battle" && styles.eventPinBattle, pin.linkedOnly && styles.eventPinLinkedOnly]}>
            <Text style={styles.eventPinPercent}>{Math.round(pin.percent)}</Text>
          </View>
          <View style={styles.eventPinLabel}>
            <Text style={styles.eventPinTitle} numberOfLines={1}>{pin.title}</Text>
            <Text style={styles.eventPinMeta}>{pin.eventType}{pin.linkedOnly ? " / linked" : ""}</Text>
          </View>
        </View>
      ))}
      <View
        style={[
          styles.playerPin,
          mini && styles.miniMapPlayerPin,
          isPlayerConcealed(playerPathVisibility) && styles.playerPinConcealed,
          playerPathVisibility === "fog" && styles.playerPinFogged,
          {
            left: `${playerPosition.x}%`,
            top: `${playerPosition.y}%`,
            transform: [{ translateX: -playerPinOffset }, { translateY: -playerPinOffset }, { scale: safePlayerScale }],
          },
          !mini && ({ transitionDuration: "450ms" } as object),
        ]}
      >
        <View pointerEvents="none" style={styles.playerLabel}>
          <Text style={styles.playerLabelText}>YOU</Text>
        </View>
        <View style={[styles.playerPortraitFrame, mini && styles.miniMapPlayerPortraitFrame]}>
          {playerPortraitUrl ? (
            <Image source={{ uri: playerPortraitUrl }} style={styles.playerPortrait} />
          ) : (
            <Text style={[styles.playerInitial, mini && styles.miniMapPlayerInitial]}>{playerName.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
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
          style={[styles.marker, mini && styles.miniMapMarker, (!marker.is_active || !marker.is_unlocked) && styles.markerHidden, getMarkerRenderStyle(marker, playerPosition, scaledMarkerSize)]}
          onPress={(event) => {
            event.stopPropagation?.();
            event.preventDefault?.();
            onSelectMarker(marker);
          }}
          hitSlop={mini ? 18 : 22}
        >
          <MarkerIcon marker={safeMarkerScale === 1 ? marker : { ...marker, marker_size: Math.round(Number(marker.marker_size ?? 100) * safeMarkerScale) }} mini={mini} />
        </Pressable>
      ))}
    </>
  );
}

function RouteSegment({ segment, draft = false }: { segment: RouteSegmentView; draft?: boolean }) {
  if (!draft && !segment.revealConcealed && (segment.visibility === "hidden" || segment.visibility === "cave")) {
    return null;
  }

  if (!draft && segment.isActive) {
    return (
      <View
        pointerEvents="none"
        style={[
          styles.routeDotLayer,
          segment.visibility === "fog" && styles.routeDotLayerFog,
          {
            left: `${segment.left}%`,
            top: `${segment.top}%`,
            width: `${segment.length}%`,
            transform: [{ rotate: `${segment.angle}deg` }],
          },
        ]}
      >
        {Array.from({ length: Math.max(2, Math.ceil(segment.length / 1.35)) }).map((_, index, dots) => (
          <View key={index} style={[styles.routeDot, { left: `${dots.length === 1 ? 0 : (index / (dots.length - 1)) * 100}%` }]} />
        ))}
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        styles.routeSegment,
        !segment.isActive && styles.routeSegmentInactive,
        draft && styles.routeSegmentDraft,
        !draft && segment.visibility === "fog" && styles.routeSegmentFog,
        !draft && (segment.visibility === "hidden" || segment.visibility === "cave") && styles.routeSegmentHiddenAdmin,
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

function isPlayerConcealed(visibility?: "visible" | "hidden" | "cave" | "fog") {
  return visibility === "hidden" || visibility === "cave";
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
  nativeViewport: {
    height: 520,
    marginHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "#061010",
  },
  lockedViewport: {
    height: 560,
    marginHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: "hidden",
    backgroundColor: "#020707",
    shadowColor: colors.gold,
    shadowOpacity: 0.14,
    shadowRadius: 16,
  },
  lockedSurface: {
    position: "absolute",
    left: 0,
    top: 0,
  },
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
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  miniMapViewport: {
    width: "100%",
    overflow: "auto",
    overflowX: "auto",
    overflowY: "auto",
    borderRadius: 8,
    WebkitOverflowScrolling: "touch",
    touchAction: "pan-x pan-y",
    overscrollBehavior: "contain",
  } as object,
  nativeMiniMapViewport: {
    width: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  lockedMiniMapViewport: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  fixedMiniMapViewport: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  miniMapZoomControls: {
    position: "absolute",
    right: 10,
    bottom: 10,
    zIndex: 35,
    gap: 8,
  },
  miniMapZoomButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(4, 7, 7, 0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  miniMapZoomText: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
  },
  lockedVignette: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(218, 164, 65, 0.2)",
    backgroundColor: "transparent",
  } as object,
  miniMapImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  miniMapEdgeFill: {
    position: "absolute",
    left: -18,
    right: -18,
    top: -18,
    bottom: -18,
    opacity: 0.32,
    transform: [{ scale: 1.08 }],
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
  routeSegmentFog: {
    backgroundColor: "rgba(255, 255, 255, 0.24)",
  },
  routeSegmentHiddenAdmin: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderStyle: "dashed",
  },
  routeDotLayer: {
    position: "absolute",
    height: 12,
    transformOrigin: "0 50%",
  } as object,
  routeDotLayerFog: {
    opacity: 0.38,
  },
  routeDot: {
    position: "absolute",
    top: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    shadowColor: "#ffffff",
    shadowOpacity: 0.5,
    shadowRadius: 5,
    transform: [{ translateX: -3 }],
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
  eventPin: {
    position: "absolute",
    zIndex: 18,
    minWidth: 132,
    transform: [{ translateX: -15 }, { translateY: -15 }],
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eventPinDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: "rgba(6, 12, 12, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.gold,
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  eventPinBattle: {
    borderColor: "#ff8f73",
    shadowColor: "#ff8f73",
  },
  eventPinLinkedOnly: {
    borderStyle: "dashed",
  },
  eventPinPercent: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
  },
  eventPinLabel: {
    maxWidth: 130,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(218, 164, 65, 0.58)",
    backgroundColor: "rgba(4, 7, 7, 0.82)",
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  eventPinTitle: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
  },
  eventPinMeta: {
    color: colors.muted,
    fontSize: 9,
    textTransform: "uppercase",
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
    width: 28,
    height: 28,
    transform: [{ translateX: -14 }, { translateY: -14 }],
    alignItems: "center",
    justifyContent: "center",
  },
  playerPinConcealed: {
    opacity: 0.2,
    borderColor: "rgba(255,255,255,0.42)",
  },
  playerPinFogged: {
    opacity: 0.58,
  },
  miniMapPlayerPin: {
    width: 35,
    height: 35,
    transform: [{ translateX: -18 }, { translateY: -18 }],
  },
  playerLabel: {
    position: "absolute",
    top: -19,
    minWidth: 34,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(54, 184, 242, 0.75)",
    backgroundColor: "rgba(1, 7, 9, 0.86)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.blue,
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  playerLabelText: {
    color: colors.blue,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  playerPortraitFrame: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.blue,
    backgroundColor: "#061118",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  miniMapPlayerPortraitFrame: {
    width: 35,
    height: 35,
    borderRadius: 18,
  },
  playerPortrait: {
    width: "100%",
    height: "100%",
  },
  playerInitial: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  miniMapPlayerInitial: {
    fontSize: 14,
  },
});
