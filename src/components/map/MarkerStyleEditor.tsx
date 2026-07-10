import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { AdminImageUploadButton } from "../admin/AdminImageUploadButton";
import { colors } from "../theme";

type MarkerStyleEditorProps = {
  iconLabel: string;
  iconImage: string;
  iconColor: string;
  markerSize: string;
  uploadFolder: string;
  onChangeIconLabel: (value: string) => void;
  onChangeIconImage: (value: string) => void;
  onChangeIconColor: (value: string) => void;
  onChangeMarkerSize: (value: string) => void;
  onUploadMessage: (message: string) => void;
};

const sizePresets = [
  { label: "Small", value: "70" },
  { label: "Normal", value: "100" },
  { label: "Large", value: "130" },
  { label: "Boss", value: "170" },
];

export function MarkerStyleEditor({
  iconLabel,
  iconImage,
  iconColor,
  markerSize,
  uploadFolder,
  onChangeIconLabel,
  onChangeIconImage,
  onChangeIconColor,
  onChangeMarkerSize,
  onUploadMessage,
}: MarkerStyleEditorProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.selectedTitle}>Marker Icon / Size</Text>
      <Text style={styles.copy}>Size is a percent scale. 100 is normal, 130 is larger, 70 is smaller.</Text>
      <TextInput value={iconLabel} onChangeText={onChangeIconLabel} placeholder="Marker icon text, example MKT" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={iconImage} onChangeText={onChangeIconImage} placeholder="Marker icon image URL or asset path" placeholderTextColor={colors.muted} style={styles.input} />
      <AdminImageUploadButton folder={uploadFolder} onUploaded={onChangeIconImage} onMessage={onUploadMessage} />
      <TextInput value={iconColor} onChangeText={onChangeIconColor} placeholder="Marker icon color, example #d9a441" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={markerSize} onChangeText={onChangeMarkerSize} placeholder="Marker size percent, example 100" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.presetRow}>
        {sizePresets.map((preset) => (
          <Pressable key={preset.value} style={[styles.routeChip, markerSize === preset.value && styles.routeChipActive]} onPress={() => onChangeMarkerSize(preset.value)}>
            <Text style={styles.routeChipText}>{preset.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 8,
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
    fontWeight: "900",
    fontSize: 12,
  },
  selectedTitle: {
    color: colors.gold,
    fontWeight: "900",
  },
});
