import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { Text, TextInput, View } from "react-native";
import { StoryFlagPicker } from "../dialogue/StoryFlagPicker";
import { dialogueAdminStyles as styles } from "../dialogue/dialogueAdminStyles";
import { colors } from "../theme";

type MarkerStoryFlagVisibilityEditorProps = {
  storyFlagKeys: string[];
  visibleStoryFlagKey: string;
  visibleStoryFlagValue: boolean;
  onChangeVisibleStoryFlagKey: (value: string) => void;
  onToggleVisibleStoryFlagValue: () => void;
  onClear: () => void;
};

export function MarkerStoryFlagVisibilityEditor({
  storyFlagKeys,
  visibleStoryFlagKey,
  visibleStoryFlagValue,
  onChangeVisibleStoryFlagKey,
  onToggleVisibleStoryFlagValue,
  onClear,
}: MarkerStoryFlagVisibilityEditorProps) {
  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Story Flag Visibility</Text>
      <Text style={styles.copy}>Optional: hide this marker until a per-player story flag matches. Use this for clues, quest markers, NPCs, entrances, and secret points of interest.</Text>
      <StoryFlagPicker flags={storyFlagKeys} selectedKey={visibleStoryFlagKey} onSelect={onChangeVisibleStoryFlagKey} />
      <TextInput
        value={visibleStoryFlagKey}
        onChangeText={onChangeVisibleStoryFlagKey}
        placeholder="Visible when flag key matches, example mara_missing_princess_started"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      {visibleStoryFlagKey.trim() ? (
        <>
          <Pressable style={[styles.secondaryButton, visibleStoryFlagValue && styles.typeSelected]} onPress={onToggleVisibleStoryFlagValue}>
            <Text style={styles.secondaryText}>Required Flag Value: {visibleStoryFlagValue ? "True" : "False"}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onClear}>
            <Text style={styles.secondaryText}>Clear Story Flag Gate</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.debugLine}>No story flag gate. This marker uses normal visibility, proximity, and lock rules.</Text>
      )}
    </View>
  );
}
