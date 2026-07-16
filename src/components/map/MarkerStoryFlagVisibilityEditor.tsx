import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { Text, TextInput, View } from "react-native";
import { StoryFlagPicker } from "../dialogue/StoryFlagPicker";
import { dialogueAdminStyles as styles } from "../dialogue/dialogueAdminStyles";
import { colors } from "../theme";

type MarkerStoryFlagVisibilityEditorProps = {
  storyFlagKeys: string[];
  visibleStoryFlagKey: string;
  visibleStoryFlagValue: boolean;
  title?: string;
  description?: string;
  placeholder?: string;
  valueLabel?: string;
  clearLabel?: string;
  emptyText?: string;
  onChangeVisibleStoryFlagKey: (value: string) => void;
  onToggleVisibleStoryFlagValue: () => void;
  onClear: () => void;
};

export function MarkerStoryFlagVisibilityEditor({
  storyFlagKeys,
  visibleStoryFlagKey,
  visibleStoryFlagValue,
  title = "Story Flag Visibility",
  description = "Optional: hide this marker until a per-player story flag matches. Use this for clues, quest markers, NPCs, entrances, and secret points of interest.",
  placeholder = "Visible when flag key matches, example mara_missing_princess_started",
  valueLabel = "Required Flag Value",
  clearLabel = "Clear Story Flag Gate",
  emptyText = "No story flag gate. This marker uses normal visibility, proximity, and lock rules.",
  onChangeVisibleStoryFlagKey,
  onToggleVisibleStoryFlagValue,
  onClear,
}: MarkerStoryFlagVisibilityEditorProps) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>{title}</Text>
      <Text style={styles.copy}>{description}</Text>
      <StoryFlagPicker flags={storyFlagKeys} selectedKey={visibleStoryFlagKey} onSelect={onChangeVisibleStoryFlagKey} />
      <TextInput
        value={visibleStoryFlagKey}
        onChangeText={onChangeVisibleStoryFlagKey}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      {visibleStoryFlagKey.trim() ? (
        <>
          <Pressable style={[styles.secondaryButton, visibleStoryFlagValue && styles.typeSelected]} onPress={onToggleVisibleStoryFlagValue}>
            <Text style={styles.secondaryText}>{valueLabel}: {visibleStoryFlagValue ? "True" : "False"}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onClear}>
            <Text style={styles.secondaryText}>{clearLabel}</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.debugLine}>{emptyText}</Text>
      )}
    </View>
  );
}
