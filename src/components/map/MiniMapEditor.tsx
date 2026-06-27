import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { MiniMap } from "../../services/mapService";
import { AdminImageUploadButton } from "../admin/AdminImageUploadButton";
import { colors, fonts } from "../theme";

type MiniMapEditorProps<MiniMapType extends string> = {
  miniMapTypes: readonly MiniMapType[];
  miniMaps: MiniMap[];
  name: string;
  type: MiniMapType;
  background: string;
  description: string;
  width: string;
  height: string;
  active: boolean;
  onChangeName: (value: string) => void;
  onChangeType: (value: MiniMapType) => void;
  onChangeBackground: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeWidth: (value: string) => void;
  onChangeHeight: (value: string) => void;
  onToggleActive: () => void;
  onSave: () => void;
  onEdit: (miniMap: MiniMap) => void;
  onCancelEdit: () => void;
  onOpen: (miniMap: MiniMap) => void;
  onDelete: (miniMapId: string) => void;
  onUploadMessage: (message: string) => void;
  editingMiniMapId: string | null;
};

export function MiniMapEditor<MiniMapType extends string>({
  miniMapTypes,
  miniMaps,
  name,
  type,
  background,
  description,
  width,
  height,
  active,
  onChangeName,
  onChangeType,
  onChangeBackground,
  onChangeDescription,
  onChangeWidth,
  onChangeHeight,
  onToggleActive,
  onSave,
  onEdit,
  onCancelEdit,
  onOpen,
  onDelete,
  onUploadMessage,
  editingMiniMapId,
}: MiniMapEditorProps<MiniMapType>) {
  const isEditing = Boolean(editingMiniMapId);

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Mini Maps</Text>
      <Text style={styles.copy}>{isEditing ? "Editing an existing mini map. Save changes or cancel to return to creation." : "Create maps for towns, forests, dungeons, areas, or tutorials. Link one to an Area/Town Entrance marker to let players enter it."}</Text>
      <TextInput value={name} onChangeText={onChangeName} placeholder="Mini map name" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.storyRoutePicker}>
        {miniMapTypes.map((item) => (
          <Pressable key={item} style={[styles.routeChip, type === item && styles.routeChipActive]} onPress={() => onChangeType(item)}>
            <Text style={styles.routeChipText}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={background} onChangeText={onChangeBackground} placeholder="Background image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
      <AdminImageUploadButton folder="mini-maps" onUploaded={onChangeBackground} onMessage={onUploadMessage} />
      <View style={styles.modeRow}>
        <TextInput value={width} onChangeText={onChangeWidth} placeholder="Frame width, example 900" placeholderTextColor={colors.muted} style={[styles.input, styles.flexInput]} />
        <TextInput value={height} onChangeText={onChangeHeight} placeholder="Frame height, example 650" placeholderTextColor={colors.muted} style={[styles.input, styles.flexInput]} />
      </View>
      <TextInput value={description} onChangeText={onChangeDescription} placeholder="Description" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
      <Pressable style={[styles.secondaryButton, active && styles.typeSelected]} onPress={onToggleActive}>
        <Text style={styles.secondaryText}>Active: {active ? "true" : "false"}</Text>
      </Pressable>
      <Pressable style={styles.primaryButton} onPress={onSave} disabled={!name.trim()}>
        <Text style={styles.primaryText}>{isEditing ? "Update Mini Map" : "Create Mini Map"}</Text>
      </Pressable>
      {isEditing ? (
        <Pressable style={styles.secondaryButton} onPress={onCancelEdit}>
          <Text style={styles.secondaryText}>Cancel Edit</Text>
        </Pressable>
      ) : null}
      <Text style={styles.selectedTitle}>Existing Mini Maps</Text>
      {miniMaps.length === 0 ? <Text style={styles.copy}>No mini maps created yet.</Text> : null}
      {miniMaps.map((miniMap) => (
        <View key={miniMap.id} style={styles.storyCard}>
          <Text style={styles.markerName}>{miniMap.name}</Text>
          <Text style={styles.copy}>{miniMap.type} / {miniMap.width ?? 900} x {miniMap.height ?? 650} / {miniMap.is_active ? "Active" : "Hidden"}</Text>
          <View style={styles.modeRow}>
            <Pressable style={[styles.secondaryButtonFlex, editingMiniMapId === miniMap.id && styles.typeSelected]} onPress={() => onEdit(miniMap)}>
              <Text style={styles.secondaryText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.secondaryButtonFlex} onPress={() => onOpen(miniMap)}>
              <Text style={styles.secondaryText}>Open</Text>
            </Pressable>
            <Pressable style={styles.secondaryButtonFlex} onPress={() => onDelete(miniMap.id)}>
              <Text style={styles.dangerText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Text style={styles.debugLine}>Open a mini map to place spawn markers, sign posts, shops, encounters, and mini-map walking paths.</Text>
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
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  flexInput: {
    flex: 1,
    minWidth: 150,
  },
  markerName: {
    color: colors.text,
    fontFamily: fonts.title,
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
