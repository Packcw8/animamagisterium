import { Pressable, StyleSheet, Text, View } from "react-native";
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
  return (
    <View style={styles.routeList}>
      <Text style={styles.selectedTitle}>{title}</Text>
      {markers.length === 0 ? <Text style={styles.copy}>{emptyText}</Text> : null}
      {markers.map((marker) => (
        <View key={marker.id} style={styles.markerTableRow}>
          <View style={styles.markerTableInfo}>
            <Text style={styles.markerName}>{marker.title}</Text>
            <Text style={styles.copy}>
              {marker.type} / X {Number(marker.x_percent).toFixed(2)}% / Y {Number(marker.y_percent).toFixed(2)}% / Radius {Number(marker.interaction_radius_percent ?? 4).toFixed(2)}%
            </Text>
            <Text style={styles.debugLine}>
              Interactable: {marker.is_interactable ? "true" : "false"} / Visible: {marker.is_active ? "true" : "false"} / Unlocked: {marker.is_unlocked ? "true" : "false"}
            </Text>
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
      ))}
    </View>
  );
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
});
