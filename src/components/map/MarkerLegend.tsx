import { Pressable, StyleSheet, Text, View } from "react-native";
import { Frame } from "../Frame";
import { colors, fonts } from "../theme";
import type { MarkerLegendItem } from "../../services/mapService";
import { MarkerIcon } from "./MarkerIcon";

export function MarkerLegend({ items, open, onToggle }: { items: MarkerLegendItem[]; open: boolean; onToggle: () => void }) {
  const visibleItems = items.filter((item) => item.is_active).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Frame style={styles.legendPanel}>
      <Pressable style={styles.legendHeader} onPress={onToggle}>
        <Text style={styles.sectionTitle}>Map Legend</Text>
        <Text style={styles.secondaryText}>{open ? "Hide" : "Show"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.legendList}>
          {visibleItems.length === 0 ? <Text style={styles.copy}>No legend entries yet.</Text> : null}
          {visibleItems.map((item) => (
            <View key={item.id} style={styles.legendItem}>
              <MarkerIcon
                marker={{
                  type: item.marker_type,
                  icon_label: item.icon_label,
                  icon_image_url: item.icon_image_url,
                  icon_color: item.icon_color,
                }}
                compact
              />
              <View style={styles.markerTableInfo}>
                <Text style={styles.markerName}>{item.title}</Text>
                {item.description ? <Text style={styles.copy}>{item.description}</Text> : <Text style={styles.copy}>{item.marker_type}</Text>}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Frame>
  );
}

const styles = StyleSheet.create({
  legendPanel: {
    marginHorizontal: 12,
    marginTop: 12,
    padding: 12,
    gap: 10,
  },
  legendHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  legendList: {
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.borderSoft,
    paddingTop: 8,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: "uppercase",
  },
  secondaryText: {
    color: colors.blue,
    fontWeight: "900",
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  markerName: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
    marginTop: 2,
  },
  markerTableInfo: {
    gap: 4,
  },
});
