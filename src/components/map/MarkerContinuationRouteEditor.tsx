import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MapRoute } from "../../services/mapService";
import { colors, fonts } from "../theme";
import { RoutePicker } from "./MarkerEditorControls";

type MarkerContinuationRouteEditorProps = {
  markerType: string;
  routes: MapRoute[];
  selectedRouteId: string | null;
  startsRouteOnAccept: boolean;
  onSelectRoute: (routeId: string | null) => void;
  onToggleStartsRoute: () => void;
};

export function MarkerContinuationRouteEditor({
  markerType,
  routes,
  selectedRouteId,
  startsRouteOnAccept,
  onSelectRoute,
  onToggleStartsRoute,
}: MarkerContinuationRouteEditorProps) {
  const isExit = markerType === "Exit" || markerType === "Exit/Leave";

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Auto-Continue Trail</Text>
      <Text style={styles.copy}>
        {isExit
          ? "Optional: after this exit moves the player to its target map or marker, automatically start one linked trail."
          : "Optional: after this entrance opens the area, automatically start one linked trail inside that area."}
      </Text>
      <RoutePicker routes={routes} selectedId={selectedRouteId} onSelect={onSelectRoute} />
      <Pressable style={[styles.secondaryButton, startsRouteOnAccept && styles.typeSelected]} onPress={onToggleStartsRoute}>
        <Text style={styles.secondaryText}>Start Linked Path After Opening: {startsRouteOnAccept ? "Yes" : "No"}</Text>
      </Pressable>
      <Text style={styles.debugLine}>Use this for same-road continuations. Use Road Signs when the player should choose between paths.</Text>
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
