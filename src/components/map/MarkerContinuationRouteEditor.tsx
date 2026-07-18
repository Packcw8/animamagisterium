import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { StyleSheet, Text, View } from "react-native";
import type { MapMarker, MapRoute } from "../../services/mapService";
import { colors, fonts } from "../theme";
import { RoutePicker } from "./MarkerEditorControls";

type MarkerContinuationRouteEditorProps = {
  markerType: string;
  routes: MapRoute[];
  selectedRouteId: string | null;
  startDirection: MapMarker["linked_route_start_direction"];
  startsRouteOnAccept: boolean;
  onSelectRoute: (routeId: string | null) => void;
  onSelectStartDirection: (direction: MapMarker["linked_route_start_direction"]) => void;
  onToggleStartsRoute: () => void;
};

export function MarkerContinuationRouteEditor({
  markerType,
  routes,
  selectedRouteId,
  startDirection,
  startsRouteOnAccept,
  onSelectRoute,
  onSelectStartDirection,
  onToggleStartsRoute,
}: MarkerContinuationRouteEditorProps) {
  const isExit = markerType === "Exit" || markerType === "Exit/Leave";

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Auto-Continue Trail</Text>
      <Text style={styles.copy}>
        {isExit
          ? "Optional: after this exit moves the player to its target map or marker, automatically start one linked trail from any world or mini map."
          : "Optional: after this entrance opens the area, automatically start one linked trail from any world or mini map."}
      </Text>
      <RoutePicker routes={routes} selectedId={selectedRouteId} onSelect={onSelectRoute} />
      {selectedRouteId ? (
        <View style={styles.directionPanel}>
          <Text style={styles.title}>Start Direction</Text>
          <Text style={styles.copy}>Forward starts this path at 0%. Reverse starts this path at 100% and walks back to 0%.</Text>
          <View style={styles.modeRow}>
            <Pressable style={[styles.secondaryButtonFlex, startDirection !== "reverse" && styles.typeSelected]} onPress={() => onSelectStartDirection("forward")}>
              <Text style={styles.secondaryText}>Forward 0% to 100%</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButtonFlex, startDirection === "reverse" && styles.typeSelected]} onPress={() => onSelectStartDirection("reverse")}>
              <Text style={styles.secondaryText}>Reverse 100% to 0%</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <Pressable style={[styles.secondaryButton, startsRouteOnAccept && styles.typeSelected]} onPress={onToggleStartsRoute}>
        <Text style={styles.secondaryText}>Start Linked Path After Opening: {startsRouteOnAccept ? "Yes" : "No"}</Text>
      </Pressable>
      <Text style={styles.debugLine}>Use this for same-road continuations. Use Travel Hubs when the player should choose between paths.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  debugLine: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  directionPanel: {
    gap: 8,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  panel: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  secondaryButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    padding: 12,
  },
  secondaryButtonFlex: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    padding: 12,
  },
  secondaryText: {
    color: colors.blue,
    fontFamily: fonts.title,
    textAlign: "center",
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  typeSelected: {
    backgroundColor: "rgba(30, 168, 236, 0.22)",
    borderColor: colors.blue,
  },
});
