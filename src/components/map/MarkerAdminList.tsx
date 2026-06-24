import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { MapMarker } from "../../services/mapService";
import { colors, fonts } from "../theme";

type MarkerAdminListProps = {
  title: string;
  emptyText: string;
  markers: MapMarker[];
  onEdit: (marker: MapMarker) => void;
  onPreview: (marker: MapMarker) => void;
  onDelete: (marker: MapMarker) => void;
};

export function MarkerAdminList({ title, emptyText, markers, onEdit, onPreview, onDelete }: MarkerAdminListProps) {
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const markerTypes = useMemo(() => Array.from(new Set(markers.map((marker) => marker.type))).sort(), [markers]);
  const filteredMarkers = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return markers.filter((marker) => {
      const matchesType = !typeFilter || marker.type === typeFilter;
      const matchesSearch = !search || marker.title.toLowerCase().includes(search) || marker.type.toLowerCase().includes(search);
      return matchesType && matchesSearch;
    });
  }, [markers, searchText, typeFilter]);

  return (
    <View style={styles.routeList}>
      <Text style={styles.selectedTitle}>{title}</Text>
      {markers.length === 0 ? <Text style={styles.copy}>{emptyText}</Text> : null}
      {markers.length > 0 ? (
        <>
          <TextInput value={searchText} onChangeText={setSearchText} placeholder="Search markers by name or type" placeholderTextColor={colors.muted} style={styles.input} />
          <View style={styles.filterRow}>
            <Pressable style={[styles.routeChip, !typeFilter && styles.routeChipActive]} onPress={() => setTypeFilter(null)}>
              <Text style={styles.routeChipText}>All</Text>
            </Pressable>
            {markerTypes.map((type) => (
              <Pressable key={type} style={[styles.routeChip, typeFilter === type && styles.routeChipActive]} onPress={() => setTypeFilter(type)}>
                <Text style={styles.routeChipText}>{type}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      {filteredMarkers.length === 0 && markers.length > 0 ? <Text style={styles.copy}>No markers match the current search/filter.</Text> : null}
      {filteredMarkers.map((marker) => {
        const warnings = getMarkerWarnings(marker);

        return (
        <View key={marker.id} style={styles.markerTableRow}>
          <View style={styles.markerTableInfo}>
            <Text style={styles.markerName}>{marker.title}</Text>
            <Text style={styles.copy}>
              {marker.type} / X {Number(marker.x_percent).toFixed(2)}% / Y {Number(marker.y_percent).toFixed(2)}% / Radius {Number(marker.interaction_radius_percent ?? 4).toFixed(2)}%
            </Text>
            <Text style={styles.debugLine}>
              Interactable: {marker.is_interactable ? "true" : "false"} / Visible: {marker.is_active ? "true" : "false"} / Unlocked: {marker.is_unlocked ? "true" : "false"}
            </Text>
            {warnings.map((warning) => <Text key={warning} style={styles.warningText}>{warning}</Text>)}
          </View>
          <View style={styles.markerTableActions}>
            <Pressable style={styles.secondaryButtonFlex} onPress={() => onEdit(marker)}>
              <Text style={styles.secondaryText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.secondaryButtonFlex} onPress={() => onPreview(marker)}>
              <Text style={styles.secondaryText}>Preview/Test</Text>
            </Pressable>
            <Pressable style={styles.secondaryButtonFlex} onPress={() => onDelete(marker)}>
              <Text style={styles.dangerText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      );
      })}
    </View>
  );
}

function getMarkerWarnings(marker: MapMarker) {
  const warnings: string[] = [];

  if (!marker.title?.trim()) warnings.push("Warning: marker needs a title.");
  if (!Number.isFinite(Number(marker.x_percent)) || !Number.isFinite(Number(marker.y_percent))) warnings.push("Warning: marker has invalid coordinates.");
  if (marker.type === "Area/Town Entrance" && !marker.linked_mini_map_id) warnings.push("Warning: entrance has no linked mini map.");
  if ((marker.type === "Exit" || marker.type === "Exit/Leave") && !marker.exit_target_marker_id && !marker.linked_mini_map_id) warnings.push("Warning: exit has no destination.");

  return warnings;
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
  debugLine: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  markerName: {
    color: colors.text,
    fontFamily: fonts.title,
  },
  markerTableActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  markerTableInfo: {
    flex: 1,
    gap: 4,
  },
  markerTableRow: {
    backgroundColor: "rgba(0,0,0,0.22)",
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  routeList: {
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
    paddingBottom: 10,
  },
  routeChip: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  routeChipActive: {
    backgroundColor: "rgba(21, 157, 220, 0.25)",
    borderColor: colors.blue,
  },
  routeChipText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
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
  warningText: {
    color: colors.red,
    fontFamily: fonts.title,
    fontSize: 12,
  },
});
