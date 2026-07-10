import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { StyleSheet, Text, View } from "react-native";
import type { MapRoute, MarkerRouteLink } from "../../services/mapService";
import { colors, fonts } from "../theme";
import { RouteCompletionConditionPicker } from "./MarkerEditorControls";

type MarkerPathRequirementEditorProps = {
  title: string;
  description: string;
  routes: MapRoute[];
  selectedRouteIds: string[];
  completionCondition: MarkerRouteLink["completion_condition"];
  onToggleRoute: (routeId: string) => void;
  onSelectCompletionCondition: (value: MarkerRouteLink["completion_condition"]) => void;
  emptyText: string;
  saveHint?: string;
};

export function MarkerPathRequirementEditor({
  title,
  description,
  routes,
  selectedRouteIds,
  completionCondition,
  onToggleRoute,
  onSelectCompletionCondition,
  emptyText,
  saveHint,
}: MarkerPathRequirementEditorProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.copy}>{description}</Text>
      <View style={styles.routePicker}>
        {routes.map((route) => (
          <Pressable
            key={route.id}
            style={[styles.routeChip, selectedRouteIds.includes(route.id) && styles.routeChipActive]}
            onPress={() => onToggleRoute(route.id)}
          >
            <Text style={styles.routeChipText}>
              {route.sort_order}. {route.name}
              {route.mini_map_id ? " (Mini)" : " (World)"}
            </Text>
          </Pressable>
        ))}
      </View>
      {routes.length === 0 ? <Text style={styles.debugLine}>{emptyText}</Text> : null}
      <RouteCompletionConditionPicker value={completionCondition} onSelect={onSelectCompletionCondition} />
      <Text style={styles.debugLine}>
        {saveHint ?? "Save the marker after changing linked paths or the unlock point."}
      </Text>
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
  routeChip: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  routeChipActive: {
    backgroundColor: "rgba(30, 168, 236, 0.22)",
    borderColor: colors.blue,
  },
  routeChipText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  routePicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 16,
  },
});
