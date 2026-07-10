import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { Text, View } from "react-native";
import { dialogueAdminStyles as styles } from "./dialogueAdminStyles";

type StoryFlagPickerProps = {
  flags: string[];
  selectedKey: string;
  onSelect: (flagKey: string) => void;
};

export function StoryFlagPicker({ flags, selectedKey, onSelect }: StoryFlagPickerProps) {
  const normalizedFlags = Array.from(new Set(flags.map((flag) => flag.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  if (normalizedFlags.length === 0) {
    return (
      <View style={styles.storyEditor}>
        <Text style={styles.selectedTitle}>Known Story Flags</Text>
        <Text style={styles.copy}>No saved story flags found yet. Type a new flag key below, then it will appear here after it exists on another choice or marker.</Text>
      </View>
    );
  }

  return (
    <View style={styles.storyEditor}>
      <Text style={styles.selectedTitle}>Known Story Flags</Text>
      <Text style={styles.copy}>Tap a flag to reuse it. You can still type a new flag key manually.</Text>
      <View style={styles.storyRoutePicker}>
        {normalizedFlags.map((flag) => (
          <Pressable key={flag} style={[styles.routeChip, selectedKey.trim() === flag && styles.routeChipActive]} onPress={() => onSelect(flag)}>
            <Text style={styles.routeChipText}>{flag}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
