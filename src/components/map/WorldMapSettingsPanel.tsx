import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AdminImageUploadButton } from "../admin/AdminImageUploadButton";
import type { WorldMapSetting } from "../../services/mapService";
import { colors, fonts } from "../theme";

type WorldMapSettingsPanelProps = {
  setting: WorldMapSetting | null;
  name: string;
  draftImageUrl: string;
  notes: string;
  aspectRatio: string;
  width: string;
  height: string;
  isActive: boolean;
  activeImageUrl: string | null;
  onChangeName: (value: string) => void;
  onChangeDraftImageUrl: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onChangeAspectRatio: (value: string) => void;
  onChangeWidth: (value: string) => void;
  onChangeHeight: (value: string) => void;
  onToggleActive: () => void;
  onSaveDraft: () => void;
  onPublishDraft: () => void;
  onClearDraft: () => void;
  onRestoreDefault: () => void;
  onUploadMessage: (message: string) => void;
};

export function WorldMapSettingsPanel({
  setting,
  name,
  draftImageUrl,
  notes,
  aspectRatio,
  width,
  height,
  isActive,
  activeImageUrl,
  onChangeName,
  onChangeDraftImageUrl,
  onChangeNotes,
  onChangeAspectRatio,
  onChangeWidth,
  onChangeHeight,
  onToggleActive,
  onSaveDraft,
  onPublishDraft,
  onClearDraft,
  onRestoreDefault,
  onUploadMessage,
}: WorldMapSettingsPanelProps) {
  const previewUrl = draftImageUrl.trim() || activeImageUrl;

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.headerText}>
          <Text style={styles.sectionTitle}>World Map Image</Text>
          <Text style={styles.copy}>Change the overworld image without moving markers or paths. Best results use the same crop and aspect ratio as the current map.</Text>
        </View>
        <Pressable style={[styles.secondaryButton, isActive && styles.typeSelected]} onPress={onToggleActive}>
          <Text style={styles.secondaryText}>Active: {isActive ? "Yes" : "No"}</Text>
        </Pressable>
      </View>

      <TextInput value={name} onChangeText={onChangeName} placeholder="Map name" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={draftImageUrl} onChangeText={onChangeDraftImageUrl} placeholder="Draft map image URL or uploaded image URL" placeholderTextColor={colors.muted} style={styles.input} />
      <AdminImageUploadButton folder="world-maps" onUploaded={onChangeDraftImageUrl} onMessage={onUploadMessage} />
      <TextInput value={aspectRatio} onChangeText={onChangeAspectRatio} placeholder="Aspect ratio note, example current or 4:3" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.dimensionRow}>
        <TextInput value={width} onChangeText={onChangeWidth} placeholder="Map width, example 1800" placeholderTextColor={colors.muted} style={[styles.input, styles.dimensionInput]} />
        <TextInput value={height} onChangeText={onChangeHeight} placeholder="Map height, example 1400" placeholderTextColor={colors.muted} style={[styles.input, styles.dimensionInput]} />
      </View>
      <TextInput value={notes} onChangeText={onChangeNotes} placeholder="Admin notes" placeholderTextColor={colors.muted} style={[styles.input, styles.multiInput]} multiline />

      <View style={styles.previewBox}>
        <Text style={styles.selectedTitle}>Preview</Text>
        {previewUrl ? <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="cover" /> : <View style={styles.previewFallback}><Text style={styles.copy}>Using bundled default map.</Text></View>}
        <Text style={styles.debugLine}>Published: {activeImageUrl ? "Custom image" : "Bundled default"}</Text>
        <Text style={styles.debugLine}>Draft: {draftImageUrl.trim() ? "Ready to publish" : "None"}</Text>
        <Text style={styles.debugLine}>Canvas: {width || "1800"} x {height || "1400"}</Text>
      </View>

      <View style={styles.actionGrid}>
        <Pressable style={styles.secondaryButton} onPress={onSaveDraft}>
          <Text style={styles.secondaryText}>{setting ? "Save Draft Settings" : "Create Settings"}</Text>
        </Pressable>
        <Pressable style={[styles.primaryButton, !draftImageUrl.trim() && styles.disabledAction]} onPress={onPublishDraft} disabled={!draftImageUrl.trim()}>
          <Text style={styles.primaryText}>Publish Draft Image</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onClearDraft}>
          <Text style={styles.secondaryText}>Clear Draft</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onRestoreDefault}>
          <Text style={styles.dangerText}>Restore Bundled Default</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionGrid: {
    gap: 8,
  },
  copy: {
    color: colors.muted,
    lineHeight: 20,
  },
  dangerText: {
    color: colors.red,
    fontFamily: fonts.title,
    textAlign: "center",
  },
  debugLine: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  disabledAction: {
    opacity: 0.5,
  },
  dimensionInput: {
    flex: 1,
    minWidth: 140,
  },
  dimensionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  headerText: {
    flex: 1,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  multiInput: {
    minHeight: 86,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  panel: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  panelHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  previewBox: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  previewFallback: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 180,
  },
  previewImage: {
    borderRadius: 8,
    height: 220,
    width: "100%",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: 8,
    padding: 14,
  },
  primaryText: {
    color: "#050505",
    fontFamily: fonts.title,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  secondaryText: {
    color: colors.blue,
    fontFamily: fonts.title,
    textAlign: "center",
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 20,
    textTransform: "uppercase",
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
});
