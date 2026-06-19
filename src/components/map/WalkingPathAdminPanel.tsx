import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MapRoute } from "../../services/mapService";
import { colors, fonts } from "../theme";

type WalkingPathAdminPanelProps<Mode extends string> = {
  title: string;
  emptyText: string;
  routes: MapRoute[];
  selectedRouteId: string;
  modes?: readonly Mode[];
  activeMode?: Mode;
  showList?: boolean;
  onSelectMode?: (mode: Mode) => void;
  onSelectRoute: (route: MapRoute) => void;
  onEditRoute: (route: MapRoute) => void;
  onDeleteRoute: (routeId: string) => void;
};

export function WalkingPathAdminPanel<Mode extends string>({
  title,
  emptyText,
  routes,
  selectedRouteId,
  modes,
  activeMode,
  showList = true,
  onSelectMode,
  onSelectRoute,
  onEditRoute,
  onDeleteRoute,
}: WalkingPathAdminPanelProps<Mode>) {
  return (
    <>
      {showList ? (
        <View style={styles.routeList}>
          <Text style={styles.selectedTitle}>{title}</Text>
          {routes.length === 0 ? <Text style={styles.copy}>{emptyText}</Text> : null}
          {routes.map((item) => (
            <View key={item.id} style={[styles.routeRow, selectedRouteId === item.id && styles.routeRowActive]}>
              <Text style={styles.routeNumber}>{item.sort_order}</Text>
              <Pressable style={styles.routeRowText} onPress={() => onSelectRoute(item)}>
                <Text style={styles.markerName}>{item.name}</Text>
                <Text style={styles.copy}>{item.is_active ? "Active" : "Hidden"} / {metersToMiles(item.distance_required_meters)} mi / {item.terrain}</Text>
              </Pressable>
              <Pressable style={styles.secondaryButtonFlex} onPress={() => onEditRoute(item)}>
                <Text style={styles.secondaryText}>Edit</Text>
              </Pressable>
              <Pressable style={styles.secondaryButtonFlex} onPress={() => onDeleteRoute(item.id)}>
                <Text style={styles.dangerText}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {modes && activeMode && onSelectMode ? (
        <View style={styles.modeRow}>
          {modes.map((mode) => (
            <Pressable key={mode} style={[styles.modeButton, activeMode === mode && styles.typeSelected]} onPress={() => onSelectMode(mode)}>
              <Text style={styles.typeText}>{mode}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
}

function metersToMiles(meters: number) {
  return (meters / 1609.344).toFixed(2);
}

const styles = StyleSheet.create({
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  dangerText: {
    color: colors.red,
    fontFamily: fonts.title,
  },
  markerName: {
    color: colors.text,
    fontFamily: fonts.title,
  },
  modeButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  routeList: {
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
    paddingBottom: 10,
  },
  routeNumber: {
    alignItems: "center",
    backgroundColor: "rgba(21, 157, 220, 0.25)",
    borderColor: colors.blue,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fonts.title,
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textAlign: "center",
  },
  routeRow: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  routeRowActive: {
    backgroundColor: "rgba(21, 157, 220, 0.16)",
    borderColor: colors.blue,
  },
  routeRowText: {
    flex: 2,
    gap: 3,
  },
  secondaryButtonFlex: {
    alignItems: "center",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    padding: 10,
  },
  secondaryText: {
    color: colors.blue,
    fontFamily: fonts.title,
  },
  selectedTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  typeSelected: {
    backgroundColor: "rgba(21, 157, 220, 0.25)",
    borderColor: colors.blue,
  },
  typeText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
  },
});
