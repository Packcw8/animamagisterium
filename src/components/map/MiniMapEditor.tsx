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
  areaName: string;
  areaKey: string;
  sortOrder: string;
  width: string;
  height: string;
  behaviorMode: MiniMap["behavior_mode"];
  zoomEnabled: boolean;
  playerAvatarScale: string;
  markerScale: string;
  entryToastTitle: string;
  entryToastMessage: string;
  entrySoundUrl: string;
  entryVideoUrl: string;
  active: boolean;
  selectedAreaKey: string;
  onChangeName: (value: string) => void;
  onChangeType: (value: MiniMapType) => void;
  onChangeBackground: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeAreaName: (value: string) => void;
  onChangeAreaKey: (value: string) => void;
  onChangeSortOrder: (value: string) => void;
  onChangeWidth: (value: string) => void;
  onChangeHeight: (value: string) => void;
  onChangeBehaviorMode: (value: MiniMap["behavior_mode"]) => void;
  onToggleZoomEnabled: () => void;
  onChangePlayerAvatarScale: (value: string) => void;
  onChangeMarkerScale: (value: string) => void;
  onChangeEntryToastTitle: (value: string) => void;
  onChangeEntryToastMessage: (value: string) => void;
  onChangeEntrySoundUrl: (value: string) => void;
  onChangeEntryVideoUrl: (value: string) => void;
  onSelectAreaKey: (value: string) => void;
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
  areaName,
  areaKey,
  sortOrder,
  width,
  height,
  behaviorMode,
  zoomEnabled,
  playerAvatarScale,
  markerScale,
  entryToastTitle,
  entryToastMessage,
  entrySoundUrl,
  entryVideoUrl,
  active,
  selectedAreaKey,
  onChangeName,
  onChangeType,
  onChangeBackground,
  onChangeDescription,
  onChangeAreaName,
  onChangeAreaKey,
  onChangeSortOrder,
  onChangeWidth,
  onChangeHeight,
  onChangeBehaviorMode,
  onToggleZoomEnabled,
  onChangePlayerAvatarScale,
  onChangeMarkerScale,
  onChangeEntryToastTitle,
  onChangeEntryToastMessage,
  onChangeEntrySoundUrl,
  onChangeEntryVideoUrl,
  onSelectAreaKey,
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
  const areaOptions = getMiniMapAreaOptions(miniMaps);
  const visibleMiniMaps = selectedAreaKey === "all" ? miniMaps : miniMaps.filter((miniMap) => getMiniMapAreaKey(miniMap) === selectedAreaKey);
  const groupedMiniMaps = groupMiniMapsByArea(visibleMiniMaps);

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Mini Maps</Text>
      <Text style={styles.copy}>{isEditing ? "Editing an existing mini map. Save changes or cancel to return to creation." : "Create maps for towns, forests, dungeons, areas, or tutorials. Link one to an Area/Town Entrance marker to let players enter it."}</Text>
      <Text style={styles.label}>Area Filter</Text>
      <View style={styles.storyRoutePicker}>
        <Pressable style={[styles.routeChip, selectedAreaKey === "all" && styles.routeChipActive]} onPress={() => onSelectAreaKey("all")}>
          <Text style={styles.routeChipText}>All Areas</Text>
        </Pressable>
        {areaOptions.map((area) => (
          <Pressable key={area.key} style={[styles.routeChip, selectedAreaKey === area.key && styles.routeChipActive]} onPress={() => onSelectAreaKey(area.key)}>
            <Text style={styles.routeChipText}>{area.name}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={name} onChangeText={onChangeName} placeholder="Mini map name" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.modeRow}>
        <TextInput value={areaName} onChangeText={onChangeAreaName} placeholder="Area group, example Hearthland Woods" placeholderTextColor={colors.muted} style={[styles.input, styles.flexInput]} />
        <TextInput value={sortOrder} onChangeText={onChangeSortOrder} placeholder="Order" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.input, styles.smallInput]} />
      </View>
      <TextInput value={areaKey} onChangeText={onChangeAreaKey} placeholder="Area key optional, example hearthland-woods" placeholderTextColor={colors.muted} style={styles.input} />
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
      <Text style={styles.selectedTitle}>Player Behavior</Text>
      <Text style={styles.copy}>Choose how this mini map behaves for players. Admin editing remains scrollable.</Text>
      <View style={styles.storyRoutePicker}>
        {[
          { key: "scrollable", label: "Scrollable" },
          { key: "follow_player", label: "Follow Player" },
          { key: "fixed", label: "Fixed View" },
        ].map((option) => (
          <Pressable key={option.key} style={[styles.routeChip, behaviorMode === option.key && styles.routeChipActive]} onPress={() => onChangeBehaviorMode(option.key as MiniMap["behavior_mode"])}>
            <Text style={styles.routeChipText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={[styles.secondaryButton, zoomEnabled && styles.typeSelected]} onPress={onToggleZoomEnabled}>
        <Text style={styles.secondaryText}>Zoom Enabled: {zoomEnabled ? "Yes" : "No"}</Text>
      </Pressable>
      <View style={styles.modeRow}>
        <TextInput value={playerAvatarScale} onChangeText={onChangePlayerAvatarScale} placeholder="Player avatar scale, 1 normal" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.input, styles.flexInput]} />
        <TextInput value={markerScale} onChangeText={onChangeMarkerScale} placeholder="Marker scale, 1 normal" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.input, styles.flexInput]} />
      </View>
      <TextInput value={entryToastTitle} onChangeText={onChangeEntryToastTitle} placeholder="Entry toast title optional" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={entryToastMessage} onChangeText={onChangeEntryToastMessage} placeholder="Entry toast/message optional" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />
      <TextInput value={entrySoundUrl} onChangeText={onChangeEntrySoundUrl} placeholder="Entry sound URL optional future" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={entryVideoUrl} onChangeText={onChangeEntryVideoUrl} placeholder="Entry video/cinematic URL optional future" placeholderTextColor={colors.muted} style={styles.input} />
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
      {miniMaps.length > 0 && visibleMiniMaps.length === 0 ? <Text style={styles.copy}>No mini maps in this area filter.</Text> : null}
      {groupedMiniMaps.map((group) => (
        <View key={group.key} style={styles.areaGroup}>
          <Text style={styles.areaTitle}>{group.name}</Text>
          {group.maps.map((miniMap) => (
            <View key={miniMap.id} style={styles.storyCard}>
              <Text style={styles.markerName}>{miniMap.name}</Text>
              <Text style={styles.copy}>{miniMap.type} / {(miniMap.behavior_mode ?? "scrollable").replace("_", " ")} / Order {miniMap.sort_order ?? 0} / {miniMap.width ?? 900} x {miniMap.height ?? 650} / {miniMap.is_active ? "Active" : "Hidden"}</Text>
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
        </View>
      ))}
      <Text style={styles.debugLine}>Open a mini map to place spawn markers, sign posts, shops, encounters, and mini-map walking paths.</Text>
    </View>
  );
}

function getMiniMapAreaKey(miniMap: MiniMap) {
  return miniMap.area_key?.trim() || slugifyAreaName(miniMap.area_name || miniMap.type || "area");
}

function getMiniMapAreaName(miniMap: MiniMap) {
  return miniMap.area_name?.trim() || titleCase(miniMap.type || "Area");
}

function getMiniMapAreaOptions(miniMaps: MiniMap[]) {
  const byKey = new Map<string, { key: string; name: string }>();
  miniMaps.forEach((miniMap) => {
    const key = getMiniMapAreaKey(miniMap);
    if (!byKey.has(key)) {
      byKey.set(key, { key, name: getMiniMapAreaName(miniMap) });
    }
  });
  return Array.from(byKey.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function groupMiniMapsByArea(miniMaps: MiniMap[]) {
  const groups = new Map<string, { key: string; name: string; maps: MiniMap[] }>();
  miniMaps.forEach((miniMap) => {
    const key = getMiniMapAreaKey(miniMap);
    if (!groups.has(key)) {
      groups.set(key, { key, name: getMiniMapAreaName(miniMap), maps: [] });
    }
    groups.get(key)?.maps.push(miniMap);
  });
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      maps: group.maps.sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0) || left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function slugifyAreaName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "area";
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

const styles = StyleSheet.create({
  areaGroup: {
    borderColor: "rgba(218, 164, 65, 0.25)",
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 8,
  },
  areaTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    textTransform: "uppercase",
  },
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
  label: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 12,
    textTransform: "uppercase",
  },
  smallInput: {
    minWidth: 110,
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
