import { GamePressable as Pressable } from "@/components/ui/GamePressable";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";

type MarkerTypeSelectorProps = {
  types: readonly string[];
  selectedType: string;
  onSelectType: (type: string) => void;
};

export function MarkerTypeSelector({ types, selectedType, onSelectType }: MarkerTypeSelectorProps) {
  return (
    <View style={styles.typeGrid}>
      {types.map((type) => (
        <Pressable key={type} style={[styles.typeButton, selectedType === type && styles.typeSelected]} onPress={() => onSelectType(type)}>
          <Text style={styles.typeText}>{type}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  typeButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeSelected: {
    backgroundColor: "rgba(21, 157, 220, 0.25)",
    borderColor: colors.blue,
  },
  typeText: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 12,
  },
});
