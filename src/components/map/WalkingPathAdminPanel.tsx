import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { MapRoute } from "../../services/mapService";
import type { PathSegmentMeta, PathSegmentVisibility } from "../../utils/mapGeometry";
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
  pathDraft?: Array<{ x: number; y: number }>;
  pathSegments?: PathSegmentMeta[];
  onChangePathSegments?: (segments: PathSegmentMeta[]) => void;
};

const visibilityOptions: Array<{ value: PathSegmentVisibility; label: string; hint: string }> = [
  { value: "visible", label: "Visible", hint: "White trail dots show to players." },
  { value: "hidden", label: "Hidden", hint: "Trail and player fade behind terrain." },
  { value: "cave", label: "Cave", hint: "Trail disappears for interior/underground travel." },
  { value: "fog", label: "Fog", hint: "Trail stays faint and player is dimmed." },
];

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
  pathDraft = [],
  pathSegments = [],
  onChangePathSegments,
}: WalkingPathAdminPanelProps<Mode>) {
  function updateSegment(segmentIndex: number, visibility: PathSegmentVisibility, label?: string | null) {
    if (!onChangePathSegments) {
      return;
    }

    const next = pathSegments.filter((segment) => Number(segment.from_index) !== segmentIndex);
    if (visibility !== "visible") {
      next.push({
        from_index: segmentIndex,
        to_index: segmentIndex + 1,
        visibility,
        label: label ?? pathSegments.find((segment) => Number(segment.from_index) === segmentIndex)?.label ?? null,
      });
    }
    onChangePathSegments(next.sort((a, b) => a.from_index - b.from_index));
  }

  function updateSegmentLabel(segmentIndex: number, label: string) {
    const current = pathSegments.find((segment) => Number(segment.from_index) === segmentIndex);
    updateSegment(segmentIndex, current?.visibility ?? "hidden", label);
  }

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
      {onChangePathSegments && pathDraft.length >= 2 ? (
        <View style={styles.segmentPanel}>
          <Text style={styles.selectedTitle}>Trail Visibility</Text>
          <Text style={styles.copy}>Choose how each segment appears to players. Hidden and Cave sections make the trail disappear and dim the player while they travel through that stretch.</Text>
          {pathDraft.slice(1).map((_, index) => {
            const segment = pathSegments.find((item) => Number(item.from_index) === index);
            const selected = segment?.visibility ?? "visible";
            return (
              <View key={`segment-${index}`} style={styles.segmentRow}>
                <View style={styles.segmentHeader}>
                  <Text style={styles.markerName}>Point {index + 1} to {index + 2}</Text>
                  <Text style={styles.copy}>{visibilityOptions.find((option) => option.value === selected)?.hint}</Text>
                </View>
                <View style={styles.modeRow}>
                  {visibilityOptions.map((option) => (
                    <Pressable key={option.value} style={[styles.visibilityChip, selected === option.value && styles.typeSelected]} onPress={() => updateSegment(index, option.value)}>
                      <Text style={styles.typeText}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {selected !== "visible" ? (
                  <TextInput
                    value={segment?.label ?? ""}
                    onChangeText={(value) => updateSegmentLabel(index, value)}
                    placeholder="Optional note, example Behind ridge"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />
                ) : null}
              </View>
            );
          })}
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
  input: {
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 44,
    padding: 10,
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
  segmentHeader: {
    gap: 2,
  },
  segmentPanel: {
    borderColor: colors.borderSoft,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  segmentRow: {
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  typeSelected: {
    backgroundColor: "rgba(21, 157, 220, 0.25)",
    borderColor: colors.blue,
  },
  visibilityChip: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  typeText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
  },
});
