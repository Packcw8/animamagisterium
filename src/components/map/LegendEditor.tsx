import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { MarkerLegendItem } from "../../services/mapService";
import { AdminImageUploadButton } from "../admin/AdminImageUploadButton";
import { colors, fonts } from "../theme";
import { MarkerIcon } from "./MarkerIcon";

type LegendEditorProps = {
  markerTypes: string[];
  items: MarkerLegendItem[];
  editingItemId: string | null;
  markerType: string;
  title: string;
  description: string;
  iconLabel: string;
  iconImage: string;
  iconColor: string;
  sortOrder: string;
  active: boolean;
  onChangeMarkerType: (value: string) => void;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeIconLabel: (value: string) => void;
  onChangeIconImage: (value: string) => void;
  onChangeIconColor: (value: string) => void;
  onChangeSortOrder: (value: string) => void;
  onToggleActive: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onEditItem: (item: MarkerLegendItem) => void;
  onDeleteItem: (itemId: string) => void;
  onUploadMessage: (message: string) => void;
};

export function LegendEditor({
  markerTypes,
  items,
  editingItemId,
  markerType,
  title,
  description,
  iconLabel,
  iconImage,
  iconColor,
  sortOrder,
  active,
  onChangeMarkerType,
  onChangeTitle,
  onChangeDescription,
  onChangeIconLabel,
  onChangeIconImage,
  onChangeIconColor,
  onChangeSortOrder,
  onToggleActive,
  onSave,
  onCancelEdit,
  onEditItem,
  onDeleteItem,
  onUploadMessage,
}: LegendEditorProps) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Map Legend Builder</Text>
      <Text style={styles.copy}>Create the player-facing key for map emblems. Use short icon text like MKT, or paste an icon image URL/asset path.</Text>
      <View style={styles.storyRoutePicker}>
        {markerTypes.map((type) => (
          <Pressable key={type} style={[styles.routeChip, markerType === type && styles.routeChipActive]} onPress={() => onChangeMarkerType(type)}>
            <Text style={styles.routeChipText}>{type}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={title} onChangeText={onChangeTitle} placeholder="Legend title, example Market" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={description} onChangeText={onChangeDescription} placeholder="What this marker means to players" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
      <TextInput value={iconLabel} onChangeText={onChangeIconLabel} placeholder="Icon text, example MKT" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={iconImage} onChangeText={onChangeIconImage} placeholder="Icon image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
      <AdminImageUploadButton folder="legend-icons" onUploaded={onChangeIconImage} onMessage={onUploadMessage} />
      <TextInput value={iconColor} onChangeText={onChangeIconColor} placeholder="Icon color, example #d9a441" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={sortOrder} onChangeText={onChangeSortOrder} placeholder="Sort order" placeholderTextColor={colors.muted} style={styles.input} />
      <Pressable style={[styles.secondaryButton, active && styles.typeSelected]} onPress={onToggleActive}>
        <Text style={styles.secondaryText}>Active: {active ? "true" : "false"}</Text>
      </Pressable>
      <View style={styles.legendPreviewRow}>
        <MarkerIcon
          marker={{
            type: markerType,
            icon_label: iconLabel,
            icon_image_url: iconImage,
            icon_color: iconColor,
          }}
          compact
        />
        <View style={styles.markerTableInfo}>
          <Text style={styles.markerName}>{title || "Legend preview"}</Text>
          <Text style={styles.copy}>{description || "Players will see this text in the collapsible legend."}</Text>
        </View>
      </View>
      <Pressable style={styles.primaryButton} onPress={onSave} disabled={!title.trim()}>
        <Text style={styles.primaryText}>{editingItemId ? "Update Legend Item" : "Create Legend Item"}</Text>
      </Pressable>
      {editingItemId ? (
        <Pressable style={styles.secondaryButton} onPress={onCancelEdit}>
          <Text style={styles.secondaryText}>Cancel Legend Edit</Text>
        </Pressable>
      ) : null}
      <Text style={styles.selectedTitle}>Existing Legend Items</Text>
      {items.length === 0 ? <Text style={styles.copy}>No legend items yet.</Text> : null}
      {items.map((item) => (
        <View key={item.id} style={styles.storyCard}>
          <View style={styles.legendPreviewRow}>
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
              <Text style={styles.copy}>{item.marker_type} / Order {item.sort_order} / {item.is_active ? "Active" : "Hidden"}</Text>
              {item.description ? <Text style={styles.copy}>{item.description}</Text> : null}
            </View>
          </View>
          <View style={styles.modeRow}>
            <Pressable style={styles.secondaryButtonFlex} onPress={() => onEditItem(item)}>
              <Text style={styles.secondaryText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.secondaryButtonFlex} onPress={() => onDeleteItem(item.id)}>
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
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  legendPreviewRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  markerName: {
    color: colors.text,
    fontFamily: fonts.title,
  },
  markerTableInfo: {
    flex: 1,
    gap: 4,
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  multiInput: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: 8,
    padding: 14,
  },
  primaryText: {
    color: colors.bg,
    fontFamily: fonts.title,
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
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  secondaryButtonFlex: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
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
  storyCard: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 10,
  },
  storyEditor: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  storyRoutePicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeSelected: {
    backgroundColor: "rgba(21, 157, 220, 0.25)",
    borderColor: colors.blue,
  },
});
